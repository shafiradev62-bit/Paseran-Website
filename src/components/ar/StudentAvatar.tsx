import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import type { GLTF } from "three-stdlib";
import * as THREE from "three";

export type Pulse = { seq: number; hit: boolean };

type Props = {
  phaseRef?: React.MutableRefObject<number>;
  variant?: "thrower" | "watcher";
  position?: [number, number, number];
  rotation?: number;
  seed?: number;
  pulse?: Pulse;
  pose?: "arms-crossed" | "hands-hips" | "pointing" | "relaxed" | "hands-in-pockets";
  gender?: "male" | "female";
};

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}
function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function isActive(action: THREE.AnimationAction): boolean {
  return action.getEffectiveWeight() > 0;
}

// ── GLB Model paths ───────────────────────────────────────────────────────
const MALE_MODEL = "/remaja.glb";
const FEMALE_MODEL = "/remaja.glb";

/**
 * Loads and displays a GLB character model with idle + throw animations.
 */
function GLBCharacter({
  phaseRef,
  variant,
  seed,
  gender,
  pulse,
}: {
  phaseRef: React.MutableRefObject<number> | undefined;
  variant: "thrower" | "watcher";
  seed: number;
  gender: "male" | "female";
  pulse: Pulse | undefined;
}) {
  const group = useRef<THREE.Group>(null);
  const path = gender === "female" ? FEMALE_MODEL : MALE_MODEL;
  const gltf = useGLTF(path) as GLTF & { scene: THREE.Group; animations: THREE.AnimationClip[] };
  const { scene, animations } = gltf;
  const { actions, names } = useAnimations(animations, group);

  const t = useRef(seed * 3.7);
  const lastPulse = useRef(0);
  const jumpT = useRef(0);
  const shakeT = useRef(0);

  // Decide which animation to play
  useEffect(() => {
    if (!actions || names.length === 0) return;
    console.log("[GLB] Available animations:", names);

    const idleName = names.find((n) => /idle|stand|breath|relax/i.test(n));
    const throwName = names.find((n) => /throw|lempar|toss|pitch|armature/i.test(n));

    if (variant === "thrower" && throwName && actions[throwName]) {
      // Don't auto-play throw — driven by phaseRef
    } else if (idleName && actions[idleName]) {
      const action = actions[idleName];
      action.reset().fadeIn(0.4).play();
      return () => {
        action.fadeOut(0.3);
      };
    } else if (names.length > 0) {
      const firstName = names[0];
      if (firstName && actions[firstName]) {
        const action = actions[firstName];
        action.reset().fadeIn(0.4).play();
        return () => {
          action.fadeOut(0.3);
        };
      }
    }
    return undefined;
  }, [actions, names, variant]);

  // Watcher reactions
  useEffect(() => {
    if (variant === "thrower" || !pulse) return;
    if (pulse.seq !== lastPulse.current) {
      lastPulse.current = pulse.seq;
      if (pulse.hit) jumpT.current = 1;
      else shakeT.current = 1;
    }
  }, [pulse, variant]);

  useFrame((_, delta) => {
    if (!group.current) return;
    const dt = Math.min(delta, 1 / 20);
    t.current += dt;

    if (variant === "watcher") {
      const breathe = Math.sin(t.current * 1.4) * 0.006;
      group.current.position.y = breathe;

      jumpT.current = Math.max(0, jumpT.current - dt * 1.6);
      if (jumpT.current > 0) {
        const jp = 1 - jumpT.current;
        group.current.position.y += Math.sin(jp * Math.PI) * 0.35;
      }

      shakeT.current = Math.max(0, shakeT.current - dt * 2.2);
      if (shakeT.current > 0) {
        group.current.rotation.y = Math.sin(t.current * 40) * 0.2 * shakeT.current;
      } else if (group.current.rotation.y !== 0) {
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, dt * 8);
      }

      if (names.length > 0) {
        const idleName = names.find((n) => /idle|stand|breath|relax/i.test(n));
        if (idleName && actions[idleName]) {
          const action = actions[idleName];
          if (jumpT.current > 0 || shakeT.current > 0) {
            if (isActive(action)) action.fadeOut(0.2);
          } else {
            if (!isActive(action)) action.reset().fadeIn(0.4).play();
          }
        }
      }
      return;
    }

    // Thrower — drive animation by phaseRef
    if (variant === "thrower" && phaseRef) {
      const p = clamp01(phaseRef.current);
      if (p > 0 && names.length > 0) {
        const throwName = names.find((n) => /throw|lempar|toss|pitch/i.test(n));
        const idleName = names.find((n) => /idle|stand|breath|relax/i.test(n));

        if (throwName && actions[throwName]) {
          const action = actions[throwName];
          action.paused = false;
          action.time = p * action.getClip().duration;
          if (!isActive(action)) {
            action.reset().fadeIn(0.15).play();
          }
        } else if (idleName && actions[idleName]) {
          const action = actions[idleName];
          if (!isActive(action)) action.reset().fadeIn(0.3).play();
          const windUp = smoothstep(0, 0.35, p);
          const release = smoothstep(0.35, 0.62, p);
          group.current.rotation.x = -0.12 * windUp + 0.25 * release;
        }
      } else if (names.length > 0) {
        const idleName = names.find((n) => /idle|stand|breath|relax/i.test(n));
        if (idleName && actions[idleName] && !isActive(actions[idleName])) {
          actions[idleName].reset().fadeIn(0.3).play();
        }
      }
    }
  });

  // Clone scene to avoid shared mutation
  const clonedScene = useRef<THREE.Object3D | null>(null);
  if (!clonedScene.current) {
    const cloned = scene.clone(true);
    cloned.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    clonedScene.current = cloned;
  }

  return (
    <group ref={group} scale={1.8} position={[0, 0, 0]}>
      <primitive object={clonedScene.current as THREE.Object3D} />
    </group>
  );
}

// Preload both models
useGLTF.preload(MALE_MODEL);

/**
 * StudentAvatar — loads a GLB model (male or female).
 */
export function StudentAvatar({
  phaseRef,
  variant = "thrower",
  position = [0, 0, 1.5],
  rotation = 0,
  seed = 0,
  pulse,
  gender = "male",
}: Props) {
  // Female model may face opposite direction - add 180 degree adjustment if needed
  const adjustedRotation = gender === "female" ? rotation + Math.PI : rotation;

  return (
    <group position={position} rotation={[0, adjustedRotation, 0]}>
      <GLBCharacter
        phaseRef={phaseRef}
        variant={variant}
        seed={seed}
        gender={gender}
        pulse={pulse}
      />
    </group>
  );
}
