/* Сборка web-glb аватара мышц из Sketchfab-выгрузки Z-Anatomy Myology.
 *
 * Имена мешей в выгрузке потеряны (Object_N), поэтому 14 групп назначаются
 * ПРОСТРАНСТВЕННО — по мировому центроиду каждого меша (классификатор ниже).
 * LINES-меши (контуры-аннотации Z-Anatomy) выкидываются. Геометрия
 * упрощается (meshopt) и сжимается (draco) под web-бюджет.
 *
 * Режимы:
 *   BUILD_MODE=debug → красит каждый меш цветом группы (magenta = не
 *     классифицирован) для визуальной проверки в браузере.
 *   BUILD_MODE=final → именует меши ключом группы (резолвер-identity), один
 *     нейтральный материал (раскраска — в рантайме по нагрузке).
 *
 * Запуск:  node scripts/build-avatar-glb.mjs [src.gltf] [out.glb]
 */
import { NodeIO } from "@gltf-transform/core";
import { KHRDracoMeshCompression } from "@gltf-transform/extensions";
import { dedup, prune, simplify, weld } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import { MeshoptSimplifier } from "meshoptimizer";

const SRC = process.argv[2] ?? "C:/Users/Артём/Downloads/myology/scene.gltf";
const OUT = process.argv[3] ?? "public/models/muscles.glb";
const MODE = process.env.BUILD_MODE ?? "final";

const KEYS = [
  "chest", "back_lats", "back_traps", "shoulders_front", "shoulders_side",
  "shoulders_rear", "biceps", "triceps", "forearms", "core", "glutes",
  "quads", "hamstrings", "calves",
];

// Палитра для DEBUG (различимые цвета на группу) + magenta для null.
const DEBUG_COLORS = {
  chest: [0.9, 0.1, 0.1], back_lats: [0.1, 0.3, 0.9], back_traps: [0.1, 0.7, 0.9],
  shoulders_front: [0.95, 0.6, 0.1], shoulders_side: [0.95, 0.85, 0.1],
  shoulders_rear: [0.6, 0.4, 0.1], biceps: [0.1, 0.8, 0.2], triceps: [0.1, 0.5, 0.3],
  forearms: [0.4, 0.9, 0.6], core: [0.8, 0.2, 0.7], glutes: [0.5, 0.1, 0.8],
  quads: [0.2, 0.9, 0.9], hamstrings: [0.3, 0.3, 0.6], calves: [0.6, 0.6, 0.2],
  _null: [1, 0, 1],
};

// Оси модели (подтверждено рендером): up = Y, anterior(перёд) = +X,
// lateral(лево-право) = Z.
function classify(c, H) {
  const [x, y, z] = c;
  const h = y / H;
  const a = x; // anterior положительный
  const az = Math.abs(z); // боковое смещение
  if (h > 0.88) return null; // голова/череп/лицо
  // Дельты — высоко, есть боковое смещение
  if (h >= 0.74 && h <= 0.9 && az >= 0.045) {
    if (a > 0.02) return "shoulders_front";
    if (a < -0.02) return "shoulders_rear";
    return "shoulders_side";
  }
  // Руки — боковое смещение, ниже плеча
  if (az >= 0.05 && h >= 0.4 && h < 0.88) {
    if (h >= 0.56) return a >= 0 ? "biceps" : "triceps";
    return "forearms";
  }
  // Ноги — низ. Срединку (|a|<0.03) отдаём переду (видимая сторона).
  if (az < 0.06 && h < 0.47) {
    if (h < 0.22) return "calves";
    if (a < -0.03 && h > 0.4) return "glutes";
    return a >= -0.03 ? "quads" : "hamstrings";
  }
  // Торс — центр. Срединные меши (a около 0) → перёд, иначе серый провал
  // на прессе. Чёткий зад только при a < -0.03.
  if (az < 0.05 && h >= 0.43 && h <= 0.88) {
    if (h < 0.52 && a < -0.03) return "glutes";
    if (a >= -0.03) return h < 0.64 ? "core" : "chest";
    return h >= 0.7 ? "back_traps" : "back_lats";
  }
  return null;
}

