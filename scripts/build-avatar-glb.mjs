/* Сборка web-glb аватара мышц из Sketchfab-выгрузки Z-Anatomy Myology.
 *
 * Имена мешей в выгрузке потеряны (Object_N), поэтому 14 групп назначаются
 * ПРОСТРАНСТВЕННО — по мировому центроиду каждого меша (классификатор ниже).
 * LINES-меши (контуры-аннотации Z-Anatomy) выкидываются.
 *
 * Затем меши КАЖДОЙ группы сливаются в один меш (joinPrimitives по группе) →
 * ~15 draw calls вместо ~275. Слитый меш именуется ключом группы, поэтому
 * рантайм-резолвер (lib/avatar/muscle-mesh-map) сводит его к группе по identity,
 * красит по нагрузке и ловит тап — «шов модели» сохраняется. Геометрия
 * упрощается (meshopt) и сжимается (draco) под web-бюджет.
 *
 * Оси модели (подтверждено рендером + пробником scripts/_dbg-probe):
 *   up = Y,  anterior(перёд) = +Z,  lateral(лево-право) = X.
 *
 * Режимы:
 *   BUILD_MODE=debug → красит каждую группу своим цветом (magenta = не
 *     классифицирован), пропускает simplify/draco для быстрой визуальной
 *     проверки классификации в браузере (scripts/_dbg-serve + public/_dbg.html).
 *   BUILD_MODE=final → один нейтральный материал (раскраска — в рантайме по
 *     нагрузке), simplify + draco.
 *
 * Запуск:  node scripts/build-avatar-glb.mjs [src.gltf] [out.glb]
 */
import { NodeIO } from "@gltf-transform/core";
import { KHRDracoMeshCompression } from "@gltf-transform/extensions";
import {
  dedup,
  joinPrimitives,
  prune,
  simplify,
  transformMesh,
  weld,
} from "@gltf-transform/functions";
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
  unmapped: [1, 0, 1],
};

