// Pixel iDevice icons: rasterises the Material Symbols of eXeLearning's Zen style onto a
// 16 × 16 grid and draws each pixel as a white teletext block with a black outline, so the
// icon reads on the black page, on the coloured panels and on the editor's white picker.
//   NODE_PATH=/path/to/exelearning/node_modules node scripts/pixel_icons.cjs /path/to/exelearning/public/files/perm/themes/base/zen/icons
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const GRID = 16;
const source = process.argv[2];
const target = path.join(__dirname, '../theme/icons');

(async () => {
  const icons = fs.readdirSync(source).filter(name => name.endsWith('.svg')).sort();
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  fs.mkdirSync(target, { recursive: true });
  for (const name of icons) {
    const svg = fs.readFileSync(path.join(source, name), 'utf8');
    const filled = await page.evaluate(async ({ svg, grid }) => {
      const image = new Image();
      image.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
      await image.decode();
      const canvas = Object.assign(document.createElement('canvas'), { width: grid, height: grid });
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, grid, grid);
      const alpha = context.getImageData(0, 0, grid, grid).data.filter((_, i) => i % 4 === 3);
      return Array.from(alpha, value => value >= 112);
    }, { svg, grid: GRID });
    fs.writeFileSync(path.join(target, name), pixelSvg(filled));
  }
  fs.copyFileSync(path.join(source, 'LICENSE.txt'), path.join(target, 'LICENSE.txt'));
  await browser.close();
  console.log(`Pixelated ${icons.length} icons into ${target}`);
})().catch(error => { console.error(error); process.exitCode = 1; });

// One cell of padding holds the outline; each colour is one path of horizontal runs.
function pixelSvg(filled) {
  const size = GRID + 2;
  const on = (x, y) => x >= 1 && y >= 1 && x <= GRID && y <= GRID && filled[(y - 1) * GRID + (x - 1)];
  const near = (x, y) => [-1, 0, 1].some(dy => [-1, 0, 1].some(dx => on(x + dx, y + dy)));
  const runs = test => {
    let d = '';
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!test(x, y)) continue;
        let end = x;
        while (end + 1 < size && test(end + 1, y)) end++;
        d += `M${x} ${y}h${end - x + 1}v1h-${end - x + 1}z`;
        x = end;
      }
    }
    return d;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size * 2}" height="${size * 2}" shape-rendering="crispEdges">`
    + `<path fill="#000" d="${runs((x, y) => !on(x, y) && near(x, y))}"/>`
    + `<path fill="#fff" d="${runs(on)}"/></svg>\n`;
}