// --- mat4 (column-major) helpers ---
const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mul(a, b) {
  const o = new Array(16);
  for (let r = 0; r < 4; r++)
    for (let cc = 0; cc < 4; cc++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[cc * 4 + k];
      o[cc * 4 + r] = s;
    }
  return o;
}
function apply(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

async function main() {
  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression])
    .registerDependencies({
      "draco3d.encoder": await draco3d.createEncoderModule(),
      "draco3d.decoder": await draco3d.createDecoderModule(),
    });

  const doc = await io.read(SRC);
  const root = doc.getRoot();

  // 1) Габариты для нормализации высоты.
  let gMax = [-1e9, -1e9, -1e9];
  const meshWorld = new Map(); // Mesh -> world center
  const scene = root.listScenes()[0];
  const walk = (node, parentWorld) => {
    const world = mul(parentWorld, node.getMatrix());
    const mesh = node.getMesh();
    if (mesh) {
      const prim = mesh.listPrimitives()[0];
      const pos = prim?.getAttribute("POSITION");
      if (pos) {
        const mn = pos.getMinNormalized([]);
        const mx = pos.getMaxNormalized([]);
        let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
        for (let xi = 0; xi < 2; xi++)
          for (let yi = 0; yi < 2; yi++)
            for (let zi = 0; zi < 2; zi++) {
              const p = apply(world, [xi ? mx[0] : mn[0], yi ? mx[1] : mn[1], zi ? mx[2] : mn[2]]);
              for (let k = 0; k < 3; k++) {
                lo[k] = Math.min(lo[k], p[k]);
                hi[k] = Math.max(hi[k], p[k]);
              }
            }
        const center = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
        meshWorld.set(mesh, center);
        for (let k = 0; k < 3; k++) gMax[k] = Math.max(gMax[k], hi[k]);
      }
    }
    for (const ch of node.listChildren()) walk(ch, world);
  };
  for (const r of scene.listChildren()) walk(r, IDENT);
  const H = gMax[1];

  // 2) Материалы по режиму.
  const matByGroup = new Map();
  const neutral = doc.createMaterial("neutral").setBaseColorFactor([0.48, 0.48, 0.45, 1]);
  function materialFor(group) {
    if (MODE !== "debug") return neutral;
    const key = group ?? "_null";
    if (!matByGroup.has(key)) {
      const [r, g, b] = DEBUG_COLORS[key];
      matByGroup.set(key, doc.createMaterial("dbg_" + key).setBaseColorFactor([r, g, b, 1]));
    }
    return matByGroup.get(key);
  }

  // 3) Обработка мешей: выкинуть LINES, классифицировать, назначить материал/имя.
  const counts = {};
  let removed = 0, kept = 0;
  for (const mesh of root.listMeshes()) {
    // удалить не-TRIANGLES примитивы (4 = TRIANGLES)
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== 4) {
        prim.dispose();
        removed++;
      }
    }
    if (mesh.listPrimitives().length === 0) {
      mesh.dispose();
      continue;
    }
    const center = meshWorld.get(mesh);
    const group = center ? classify(center, H) : null;
    if (group) counts[group] = (counts[group] || 0) + 1;
    kept++;
    const mat = materialFor(group);
    for (const prim of mesh.listPrimitives()) prim.setMaterial(mat);
    mesh.setName(group ?? "unmapped");
  }

  // имена нод = имена их мешей (three берёт name с ноды) — резолвер по identity.
  for (const node of root.listNodes()) {
    const m = node.getMesh();
    if (m) node.setName(m.getName());
  }

  // 4) Оптимизация геометрии.
  await MeshoptSimplifier.ready;
  await doc.transform(
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: 0.25, error: 0.008 }),
    dedup(),
    prune(),
  );

  // 5) Draco-сжатие.
  doc.createExtension(KHRDracoMeshCompression).setRequired(true);

  await io.write(OUT, doc);

  console.log("MODE:", MODE);
  console.log("meshes kept:", kept, "| LINES prims removed:", removed);
  console.log("height H:", H.toFixed(3));
  for (const k of KEYS) console.log("  " + k.padEnd(16), counts[k] || 0);
  const missing = KEYS.filter((k) => !counts[k]);
  console.log("MISSING:", missing.length ? missing.join(", ") : "none");
  console.log("wrote", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
