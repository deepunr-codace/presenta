import { readFileSync, writeFileSync } from "fs";

// Packs PNG files into a multi-size .ico using the PNG-in-ICO format
// (supported by all modern browsers and Windows since Vista).
const sizes = [16, 32, 48];
const pngs = sizes.map((s) => readFileSync(`public/favicon-${s}.png`));

const count = pngs.length;
const headerSize = 6 + count * 16;
let offset = headerSize;
const dirEntries = [];
for (let i = 0; i < count; i++) {
  const size = sizes[i];
  const data = pngs[i];
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0); // width
  entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
  entry.writeUInt8(0, 2); // color palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(data.length, 8); // size of image data
  entry.writeUInt32LE(offset, 12); // offset of image data
  dirEntries.push(entry);
  offset += data.length;
}

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(count, 4); // image count

const ico = Buffer.concat([header, ...dirEntries, ...pngs]);
writeFileSync("src/app/favicon.ico", ico);
console.log("wrote src/app/favicon.ico", ico.length, "bytes");
