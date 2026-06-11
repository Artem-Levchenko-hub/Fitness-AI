/* Эфемерный статик-сервер для визуальной отладки аватара (BUILD_MODE=debug).
 * Отдаёт корень репозитория, чтобы _dbg.html импортил локальный three +
 * аддоны + draco-декодер из node_modules (без CDN). НЕ для прода — временный
 * инструмент классификационного цикла. Запуск: node scripts/_dbg-serve.mjs */
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const ROOT = process.cwd();
const PORT = Number(process.env.DBG_PORT ?? 5599);
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".wasm": "application/wasm",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".bin": "application/octet-stream",
  ".json": "application/json",
};

createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const safe = normalize(url).replace(/^(\.\.[/\\])+/, "");
  const path = join(ROOT, safe);
  try {
    const st = statSync(path);
    if (st.isDirectory()) {
      res.writeHead(403).end("dir");
      return;
    }
    res.writeHead(200, {
      "content-type": MIME[extname(path).toLowerCase()] ?? "application/octet-stream",
      "access-control-allow-origin": "*",
    });
    createReadStream(path).pipe(res);
  } catch {
    res.writeHead(404).end("not found: " + safe);
  }
}).listen(PORT, () => console.log(`dbg server: http://localhost:${PORT}/public/_dbg.html`));
