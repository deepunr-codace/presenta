import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// Matches src/components/shell/Mark.tsx: ink rounded square, two-tone violet/orange spark.
const svg = (size, radius) => `
<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <rect width="24" height="24" rx="${radius}" fill="#000000" />
  <path d="M12 4.5c.6 4.4 3.1 6.9 7.5 7.5-4.4.6-6.9 3.1-7.5 7.5V4.5Z" fill="#FF4704" />
  <path d="M12 4.5c-.6 4.4-3.1 6.9-7.5 7.5 4.4.6 6.9 3.1 7.5 7.5V4.5Z" fill="#0447FF" />
</svg>`;

const appDir = "src/app";
const publicDir = "public";
mkdirSync(publicDir, { recursive: true });

// 1. Scalable favicon.svg served at /src/app/icon.svg (Next.js app-icon convention)
writeFileSync(join(appDir, "icon.svg"), svg(32, 6).trim());

// 2. PNG sizes for favicon.ico, apple-touch-icon and manifest icons
const targets = [
  { file: join(publicDir, "favicon-16.png"), size: 16 },
  { file: join(publicDir, "favicon-32.png"), size: 32 },
  { file: join(publicDir, "favicon-48.png"), size: 48 },
  { file: join(appDir, "apple-icon.png"), size: 180 },
  { file: join(publicDir, "icon-192.png"), size: 192 },
  { file: join(publicDir, "icon-512.png"), size: 512 },
];

for (const t of targets) {
  await sharp(Buffer.from(svg(t.size, Math.round((6 / 24) * t.size))))
    .resize(t.size, t.size)
    .png()
    .toFile(t.file);
  console.log("wrote", t.file);
}

console.log("done");
