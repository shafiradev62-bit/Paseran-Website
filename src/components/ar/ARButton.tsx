import { useState, useEffect } from "react";
import { Scan, XCircle } from "lucide-react";
import { isARSupported, startARSession, stopARSession } from "./xr";

interface ARButtonProps {
  onARStart?: () => void;
  onAREnd?: () => void;
}

export function ARButton({ onARStart, onAREnd }: ARButtonProps) {
  const [arSupported, setArSupported] = useState(false);
  const [isARActive, setIsARActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isARSupported().then((supported) => {
      setArSupported(supported);
      if (!supported) console.log("AR not supported on this device");
    });
  }, []);

  const startAR = async () => {
    try {
      setError(null);
      const result = await startARSession(() => {
        setIsARActive(false);
        onAREnd?.();
      });
      if (!result.ok) {
        setError(result.error || "Gagal memulai AR mode");
        return;
      }

      setIsARActive(true);
      onARStart?.();
      console.log("AR Session started successfully");
    } catch (err) {
      console.error("Error starting AR:", err);
      setError(err instanceof Error ? err.message : "Gagal memulai AR mode");
      setIsARActive(false);
    }
  };

  const stopAR = async () => {
    try {
      await stopARSession();
    } catch {
      // ignore
    }
    setIsARActive(false);
    onAREnd?.();
  };

  if (!arSupported) {
    return (
      <button
        className="ar-button ar-button-disabled"
        disabled
        title="AR tidak didukung di perangkat ini"
      >
        <Scan size={18} strokeWidth={2} />
        <span>AR Tidak Tersedia</span>
      </button>
    );
  }

  return (
    <div className="ar-button-container">
      {!isARActive ? (
        <button
          className="ar-button ar-button-active"
          onClick={startAR}
          title="Aktifkan AR Mode (butuh perangkat WebXR)"
        >
          <Scan size={18} strokeWidth={2} />
          <span>Aktifkan AR</span>
        </button>
      ) : (
        <button className="ar-button ar-button-stop" onClick={stopAR} title="Hentikan AR Mode">
          <XCircle size={18} strokeWidth={2} />
          <span>Keluar AR</span>
        </button>
      )}
      {error && <div className="ar-error">{error}</div>}
    </div>
  );
}

export default ARButton;
