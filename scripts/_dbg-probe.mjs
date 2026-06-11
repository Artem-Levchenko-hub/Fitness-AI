/* Эфемерный пробник классификатора аватара. Повторяет walk из
 * build-avatar-glb.mjs, применяет ту же classify() и печатает по-групповые
 * границы центроидов + детально шею/плечи. НЕ для прода. Запуск:
 *   node scripts/_dbg-probe.mjs [src.gltf] */
import { NodeIO } from "@gltf-transform/core";

const SRC = process.argv[2] ?? "C:/Users/Артём/Downloads/myology/scene.gltf";

// === КОПИЯ classify() из build-avatar-glb.mjs (держать в синхроне) ===
function classify(c, H) {
  const [x, y, z] = c;
  const h = y / H;
  const ant = z;
  const lat = Math.abs(x);
  if (h > 0.88) return null;
  if (h >= 0.76 && lat >= 0.066) {
    if (ant > 0.0) return "shoulders_front";
    if (ant < -0.03) return "shoulders_rear";
    return "shoulders_side";
  }
  if (lat >= 0.11) {
    if (h >= 0.5) return ant >= 0 ? "biceps" : "triceps";
    return "forearms";
  }
  if (h >= 0.4 && h < 0.54 && ant < -0.012) return "glutes";
  if (h < 0.46) {
    if (h < 0.2) return "calves";
    return ant >= -0.012 ? "quads" : "hamstrings";
  }
  if (ant >= -0.012) return h < 0.63 ? "core" : "chest";
  return h >= 0.68 ? "back_traps" : "back_lats";
}

const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const mul = (a, b) => {
  const o = new Array(16);
  for (let r = 0; r < 4; r++)
    for (let cc = 0; cc < 4; cc++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[cc * 4 + k];
      o[cc * 4 + r] = s;
    }
  return o;
};
const apply = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
];

const io = new NodeIO();
const doc = await io.read(SRC);
const scene = doc.getRoot().listScenes()[0];

const centers = [];
let H = 0;
const walk = (node, pw) => {
  const world = mul(pw, node.getMatrix());
  const mesh = node.getMesh();
  const prim = mesh?.listPrimitives()[0];
  const pos = prim?.getAttribute("POSITION");
  if (mesh && pos && prim.getMode() === 4) {
    const mn = pos.getMinNormalized([]);
    const mx = pos.getMaxNormalized([]);
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (let xi = 0; xi < 2; xi++)
      for (let yi = 0; yi < 2; yi++)
        for (let zi = 0; zi < 2; zi++) {
          const p = apply(world, [xi ? mx[0] : mn[0], yi ? mx[1] : mn[1], zi ? mx[2] : mn[2]]);
          for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
        }
    centers.push({ c: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2], lo, hi });
    H = Math.max(H, hi[1]);
  }
  for (const ch of node.listChildren()) walk(ch, world);
};
for (const r of scene.listChildren()) walk(r, IDENT);

const f = (n) => n.toFixed(3);
const groups = {};
for (const m of centers) {
  const g = classify(m.c, H) ?? "unmapped";
  (groups[g] ??= []).push(m);
}
console.log("H", f(H), "| meshes", centers.length);
for (const [g, arr] of Object.entries(groups)) {
  const hs = arr.map((m) => m.c[1] / H);
  const zs = arr.map((m) => m.c[2]);
  const ls = arr.map((m) => Math.abs(m.c[0]));
  const rng = (a) => `${f(Math.min(...a))}..${f(Math.max(...a))}`;
  console.log(`${g.padEnd(16)} n=${String(arr.length).padStart(3)}  h ${rng(hs)}  ant ${rng(zs)}  lat ${rng(ls)}`);
}

// Детально: шея/верх-грудь (h 0.74-0.90, lat<0.07) — откуда «золотая» шапка.
console.log("\n-- neck/upper-sternum region (h 0.74-0.90, lat<0.07) --");
for (const m of centers) {
  const h = m.c[1] / H, lat = Math.abs(m.c[0]);
  if (h >= 0.74 && h <= 0.9 && lat < 0.07) {
    console.log(`  h ${f(h)} ant ${f(m.c[2])} lat ${f(lat)} → ${classify(m.c, H)}  (yspan ${f(m.hi[1] - m.lo[1])})`);
  }
}
