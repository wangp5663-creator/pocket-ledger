import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const source = 'public/icon.svg';
await mkdir('public/icons', { recursive: true });
await sharp(source).resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp(source).resize(512, 512).png().toFile('public/icons/icon-512.png');

const padded = await sharp({
  create: { width: 512, height: 512, channels: 4, background: '#10B981' },
})
  .composite([{ input: await sharp(source).resize(384, 384).png().toBuffer(), gravity: 'center' }])
  .png()
  .toBuffer();

await sharp(padded).toFile('public/icons/icon-maskable-512.png');
console.log('icons generated');
