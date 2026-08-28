import { Suspense, memo, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  AdaptiveDpr,
  AdaptiveEvents,
  Html,
  Line,
  OrbitControls,
  PerformanceMonitor,
} from "@react-three/drei";
import * as THREE from "three";
import { makeKawungTexture, SchoolEnvironment } from "./SchoolEnvironment";
import { setXRRenderer } from "./xr";
import { playGong, playThud } from "@/lib/audio";

const G = 9.81;
const RHO_AIR = 1.225; // kg/m³ air density at sea level
const LAUNCH_H = 1.55;
const THROWER_Y_OFFSET = 1.5;
const LAUNCH_Z = 1.5;
const FIGURE_HALF = 0.5; // lateral tolerance around the figure axis

// ── Target hardness types ────────────────────────────────────────────────────
export type TargetHardness = "cement" | "foam" | "banana";

// ── Panah Jemparingan defaults ────────────────────────────────────────────
const DEFAULT_DART_MASS = 0.012; // kg (panah jemparingan mass)
const DEFAULT_FEATHER_AREA = 0.0008; // m² cross-section of feather fletching
const DEFAULT_FEATHER_CD = 0.45; // drag coefficient of feather tail
const DEFAULT_NEEDLE_SHARPNESS = 0.85; // 0-1, how sharp the needle tip is
const DEFAULT_TARGET_HARDNESS: TargetHardness = "foam";

/** Hardness factor: higher = harder to penetrate */
const HARDNESS_FACTOR: Record<TargetHardness, number> = {
  cement: 0.95,
  foam: 0.25,
  banana: 0.4,
};

// ── Scoring zones of the Jemparingan ring target (lingkaran panahan) ───────
export type ZoneId = "kepala" | "leher" | "dada" | "kendil" | "bawah";
export type MissType = "none" | "pendek" | "tinggi" | "rendah" | "melebar";

export const TARGET_CENTER_Y = 1.5; // center height of the ring target

// Ring radii (from center outward) for each scoring zone
export const ZONE_RINGS: {
  id: ZoneId;
  label: string;
  innerR: number;
  outerR: number;
  points: number;
  color: string;
}[] = [
  { id: "kepala", label: "Sirah", innerR: 0, outerR: 0.15, points: 5, color: "#f4c430" },
  { id: "leher", label: "Gulu", innerR: 0.15, outerR: 0.32, points: 4, color: "#e07b39" },
  { id: "dada", label: "Dhada", innerR: 0.32, outerR: 0.52, points: 3, color: "#5b8fbf" },
  { id: "kendil", label: "Kendil", innerR: 0.52, outerR: 0.75, points: 2, color: "#6fae7a" },
  { id: "bawah", label: "Ngisor", innerR: 0.75, outerR: 1.0, points: 1, color: "#9a8c6a" },
];

// Legacy ZONES array kept for compatibility (height-based for resolveShot fallback)
export const ZONES: {
  id: ZoneId;
  label: string;
  min: number;
  max: number;
  points: number;
  color: string;
  yc: number;
}[] = [
  { id: "kepala", label: "Sirah", min: 0, max: 0.15, points: 5, color: "#f4c430", yc: 0.075 },
  { id: "leher", label: "Gulu", min: 0.15, max: 0.32, points: 4, color: "#e07b39", yc: 0.235 },
  { id: "dada", label: "Dhada", min: 0.32, max: 0.52, points: 3, color: "#5b8fbf", yc: 0.42 },
  { id: "kendil", label: "Kendil", min: 0.52, max: 0.75, points: 2, color: "#6fae7a", yc: 0.635 },
  { id: "bawah", label: "Ngisor", min: 0.75, max: 1.0, points: 1, color: "#9a8c6a", yc: 0.875 },
];

export const WIRE_Y = 2.78;

// ── Multiplayer (dua pemain duduk bersila berjejer) ──────────────────────────
export type PlayerId = 1 | 2;
export const PLAYER_X: Record<PlayerId, number> = { 1: -0.95, 2: 0.95 };
const PLAYER_COLOR: Record<PlayerId, string> = { 1: "#e63946", 2: "#2a6fdb" };

export type Selection = "murid" | "target" | "lintasan";
export type ShotResult = {
  range: number;
  maxH: number;
  time: number;
  hit: boolean;
  error: number;
  zone: ZoneId | null;
  points: number;
  missType: MissType;
  lateral: number;
  player: PlayerId;
  // ── Impact physics ──
  impactSpeed?: number; // m/s at impact
  impactEnergy?: number; // Joules at impact
  penetrationDepth?: number; // m (how deep the needle sticks in)
  angleOfEntry?: number; // degrees from horizontal
  stuck: boolean; // did the panah stick or bounce?
};
export type Pulse = { seq: number; hit: boolean };
export type Shake = { amp: number; seq: number };
export type HitFlash = { zone: ZoneId | null; seq: number };

export type ViewportProps = {
  angle: number;
  velocity: number;
  running: boolean;
  showTrajectory: boolean;
  showVectors: boolean;
  targetDistance: number;
  drag: number;
  wind: number;
  timeScale: number;
  cameraMode: "orbit" | "follow" | "side";
  selected: Selection;
  focusTick: number;
  previewStyle?: "cinematic" | "orbit" | "follow" | "aerial";
  isPreview?: boolean;
  gender: "male" | "female";
  onSelect: (s: Selection | null) => void;
  onLanded: (r: ShotResult) => void;
  onTick: (t: number, pos: [number, number, number], speed: number) => void;
  isEditMode?: boolean;
  watcherStudents?: Array<{
    id: number;
    position: [number, number, number];
    rotation: number;
    gender: "male" | "female";
    seed: number;
  }>;
  onUpdateStudentPosition?: (id: number, pos: [number, number, number]) => void;
  onRotateStudent?: (id: number, deltaRot: number) => void;
  selectedStudentId?: number | null;
  onSelectStudent?: (id: number | null) => void;
  isARMode?: boolean;
  multiplayer?: boolean;
  turn?: PlayerId;
  // ── Jemparingan ethno-physics parameters ──
  dartMass?: number; // kg
  featherArea?: number; // m²
  featherCd?: number;
  needleSharpness?: number;
  targetHardness?: TargetHardness;
  showRestoringTorque?: boolean;
  onTorqueHistory?: (h: TorqueRecord[]) => void;
};

