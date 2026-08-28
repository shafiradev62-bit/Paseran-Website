import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as THREE from "three";

const here = path.dirname(fileURLToPath(import.meta.url));
const modelPath = path.join(here, "..", "public", "models", "xbot.glb");
const buffer = await readFile(modelPath);

const loader = new GLTFLoader();
const gltf = await loader.parseAsync(buffer.buffer, "");
const box = new THREE.Box3().setFromObject(gltf.scene);
const size = box.getSize(new THREE.Vector3());
const center = box.getCenter(new THREE.Vector3());
console.log("size:", size.x.toFixed(3), size.y.toFixed(3), size.z.toFixed(3));
console.log("center:", center.x.toFixed(3), center.y.toFixed(3), center.z.toFixed(3));
console.log(
  "animations:",
  gltf.animations.map((a) => a.name),
);
const names = new Set();
gltf.scene.traverse((o) => {
  if (o.isMesh) names.add(o.name);
});
console.log("meshes:", [...names]);

const bones = [];
gltf.scene.traverse((o) => {
  if (o.isBone) bones.push(o.name);
});
console.log("bones:", bones.join(", "));
