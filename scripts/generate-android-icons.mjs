import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const source = 'public/icon.svg';
const res = 'android/app/src/main/res';
const iconSvg = await readFile(source);

const LEGACY = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const FOREGROUND = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
const SPLASH = {
  'drawable-land-mdpi': [480, 320],
  'drawable-land-hdpi': [800, 480],
  'drawable-land-xhdpi': [1280, 720],
  'drawable-land-xxhdpi': [1600, 960],
  'drawable-land-xxxhdpi': [1920, 1280],
  'drawable-port-mdpi': [320, 480],
  'drawable-port-hdpi': [480, 800],
  'drawable-port-xhdpi': [720, 1280],
  'drawable-port-xxhdpi': [960, 1600],
  'drawable-port-xxxhdpi': [1280, 1920],
};

async function render(size) {
  return sharp(iconSvg, { density: Math.max(72, Math.ceil((size / 512) * 72 * 8)) })
    .resize(size, size)
    .png()
    .toBuffer();
}

for (const [density, size] of Object.entries(LEGACY)) {
  const dir = `${res}/mipmap-${density}`;
  await sharp(await render(size)).toFile(`${dir}/ic_launcher.png`);

  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
  );
  await sharp(await render(size))
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toFile(`${dir}/ic_launcher_round.png`);
}

for (const [density, size] of Object.entries(FOREGROUND)) {
  const contentSize = Math.round(size * 0.78);
  const content = await sharp(iconSvg, { density: 600 }).resize(contentSize, contentSize).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: content, gravity: 'center' }])
    .png()
    .toFile(`${res}/mipmap-${density}/ic_launcher_foreground.png`);
}

for (const [dir, [width, height]] of Object.entries(SPLASH)) {
  const side = Math.round(Math.min(width, height) * 0.32);
  const icon = await sharp(iconSvg, { density: 600 }).resize(side, side).png().toBuffer();
  await sharp({
    create: { width, height, channels: 4, background: '#F3EFE8' },
  })
    .composite([{ input: icon, gravity: 'center' }])
    .png()
    .toFile(`${res}/${dir}/splash.png`);
}

console.log('Android icons and splash images generated');