function resolveShot(
  lateral: number,
  height: number,
): { zone: ZoneId | null; points: number; missType: MissType } {
  // Ring target: compute radial distance from target center
  const dy = height - TARGET_CENTER_Y;
  const radialDist = Math.sqrt(lateral * lateral + dy * dy);
  if (radialDist > ZONE_RINGS[ZONE_RINGS.length - 1]!.outerR + 0.15)
    return { zone: null, points: 0, missType: "melebar" };
  const z = ZONE_RINGS.find((zz) => radialDist >= zz.innerR && radialDist <= zz.outerR);
  if (z) return { zone: z.id, points: z.points, missType: "none" };
  if (radialDist > ZONE_RINGS[ZONE_RINGS.length - 1]!.outerR)
    return { zone: null, points: 0, missType: "tinggi" };
  return { zone: null, points: 0, missType: "rendah" };
}

/** Physics state for restoring torque tracking */
export type TorqueRecord = { t: number; aoa: number; torque: number };

/** Aerodynamic parameters */
export type AeroParams = {
  featherArea: number; // cross-sectional area of fletching (m²)
  featherCd: number; // drag coefficient of feather tail
  dartMass: number; // total dart mass (kg)
};

/** Integrated flight — 3D (downrange d, lateral w, height h),
 *  feather aerodynamics + restoring torque + wind aware.
 *  Uses Fd = 0.5 * rho * v² * A * Cd for drag force on feather tail.
 *  CoM is forward (needle), CoP is rearward (feathers) → self-correcting pitch.
 */
/** Gain angin: diperkuat supaya defleksi lateral terasa jelas saat lempar. */
const WIND_GAIN = 2.6;

function integratePath3D(
  angle: number,
  velocity: number,
  wind: number,
  drag: number,
  aero?: AeroParams,
) {
  const rad = (angle * Math.PI) / 180;
  let vd = velocity * Math.cos(rad);
  let vh = velocity * Math.sin(rad);
  let vw = 0;
  let d = 0;
  let w = 0;
  let h = LAUNCH_H;
  let t = 0;
  let maxH = LAUNCH_H;
  const dt = 1 / 240;
  const pts: [number, number, number][] = [[w, h, d]];
  const torqueHistory: TorqueRecord[] = [];

  // CoM–CoP distance (m): needle is ~0.15m forward of feather tail center
  const dCoMCoP = aero ? 0.15 : 0;
  // Moment of inertia about CoM (simplified rod model)
  const I = aero ? (1 / 12) * aero.dartMass * 0.26 * 0.26 : 0;

  let pitchAngle = rad; // current pitch angle of the dart body
  let pitchRate = 0; // angular velocity of pitch

  while (h > 0 && t < 120) {
    const v = Math.hypot(vd, vh, vw);

    if (aero && aero.featherArea > 0 && v > 0.01) {
      // ── Feather aerodynamic drag force ──
      // Fd = 0.5 * rho * v² * A * Cd
      const Fd = 0.5 * RHO_AIR * v * v * aero.featherArea * aero.featherCd;
      // Drag opposes velocity direction
      const axDrag = -(Fd / aero.dartMass) * (vd / v);
      const ayDrag = -(Fd / aero.dartMass) * (vh / v);
      const azDrag = -(Fd / aero.dartMass) * (vw / v);

      // ── Angle of attack & restoring torque ──
      // AoA = difference between velocity direction and body pitch
      const velAngle = Math.atan2(vh, vd);
      const aoa = pitchAngle - velAngle;

      // Restoring torque: feather acts as stabilizer, tries to align body with velocity
      // τ = -k * aoa - c * pitchRate  (spring-damper model)
      const kRestore = 2.5; // spring constant (N·m/rad)
      const cDamp = 0.3; // damping constant (N·m·s/rad)
      const torque = -kRestore * aoa - cDamp * pitchRate;

      // Angular acceleration
      const alpha = I > 0 ? torque / I : 0;
      pitchRate += alpha * dt;
      pitchAngle += pitchRate * dt;

      // Apply feather drag (gravity applied below)
      vd += axDrag * dt;
      vh += ayDrag * dt;
      vw += azDrag * dt;

      // Store torque for HUD graph
      if (torqueHistory.length < 600) {
        torqueHistory.push({ t, aoa: aoa * (180 / Math.PI), torque });
      }
    }

    // Hambatan udara dari slider k — aktif di kedua mode biar terasa
    if (drag > 0) {
      vd -= drag * v * vd * dt;
      vh -= drag * v * vh * dt;
      vw -= drag * v * vw * dt;
    }
    vh -= G * dt;

    vw += wind * WIND_GAIN * dt;
    d += vd * dt;
    w += vw * dt;
    h += vh * dt;
    t += dt;
    maxH = Math.max(maxH, h);
    pts.push([w, h, d]);
  }

  // ── Impact physics at ground ──
  const impactSpeed =
    pts.length >= 2
      ? Math.hypot(
          pts[pts.length - 1]![0] - pts[pts.length - 2]![0],
          pts[pts.length - 1]![1] - pts[pts.length - 2]![1],
          pts[pts.length - 1]![2] - pts[pts.length - 2]![2],
        ) / dt
      : 0;

  return {
    time: t,
    range: d,
    maxH,
    pts,
    torqueHistory,
    impactSpeed,
    finalPitch: pitchAngle * (180 / Math.PI),
  };
}

/** Predicted launch components + summary (drag/wind/aero aware via numeric integration). */
export function predict(angle: number, velocity: number, drag = 0, wind = 0, aero?: AeroParams) {
  const p = integratePath3D(angle, velocity, wind, drag, aero);
  const rad = (angle * Math.PI) / 180;
  return {
    vd: velocity * Math.cos(rad),
    vy: velocity * Math.sin(rad),
    time: p.time,
    range: p.range,
    maxH: p.maxH,
    torqueHistory: p.torqueHistory,
    impactSpeed: p.impactSpeed,
    finalPitch: p.finalPitch,
  };
}

// ══════════════════════════════ SCENE PIECES ═════════════════════════════════

