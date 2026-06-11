/* Сборка web-glb аватара из ИМЕНОВАННОЙ модели Z-Anatomy «Muscular system».
 *
 * Вход: muscles_named.glb (экспорт коллекции «4: Muscular system» из Z-Anatomy
 * Startup.blend, 789 мешей с анатомическими TA2-именами, draco). Здесь каждый
 * меш классифицируется ПО ИМЕНИ (точно, не по координатам) в одну из 14 групп
 * расширенным резолвером; соединительная ткань (фасции/бурсы/сухожилия) и
 * неконтрактильные мелочи отбрасываются. Меши группы сливаются (joinPrimitives)
 * → 14 мешей, названных ключом группы → рантайм-резолвер красит по нагрузке.
 *
 * Запуск: node scripts/build-avatar-from-named.mjs [src.glb] [out.glb]
 */
import { NodeIO } from "@gltf-transform/core";
import { KHRDracoMeshCompression } from "@gltf-transform/extensions";
import {
  dedup,
  joinPrimitives,
  prune,
  simplify,
  weld,
} from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import { MeshoptSimplifier } from "meshoptimizer";

const SRC = process.argv[2] ?? "C:/Users/Артём/Downloads/zanatomy/muscles_named.glb";
const OUT = process.argv[3] ?? "public/models/muscles.glb";

const KEYS = [
  "chest", "back_lats", "back_traps", "shoulders_front", "shoulders_side",
  "shoulders_rear", "biceps", "triceps", "forearms", "core", "glutes",
  "quads", "hamstrings", "calves",
];

// Соединительная ткань / не-мышцы — отбрасываем, даже если имя содержит мышцу.
const CONNECTIVE = [
  "fascia", "bursa", "sheath", "septum", "retinacul", "aponeuros", "ligament",
  "tendon", "raphe", "membrane", "capsule", "trochlea", "sesamoid",
  "compartment", "investing", "subcutaneous",
];

// Правила имя→группа, специфичное → общее. Все токены должны присутствовать.
const RULES = [
  [["rectus", "femoris"], "quads"], [["vastus"], "quads"], [["quadriceps"], "quads"],
  [["sartorius"], "quads"], [["adductor"], "quads"], [["pectineus"], "quads"], [["gracilis"], "quads"],
  [["biceps", "femoris"], "hamstrings"], [["semitendinosus"], "hamstrings"],
  [["semimembranosus"], "hamstrings"], [["hamstring"], "hamstrings"],
  [["triceps", "surae"], "calves"], [["gastrocnemius"], "calves"], [["soleus"], "calves"],
  [["tibialis"], "calves"], [["fibularis"], "calves"], [["peroneus"], "calves"], [["plantaris"], "calves"],
  [["biceps", "brachii"], "biceps"], [["brachialis"], "biceps"],
  [["triceps", "brachii"], "triceps"], [["anconeus"], "triceps"],
  [["brachioradialis"], "forearms"], [["flexor"], "forearms"], [["extensor"], "forearms"],
  [["pronator"], "forearms"], [["supinator"], "forearms"], [["palmaris"], "forearms"],
  [["latissimus"], "back_lats"], [["teres", "major"], "back_lats"], [["erector"], "back_lats"],
  [["iliocostalis"], "back_lats"], [["longissimus"], "back_lats"], [["spinalis"], "back_lats"],
  [["multifidus"], "back_lats"], [["quadratus", "lumborum"], "back_lats"],
  [["trapezius"], "back_traps"], [["rhomboid"], "back_traps"], [["levator", "scapulae"], "back_traps"],
  [["splenius"], "back_traps"], [["sternocleidomastoid"], "back_traps"],
  [["infraspinatus"], "shoulders_rear"], [["teres", "minor"], "shoulders_rear"],
  [["supraspinatus"], "shoulders_rear"], [["posterior", "deltoid"], "shoulders_rear"],
  [["scapular", "deltoid"], "shoulders_rear"],
  [["anterior", "deltoid"], "shoulders_front"], [["clavicular", "deltoid"], "shoulders_front"],
  [["acromial", "deltoid"], "shoulders_side"], [["deltoid"], "shoulders_side"],
  [["pectoralis"], "chest"], [["pectoral"], "chest"],
  [["serratus", "anterior"], "core"], [["rectus", "abdominis"], "core"], [["abdominis"], "core"],
  [["oblique"], "core"], [["transversus"], "core"], [["abdominal"], "core"],
  [["gluteus"], "glutes"], [["gluteal"], "glutes"],
  [["biceps"], "biceps"], [["triceps"], "triceps"], [["quad"], "quads"],
];
// Мелкие intrinsics кисти/стопы и большого пальца — не «качковые» группы,
// сбивают регион и клики. Дропаем по имени (форму предплечья всё равно держат
// carpi/digitorum/brachioradialis/pronator).
const DROP_INTRINSIC = [
  "of hand", "lumbric", "interosse", "opponens", "indicis", "pollicis",
  "palmaris brevis", "abductor digiti",
];
const SIDE = new Set(["l", "r", "j", "left", "right", "lr", "musclel", "muscler", "musclej"]);
function tokenize(name) {
  return name.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t && !SIDE.has(t) && !/^\d+$/.test(t));
}
function resolveByName(name) {
  const low = name.toLowerCase();
  if (CONNECTIVE.some((c) => low.includes(c))) return null;
  if (DROP_INTRINSIC.some((c) => low.includes(c))) return null;
  const ts = new Set(tokenize(name));
  for (const [toks, key] of RULES) if (toks.every((t) => ts.has(t))) return key;
  return null;
}

