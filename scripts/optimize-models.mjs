/* Optimasi model GLB yang dipakai scene:
   - tekstur di-resize max 1024px & dikonversi WebP (profil warna dibersihkan dulu)
   - mesh disederhanakan (meshoptimizer) sesuai toleransi error per model
   - geometri dikompresi EXT_meshopt_compression
   Original tetap utuh di folder ../model-backups/ */
import { readFile, writeFile } from "node:fs/promises";
import { NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, EXTTextureWebP, KHRMeshQuantization, KHRTextureTransform } from "@gltf-transform/extensions";
import { dedup, prune, simplify, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const JOBS = [
  { path: "public/bapak duduk.glb", error: 0.0008 },
  { path: "public/remaja.glb", error: 0.0003 },
  { path: "public/models/piagam-baru.glb", error: 0.0003 },
  { path: "public/models/bapak-duduk.glb", error: 0.0008 },
  { path: "public/models/joglo.glb", error: 0.001 },
  { path: "public/models/bangunan-baru.glb", error: 0.002 },
];

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;

for (const job of JOBS) {
  const io = new NodeIO()
    .registerExtensions([EXTMeshoptCompression, EXTTextureWebP, KHRMeshQuantization, KHRTextureTransform])
    .registerDependencies({
      "meshopt.encoder": MeshoptEncoder,
      "meshopt.decoder": MeshoptDecoder,
      "meshopt.simplifier": MeshoptSimplifier,
    });

  const doc = await io.read(job.path);
  const root = doc.getRoot();

  // ── Simplify geometry ──
  await doc.transform(
    dedup(),
    prune(),
    weld(),
    simplify({ error: job.error, ratio: 0, simplifier: MeshoptSimplifier }),
  );

  // ── Textures: bersihkan profil bermasalah → resize → WebP ──
  let texIn = 0;
  let texOut = 0;
  for (const tex of root.listTextures()) {
    const img = tex.getImage();
    if (!img) continue;
    texIn += img.byteLength;
    const out = await sharp(Buffer.from(img), { failOn: "none" })
      .rotate()
      .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
      .toColourspace("srgb")
      .webp({ quality: 82 })
      .toBuffer();
    tex.setImage(new Uint8Array(out));
    tex.setMimeType("image/webp");
    texOut += out.byteLength;
  }

  // ── Meshopt compression on write ──
  doc.createExtension(EXTMeshoptCompression).setRequired(true);

  const outPath = job.path.replace(/\.glb$/, ".opt.glb");
  await io.write(outPath, doc);
  const bufIn = (await readFile(job.path)).byteLength;
  const bufOut = (await readFile(outPath)).byteLength;

  const mb = (n) => (n / 1048576).toFixed(2) + " MB";
  console.log(
    `= ${job.path}\n  file: ${mb(bufIn)} -> ${mb(bufOut)}\n  textures: ${mb(texIn)} -> ${mb(texOut)}`,
  );
}
console.log("done");