type V3 = [number, number, number];
type BurstFxData = { id: number; pos: V3; color: string; spark: boolean };
type PopupData = { id: number; pos: V3; text: string; color: string };
type FlightState = {
  active: boolean;
  t: number;
  T: number;
  maxH: number;
  crossed: boolean;
  result: ShotResult | null;
  pts: V3[];
  player: PlayerId;
  torqueHistory: TorqueRecord[];
  impactSpeed: number;
};

const _dirV = new THREE.Vector3();
const _fwdZ = new THREE.Vector3(0, 0, 1);
const _qTarget = new THREE.Quaternion();

/* ── Panah Jemparingan: kawat baja + bulu paper berwarna ─────────────────── */
const PaserModel = memo(function PaserModel() {
  return (
    <group>
      {/* needle body along +z (nose) */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.011, 0.011, 0.21, 6]} />
        <meshStandardMaterial color="#c9d2da" metalness={0.75} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.125]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.016, 0.05, 8]} />
        <meshStandardMaterial color="#8f9aa4" metalness={0.8} roughness={0.25} />
      </mesh>
      {/* crossed paper fins at the tail */}
      <mesh position={[0, 0, -0.105]}>
        <boxGeometry args={[0.062, 0.0016, 0.085]} />
        <meshStandardMaterial color="#e63946" side={THREE.DoubleSide} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, -0.105]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.062, 0.0016, 0.085]} />
        <meshStandardMaterial color="#f4c430" side={THREE.DoubleSide} roughness={0.7} />
      </mesh>
    </group>
  );
});

/* ── Target Jemparingan: lingkaran konsentris (seperti target panah) ────── */
function TargetJemparingan({
  distance,
  flash,
  onPick,
}: {
  distance: number;
  flash: HitFlash | null;
  onPick: () => void;
}) {
  const [hover, setHover] = useState<ZoneId | null>(null);
  const litZone = hover ?? flash?.zone ?? null;
  const lastHit = useRef(0);
  const shakeRef = useRef(0);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!flash || !flash.zone || flash.seq === lastHit.current) return;
    lastHit.current = flash.seq;
    shakeRef.current = 1;
  }, [flash]);

  useFrame((state, rawDt) => {
    if (!groupRef.current) return;
    const dt = Math.min(rawDt, 1 / 20);
    shakeRef.current = Math.max(0, shakeRef.current - dt * 3);
    // Subtle wobble on hit
    groupRef.current.rotation.y =
      Math.sin(state.clock.elapsedTime * 1.2) * 0.01 +
      (shakeRef.current > 0 ? Math.sin(state.clock.elapsedTime * 30) * 0.05 * shakeRef.current : 0);
  });

  const zoneEvents = (zid: ZoneId) => ({
    onPointerOver: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      setHover(zid);
    },
    onPointerOut: () => setHover((h) => (h === zid ? null : h)),
  });

  // Build concentric rings from outside in (so inner rings render on top)
  const rings = [...ZONE_RINGS].reverse();

  return (
    <group
      position={[0, 0, LAUNCH_Z - distance]}
      onClick={(e) => {
        e.stopPropagation();
        onPick();
      }}
    >
      {/* two wooden poles */}
      {[-1.4, 1.4].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 1.55, 0]} castShadow>
            <cylinderGeometry args={[0.045, 0.065, 3.1, 10]} />
            <meshStandardMaterial color="#7a5230" roughness={0.92} />
          </mesh>
          <mesh position={[0, 3.14, 0]} castShadow>
            <sphereGeometry args={[0.06, 10, 8]} />
            <meshStandardMaterial color="#caa96a" roughness={0.6} />
          </mesh>
        </group>
      ))}
      {/* crossbeam */}
      <mesh position={[0, WIRE_Y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 2.84, 8]} />
        <meshStandardMaterial color="#8a8a8a" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* ropes to hold target */}
      {[-0.38, 0.38].map((x) => (
        <mesh key={`rope${x}`} position={[x, WIRE_Y - 0.09, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.2, 6]} />
          <meshStandardMaterial color="#b0946a" roughness={0.9} />
        </mesh>
      ))}

      {/* ring target disc (vertical, facing the thrower) */}
      <group ref={groupRef} position={[0, TARGET_CENTER_Y, 0]}>
        {/* Back board */}
        <mesh position={[0, 0, -0.025]} castShadow>
          <circleGeometry args={[1.05, 48]} />
          <meshStandardMaterial color="#5a3a1a" roughness={0.95} />
        </mesh>

        {/* Concentric rings — rendered from largest (outermost) to smallest */}
        {rings.map((ring) => {
          const isLit = litZone === ring.id;
          return (
            <mesh
              key={ring.id}
              position={[0, 0, 0.001]}
              rotation={[0, 0, 0]}
              castShadow
              {...zoneEvents(ring.id)}
            >
              <ringGeometry args={[ring.innerR, ring.outerR, 64]} />
              <meshStandardMaterial
                color={isLit ? "#fff1bd" : ring.color}
                emissive={ring.color}
                emissiveIntensity={isLit ? 0.55 : 0}
                roughness={0.85}
                side={THREE.DoubleSide}
              />
            </mesh>
          );
        })}

        {/* Center bullseye dot */}
        <mesh position={[0, 0, 0.005]}>
          <circleGeometry args={[0.04, 16]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
        </mesh>

        {/* Thin gold ring at center for visual pop */}
        <mesh position={[0, 0, 0.006]}>
          <ringGeometry args={[0.14, 0.155, 48]} />
          <meshStandardMaterial
            color="#d9a441"
            emissive="#d9a441"
            emissiveIntensity={0.3}
            roughness={0.5}
          />
        </mesh>
      </group>

      {/* Zone labels beside the target */}
      {ZONE_RINGS.map((z, i) => {
        const yOff = TARGET_CENTER_Y + 0.75 - i * 0.28;
        return (
          <Html
            key={z.id}
            position={[1.3, yOff, 0]}
            center
            distanceFactor={13}
            zIndexRange={[30, 0]}
            style={{ pointerEvents: "none" }}
          >
            <div className="world-tag zone-tag" style={{ borderColor: z.color, color: "#ffffff" }}>
              {z.label} · {z.points} Poin
            </div>
          </Html>
        );
      })}
    </group>
  );
}

