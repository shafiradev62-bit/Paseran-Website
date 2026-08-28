import * as THREE from "three";

let renderer: THREE.WebGLRenderer | null = null;
let activeSession: XRSession | null = null;

export function setXRRenderer(r: THREE.WebGLRenderer | null) {
  renderer = r;
}

export function getXRRenderer(): THREE.WebGLRenderer | null {
  return renderer;
}

export function isARSupported(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("xr" in navigator)) {
    return Promise.resolve(false);
  }
  return (navigator as unknown as { xr: XRSystem }).xr
    .isSessionSupported("immersive-ar")
    .catch(() => false);
}

export async function startARSession(
  onSessionEnd?: () => void,
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (typeof navigator === "undefined" || !("xr" in navigator)) {
      return { ok: false, error: "WebXR tidak tersedia di browser ini" };
    }
    if (!renderer) {
      return { ok: false, error: "Scene 3D belum siap. Coba lagi." };
    }
    const xr = (navigator as unknown as { xr: XRSystem }).xr;
    const supported = await xr.isSessionSupported("immersive-ar");
    if (!supported) {
      return { ok: false, error: "AR tidak didukung di perangkat ini" };
    }

    const session = await xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking", "dom-overlay"],
      domOverlay: { root: document.body },
    });

    await renderer.xr.setSession(session);
    activeSession = session;
    session.addEventListener("end", () => {
      activeSession = null;
      onSessionEnd?.();
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memulai mode AR";
    return { ok: false, error: message };
  }
}

export async function stopARSession(): Promise<void> {
  try {
    await activeSession?.end();
  } catch {
    // ignore
  }
  activeSession = null;
}

export function isARActive(): boolean {
  return activeSession !== null;
}