// Классификатор: мировой центроид меша → группа (или null = выкинуть).
// h — доля высоты [0,1]; ant — глубина (перёд +); lat — расстояние от средней
// линии. Пороги подобраны по пробнику (scripts/_dbg-probe) и визуальному циклу.
function classify(c, H) {
  const [x, y, z] = c;
  const h = y / H;
  const ant = z; // перёд > 0, зад < 0
  const lat = Math.abs(x); // боковое смещение от средней линии

  if (h > 0.88) return null; // голова/череп/лицо

  // Плечи/дельты — верхняя боковая «шапка» (высоко + боковое смещение).
  if (h >= 0.76 && lat >= 0.066) {
    if (ant > 0.0) return "shoulders_front";
    if (ant < -0.03) return "shoulders_rear";
    return "shoulders_side";
  }

  // Руки — боковое смещение от торса. Выше локтя → бицепс(перёд)/трицепс(зад),
  // ниже → предплечье/кисть.
  if (lat >= 0.11) {
    if (h >= 0.5) return ant >= 0 ? "biceps" : "triceps";
    return "forearms";
  }

  // Ягодицы — задняя «шапка» таза (зад, на стыке торса и бедра).
  if (h >= 0.4 && h < 0.54 && ant < -0.012) return "glutes";

  // Ноги.
  if (h < 0.46) {
    if (h < 0.2) return "calves";
    return ant >= -0.012 ? "quads" : "hamstrings"; // перёд/зад бедра
  }

  // Торс по центру: перёд = пресс(низ)/грудь(верх), зад = трапеции/широчайшие.
  if (ant >= -0.012) return h < 0.63 ? "core" : "chest";
  return h >= 0.68 ? "back_traps" : "back_lats";
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

// Мировой центроид (AABB-центр) и мировая матрица каждого меша. Меш в этой
// выгрузке привязан к одной ноде (1:1), поэтому одной матрицы достаточно.
function collectMeshWorlds(scene) {
  const out = new Map(); // Mesh -> { center, matrix }
  let H = 0;
  const walk = (node, parentWorld) => {
    const world = mul(parentWorld, node.getMatrix());
    const mesh = node.getMesh();
    const prim = mesh?.listPrimitives()[0];
    const pos = prim?.getAttribute("POSITION");
    if (mesh && pos) {
      const mn = pos.getMinNormalized([]);
      const mx = pos.getMaxNormalized([]);
      let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      for (let xi = 0; xi < 2; xi++)
        for (let yi = 0; yi < 2; yi++)
          for (let zi = 0; zi < 2; zi++) {
            const p = apply(world, [xi ? mx[0] : mn[0], yi ? mx[1] : mn[1], zi ? mx[2] : mn[2]]);
            for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
          }
      out.set(mesh, {
        center: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2],
        matrix: world,
      });
      H = Math.max(H, hi[1]);
    }
    for (const ch of node.listChildren()) walk(ch, world);
  };
  for (const r of scene.listChildren()) walk(r, IDENT);
  return { meshWorlds: out, H };
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
  const scene = root.listScenes()[0];

  const { meshWorlds, H } = collectMeshWorlds(scene);

  // Материалы по режиму. final → один нейтральный (рантайм перекрашивает).
  // debug → свой цвет на группу (для визуальной проверки классификации).
  const matByGroup = new Map();
  const neutral = doc.createMaterial("neutral").setBaseColorFactor([0.48, 0.48, 0.45, 1]);
  function materialFor(groupKey) {
    if (MODE !== "debug") return neutral;
    if (!matByGroup.has(groupKey)) {
      const [r, g, b] = DEBUG_COLORS[groupKey];
      matByGroup.set(groupKey, doc.createMaterial("dbg_" + groupKey).setBaseColorFactor([r, g, b, 1]));
    }
    return matByGroup.get(groupKey);
  }

  // 1) Классификация + запекание мировой матрицы + бакетирование примитивов по
  //    группе. Не-TRIANGLES примитивы (LINES-аннотации) и атрибуты кроме
  //    POSITION/NORMAL выкидываем (нужно для совместимости при join и под бюджет).
  const buckets = new Map(); // groupKey -> Primitive[]
  const counts = {};
  let removedLines = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== 4) { prim.dispose(); removedLines++; }
    }
    if (mesh.listPrimitives().length === 0) { mesh.dispose(); continue; }

    const world = meshWorlds.get(mesh);
    const group = world ? classify(world.center, H) : null;
    const key = group ?? "unmapped";
    if (group) counts[group] = (counts[group] || 0) + 1;

    if (world) transformMesh(mesh, world.matrix); // запечь в мировые координаты
    const mat = materialFor(key);
    for (const prim of mesh.listPrimitives()) {
      for (const semantic of prim.listSemantics()) {
        if (semantic !== "POSITION" && semantic !== "NORMAL") prim.setAttribute(semantic, null);
      }
      prim.setMaterial(mat);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(prim);
    }
  }

  // 2) Слить примитивы каждой группы в один меш, назвать ключом группы. Новые
  //    ноды на identity (матрицы уже запечены). Старую сцену сносим.
  const oldNodes = root.listNodes();
  const oldMeshes = root.listMeshes();
  for (const [key, prims] of buckets) {
    const merged = prims.length === 1 ? prims[0] : joinPrimitives(prims);
    const mesh = doc.createMesh(key).addPrimitive(merged);
    const node = doc.createNode(key).setMesh(mesh);
    scene.addChild(node);
  }
  for (const n of oldNodes) n.dispose();
  for (const m of oldMeshes) m.dispose();

  // 3) Оптимизация геометрии (только final — debug грузим как есть, быстрее).
  if (MODE !== "debug") {
    await MeshoptSimplifier.ready;
    await doc.transform(
      weld(),
      simplify({ simplifier: MeshoptSimplifier, ratio: 0.25, error: 0.008 }),
      dedup(),
      prune(),
    );
    doc.createExtension(KHRDracoMeshCompression).setRequired(true);
  } else {
    await doc.transform(prune());
  }

  await io.write(OUT, doc);

  console.log("MODE:", MODE);
  console.log("groups (meshes):", buckets.size, "| LINES prims removed:", removedLines);
  console.log("height H:", H.toFixed(3));
  for (const k of KEYS) console.log("  " + k.padEnd(16), counts[k] || 0);
  const missing = KEYS.filter((k) => !counts[k]);
  console.log("MISSING:", missing.length ? missing.join(", ") : "none");
  console.log("unmapped meshes:", (buckets.get("unmapped") || []).length);
  console.log("wrote", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
