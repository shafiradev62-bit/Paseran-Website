import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ── Umbul-umbul: tali bendera segitiga antara dua tiang bambu ───────────── */
function UmbulUmbul({
  from,
  to,
  color = "#e63946",
}: {
  from: [number, number, number];
  to: [number, number, number];
  color?: string;
}) {
  const flagsRef = useRef<THREE.Group>(null);
  const n = 9;
  const items = useMemo(() => {
    const arr: { pos: [number, number, number]; rot: number; c: string }[] = [];
    const palette = [color, "#f4c430", "#2a9d8f", "#f4c430", color];
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      arr.push({
        pos: [
          from[0] + (to[0] - from[0]) * t,
          from[1] + (to[1] - from[1]) * t,
          from[2] + (to[2] - from[2]) * t,
        ],
        rot: Math.atan2(to[0] - from[0], to[2] - from[2]),
        c: palette[i % palette.length]!,
      });
    }
    return arr;
  }, [from, to, color]);

  useFrame(({ clock }) => {
    if (!flagsRef.current) return;
    flagsRef.current.children.forEach((c, i) => {
      c.rotation.x = Math.sin(clock.elapsedTime * 1.6 + i * 0.7) * 0.22;
    });
  });

  return (
    <group>
      {/* tiang ujung */}
      {[from, to].map((p, i) => (
        <mesh key={i} position={[p[0], p[1] / 2, p[2]]} castShadow>
          <cylinderGeometry args={[0.03, 0.04, p[1], 7]} />
          <meshStandardMaterial color="#8a6a48" roughness={0.9} />
        </mesh>
      ))}
      {/* tali */}
      <mesh position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]} rotation={[0, Math.atan2(to[0] - from[0], to[2] - from[2]), Math.atan2(from[1] - to[1], Math.hypot(to[0] - from[0], to[2] - from[2]))]}>
        <boxGeometry args={[0.008, Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]), 0.008]} />
        <meshStandardMaterial color="#5a4a33" roughness={0.95} />
      </mesh>
      <group ref={flagsRef}>
        {items.map((it, i) => (
          <group key={i} position={it.pos} rotation={[0, it.rot, 0]}>
            <mesh position={[0, -0.14, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.13, 0.28, 3]} />
              <meshStandardMaterial
                color={it.c}
                side={THREE.DoubleSide}
                roughness={0.85}
                emissive={it.c}
                emissiveIntensity={0.06}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

export function UmbulArena() {
  return (
    <group>
      <UmbulUmbul from={[-8, 3.1, -2]} to={[-2.5, 3.1, -4.5]} />
      <UmbulUmbul from={[8, 3.1, -2]} to={[2.5, 3.1, -4.5]} color="#2a6fdb" />
      <UmbulUmbul from={[-7, 2.9, -12]} to={[-1.5, 2.9, -15]} color="#2a9d8f" />
      <UmbulUmbul from={[7, 2.9, -12]} to={[1.5, 2.9, -15]} color="#f4c430" />
    </group>
  );
}

/* ── Candi bentar: gerbang belah batu andesit di ujung arena ──────────────── */
function TowerCandi({ x }: { x: number }) {
  const tiers = [
    { w: 1.35, h: 0.55, y: 0.27 },
    { w: 1.05, h: 0.75, y: 0.92 },
    { w: 0.82, h: 0.95, y: 1.77 },
    { w: 0.62, h: 1.0, y: 2.74 },
    { w: 0.45, h: 0.85, y: 3.66 },
    { w: 0.3, h: 0.6, y: 4.38 },
  ] as const;
  return (
    <group position={[x, 0, 0]}>
      {/* kaki profil */}
      <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.7, 0.16, 1.1]} />
        <meshStandardMaterial color="#6e6a60" roughness={0.95} />
      </mesh>
      {tiers.map((t, i) => (
        <mesh key={i} position={[0, t.y, 0]} castShadow receiveShadow>
          <boxGeometry args={[t.w, t.h, 0.72]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#7d7970" : "#75716a"} roughness={0.98} />
        </mesh>
      ))}
      {/* puncak */}
      <mesh position={[0, 4.82, 0]} castShadow>
        <sphereGeometry args={[0.17, 10, 8]} />
        <meshStandardMaterial color="#5c584f" roughness={0.9} />
      </mesh>
    </group>
  );
}

export function CandiBentar({ z = -46 }: { z?: number }) {
  return (
    <group position={[0, 0, z]}>
      <TowerCandi x={-2.6} />
      <TowerCandi x={2.6} />
    </group>
  );
}

/* ── Gong ageng: gong besar di rak kayu berukir ────────────────────────────── */
export function GongAgeng({
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
      {/* dua tiang ukir */}
      {[-0.62, 0.62].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.85, 0]} castShadow>
            <boxGeometry args={[0.14, 1.7, 0.14]} />
            <meshStandardMaterial color="#4a2e18" roughness={0.85} />
          </mesh>
          {/* mahkota tiang */}
          <mesh position={[0, 1.76, 0]} castShadow>
            <sphereGeometry args={[0.11, 10, 8]} />
            <meshStandardMaterial color="#b8860b" metalness={0.65} roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* balok atas */}
      <mesh position={[0, 1.62, 0]} castShadow>
        <boxGeometry args={[1.55, 0.14, 0.18]} />
        <meshStandardMaterial color="#5a3a22" roughness={0.85} />
      </mesh>
      {/* gong besar menggantung */}
      <group position={[0, 1.06, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.42, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#a97d0e" metalness={0.72} roughness={0.32} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.42, 0.03, 8, 24]} />
          <meshStandardMaterial color="#8f6800" metalness={0.78} roughness={0.28} />
        </mesh>
        {/* bobok (punuk tengah) */}
        <mesh position={[0, -0.02, 0.16]} castShadow>
          <sphereGeometry args={[0.09, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#8f6800" metalness={0.8} roughness={0.25} />
        </mesh>
        {/* tali pengikat */}
        <mesh position={[0, 0.56, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.24, 6]} />
          <meshStandardMaterial color="#b0946a" roughness={0.9} />
        </mesh>
      </group>
      {/* palu gong bersandar */}
      <group position={[0.85, 0, 0.25]} rotation={[0, -0.5, Math.PI / 2.6]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.85, 7]} />
          <meshStandardMaterial color="#6b4a2f" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

/* ── Bedug: kendang besar di rak penyangga ─────────────────────────────────── */
export function Bedug({
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
      {/* rak */}
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.32, 0]} rotation={[0, 0, x > 0 ? -0.12 : 0.12]} castShadow>
          <boxGeometry args={[0.1, 0.64, 0.5]} />
          <meshStandardMaterial color="#4a2e18" roughness={0.88} />
        </mesh>
      ))}
      {/* badan bedug (silinder mendatar) */}
      <group position={[0, 0.78, 0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.34, 0.34, 1.15, 16]} />
          <meshStandardMaterial color="#7a4a26" roughness={0.9} />
        </mesh>
        {/* kulipis dua sisi */}
        {[-0.58, 0.58].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation={[0, 0, 0]}>
            <circleGeometry args={[0.33, 16]} />
            <meshStandardMaterial color="#d8c49a" roughness={0.95} />
          </mesh>
        ))}
        {/* lingkar besi */}
        {[-0.5, -0.25, 0.25, 0.5].map((y) => (
          <mesh key={`r${y}`} position={[0, y, 0]}>
            <torusGeometry args={[0.345, 0.012, 6, 20]} />
            <meshStandardMaterial color="#3a3a3a" metalness={0.7} roughness={0.4} />
          </mesh>
        ))}
      </group>
      {/* pemukul */}
      <group position={[-0.8, 0.55, 0.2]} rotation={[0, 0.4, Math.PI / 2.4]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.022, 0.022, 0.7, 7]} />
          <meshStandardMaterial color="#6b4a2f" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

