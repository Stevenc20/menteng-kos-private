const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const OUT = 'public/img/opt';
fs.mkdirSync(OUT, { recursive: true });

const TARGETS = [
  {
    src: 'reference/20250705_085309.jpg',      // properti-1 (landscape)
    name: 'p1',
    widths: [384, 640, 1024],
    quality: 80,
  },
  {
    src: 'reference/20250705_085331.jpg',      // properti-2 (landscape)
    name: 'p2',
    widths: [384, 640, 1024],
    quality: 80,
  },
  {
    src: 'reference/20250705_085321.jpg',      // kamar (portrait)
    name: 'kamar',
    widths: [640, 1024, 1400],
    quality: 80,
  },
  {
    src: 'reference/e891d7eb-d70d-45a9-8be7-5d2e83c3665e.png', // hero (wide)
    name: 'hero',
    widths: [640, 1024, 1600],
    quality: 80,
  },
];

const FMT = ['avif', 'webp', 'jpg', 'png'];

(async () => {
  let total = 0;
  for (const t of TARGETS) {
    const base = sharp(t.src, { failOn: 'none' }).rotate();
    const meta = await base.metadata();
    for (const w of t.widths) {
      const resized = base.clone().resize({ width: w, withoutEnlargement: false });
      // never upscale beyond original
      if (w >= meta.width) {
        // only emit jpg fallback at near-original size if original width is smaller
        continue;
      }
      for (const fmt of FMT) {
        let out = `${OUT}/${t.name}-${w}.${fmt}`;
        let pipeline = resized.clone();
        switch (fmt) {
          case 'avif': pipeline = pipeline.avif({ quality: t.quality, effort: 4 }); break;
          case 'webp': pipeline = pipeline.webp({ quality: t.quality, effort: 4 }); break;
          case 'jpg': pipeline = pipeline.jpeg({ quality: t.quality, mozjpeg: true }); break;
          case 'png': pipeline = pipeline.png({ compressionLevel: 9, palette: false }); break;
        }
        await pipeline.toFile(out);
        const kb = Math.round(fs.statSync(out).size / 1024);
        total += kb;
        console.log(`${out}  ${kb} KB`);
      }
    }
  }
  // Logo: optimized png + webp (keep transparency)
  for (const fmt of ['png', 'webp']) {
    let pipeline = sharp('public/images/logo/logo.png').resize({ width: 256 });
    if (fmt === 'webp') pipeline = pipeline.webp({ quality: 90, effort: 4 });
    else pipeline = pipeline.png({ compressionLevel: 9 });
    const out = `public/images/logo/logo-256.${fmt}`;
    await pipeline.toFile(out);
    const kb = Math.round(fs.statSync(out).size / 1024);
    total += kb;
    console.log(`${out}  ${kb} KB`);
  }
  // og image: resize down to 1200 (it already is 1200) -> re-encode jpg + webp
  for (const fmt of ['jpg', 'webp', 'avif']) {
    let pipeline = sharp('public/images/logo/logo-og.png').resize({ width: 1200 });
    if (fmt === 'webp') pipeline = pipeline.webp({ quality: 82, effort: 4 });
    else if (fmt === 'avif') pipeline = pipeline.avif({ quality: 80, effort: 4 });
    else pipeline = pipeline.jpeg({ quality: 85, mozjpeg: true });
    const out = `public/images/logo/logo-og.${fmt}`;
    await pipeline.toFile(out);
    const kb = Math.round(fs.statSync(out).size / 1024);
    total += kb;
    console.log(`${out}  ${kb} KB`);
  }
  console.log(`TOTAL new bytes: ${Math.round(total / 1024)} MB`);
})();