/* Снимок фактических имён узлов/мешей аватар-glb → коммит-фикстура.
 *
 * H11.5 — аудит покрытия классификации мышц. Резолвер resolveMuscleKey
 * (lib/avatar/muscle-mesh-map.ts) сводит имена мешей реальной модели к нашим 14
 * группам; чтобы тест ловил тихое выпадение группы из heat→prompt-пути на
 * РЕАЛЬНЫХ именах (а не выдуманных), список имён берётся из самого glb и
 * коммитится как фикстура. Перегенерировать после любого переэкспорта модели:
 *
 *   node scripts/dump-avatar-mesh-names.mjs [src.glb] [out.json]
 *
 * Имя берём с УЗЛА (glTF node) — именно node.name становится Mesh.name в
 * three.js (GLTFLoader), а резолвер в рантайме видит obj.name меша
 * (MuscleModel.tsx:50). Так фикстура = ровно то, что классифицируется живьём.
 */
import { writeFileSync } from "node:fs";

import { NodeIO } from "@gltf-transform/core";
import { KHRDracoMeshCompression } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";

const SRC = process.argv[2] ?? "public/models/muscles.glb";
const OUT = process.argv[3] ?? "lib/avatar/muscle-mesh-names.fixture.json";

const io = new NodeIO()
  .registerExtensions([KHRDracoMeshCompression])
  .registerDependencies({ "draco3d.decoder": await draco3d.createDecoderModule() });

const doc = await io.read(SRC);
const names = doc
  .getRoot()
  .listNodes()
  .filter((n) => n.getMesh())
  .map((n) => n.getName())
  .sort((a, b) => a.localeCompare(b));

writeFileSync(
  OUT,
  JSON.stringify({ generatedFrom: SRC, meshNodeNames: names }, null, 2) + "\n",
);
console.log(`Wrote ${names.length} mesh-node names → ${OUT}`);