/* ── Pohon beringin: kanopi lebar khas alun-alun ───────────────────────────── */
export function PohonBeringin({
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
      {/* batang utama */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.44, 3, 9]} />
        <meshStandardMaterial color="#5f4a33" roughness={0.98} />
      </mesh>
      {/* cabang */}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.75, 2.9 + (i % 2) * 0.35, Math.sin(a) * 0.75]}
            rotation={[Math.sin(a) * 0.5, -a, -Math.cos(a) * 0.5]}
            castShadow
          >
            <cylinderGeometry args={[0.07, 0.13, 1.7, 6]} />
            <meshStandardMaterial color="#54412d" roughness={0.98} />
          </mesh>
        );
      })}
      {/* akar gantung */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        const r = 1.35 + (i % 3) * 0.28;
        return (
          <mesh key={`rt${i}`} position={[Math.cos(a) * r, 1.15, Math.sin(a) * r]} castShadow>
            <cylinderGeometry args={[0.03, 0.045, 2.3, 5]} />
            <meshStandardMaterial color="#6a543c" roughness={0.98} />
          </mesh>
        );
      })}
      {/* kanopi lebar — 3 bola low-poly */}
      <mesh position={[0, 4.15, 0]} scale={[2.6, 1.35, 2.6]} castShadow>
        <sphereGeometry args={[1.35, 14, 10]} />
        <meshStandardMaterial color="#2e5e2a" roughness={1} flatShading />
      </mesh>
      <mesh position={[1.5, 3.7, 0.6]} scale={[1.5, 0.95, 1.5]} castShadow>
        <sphereGeometry args={[1.05, 12, 9]} />
        <meshStandardMaterial color="#376e31" roughness={1} flatShading />
      </mesh>
      <mesh position={[-1.4, 3.8, -0.5]} scale={[1.4, 0.9, 1.4]} castShadow>
        <sphereGeometry args={[1.0, 12, 9]} />
        <meshStandardMaterial color="#29541f" roughness={1} flatShading />
      </mesh>
    </group>
  );
}

