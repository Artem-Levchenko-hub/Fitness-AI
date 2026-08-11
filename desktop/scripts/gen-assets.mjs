import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { Jimp } from 'jimp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = (f) => path.join(root, 'assets-src', f);
const out = (f) => path.join(root, 'build', f);

async function imageToPng(imagePath, w, h) {
  const buf = await readFile(imagePath);
  return sharp(buf, { density: 384 }).resize(w, h, { fit: 'fill' }).png().toBuffer();
}

async function svgToPng(svgPath, w, h) {
  return imageToPng(svgPath, w, h);
}

async function svgToBmp(svgPath, w, h, dest) {
  const png = await svgToPng(svgPath, w, h);
  const img = await Jimp.read(png);
  await img.write(dest); // extension .bmp -> 24-bit BMP
  console.log('bmp', dest, `${w}x${h}`);
}

await mkdir(out('.'), { recursive: true });

// App icon -> multi-size .ico
const icoSizes = [256, 128, 64, 48, 32, 16];
const icoPngs = await Promise.all(icoSizes.map((s) => imageToPng(src('icon.png'), s, s)));
await writeFile(out('icon.ico'), await pngToIco(icoPngs));
console.log('ico  icon.ico', icoSizes.join(','));

// NSIS installer images (exact dims, BMP)
await svgToBmp(src('sidebar.svg'), 164, 314, out('sidebar.bmp'));
await svgToBmp(src('header.svg'), 150, 57, out('header.bmp'));

console.log('DONE');
