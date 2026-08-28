import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const files = [
  "../public/remaja.glb",
  "../public/models/bapak-duduk.glb",
  "../public/models/bangunan-baru.glb",
  "../public/models/piagam-baru.glb",
  "../public/models/joglo.glb",
];

for (const rel of files) {
  const buf = await readFile(path.join(here, rel));
  // GLB container: magic(4) version(4) len(4) | chunkLen(4) chunkType(4=JSON)
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));

  const verts = (json.meshes ?? [])
    .flatMap((m) => m.primitives ?? [])
    .reduce((s, p) => s + (json.accessors?.[p.attributes.POSITION]?.count ?? 0), 0);
  const tris = (json.meshes ?? []).flatMap((m) => m.primitives ?? []).reduce((s, p) => {
    const idx = p.indices !== undefined ? json.accessors[p.indices].count : json.accessors[p.attributes.POSITION]?.count ?? 0;
    return s + idx / 3;
  }, 0);

  let texBytes = 0;
  const imgs = [];
  for (const img of json.images ?? []) {
    let bytes = 0;
    if (img.bufferView !== undefined) {
      const bv = json.bufferViews[img.bufferView];
      bytes = bv.byteLength;
      texBytes += bytes;
    }
    imgs.push(`${(bytes / 1024).toFixed(0)}KB ${img.mimeType}`);
  }

  console.log("=", rel);
  console.log("  size:", (buf.length / 1048576).toFixed(2), "MB");
  console.log("  extensionsUsed:", json.extensionsUsed ?? "(none)");
  console.log("  meshes:", (json.meshes ?? []).length, "| nodes:", (json.nodes ?? []).length,
    "| skins:", (json.skins ?? []).length, "| anims:", (json.animations ?? []).length);
  console.log("  vertices:", verts, "| triangles:", Math.round(tris));
  console.log("  textures:", (imgs.length || 0), "total", (texBytes / 1048576).toFixed(2), "MB");
  for (const i of imgs) console.log("   -", i);
}