/* ── Sparkle burst / dust puff ─────────────────────────────────────────────── */
function BurstFx({ burst }: { burst: BurstFxData }) {
  const grp = useRef<THREE.Group>(null);
  const life = useRef(0);
  const seeds = useMemo(
    () =>
      Array.from({ length: burst.spark ? 22 : 12 }, () => {
        const v = new THREE.Vector3().randomDirection();
        v.y = Math.abs(v.y) * 0.9 + 0.35;
        return {
          v: v.multiplyScalar(burst.spark ? 1.5 + Math.random() * 1.6 : 0.8 + Math.random()),
          s: 0.02 + Math.random() * 0.028,
        };
      }),
    [burst.spark],
  );

  useFrame((_, rawDt) => {
    if (!grp.current) return;
    life.current += rawDt;
    const t = life.current;
    grp.current.children.forEach((c, i) => {
      const sd = seeds[i % seeds.length]!;
      c.position.set(sd.v.x * t, sd.v.y * t - 4.2 * t * t, sd.v.z * t);
      const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
      m.opacity = Math.max(0, 1 - t / 0.95);
    });
  });

  return (
    <group ref={grp} position={burst.pos}>
      {seeds.map((sd, i) => (
        <mesh key={i} scale={sd.s}>
          <sphereGeometry args={[1, 6, 6]} />
          <meshStandardMaterial
            color={burst.color}
            emissive={burst.color}
            emissiveIntensity={burst.spark ? 1.3 : 0.2}
            transparent
            opacity={1}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ── Wind indicator: pole + drifting arrows + tag ──────────────────────────── */
function WindIndicator({ wind, distance }: { wind: number; distance: number }) {
  const strength = Math.min(1, Math.abs(wind) / 6);
  const dir = wind >= 0 ? 1 : -1;
  const arrows = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!arrows.current) return;
    const off = ((clock.elapsedTime * (0.4 + strength * 1.6)) % 1.1) - 0.55;
    arrows.current.position.x = dir * off * strength;
  });

  if (wind === 0 && strength === 0) {
    return (
      <group position={[2.6, 0, LAUNCH_Z - distance * 0.55]}>
        <mesh position={[0, 1, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.04, 2, 8]} />
          <meshStandardMaterial color="#6b6b6b" metalness={0.5} roughness={0.5} />
        </mesh>
        <Html position={[0, 2.25, 0]} center distanceFactor={13}>
          <div className="world-tag wind-tag">Angin Tenang</div>
        </Html>
      </group>
    );
  }

  return (
    <group position={[2.6, 0, LAUNCH_Z - distance * 0.55]}>
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.04, 2, 8]} />
        <meshStandardMaterial color="#6b6b6b" metalness={0.5} roughness={0.5} />
      </mesh>
      <group ref={arrows}>
        {[0, 1, 2].map((i) => (
          <group key={i} position={[dir * (0.3 + i * 0.42), 2.1 - i * 0.26, 0]}>
            <mesh>
              <boxGeometry args={[0.34, 0.02, 0.02]} />
              <meshStandardMaterial color="#4da3ff" transparent opacity={0.25 + strength * 0.55} />
            </mesh>
            <mesh
              position={[dir * 0.24, 0, 0]}
              rotation={[0, 0, dir > 0 ? -Math.PI / 2 : Math.PI / 2]}
            >
              <coneGeometry args={[0.08, 0.16, 8]} />
              <meshStandardMaterial
                color="#4da3ff"
                emissive="#4da3ff"
                emissiveIntensity={0.4}
                transparent
                opacity={0.3 + strength * 0.6}
              />
            </mesh>
          </group>
        ))}
      </group>
      <Html position={[0, 2.5, 0]} center distanceFactor={13}>
        <div className="world-tag wind-tag">
          Angin {dir > 0 ? "→" : "←"} {Math.abs(wind).toFixed(1)} m/s
        </div>
      </Html>
    </group>
  );
}

