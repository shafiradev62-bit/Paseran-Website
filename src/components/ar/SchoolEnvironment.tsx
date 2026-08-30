import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useGLTF, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { GLTF } from "three-stdlib";
import {
  UmbulArena,
  CandiBentar,
  GongAgeng,
  Bedug,
  WayangKulit,
  KudaLumping,
} from "./JawaCulture";

const CHAR_Y_OFFSET = 1.71;
const LAUNCH_Z = 1.5;

function useModel(path: string, cast = true) {
  const gltf = useGLTF(path) as GLTF & { scene: THREE.Group };
  const ref = useRef<THREE.Object3D | null>(null);
  if (!ref.current) {
    const cloned = gltf.scene.clone(true);
    cloned.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = cast;
        child.receiveShadow = true;
      }
    });
    ref.current = cloned;
  }
  return ref;
}

/* ── Procedural sand texture (grainy, seamless tiling) ─────────────────────── */
function useSandTexture() {
  return useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#d9c69b";
    ctx.fillRect(0, 0, size, size);

    /* Garis-garis riak pasir (sand ripples ala pantai/lapangan Jawa) */
    const rows = 20;
    const K1 = ((Math.PI * 2 * 3) / size) * 1; // 3 siklus penuh → seamless horizontal
    const K2 = ((Math.PI * 2 * 7) / size) * 1;
    for (let i = 0; i < rows; i++) {
      const yy = (i / rows) * size;
      const p1 = (i * (Math.PI * 2 * 2)) / rows; // fase periodik → seamless vertikal
      const p2 = (i * (Math.PI * 2 * 5)) / rows;
      ctx.beginPath();
      for (let x = 0; x <= size; x += 3) {
        const wob = Math.sin(x * K1 + p1) * 2.4 + Math.sin(x * K2 + p2) * 1.1;
        if (x === 0) ctx.moveTo(x, yy + wob);
        else ctx.lineTo(x, yy + wob);
      }
      const dark = i % 2 === 0;
      ctx.strokeStyle = dark ? "rgba(146,118,70,0.18)" : "rgba(250,238,206,0.17)";
      ctx.lineWidth = 2.2 + (i % 3) * 0.8;
      ctx.stroke();
    }

    for (let i = 0; i < 14000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const dark = Math.random() > 0.5;
      const a = 0.04 + Math.random() * 0.12;
      ctx.fillStyle = dark ? `rgba(146,118,70,${a})` : `rgba(247,232,198,${a})`;
      ctx.fillRect(x, y, 1 + Math.random() * 1.5, 1 + Math.random() * 1.5);
    }
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 6 + Math.random() * 18;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(190,164,112,${0.05 + Math.random() * 0.06})`);
      g.addColorStop(1, "rgba(190,164,112,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(20, 20);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, []);
}

/* ── Batik kawung motif (procedural canvas) ────────────────────────────────── */
export function makeKawungTexture(repeatX = 3, repeatY = 2) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#e9dcbb";
  ctx.fillRect(0, 0, size, size);
  const cell = size / 4;
  const w = cell * 0.15;
  const l = cell * 0.27;
  const off = cell * 0.27;
  for (let gy = -1; gy <= 4; gy++) {
    for (let gx = -1; gx <= 4; gx++) {
      const cx = gx * cell + cell / 2 + (gy % 2 === 0 ? 0 : cell / 2);
      const cy = gy * cell + cell / 2;
      ctx.fillStyle = "#7a4a21";
      // 4 kawung petals
      ctx.beginPath();
      ctx.ellipse(cx, cy - off, w, l, 0, 0, Math.PI * 2);
      ctx.ellipse(cx, cy + off, w, l, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - off, cy, l, w, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + off, cy, l, w, 0, 0, Math.PI * 2);
      ctx.fill();
      // center dot
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function SandGround() {
  const sand = useSandTexture();
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, -10]}>
      <planeGeometry args={[160, 160]} />
      <meshStandardMaterial map={sand} roughness={1} metalness={0} />
    </mesh>
  );
}

/* ── Standing thrower at the launch pad — remaja.glb ──────────────────────── */
function ThrowerGLB({ throwingRef }: { throwingRef?: React.MutableRefObject<boolean> | undefined }) {
  const ref = useModel("/remaja.opt.glb");
  const grp = useRef<THREE.Group>(null);
  const lean = useRef(0);
  useFrame((_, dt) => {
    if (!grp.current) return;
    // Ayunan lempar yang hidup: mantul ke depan saat rilis, lalu kembali pelan.
    const target = throwingRef?.current ? 1 : 0;
    lean.current += (target - lean.current) * Math.min(1, dt * 7);
    grp.current.rotation.x = -0.45 * lean.current;
    grp.current.position.z = LAUNCH_Z - 0.3 * lean.current;
    grp.current.position.y = Math.sin(lean.current * Math.PI) * 0.12;
  });
  return (
    <group ref={grp} position={[0, 0, LAUNCH_Z]} rotation={[0, Math.PI, 0]} scale={1.8}>
      <primitive object={ref.current as THREE.Object3D} />
    </group>
  );
}

/* ── Sitting watcher directly behind the thrower (bapak-duduk.glb) ─────── */
function BapakWatcherGLB({
  position,
  rotation = 0,
  scale = 1.7,
}: {
  position: [number, number, number];
  rotation?: number;
  scale?: number;
}) {
  const ref = useModel("/models/bapak-duduk.opt.glb");
  return (
    <group
      position={[position[0], 0.53 * scale + position[1], position[2]]}
      rotation={[0, rotation, 0]}
      scale={[scale, scale, scale]}
    >
      <primitive object={ref.current as THREE.Object3D} />
    </group>
  );
}

/* ── Buildings scattered around the arena ──────────────────────────────────── */
function BangunanGLB({
  position,
  rotation = 0,
  scale = 3,
}: {
  position: [number, number, number];
  rotation?: number;
  scale?: number;
}) {
  const ref = useModel("/models/bangunan-baru.glb", false);
  return (
    <group
      position={[position[0], 0.56 * scale + position[1], position[2]]}
      rotation={[0, rotation, 0]}
      scale={[scale, scale, scale]}
    >
      <primitive object={ref.current as THREE.Object3D} />
    </group>
  );
}

/* ── Piagam plaque near the field ──────────────────────────────────────────── */
function PiagamGLB({ position }: { position: [number, number, number] }) {
  const ref = useModel("/models/piagam-baru.opt.glb", false);
  return (
    <group position={position}>
      <primitive object={ref.current as THREE.Object3D} />
    </group>
  );
}

/* ── Pohon kelapa (coconut palm) ───────────────────────────────────────────── */
function PohonKelapa({
  position,
  rotation = 0,
  scale = 1,
}: {
  position: [number, number, number];
  rotation?: number;
  scale?: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const phase = useRef(Math.random() * Math.PI * 2);
  // Sedikit ayunan daun → scene terasa hidup (seperti ditiup angin).
  useFrame((state) => {
    if (ref.current) ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.6 + phase.current) * 0.018;
  });
  return (
    <group ref={ref} position={position} rotation={[0, rotation, 0]} scale={[scale, scale, scale]}>
      {Array.from({ length: 5 }).map((_, i) => {
        const t = i / 5;
        return (
          <mesh
            key={i}
            position={[t * t * 0.9, 0.9 + t * 2.7, 0]}
            rotation={[0, 0, -t * 0.16]}
            castShadow
          >
            <cylinderGeometry args={[0.095 - t * 0.02, 0.115 - t * 0.02, 0.78, 6]} />
            <meshStandardMaterial color="#8a6a48" roughness={0.95} />
          </mesh>
        );
      })}
      <group position={[0.92, 3.68, 0]}>
        {Array.from({ length: 7 }).map((_, i) => (
          <group key={i} rotation={[0, (i / 7) * Math.PI * 2, 0]}>
            <mesh
              position={[0.72, -0.12, 0]}
              rotation={[0, 0, -0.55]}
              scale={[1, 0.22, 0.32]}
              castShadow
            >
              <coneGeometry args={[0.52, 1.9, 4]} />
              <meshStandardMaterial color="#3f7a37" roughness={1} />
            </mesh>
          </group>
        ))}
        {[0, 1, 2].map((i) => (
          <mesh
            key={`nut${i}`}
            position={[Math.cos(i * 2.1) * 0.14, -0.22, Math.sin(i * 2.1) * 0.14]}
            castShadow
          >
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshStandardMaterial color="#6b4a2f" roughness={0.9} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* ── Tikar anyaman (woven pandan mat) for thrower to sit on ──────────────── */
function TikarLemper({
  position,
  rotation = 0,
}: {
  position: [number, number, number];
  rotation?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1.6, 1.1]} />
        <meshStandardMaterial color="#c4a35a" roughness={0.95} />
      </mesh>
      {/* anyaman pattern lines */}
      {Array.from({ length: 14 }).map((_, i) => (
        <mesh key={`h${i}`} position={[0, 0.016, -0.5 + i * 0.075]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.55, 0.02]} />
          <meshBasicMaterial color="#9a7e3e" transparent opacity={0.5} />
        </mesh>
      ))}
      {Array.from({ length: 20 }).map((_, i) => (
        <mesh
          key={`v${i}`}
          position={[-0.75 + i * 0.08, 0.016, 0]}
          rotation={[-Math.PI / 2, 0, Math.PI / 2]}
        >
          <planeGeometry args={[1.05, 0.02]} />
          <meshBasicMaterial color="#9a7e3e" transparent opacity={0.3} />
        </mesh>
      ))}
    </group>
  );
}

/* ── Sesajen: offerings (flowers, incense, banana) on a small platform ────── */
function Sesajen({
  position,
  rotation = 0,
}: {
  position: [number, number, number];
  rotation?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* wooden plate */}
      <mesh position={[0, 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.25, 0.04, 12]} />
        <meshStandardMaterial color="#6b4a2f" roughness={0.9} />
      </mesh>
      {/* banana (pisang) */}
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          position={[-0.08 + i * 0.08, 0.12, -0.05]}
          rotation={[0.2, 0, 0.5 + i * 0.3]}
          castShadow
        >
          <capsuleGeometry args={[0.025, 0.12, 4, 8]} />
          <meshStandardMaterial color="#e8c84a" roughness={0.7} />
        </mesh>
      ))}
      {/* flowers (kenanga/melati) */}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh
            key={`f${i}`}
            position={[Math.cos(a) * 0.15, 0.13, Math.sin(a) * 0.15 + 0.05]}
            castShadow
          >
            <sphereGeometry args={[0.028, 8, 8]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#fff5e0" : "#e8a04a"} roughness={0.6} />
          </mesh>
        );
      })}
      {/* incense sticks (dupa) */}
      {[0, 1, 2].map((i) => (
        <mesh key={`d${i}`} position={[0.06 + i * 0.02, 0.18, 0.08]} castShadow>
          <cylinderGeometry args={[0.004, 0.004, 0.16, 6]} />
          <meshStandardMaterial color="#8b6914" roughness={0.8} />
        </mesh>
      ))}
      {/* incense smoke (soft transparent) */}
      <mesh position={[0.08, 0.35, 0.08]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#ccc" transparent opacity={0.15} />
      </mesh>
    </group>
  );
}

/* ── Bonang barung: row of bronze kettle-gongs (gamelan) ─────────────────── */
function BonangBarung({
  position,
  rotation = 0,
  scale = 1,
}: {
  position: [number, number, number];
  rotation?: number;
  scale?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={[scale, scale, scale]}>
      {/* wooden rack (rancang) */}
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[1.4, 0.06, 0.4]} />
        <meshStandardMaterial color="#5a3a22" roughness={0.9} />
      </mesh>
      {[-0.5, -0.25, 0, 0.25, 0.5].map((x, i) => (
        <group key={i} position={[x, 0.35, 0]}>
          {/* gong body */}
          <mesh castShadow>
            <sphereGeometry args={[0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#b8860b" metalness={0.6} roughness={0.35} />
          </mesh>
          {/* gong rim */}
          <mesh position={[0, -0.01, 0]} castShadow>
            <torusGeometry args={[0.1, 0.018, 8, 16]} />
            <meshStandardMaterial color="#9a7000" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* legs */}
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.15, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.04, 0.3, 8]} />
          <meshStandardMaterial color="#5a3a22" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/* ── Kelir: wayang kulit screen (white cloth on bamboo frame) ──────────────── */
function KelirWayang({
  position,
  rotation = 0,
  scale = 1,
}: {
  position: [number, number, number];
  rotation?: number;
  scale?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={[scale, scale, scale]}>
      {/* screen cloth */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <planeGeometry args={[2.4, 1.8]} />
        <meshStandardMaterial
          color="#f5e6c8"
          roughness={0.95}
          side={THREE.DoubleSide}
          emissive="#ffd9a0"
          emissiveIntensity={0.08}
        />
      </mesh>
      {/* bamboo frame top */}
      <mesh position={[0, 2.15, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 2.5, 8]} />
        <meshStandardMaterial color="#8a6a48" roughness={0.85} />
      </mesh>
      {/* bamboo frame sides */}
      {[-1.2, 1.2].map((x) => (
        <mesh key={x} position={[x, 1.2, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 2.4, 8]} />
          <meshStandardMaterial color="#8a6a48" roughness={0.85} />
        </mesh>
      ))}
      {/* base support */}
      <mesh position={[0, 0.03, 0]} castShadow>
        <boxGeometry args={[2.6, 0.06, 0.25]} />
        <meshStandardMaterial color="#6b4a2f" roughness={0.9} />
      </mesh>
    </group>
  );
}

/* ── Clingeng: bamboo wind chimes (angklung-like) ──────────────────────────── */
function Clingeng({
  position,
  rotation = 0,
}: {
  position: [number, number, number];
  rotation?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* hanging beam */}
      <mesh position={[0, 2.5, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.8, 6]} />
      </mesh>
      {/* bamboo tubes */}
      {[-0.25, -0.08, 0.08, 0.25].map((x, i) => (
        <mesh key={i} position={[x, 2.1 - i * 0.05, 0]} castShadow>
          <cylinderGeometry args={[0.018, 0.016, 0.4 + i * 0.08, 6]} />
          <meshStandardMaterial color="#c4a35a" roughness={0.7} />
        </mesh>
      ))}
      {/* support post */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.04, 2.5, 8]} />
        <meshStandardMaterial color="#6b4a2f" roughness={0.9} />
      </mesh>
    </group>
  );
}

/* ── Joglo GLB mengelilingi arena ──────────────────────────────────────────── */
function JogloGLB({
  position,
  rotation = 0,
  scale = 3.2,
}: {
  position: [number, number, number];
  rotation?: number;
  scale?: number;
}) {
  const ref = useModel("/models/joglo.glb", false);
  return (
    <group
      position={[position[0], 0.74 * scale + position[1], position[2]]}
      rotation={[0, rotation, 0]}
      scale={[scale, scale, scale]}
    >
      <primitive object={ref.current as THREE.Object3D} />
    </group>
  );
}

/* ── Gentong (clay pot) ────────────────────────────────────────────────────── */
function Gentong({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.42, 0]} scale={[1, 0.85, 1]} castShadow>
        <sphereGeometry args={[0.42, 14, 12]} />
        <meshStandardMaterial color="#9c5a33" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.86, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.2, 0.16, 12]} />
        <meshStandardMaterial color="#8a4d2b" roughness={0.9} />
      </mesh>
    </group>
  );
}

/* ── Gunungan wayang (siluet kayu) ─────────────────────────────────────────── */
function Gunungan({
  position,
  rotation = 0,
  scale = 1.5,
}: {
  position: [number, number, number];
  rotation?: number;
  scale?: number;
}) {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(0.55, 0.05, 0.62, 0.45, 0.42, 0.75);
    s.bezierCurveTo(0.32, 0.95, 0.3, 1.1, 0.12, 1.28);
    s.bezierCurveTo(0.06, 1.34, 0.02, 1.38, 0, 1.46);
    s.bezierCurveTo(-0.02, 1.38, -0.06, 1.34, -0.12, 1.28);
    s.bezierCurveTo(-0.3, 1.1, -0.32, 0.95, -0.42, 0.75);
    s.bezierCurveTo(-0.62, 0.45, -0.55, 0.05, 0, 0);
    return new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false });
  }, []);
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={[scale, scale, scale]}>
      <mesh geometry={geo} castShadow>
        <meshStandardMaterial color="#3b2412" roughness={0.75} metalness={0.2} />
      </mesh>
      {/* tiang penyangga */}
      <mesh position={[0, -0.18, 0.02]} castShadow>
        <cylinderGeometry args={[0.035, 0.05, 0.36, 8]} />
        <meshStandardMaterial color="#5a3a22" roughness={0.9} />
      </mesh>
    </group>
  );
}

/* ── Tali bendera segitiga sepanjang sisi arena (tiang bambu di kedua ujung) ─ */
const FLAG_COLORS = ["#e63946", "#f4c430", "#2a6fdb", "#3f7a37", "#e07b39"];
type StringSpec = { from: [number, number, number]; to: [number, number, number]; count?: number };
function FlagStrings({ items }: { items: StringSpec[] }) {
  const rows = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    rows.current.forEach((grp) => {
      if (!grp) return;
      grp.children.forEach((c, j) => {
        if (!(c instanceof THREE.Mesh)) return;
        c.rotation.z = Math.sin(t * 2.1 + j * 0.65) * 0.16;
        c.rotation.x = Math.PI + Math.sin(t * 1.6 + j * 0.5) * 0.09;
      });
    });
  });
  return (
    <>
      {items.map((it, si) => {
        const a = new THREE.Vector3(...it.from);
        const b = new THREE.Vector3(...it.to);
        const count = it.count ?? Math.round(a.distanceTo(b) / 1.1);
        /* tali melengkung sedikit di tengah */
        const sag = a.distanceTo(b) * 0.03;
        const ropePts: THREE.Vector3[] = [];
        for (let s = 0; s <= 20; s++) {
          const u = s / 20;
          ropePts.push(
            new THREE.Vector3(
              THREE.MathUtils.lerp(a.x, b.x, u),
              THREE.MathUtils.lerp(a.y, b.y, u) - Math.sin(u * Math.PI) * sag,
              THREE.MathUtils.lerp(a.z, b.z, u),
            ),
          );
        }
        return (
          <group key={si}>
            {/* tiang bambu pengikat di kedua ujung */}
            {[a, b].map((p, pi) => (
              <mesh key={`pole${pi}`} position={[p.x, p.y / 2, p.z]}>
                <cylinderGeometry args={[0.022, 0.032, p.y, 6]} />
                <meshStandardMaterial color="#8a6a48" roughness={0.9} />
              </mesh>
            ))}
            <Line points={ropePts} color="#cbb98d" lineWidth={1} transparent opacity={0.85} />
            <group
              ref={(el) => {
                rows.current[si] = el;
              }}
            >
              {Array.from({ length: count }).map((_, i) => {
                const u = (i + 0.5) / count;
                const p = ropePts[Math.round(u * 20)]!;
                return (
                  <mesh key={i} position={[p.x, p.y - 0.13, p.z]} rotation={[Math.PI, 0, 0]}>
                    <coneGeometry args={[0.11, 0.26, 4]} />
                    <meshStandardMaterial
                      color={FLAG_COLORS[i % FLAG_COLORS.length]!}
                      roughness={0.95}
                      side={THREE.DoubleSide}
                    />
                  </mesh>
                );
              })}
            </group>
          </group>
        );
      })}
    </>
  );
}

/* ── Rumpun bambu di tepi arena ───────────────────────────────────────────── */
function BambuClump({
  position,
  rotation = 0,
}: {
  position: [number, number, number];
  rotation?: number;
}) {
  const culms = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        x: Math.sin(i * 2.4) * 0.32,
        z: Math.cos(i * 1.7) * 0.28,
        h: 3.2 + ((i * 37) % 13) / 10,
        tilt: ((i * 53) % 10) / 60,
        lean: i * 1.05,
      })),
    [],
  );
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {culms.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]} rotation={[c.tilt, c.lean, c.tilt * 0.7]}>
          <mesh position={[0, c.h / 2, 0]}>
            <cylinderGeometry args={[0.028, 0.04, c.h, 6]} />
            <meshStandardMaterial color="#b7bd6e" roughness={0.8} />
          </mesh>
          {/* buku bambu */}
          {[0.35, 0.65, 0.9].map((u) => (
            <mesh key={u} position={[0, c.h * u, 0]}>
              <cylinderGeometry args={[0.036, 0.036, 0.03, 6]} />
              <meshStandardMaterial color="#8f9450" roughness={0.85} />
            </mesh>
          ))}
          {/* daun */}
          {[0, 1, 2].map((l) => (
            <mesh
              key={`leaf${l}`}
              position={[0.18 + l * 0.06, c.h - 0.2 - l * 0.3, 0.05 * (l - 1)]}
              rotation={[0.4 * (l - 1), l * 2.1, -0.5]}
              scale={[1, 1, 0.18]}
            >
              <coneGeometry args={[0.09, 0.55, 4]} />
              <meshStandardMaterial color="#5d8038" roughness={0.95} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

useGLTF.preload("/remaja.opt.glb");
useGLTF.preload("/models/bapak-duduk.opt.glb");
useGLTF.preload("/models/bangunan-baru.glb");
useGLTF.preload("/models/piagam-baru.opt.glb");
useGLTF.preload("/models/joglo.glb");

/**
 * Mount children only after the browser is idle, so the first frame paints
 * immediately (ground + sky + target) while heavy GLB decorations stream in
 * afterwards. Elements are NOT removed — they simply appear a moment later.
 */
function Deferred({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) {
      const id = ric(() => setShow(true), { timeout: 500 });
      return () => {
        const cancel = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
        cancel?.(id);
      };
    }
    const t = window.setTimeout(() => setShow(true), 200);
    return () => window.clearTimeout(t);
  }, []);
  return show ? <>{children}</> : null;
}

export function SchoolEnvironment({
  onClickGround,
  throwingRef,
}: {
  onClickGround?: () => void;
  throwingRef?: React.MutableRefObject<boolean> | undefined;
}) {
  return (
    <group
      {...(onClickGround
        ? {
            onClick: (e: { stopPropagation: () => void }) => {
              e.stopPropagation();
              onClickGround();
            },
          }
        : {})}
    >
      <SandGround />

      {/* Penembak + penonton: GLB ringan (.opt) → tampil langsung */}
      <Suspense fallback={null}>
        {/* Penembak berdiri di titik lempar */}
        <ThrowerGLB throwingRef={throwingRef} />

        {/* Penonton remaja di belakang pelempar */}
        <BapakWatcherGLB position={[1.6, 0, 4.8]} rotation={Math.PI + 0.15} />
        <BapakWatcherGLB position={[-2.1, 0, 5.4]} rotation={Math.PI - 0.2} />
      </Suspense>

      {/* Sisa dekorasi (bangunan/joglo GLB besar) dialirkan setelah frame
          pertama supaya scene langsung interaktif & tidak lambat dimuat */}
      <Deferred>
        <Suspense fallback={null}>
          {/* Bangunan mengelilingi arena */}
          <BangunanGLB position={[-13, 0, -8]} rotation={0.25} />
          <BangunanGLB position={[13.5, 0, -14]} rotation={-0.3} />
          <BangunanGLB position={[0, 0, -40]} rotation={0.05} />

          {/* Piagam di pinggir lapangan */}
          <PiagamGLB position={[3.6, 0, -2.5]} />

          {/* Pohon-pohon */}
          <PohonKelapa position={[-7, 0, -4]} rotation={0.6} />
          <PohonKelapa position={[8.5, 0, -9]} rotation={-0.8} scale={1.1} />
          <PohonKelapa position={[-9, 0, -26]} rotation={1.2} />
          <PohonKelapa position={[10.5, 0, -42]} rotation={-0.4} />
          <PohonKelapa position={[6.5, 0, 3]} rotation={-1.5} scale={0.85} />

          {/* Elemen Jawa: joglo mengelilingi & gentong */}
          <JogloGLB position={[-9.5, 0, -16]} rotation={0.5} />
          <JogloGLB position={[10, 0, -19]} rotation={-0.6} />
          <JogloGLB position={[-10.5, 0, 1]} rotation={1.2} />
          <JogloGLB position={[11, 0, -5]} rotation={-1.1} />
          <JogloGLB position={[-8.5, 0, 11]} rotation={2.4} />
          <JogloGLB position={[9, 0, 12]} rotation={-2.6} />
          <Gentong position={[3, 0, 0.3]} />
          <Gentong position={[-3.1, 0, 3]} />

          {/* Gunungan wayang pengapit arena */}
          <Gunungan position={[-2.7, 0, 0.8]} rotation={0.35} />
          <Gunungan position={[2.7, 0, 0.8]} rotation={-0.35} />
          <Gunungan position={[-3.2, 0, -9]} rotation={0.2} scale={1.2} />
          <Gunungan position={[3.2, 0, -9]} rotation={-0.2} scale={1.2} />

          {/* Elemen budaya Jawa: tikar, sesajen, gamelan, kelir, clingeng */}
          {/* Tikar anyaman untuk pelempar duduk bersila */}
          <TikarLemper position={[0, 0, LAUNCH_Z]} rotation={0} />
          {/* Sesajen di pinggir arena */}
          <Sesajen position={[-1.8, 0, 1.5]} rotation={0.3} />
          <Sesajen position={[1.8, 0, 1.5]} rotation={-0.3} />
          {/* Gamelan bonang di samping arena */}
          <BonangBarung position={[-5.5, 0, 0]} rotation={0.4} scale={1.2} />
          <BonangBarung position={[5.5, 0, 0]} rotation={-0.4} scale={1.2} />
          {/* Kelir wayang kulit sebagai latar */}
          <KelirWayang position={[-8, 0, -30]} rotation={0.2} scale={1.5} />
          <KelirWayang position={[8, 0, -30]} rotation={-0.2} scale={1.5} />
          {/* Clingeng (bamboo wind chimes) */}
          <Clingeng position={[-3.5, 0, 3]} rotation={0.5} />
          <Clingeng position={[3.5, 0, 3]} rotation={-0.5} />

          {/* ── Elemen budaya Jawa - di jauhkan agar tidak menghalangi angka ── */}
          {/* Candi bentar (gerbang belah) di ujung lapangan */}
          <CandiBentar z={-46} />

          {/* Tali bendera segitiga di sisi kiri-kanan arena */}
          <FlagStrings
            items={[
              { from: [-6.4, 2.55, 2.2], to: [-6.4, 2.55, -26.5], count: 22 },
              { from: [6.4, 2.55, 2.2], to: [6.4, 2.55, -26.5], count: 22 },
            ]}
          />

          {/* Rumpun bambu di tepi hutan */}
          <BambuClump position={[-12, 0, -22]} rotation={0.8} />
          <BambuClump position={[12.5, 0, -27]} rotation={-1.2} />
          <BambuClump position={[-12.5, 0, -34]} rotation={2.1} />
        </Suspense>
      </Deferred>
    </group>
  );
}

export { CHAR_Y_OFFSET };