const ARM_GROUPS = new Set(["biceps", "triceps", "forearms"]);
const LEG_GROUPS = new Set(["quads", "hamstrings", "calves"]);

/** Гард по положению: имя даёт идентичность мышцы, но РЕГИОН тела решает
 *  высота центроида. Чинит главную ошибку — стопные/голеностопные flexor/
 *  extensor/adductor («…longus», «…hallucis», «adductor hallucis»), которые по
 *  имени уходили в forearms/quads, а по факту это низ ноги. anterior = +Z. */
function classify(name, centroid, H) {
  const g = resolveByName(name);
  if (!g) return null;
  const hf = centroid[1] / H; // доля высоты [0..1]
  const z = centroid[2]; // глубина, перёд > 0
  if (ARM_GROUPS.has(g) && hf < 0.45) {
    // на самом деле низ тела (стопа/голень/бедро)
    if (hf < 0.28) return "calves";
    return z >= 0 ? "quads" : "hamstrings";
  }
  if (LEG_GROUPS.has(g)) {
    if (hf < 0.22) return "calves"; // стопа/голеностоп
    if (hf > 0.55) return "forearms"; // ошибочно «в руку»
  }
  return g;
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

  const neutral = doc.createMaterial("neutral").setBaseColorFactor([0.48, 0.48, 0.45, 1]);

  // Классификация ПО ИМЕНИ НОДЫ + запекание мировой матрицы + бакеты по группе.
  // Геометрия уже запечена в world-координаты в Blender (make_single_user +
  // transform_apply, ноды identity) → centroid = центр AABB меша (min/max
  // POSITION уже в мире). Трансформы тут НЕ применяем.
  const meshNodes = [];
  const collect = (node) => {
    const mesh = node.getMesh();
    if (mesh) {
      let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        if (!pos) continue;
        const mn = pos.getMinNormalized([]), mx = pos.getMaxNormalized([]);
        for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], mn[k]); hi[k] = Math.max(hi[k], mx[k]); }
      }
      const centroid = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
      meshNodes.push({ node, mesh, name: node.getName(), centroid, maxY: hi[1] });
    }
    for (const ch of node.listChildren()) collect(ch);
  };
  for (const r of scene.listChildren()) collect(r);
  const H = Math.max(...meshNodes.map((m) => m.maxY));

  const buckets = new Map();
  const counts = {};
  let dropped = 0;
  for (const mn of meshNodes) {
    const group = classify(mn.name, mn.centroid, H);
    if (!group) { dropped++; continue; }
    counts[group] = (counts[group] || 0) + 1;
    for (const prim of mn.mesh.listPrimitives()) {
      for (const sem of prim.listSemantics())
        if (sem !== "POSITION" && sem !== "NORMAL") prim.setAttribute(sem, null);
      prim.setMaterial(neutral);
      if (!buckets.has(group)) buckets.set(group, []);
      buckets.get(group).push(prim);
    }
  }

  const oldNodes = root.listNodes();
  const oldMeshes = root.listMeshes();
  for (const [key, prims] of buckets) {
    const merged = prims.length === 1 ? prims[0] : joinPrimitives(prims);
    const mesh = doc.createMesh(key).addPrimitive(merged);
    scene.addChild(doc.createNode(key).setMesh(mesh));
  }
  for (const n of oldNodes) n.dispose();
  for (const m of oldMeshes) m.dispose();

  await MeshoptSimplifier.ready;
  await doc.transform(
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: 0.4, error: 0.005 }),
    dedup(),
    prune(),
  );
  doc.createExtension(KHRDracoMeshCompression).setRequired(true);
  await io.write(OUT, doc);

  console.log("groups:", buckets.size, "dropped(non-muscle):", dropped);
  for (const k of KEYS) console.log("  " + k.padEnd(16), counts[k] || 0);
  console.log("MISSING:", KEYS.filter((k) => !counts[k]).join(", ") || "none");
  console.log("wrote", OUT);
}
main().catch((e) => { console.error(e); process.exit(1); });