/* ── Distance markers every 5 m + guide line (kalibrasi jarak) ─────────────── */
function DistanceMarkers({ distance }: { distance: number }) {
  const marks = useMemo(() => {
    const arr: number[] = [];
    for (let d = 5; d < distance; d += 5) arr.push(d);
    arr.push(Math.round(distance));
    return arr;
  }, [distance]);

  return (
    <group>
      <Line
        points={[
          [0, 0.02, LAUNCH_Z],
          [0, 0.02, LAUNCH_Z - distance],
        ]}
        color="#ffffff"
        transparent
        opacity={0.4}
        dashed
        dashSize={0.5}
        gapSize={0.5}
        lineWidth={1.2}
      />
      {marks.map((d) => (
        <group key={d} position={[0, 0, LAUNCH_Z - d]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1.35, 0.02, 0]}>
            <ringGeometry args={[0.14, 0.21, 20]} />
            <meshBasicMaterial color={d === Math.round(distance) ? "#e63946" : "#ffffff"} />
          </mesh>
          <Html position={[1.35, 0.22, 0]} center distanceFactor={14}>
            <div className="world-tag" style={{ fontSize: 10 }}>
              {d} m
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

/* ── Launch pad: area duduk bersila ────────────────────────────────────────── */
function LaunchPad({
  x,
  active,
  playerLabel,
  playerColor,
}: {
  x: number;
  active: boolean;
  playerLabel?: string | undefined;
  playerColor?: string | undefined;
}) {
  const ring = useRef<THREE.Mesh>(null);
  const batik = useMemo(() => makeKawungTexture(4, 3), []);
  useFrame(({ clock }) => {
    if (!ring.current || !active) return;
    ring.current.rotation.z = clock.elapsedTime * 1.1;
    const s = 1 + Math.sin(clock.elapsedTime * 3) * 0.05;
    ring.current.scale.setScalar(s);
  });

  return (
    <group position={[x, 0, LAUNCH_Z]}>
      {/* tikar anyaman */}
      <mesh position={[0, 0.015, 0]} receiveShadow>
        <boxGeometry args={[1.5, 0.03, 1.05]} />
        <meshStandardMaterial color="#b23b3b" roughness={0.95} />
      </mesh>
      {/* alasan batik kawung */}
      <mesh position={[0, 0.031, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.42, 0.98]} />
        <meshStandardMaterial map={batik} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.032, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.52, 0.58, 28]} />
        <meshBasicMaterial color="#e8c87a" />
      </mesh>
      {active && (
        <mesh ref={ring} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.66, 0.78, 32, 1, 0, Math.PI * 1.7]} />
          <meshBasicMaterial
            color={playerColor ?? "#4da3ff"}
            transparent
            opacity={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {playerLabel && (
        <Html position={[0, 2.35, 0]} center distanceFactor={12}>
          <div
            className="world-tag mp-chip"
            style={{ borderColor: playerColor, color: playerColor }}
          >
            {playerLabel}
          </div>
        </Html>
      )}
    </group>
  );
}

/* ── Predicted trajectory line (garis lintasan) ────────────────────────────── */
function PredictedPath({
  angle,
  velocity,
  wind,
  drag,
  ox,
  aero,
}: {
  angle: number;
  velocity: number;
  wind: number;
  drag: number;
  ox: number;
  aero?: AeroParams;
}) {
  const path = useMemo(
    () => integratePath3D(angle, velocity, wind, drag, aero),
    [angle, velocity, wind, drag, aero],
  );
  const pts = useMemo(
    () =>
      path.pts
        .filter((_, i) => i % 6 === 0)
        .map(([w, h, d]) => new THREE.Vector3(ox + w, h, LAUNCH_Z - d)),
    [path, ox],
  );
  const end = pts[pts.length - 1];

  return (
    <group>
      <Line
        points={pts}
        color="#ffd54a"
        lineWidth={2}
        dashed
        dashSize={0.35}
        gapSize={0.2}
        transparent
        opacity={0.85}
      />
      {end && (
        <>
          <mesh position={[end.x, 0.03, end.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.18, 0.26, 22]} />
            <meshBasicMaterial color="#ffd54a" transparent opacity={0.9} />
          </mesh>
          <Html position={[end.x, 0.35, end.z]} center distanceFactor={14}>
            <div className="world-tag">Prediksi {path.range.toFixed(1)} m</div>
          </Html>
        </>
      )}
    </group>
  );
}

/* ── Initial velocity vector arrow (vektor kecepatan) ──────────────────────── */
function VelocityArrow({ angle, velocity, ox }: { angle: number; velocity: number; ox: number }) {
  const rad = (angle * Math.PI) / 180;
  const vd = velocity * Math.cos(rad);
  const vy = velocity * Math.sin(rad);
  const S = 0.22;
  const from = useMemo(() => new THREE.Vector3(ox, LAUNCH_H, LAUNCH_Z), [ox]);
  const to = useMemo(
    () => new THREE.Vector3(ox, LAUNCH_H + vy * S, LAUNCH_Z - vd * S),
    [ox, vy, vd, S],
  );
  const quat = useMemo(() => {
    const dir = to.clone().sub(from).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  }, [from, to]);

  return (
    <group>
      <Line points={[from, to]} color="#ff5252" lineWidth={3} />
      <mesh position={to} quaternion={quat}>
        <coneGeometry args={[0.05, 0.14, 10]} />
        <meshStandardMaterial color="#ff5252" emissive="#ff5252" emissiveIntensity={0.5} />
      </mesh>
      <Html position={[to.x, to.y + 0.18, to.z]} center distanceFactor={14}>
        <div className="world-tag vec-tag">
          v₀ = {velocity.toFixed(1)} m/s · θ = {angle}°
        </div>
      </Html>
    </group>
  );
}

/* ── Restoring torque graph overlay (in-world 3D line) ─────────────────────── */
function RestoringTorqueViz({
  show,
  history,
  targetDistance,
}: {
  show: boolean;
  history: TorqueRecord[];
  targetDistance: number;
}) {
  const pts = useMemo(() => {
    if (!show || history.length < 2) return [];
    const maxT = history[history.length - 1]!.t || 1;
    const maxTorque = Math.max(...history.map((h) => Math.abs(h.torque)), 1);
    return history
      .filter((_, i) => i % 4 === 0)
      .map((h) => {
        const x = 2.5 + (h.t / maxT) * 2;
        const y = 3.2 + (h.torque / maxTorque) * 0.8;
        const z = LAUNCH_Z - targetDistance * 0.5;
        return new THREE.Vector3(x, y, z);
      });
  }, [show, history, targetDistance]);

  if (pts.length < 2) return null;

  return (
    <group>
      <Line points={pts} color="#ff8a00" lineWidth={2} transparent opacity={0.85} />
      <Html position={[2.5, 4.2, LAUNCH_Z - targetDistance * 0.5]} center distanceFactor={14}>
        <div className="world-tag vec-tag" style={{ borderColor: "#ff8a00", color: "#c06600" }}>
          Restoring Torque (τ)
        </div>
      </Html>
    </group>
  );
}

/* ── Camera rig: orbit / follow projectile / side view + focus tween ───────── */
function CameraRig({
  mode,
  targetDistance,
  focusTick,
  selected,
  followPos,
  isARMode,
  previewStyle,
  isPreview,
}: {
  mode: ViewportProps["cameraMode"];
  targetDistance: number;
  focusTick: number;
  selected: Selection;
  followPos: React.MutableRefObject<THREE.Vector3 | null>;
  isARMode: boolean;
  previewStyle?: "cinematic" | "orbit" | "follow" | "aerial" | undefined;
  isPreview?: boolean | undefined;
}) {
  const { camera } = useThree();
  const controls = useRef<{ target: THREE.Vector3; update: () => void } | null>(null);
  const goal = useRef<THREE.Vector3 | null>(null);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  /* Titik fokus kamera di-smooth terpisah → view tidak getar saat panah melaju cepat */
  const aim = useMemo(() => new THREE.Vector3(0, LAUNCH_H, LAUNCH_Z), []);

  useEffect(() => {
    if (focusTick === 0) return;
    const zT = LAUNCH_Z - targetDistance;
    goal.current =
      selected === "murid"
        ? new THREE.Vector3(0, 1.4, LAUNCH_Z)
        : selected === "target"
          ? new THREE.Vector3(0, 1.7, zT)
          : new THREE.Vector3(0, 1.2, (LAUNCH_Z + zT) / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTick]);

  useFrame((state, rawDt) => {
    if (isARMode) return;
    const dt = Math.min(rawDt, 1 / 20);
    const k = 1 - Math.exp(-5 * dt);
    const t = state.clock.elapsedTime;
    const cz = LAUNCH_Z - Math.min(targetDistance, 30) * 0.45;

    // ── Multi-style cinematic preview ──────────────────────────────────────
    if (isPreview && previewStyle === "orbit") {
      const r = 15;
      const a = t * 0.18;
      tmp.set(Math.sin(a) * r, 5.6 + Math.sin(t * 0.3) * 0.6, cz + Math.cos(a) * r);
      camera.position.lerp(tmp, k);
      camera.lookAt(0, 1.4, cz);
      return;
    }
    if (isPreview && previewStyle === "aerial") {
      tmp.set(Math.sin(t * 0.12) * 6, 20 + Math.sin(t * 0.2) * 1.5, cz + 10 + Math.cos(t * 0.12) * 4);
      camera.position.lerp(tmp, k);
      camera.lookAt(0, 0.4, cz);
      return;
    }
    if (isPreview && (previewStyle === "cinematic" || previewStyle === "follow") && followPos.current) {
      const offY = previewStyle === "cinematic" ? 1.15 : 0.7;
      const offZ = previewStyle === "cinematic" ? 3.6 : 3.2;
      // Sedikit guncangan tangan (handheld) pada gaya sinematik → kesan hidup/film.
      const sx = previewStyle === "cinematic" ? Math.sin(t * 1.7) * 0.05 + Math.sin(t * 0.9) * 0.03 : 0;
      const sy = previewStyle === "cinematic" ? Math.cos(t * 1.3) * 0.04 : 0;
      tmp.set(
        followPos.current.x + sx,
        followPos.current.y + offY + sy,
        followPos.current.z + offZ,
      );
      camera.position.lerp(tmp, k);
      aim.lerp(followPos.current, Math.min(1, dt * 12));
      camera.lookAt(aim);
      return;
    }

    if (mode === "follow" && followPos.current) {
      tmp.set(followPos.current.x, followPos.current.y + 0.7, followPos.current.z + 3.2);
      camera.position.lerp(tmp, k);
      aim.lerp(followPos.current, Math.min(1, dt * 12));
      camera.lookAt(aim);
    } else if (mode === "side") {
      tmp.set(13.5, 2.6, LAUNCH_Z - targetDistance / 2);
      camera.position.lerp(tmp, k);
      look.set(0, 1.3, LAUNCH_Z - targetDistance / 2);
      camera.lookAt(look);
    } else if (goal.current && controls.current) {
      controls.current.target.lerp(goal.current, k);
      controls.current.update();
      if (controls.current.target.distanceTo(goal.current) < 0.04) goal.current = null;
    }
  });

  if (isARMode) return null;
  return (
    <OrbitControls
      ref={controls as never}
      makeDefault
      enabled={mode === "orbit"}
      target={[0, 1.3, LAUNCH_Z - Math.min(targetDistance * 0.4, 9)]}
      maxPolarAngle={Math.PI / 2.04}
      minDistance={2}
      maxDistance={70}
      enableDamping
      dampingFactor={0.08}
    />
  );
}

// ═══════════════════════════════ MAIN SCENE ══════════════════════════════════

/* ── Langit Jawa: gradasi senja keemasan + awan cumulus bergerak pelan ───────
   Satu dome + fragment shader saja → sangat ringan, tanpa lag. */
const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform float uTime;
  uniform vec3 uZenith;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uCloud;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
  float fbm3(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec2(17.3, 9.1);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    // gradasi langit sore khas Jawa
    vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.28, h));
    col = mix(col, uZenith, smoothstep(0.22, 0.75, h));
    // kabut hangat di bawah horizon
    col = mix(vec3(0.93, 0.83, 0.68), col, smoothstep(-0.08, 0.02, h));
    // awan hanya dihitung di atas horizon → hemat GPU
    if (h > 0.02) {
      vec2 uv = d.xz / max(h, 0.055);
      float t = uTime * 0.008;
      float n = fbm3(uv * 0.55 + vec2(t, t * 0.55));
      n += 0.35 * noise(uv * 1.4 - vec2(t * 0.7, t * 0.3)) * 2.0;
      float cover = smoothstep(0.62, 0.95, n);
      float mask = smoothstep(0.03, 0.16, h);
      col = mix(col, uCloud, cover * mask * 0.88);
    }
    // semburat emas arah matahari
    float sun = pow(max(dot(d, normalize(vec3(0.55, 0.32, -0.75))), 0.0), 6.0);
    col += vec3(0.35, 0.22, 0.06) * sun;
    gl_FragColor = vec4(col, 1.0);
  }
`;

function LangitJawa() {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uZenith: { value: new THREE.Color("#2f6fb4") },
      uMid: { value: new THREE.Color("#7fb2dd") },
      uHorizon: { value: new THREE.Color("#f2c98f") },
      uCloud: { value: new THREE.Color("#fff7ea") },
    }),
    [],
  );
  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <mesh frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[320, 32, 20]} />
      <shaderMaterial
        vertexShader={SKY_VERT}
        fragmentShader={SKY_FRAG}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
}

function Scene(props: ViewportProps) {
  const {
    angle,
    velocity,
    running,
    showTrajectory,
    showVectors,
    targetDistance,
    drag,
    wind,
    timeScale,
    cameraMode,
    selected,
    focusTick,
    gender,
    onSelect,
    isARMode,
    previewStyle,
    isPreview,
    multiplayer,
    turn = 1,
    watcherStudents = [],
    // ── Jemparingan physics params ──
    dartMass = DEFAULT_DART_MASS,
    featherArea = DEFAULT_FEATHER_AREA,
    featherCd = DEFAULT_FEATHER_CD,
    needleSharpness = DEFAULT_NEEDLE_SHARPNESS,
    targetHardness = DEFAULT_TARGET_HARDNESS,
    showRestoringTorque = false,
    onTorqueHistory,
  } = props;

  const aeroParams: AeroParams = useMemo(
    () => ({
      featherArea,
      featherCd,
      dartMass,
    }),
    [featherArea, featherCd, dartMass],
  );

  const tickCb = useRef(props.onTick);
  tickCb.current = props.onTick;
  const landedCb = useRef(props.onLanded);
  landedCb.current = props.onLanded;
  const torqueCb = useRef(props.onTorqueHistory);
  torqueCb.current = props.onTorqueHistory;

  const proj = useRef<THREE.Group>(null);
  const followPos = useRef<THREE.Vector3 | null>(null);
  const phase1 = useRef(0);
  const phase2 = useRef(0);
  const fl = useRef<FlightState>({
    active: false,
    t: 0,
    T: 0,
    maxH: LAUNCH_H,
    crossed: false,
    result: null,
    pts: [],
    player: 1,
    torqueHistory: [],
    impactSpeed: 0,
  });

  const [flash, setFlash] = useState<HitFlash | null>(null);
  const fxSeq = useRef(0);
  const [bursts, setBursts] = useState<BurstFxData[]>([]);
  const [popups, setPopups] = useState<PopupData[]>([]);
  const fxId = useRef(0);
  const [pulse, setPulse] = useState<Pulse>({ seq: 0, hit: false });
  const [torqueHist, setTorqueHist] = useState<TorqueRecord[]>([]);

  const pushBurst = (pos: V3, color: string, spark: boolean) => {
    const id = ++fxId.current;
    setBursts((b) => [...b.slice(-6), { id, pos, color, spark }]);
    window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1100);
  };
  const pushPopup = (pos: V3, text: string, color: string) => {
    const id = ++fxId.current;
    setPopups((p) => [...p.slice(-4), { id, pos, text, color }]);
    window.setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 1500);
  };

  const originX = multiplayer ? PLAYER_X[turn]! : 0;

  // Environment (langit + sekolah) statis → di-memo supaya tidak dibangun ulang
  // tiap kali state FX (burst/popup/flash) berubah, menjaga frame tetap ringan.
  // throwingRef dibaca tiap frame oleh karakter agar tetap bereaksi tanpa re-render.
  const throwingRef = useRef(running);
  throwingRef.current = running;
  const staticEnv = useMemo(
    () => (!isARMode ? <><LangitJawa /><SchoolEnvironment throwingRef={throwingRef} /></> : null),
    [isARMode, throwingRef],
  );

  /* Start of throw — snapshot parameters once per run */
  useEffect(() => {
    if (!running) return;
    const path = integratePath3D(angle, velocity, wind, drag, aeroParams);
    fl.current = {
      active: true,
      t: 0,
      T: path.time,
      maxH: path.maxH,
      crossed: false,
      result: null,
      pts: path.pts.map(([w, h, d]) => [originX + w, h, LAUNCH_Z - d] as V3),
      player: turn,
      torqueHistory: path.torqueHistory,
      impactSpeed: path.impactSpeed,
    };
    proj.current?.quaternion.identity();
    if (turn === 1) phase1.current = 0;
    else phase2.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  /* Flight simulation frame step */
  useFrame((_, rawDt) => {
    const f = fl.current;
    const g = proj.current;
    if (!g) return;
    if (!f.active || f.pts.length < 2) {
      g.visible = false;
      return;
    }
    const STEP = 1 / 240;
    /* Clamp dt: spike FPS tidak membuat panah melompat — simulasi tetap halus */
    const dt = Math.min(Math.max(rawDt, 1 / 1000), 1 / 30);
    f.t = Math.min(f.T, f.t + dt * timeScale);

    const i = Math.min(f.pts.length - 2, Math.floor(f.t / STEP));
    const a = f.pts[i]!;
    const b = f.pts[i + 1]!;
    const fr = THREE.MathUtils.clamp((f.t - i * STEP) / STEP, 0, 1);
    const cx = a[0] + (b[0] - a[0]) * fr;
    const cy = a[1] + (b[1] - a[1]) * fr;
    const cz = a[2] + (b[2] - a[2]) * fr;

    g.visible = true;
    g.position.set(cx, cy, cz);

    /* Orientasi realistik: hidung dart selalu maju mengikuti arah tembak
       (pitch mengikuti lengkung lintasan, smoothing bebas frame-rate) */
    _dirV.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (_dirV.lengthSq() > 1e-12) {
      _dirV.normalize();
      _qTarget.setFromUnitVectors(_fwdZ, _dirV);
      g.quaternion.slerp(_qTarget, 1 - Math.exp(-14 * dt));
      /* Putaran poros ala paseran asli (diputar telapak tangan saat dilempar) */
      g.rotateZ(dt * timeScale * 5);
    }

    if (!followPos.current) followPos.current = new THREE.Vector3();
    followPos.current.set(cx, cy, cz);

    if (f.player === 1) phase1.current = Math.min(1, f.t / 0.5);
    else phase2.current = Math.min(1, f.t / 0.5);

    const downrange = LAUNCH_Z - cz;
    const sp = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / STEP;
    tickCb.current(f.t, [downrange, cy, 0], sp);

    /* crossing the target plane → scoring */
    const planeZ = LAUNCH_Z - targetDistance;
    if (!f.crossed && a[2] >= planeZ && b[2] < planeZ) {
      f.crossed = true;
      const span = a[2] - b[2] || 1e-6;
      const k = (a[2] - planeZ) / span;
      const hy = a[1] + (b[1] - a[1]) * k;
      const lx = a[0] + (b[0] - a[0]) * k;
      const lateral = lx - PLAYER_X[f.player];
      const res = resolveShot(lateral, hy);
      const hitPos: V3 = [lx, hy, planeZ + 0.06];
      const meta = res.zone ? ZONES.find((z) => z.id === res.zone)! : null;
      // ── Impact physics calculation ──
      const mSpeed = f.impactSpeed || Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / STEP;
      const impactE = 0.5 * dartMass * mSpeed * mSpeed;
      const hardnessF = HARDNESS_FACTOR[targetHardness] ?? 0.25;
      // Penetration depth: deeper when faster, sharper needle, softer target
      const penDepth = Math.min(0.06, (impactE * needleSharpness * (1 - hardnessF)) / 2.5);
      const angleEntry = Math.atan2(Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2])) * (180 / Math.PI);
      const didStick = penDepth > 0.008 && res.zone !== null;

      f.result = {
        range: 0,
        maxH: f.maxH,
        time: f.t,
        hit: res.zone !== null,
        error: 0,
        zone: res.zone,
        points: res.points,
        missType: res.missType,
        lateral,
        player: f.player,
        impactSpeed: mSpeed,
        impactEnergy: impactE,
        penetrationDepth: penDepth,
        angleOfEntry: angleEntry,
        stuck: didStick,
      };
      if (meta) {
        fxSeq.current += 1;
        setFlash({ zone: meta.id, seq: fxSeq.current });
        pushBurst(hitPos, meta.color, true);
        playGong(res.zone === "kepala" ? 1 : 0.7);
        pushPopup(
          [hitPos[0], hitPos[1] + 0.35, hitPos[2]],
          res.zone === "kepala"
            ? `+${res.points} SIRAH! KRITIS!`
            : `+${res.points} ${meta.label.toUpperCase()}!`,
          meta.color,
        );
      } else {
        pushPopup(hitPos, "ORA KENA!", "#c9a86a");
      }
    }

    /* ground contact → finalize */
    if (f.t >= f.T) {
      f.active = false;
      g.visible = false;
      const end = f.pts[f.pts.length - 1]!;
      const range = LAUNCH_Z - end[2];
      const mSpd = f.impactSpeed || 0;
      const mEnergy = 0.5 * dartMass * mSpd * mSpd;
      const hardnessF = HARDNESS_FACTOR[targetHardness] ?? 0.25;
      const penD = Math.min(0.06, (mEnergy * needleSharpness * (1 - hardnessF)) / 2.5);
      const didStick = penD > 0.008 && f.result?.hit === true;

      if (!f.result) {
        f.result = {
          range,
          maxH: f.maxH,
          time: f.T,
          hit: false,
          error: 0,
          zone: null,
          points: 0,
          missType: range < targetDistance ? "pendek" : "melebar",
          lateral: end[0] - PLAYER_X[f.player],
          player: f.player,
          impactSpeed: mSpd,
          impactEnergy: mEnergy,
          penetrationDepth: penD,
          angleOfEntry: 0,
          stuck: didStick,
        };
      }
      const res = f.result!;
      res.range = range;
      res.error = Math.abs(range - targetDistance);
      res.impactSpeed = mSpd;
      res.impactEnergy = mEnergy;
      res.penetrationDepth = penD;
      res.stuck = didStick;
      if (!res.hit) {
        pushBurst([end[0], 0.05, end[2]], "#8b7355", false);
        playThud();
      }
      setPulse((p) => ({ seq: p.seq + 1, hit: res.hit }));

      // Send torque history to parent for HUD graph
      if (torqueCb.current && f.torqueHistory.length > 0) {
        torqueCb.current(f.torqueHistory);
      }

      landedCb.current({ ...res });
    }
  });

  const players: PlayerId[] = multiplayer ? [1, 2] : [1];

  return (
    <>
      {/* Lighting */}
      {!isARMode && <hemisphereLight args={["#cfe6ff", "#4c7a43", 0.5]} />}
      <ambientLight intensity={isARMode ? 0.85 : 0.22} />
      <directionalLight
        position={[12, 18, 8]}
        intensity={isARMode ? 0.6 : 1.5}
        castShadow={!isARMode}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={12}
        shadow-camera-bottom={-36}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0004}
      />

      {/* Environment (hidden in AR so the real world shows through) */}
      {staticEnv}

      {/* Launch position marker */}
      <group position={[0, 0, LAUNCH_Z]}>
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.4, 0.55, 24]} />
          <meshBasicMaterial color="#e63946" transparent opacity={0.8} />
        </mesh>
        <Html position={[0, 0.4, 0]} center distanceFactor={14}>
          <div className="world-tag" style={{ borderColor: "#e63946" }}>
            Lemparan
          </div>
        </Html>
      </group>

      {/* Target: lingkaran konsentris Jemparingan */}
      <TargetJemparingan
        distance={targetDistance}
        flash={flash}
        onPick={() => onSelect("target")}
      />

      {/* Kalibrasi jarak & angin */}
      <DistanceMarkers distance={targetDistance} />
      <WindIndicator wind={wind} distance={targetDistance} />

      {/* Restoring torque visualization */}
      {showRestoringTorque && (
        <RestoringTorqueViz
          show={showRestoringTorque}
          history={torqueHist}
          targetDistance={targetDistance}
        />
      )}

      {/* Aim assist */}
      {showTrajectory && !running && (
        <PredictedPath
          angle={angle}
          velocity={velocity}
          wind={wind}
          drag={drag}
          ox={originX}
          aero={aeroParams}
        />
      )}
      {showVectors && !running && <VelocityArrow angle={angle} velocity={velocity} ox={originX} />}

      {/* Panah Jemparingan projectile */}
      <group ref={proj} visible={false}>
        <PaserModel />
      </group>

      {/* FX */}
      {bursts.map((b) => (
        <BurstFx key={b.id} burst={b} />
      ))}
      {popups.map((p) => (
        <Html key={p.id} position={p.pos} center distanceFactor={11} zIndexRange={[40, 0]}>
          <div className="score-pop" style={{ color: p.color, borderColor: p.color }}>
            {p.text}
          </div>
        </Html>
      ))}

      <CameraRig
        mode={cameraMode}
        targetDistance={targetDistance}
        focusTick={focusTick}
        selected={selected}
        followPos={followPos}
        isARMode={!!isARMode}
        previewStyle={previewStyle}
        isPreview={isPreview}
      />
    </>
  );
}

// ═══════════════════════════════ COMPONENT ═══════════════════════════════════

export function ARViewport(props: ViewportProps) {
  const [dpr, setDpr] = useState(1.5);
  return (
    <div className="viewport-stage">
      <Canvas
        shadows
        dpr={dpr}
        performance={{ min: 0.5 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
        }}
        camera={{ position: [7, 3.4, LAUNCH_Z + 9], fov: 55, near: 0.1, far: 400 }}
        onCreated={({ gl }) => setXRRenderer(gl)}
      >
        {!props.isARMode && <color attach="background" args={["#aee1f5"]} />}
        <Suspense fallback={null}>
          <Scene {...props} />
        </Suspense>

        {/* Adaptif: turunkan resolusi saat GPU berat → tetap mulus & ringan */}
        <PerformanceMonitor
          flipflops={3}
          onDecline={() => setDpr(1)}
          onIncline={() => setDpr(1.5)}
        />
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
      </Canvas>
      {props.isARMode && (
        <div className="ar-scan-hint">
          Arahkan kamera ke lantai terbuka — target Jemparingan akan muncul pada jarak yang dipilih.
        </div>
      )}
    </div>
  );
}

export default ARViewport;
