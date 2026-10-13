// Renders assets/icon.svg to the PNG sizes the manifest references.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';

const SIZES = [16, 32, 48, 128];
const svg = await readFile(new URL('../assets/icon.svg', import.meta.url));
const outDir = new URL('../public/icons/', import.meta.url);
await mkdir(outDir, { recursive: true });

for (const size of SIZES) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  await writeFile(new URL(`icon-${size}.png`, outDir), png);
  console.log(`icons/icon-${size}.png`);
}