/* ── Wayang kulit: patung datar di dudukan batok pisang ────────────────────── */
function PuppetShape() {
  // siluet punakawan sederhana: badan + lengan menyamping
  const s = new THREE.Shape();
  s.moveTo(0, 0); // kaki
  s.lineTo(0.09, 0);
  s.lineTo(0.07, 0.38); // lutut
  s.lineTo(0.16, 0.52); // pinggul
  s.lineTo(0.13, 0.92); // badan
  s.lineTo(0.42, 1.02); // lengan kanan ke samping
  s.lineTo(0.44, 1.1);
  s.lineTo(0.14, 1.08);
  s.lineTo(0.1, 1.28); // leher
  s.lineTo(0.2, 1.36); // sangkutan wajah gayungan
  s.lineTo(0.06, 1.5); // mahkota
  s.lineTo(-0.06, 1.5);
  s.lineTo(-0.2, 1.36);
  s.lineTo(-0.06, 1.28);
  s.lineTo(-0.1, 1.08);
  s.lineTo(-0.14, 1.08);
  s.lineTo(-0.44, 1.1);
  s.lineTo(-0.42, 1.02);
  s.lineTo(-0.13, 0.92);
  s.lineTo(-0.16, 0.52);
  s.lineTo(-0.07, 0.38);
  s.lineTo(-0.09, 0);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false });
}

export function WayangKulit({
  position,
  rotation = 0,
  scale = 1,
  color = "#3b2412",
}: {
  position: [number, number, number];
  rotation?: number;
  scale?: number;
  color?: string;
}) {
  const geo = useMemo(PuppetShape, []);
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={[scale, scale, scale]}>
      <group position={[0, 0.32, 0]}>
        <mesh geometry={geo} castShadow>
          <meshStandardMaterial color={color} roughness={0.7} metalness={0.15} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* dudukan batok pisang */}
      <mesh position={[0, 0.09, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.3, 0.34, 0.18, 12]} />
        <meshStandardMaterial color="#c8bd7a" roughness={0.95} />
      </mesh>
    </group>
  );
}

/* ── Kuda lumping: hiasan kepala kuda anyaman bersandar ────────────────────── */
export function KudaLumping({
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
      {/* leher condong */}
      <mesh position={[0, 0.42, 0]} rotation={[0.5, 0, 0]} castShadow>
        <boxGeometry args={[0.16, 0.75, 0.3]} />
        <meshStandardMaterial color="#b23b3b" roughness={0.9} />
      </mesh>
      {/* kepala */}
      <mesh position={[0, 0.86, 0.24]} rotation={[0.35, 0, 0]} castShadow>
        <boxGeometry args={[0.14, 0.24, 0.42]} />
        <meshStandardMaterial color="#c04a4a" roughness={0.9} />
      </mesh>
      {/* telinga */}
      {[-0.05, 0.05].map((x) => (
        <mesh key={x} position={[x, 1.02, 0.14]} castShadow>
          <coneGeometry args={[0.035, 0.12, 4]} />
          <meshStandardMaterial color="#c04a4a" roughness={0.9} />
        </mesh>
      ))}
      {/* cambang anyaman emas */}
      <mesh position={[0, 0.66, 0.2]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[0.18, 0.3, 0.05]} />
        <meshStandardMaterial color="#e8c87a" roughness={0.7} emissive="#e8c87a" emissiveIntensity={0.08} />
      </mesh>
      {/* mata */}
      <mesh position={[0.075, 0.9, 0.36]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[-0.075, 0.9, 0.36]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
    </group>
  );
}
