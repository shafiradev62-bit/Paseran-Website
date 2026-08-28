import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import {
  Play,
  RotateCcw,
  Move3d,
  Crosshair,
  Spline,
  Orbit,
  Video,
  Rows3,
  Gauge,
  Wind,
  Eye,
  EyeOff,
  ChevronRight,
  Trophy,
  Timer,
  Scan,
} from "lucide-react";
import type { Selection, ShotResult, TargetHardness, PlayerId } from "@/components/ar/ARViewport";
import { predict } from "@/components/ar/ARViewport";
import { NotificationProvider, ToastStack, useNotify } from "@/components/ar/Toaster";
import { ARButton } from "@/components/ar/ARButton";
import { PreviewOverlay, type PreviewStyle, PREVIEW_STYLES } from "@/components/ar/PreviewOverlay";

const ARViewport = lazy(() =>
  import("@/components/ar/ARViewport").then((m) => ({ default: m.ARViewport })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AR Jemparingan — Simulator Gerak Parabola Kelas X" },
      {
        name: "description",
        content:
          "Simulator 3D gaya game untuk gerak parabola berbasis permainan tradisional Jemparingan: atur sudut, kecepatan awal, dan hambatan udara, lalu amati lintasan di halaman sekolah.",
      },
      { property: "og:title", content: "AR Jemparingan — Simulator Gerak Parabola" },
      {
        property: "og:description",
        content:
          "Editor 3D interaktif untuk memvisualisasikan lintasan parabola pada permainan Jemparingan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

const G = 9.8;

const PLAYER_COLORS: Record<PlayerId, string> = { 1: "#e63946", 2: "#2a6fdb" };

// Zone metadata (kept local so ARViewport stays lazily loaded)
const ZONE_META: Record<string, { label: string; points: number }> = {
  kepala: { label: "Atas", points: 50 },
  leher: { label: "Atas-Tengah", points: 30 },
  dada: { label: "Tengah", points: 20 },
  kendil: { label: "Bawah-Tengah", points: 10 },
  bawah: { label: "Bawah", points: 5 },
};

function IconButton({
  icon: Icon,
  label,
  active,
  onClick,
  variant = "ghost",
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  active?: boolean;
  onClick: () => void;
  variant?: "ghost" | "solid";
}) {
  return (
    <button
      className={`iconbtn ${variant === "solid" ? "is-solid" : ""} ${active ? "is-active" : ""}`}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      data-tip={label}
      type="button"
    >
      <Icon size={16} strokeWidth={2} />
    </button>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="field">
      <div className="field-top">
        <span>{label}</span>
        <span className="val">
          {value.toFixed(step < 1 ? 1 : 0)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        aria-label={label}
        style={{ "--fill": `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties}
      />
    </div>
  );
}

function Page() {
  return (
    <NotificationProvider>
      <Editor />
    </NotificationProvider>
  );
}

function Editor() {
  const notify = useNotify();
  const [angle, setAngle] = useState(45);
  const [velocity, setVelocity] = useState(14);
  const [targetDistance, setTargetDistance] = useState(18);
  const [drag, setDrag] = useState(0);
  const [wind, setWind] = useState(0);
  const [timeScale, setTimeScale] = useState(1);
  const [running, setRunning] = useState(false);
  const [showTrajectory, setShowTrajectory] = useState(true);
  const [showVectors, setShowVectors] = useState(false);
  const [level, setLevel] = useState<1 | 2 | 3>(1);
  // Level pembelajaran (modul): preset fokus tiap tahap.
  // Setiap level juga memilih bingkai kamera yang tetap MENGHADAP lintasan/
  // sasaran (dan bangunan di sisi jauh), bukan membelakanginya.
  useEffect(() => {
    setShowTrajectory(true);
    setShowVectors(level === 2);
    setCameraMode("orbit");
    setSelected(level === 3 ? "target" : "lintasan");
    setFocusTick((t) => t + 1);
  }, [level]);
  const [cameraMode, setCameraMode] = useState<"orbit" | "follow" | "side">("orbit");
  const [selected, setSelected] = useState<Selection>("murid");
  const [focusTick, setFocusTick] = useState(0);
  const [result, setResult] = useState<ShotResult | null>(null);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  useEffect(() => {
    if (result) setResultModalOpen(true);
  }, [result]);

  type ThrowRecord = {
    angle: number;
    velocity: number;
    range: number;
    maxH: number;
    time: number;
    points: number;
    hit: boolean;
  };
  const [recording, setRecording] = useState(false);
  const [records, setRecords] = useState<ThrowRecord[]>([]);
  const lastRecResult = useRef<ShotResult | null>(null);
  useEffect(() => {
    if (recording && result && lastRecResult.current !== result) {
      lastRecResult.current = result;
      setRecords((rs) => [
        ...rs,
        {
          angle,
          velocity,
          range: result.range,
          maxH: result.maxH,
          time: result.time,
          points: result.points,
          hit: result.hit,
        },
      ]);
    }
  }, [result, recording, angle, velocity]);
  const [attempts, setAttempts] = useState(0);
  const [hits, setHits] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const [live, setLive] = useState({ t: 0, h: 0, x: 0, v: 0 });
  const [isARMode, setIsARMode] = useState(false);
  // ── Cinematic preview (YouTube-style auto-play) ──
  const [preview, setPreview] = useState(true);
  const [previewStyle, setPreviewStyle] = useState<PreviewStyle>("cinematic");
  const previewRef = useRef(preview);
  useEffect(() => {
    previewRef.current = preview;
  }, [preview]);

  // Preview TIDAK autoplay. Tombol putar memicu satu lemparan MANUAL;
  // gaya kamera ganti tiap lemparan selesai agar tetap variatif.
  const prevRunning = useRef(false);
  useEffect(() => {
    if (preview && prevRunning.current && !running) {
      setPreviewStyle((s) => PREVIEW_STYLES[(PREVIEW_STYLES.indexOf(s) + 1) % PREVIEW_STYLES.length] ?? s);
    }
    prevRunning.current = running;
  }, [preview, running]);
  // ── Jemparingan ethno-physics state ──
  const [dartMass, setDartMass] = useState(0.012);
  const [featherArea, setFeatherArea] = useState(0.0008);
  const [featherCd, setFeatherCd] = useState(0.45);
  const [needleSharpness, setNeedleSharpness] = useState(0.85);
  const [targetHardness, setTargetHardness] = useState<TargetHardness>("foam");
  const [showRestoringTorque, setShowRestoringTorque] = useState(false);
  const [multiplayer, setMultiplayer] = useState(false);
  const [turn, setTurn] = useState<PlayerId>(1);
  const [scores, setScores] = useState<Record<PlayerId, number>>({ 1: 0, 2: 0 });
  const liveRef = useRef(live);
  // Throttle HUD updates — React re-render tidak lagi jalan di tiap frame render
  const lastLivePush = useRef(0);

  const effectiveVelocity = useMemo(() => {
    return velocity;
  }, [velocity]);

  const aeroParams = useMemo(
    () => ({ featherArea, featherCd, dartMass }),
    [featherArea, featherCd, dartMass],
  );

  const p = useMemo(
    () => predict(angle, effectiveVelocity, drag, wind, aeroParams),
    [angle, effectiveVelocity, drag, wind, aeroParams],
  );

  const handleSelect = useCallback((s: Selection | null) => {
    if (s) setSelected(s);
  }, []);

  const onTick = useCallback((t: number, pos: [number, number, number], speed: number) => {
    liveRef.current = { t, h: pos[1], x: pos[0], v: speed };
    const now = performance.now();
    if (now - lastLivePush.current >= 100) {
      lastLivePush.current = now;
      setLive(liveRef.current);
    }
  }, []);

  const throwNow = useCallback(() => {
    if (running) return;
    setResult(null);
    setLive({ t: 0, h: 0, x: 0, v: 0 });
    setRunning(true);
    const vel = velocity;
    notify({
      kind: "info",
      title: `Lemparan Dimulai`,
      body: `Sudut ${angle}° · Kec. Awal ${vel.toFixed(1)} m/s · Jarak ${targetDistance}m`,
    });
  }, [running, angle, velocity, targetDistance, notify]);

  const reset = useCallback(() => {
    setRunning(false);
    setResult(null);
    setLive({ t: 0, h: 0, x: 0, v: 0 });
    notify({ kind: "info", title: "Simulasi Direset" });
  }, [notify]);

  const onLanded = useCallback(
    (r: ShotResult) => {
      setRunning(false);
      // Preview berputar secara sunyi — lempar otomatis hanya visual,
      // tidak memunculkan notifikasi/result/hitung skor.
      if (previewRef.current) return;
      setResult(r);
      setAttempts((a) => a + 1);
      setBest((b) => (b === null || r.error < b ? r.error : b));
      if (r.hit) setHits((h) => h + 1);
      if (multiplayer) {
        setScores((s) => ({ ...s, [r.player]: s[r.player] + r.points }));
        setTurn(r.player === 1 ? 2 : 1);
      }
      const meta = r.zone ? ZONE_META[r.zone] : null;
      if (r.hit && meta) {
        notify({
          kind: "success",
          title: `${meta.label.toUpperCase()} +${meta.points}${r.zone === "kepala" ? " · KRITIS!" : ""}`,
          body: `Pemain ${r.player} · Jangkauan ${r.range.toFixed(2)} m · Waktu ${r.time.toFixed(2)} s`,
        });
      } else {
        notify({
          kind: "warn",
          title:
            r.missType === "tinggi"
              ? "⚠ Kemundhing Dhuwur"
              : r.range > targetDistance
                ? "⚠ Kakung Adoh"
                : "⚠ Ora Kena!",
          body: `Pemain ${r.player} · Selisih ${r.error.toFixed(2)} m dari target`,
        });
      }
    },
    [notify, targetDistance, multiplayer],
  );

  const toggleMultiplayer = useCallback(() => {
    setMultiplayer((m) => {
      if (!m) {
        setScores({ 1: 0, 2: 0 });
        setTurn(1);
      }
      return !m;
    });
  }, []);

  // Keyboard shortcuts (game-style)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLSelectElement
      )
        return;
      const key = (e.key || "").toLowerCase();
      if (e.code === "Space") {
        e.preventDefault();
        throwNow();
        return;
      }
      if (key === "r") reset();
      else if (key === "c")
        setCameraMode((m) => (m === "orbit" ? "follow" : m === "follow" ? "side" : "orbit"));
      else if (key === "t") setShowTrajectory((s) => !s);
      else if (key === "f") setFocusTick((x) => x + 1);
      else if (key === "m") toggleMultiplayer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [throwNow, reset, toggleMultiplayer]);

  const accuracy = attempts ? Math.round((hits / attempts) * 100) : 0;

  const handleARStart = useCallback(() => {
    setIsARMode(true);
    notify({
      kind: "success",
      title: "AR Mode Aktif",
      body: "Gunakan perangkat Anda untuk melihat scene dalam AR",
    });
  }, [notify]);

  const handleAREnd = useCallback(() => {
    setIsARMode(false);
    notify({ kind: "info", title: "AR Mode Dinonaktifkan" });
  }, [notify]);

  return (
    <div className={preview ? "editor is-preview" : "editor"}>
      <header className="bar top">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <div>
            <div className="brand-title">AR JEMPARINGAN</div>
            <div className="brand-sub">Gerak Parabola · Fase E</div>
          </div>
        </div>

        <div className="toolbar">
          <div className="toolgroup">
            <IconButton
              icon={Move3d}
              label="Murid"
              active={selected === "murid"}
              onClick={() => setSelected("murid")}
            />
            <IconButton
              icon={Crosshair}
              label="Target"
              active={selected === "target"}
              onClick={() => setSelected("target")}
            />
            <IconButton
              icon={Spline}
              label="Lintasan"
              active={selected === "lintasan"}
              onClick={() => setSelected("lintasan")}
            />
            <IconButton
              icon={Scan}
              label="Fokus Objek (F)"
              onClick={() => setFocusTick((t) => t + 1)}
            />
          </div>

          <div className="toolgroup">
            <IconButton
              icon={Orbit}
              label="Kamera Orbit (C)"
              active={cameraMode === "orbit"}
              onClick={() => setCameraMode("orbit")}
            />
            <IconButton
              icon={Video}
              label="Kamera Belakang"
              active={cameraMode === "follow"}
              onClick={() => setCameraMode("follow")}
            />
            <IconButton
              icon={Rows3}
              label="Kamera Samping"
              active={cameraMode === "side"}
              onClick={() => setCameraMode("side")}
            />
          </div>

          <div className="toolgroup level-switch">
            <span className="lbl">Level</span>
            {([1, 2, 3] as const).map((lv) => (
              <button
                key={lv}
                type="button"
                className={`iconbtn${level === lv ? " is-active" : ""}`}
                onClick={() => setLevel(lv)}
                title={
                  lv === 1
                    ? "Level 1 · Observasi Lintasan"
                    : lv === 2
                      ? "Level 2 · Dekomposisi Vektor (vx, vy)"
                      : "Level 3 · Optimasi Sasaran (θ optimum)"
                }
              >
                L{lv}
              </button>
            ))}
          </div>

          <div className="toolgroup">
            <IconButton
              icon={showTrajectory ? Eye : EyeOff}
              label="Tampilkan Prediksi Lintasan (T)"
              active={showTrajectory}
              onClick={() => setShowTrajectory((s) => !s)}
            />
            <IconButton
              icon={Gauge}
              label="Tampilkan Vektor Kecepatan"
              active={showVectors}
              onClick={() => setShowVectors((s) => !s)}
            />
            <IconButton
              icon={Wind}
              label={wind ? `Angin Aktif ${wind.toFixed(1)} m/s` : "Nyalakan Angin"}
              active={wind !== 0}
              onClick={() => setWind((w) => (w > 0 ? 0 : 4))}
            />
            <IconButton
              icon={Timer}
              label={timeScale < 1 ? "Gerak Lambat Aktif" : "Kecepatan Normal"}
              active={timeScale < 1}
              onClick={() => setTimeScale((t) => (t < 1 ? 1 : 0.35))}
            />
          </div>

          <div className="toolgroup">
            <button
              className={`iconbtn ${multiplayer ? "is-active" : ""}`}
              style={{
                fontSize: 9,
                width: "auto",
                padding: "4px 8px",
                borderRadius: 5,
                fontWeight: 600,
              }}
              onClick={toggleMultiplayer}
              aria-pressed={multiplayer}
              title="Mode 2 Pemain (M)"
            >
              2 PEMAIN
            </button>
          </div>

          <div className="toolgroup">
            <ARButton onARStart={handleARStart} onAREnd={handleAREnd} />
          </div>

          {/* Preset buttons */}
          <div className="toolgroup">
            <button
              className="iconbtn is-solid"
              style={{
                fontSize: 9,
                width: "auto",
                padding: "4px 8px",
                borderRadius: 5,
                fontWeight: 600,
              }}
              onClick={() => {
                setAngle(45);
                setVelocity(12);
                setTargetDistance(5);
                setDrag(0);
                setWind(0);
                setSelected("target");
                setFocusTick((t) => t + 1);
                notify({
                  kind: "info",
                  title: "Preset: Latihan 5m",
                  body: "θ=45° v₀=12 m/s — sasaran merapat ke dekat",
                });
              }}
              title="Latihan 5m"
            >
              5m
            </button>
            <button
              className="iconbtn is-solid"
              style={{
                fontSize: 9,
                width: "auto",
                padding: "4px 8px",
                borderRadius: 5,
                fontWeight: 600,
              }}
              onClick={() => {
                setAngle(40);
                setVelocity(16);
                setTargetDistance(10);
                setDrag(0.012);
                setWind(0);
                setSelected("target");
                setFocusTick((t) => t + 1);
                notify({
                  kind: "info",
                  title: "Preset: Kompetisi 10m",
                  body: "θ=40° v₀=16 m/s k=0.012",
                });
              }}
              title="Kompetisi 10m"
            >
              10m
            </button>
            <button
              className="iconbtn is-solid"
              style={{
                fontSize: 9,
                width: "auto",
                padding: "4px 8px",
                borderRadius: 5,
                fontWeight: 600,
              }}
              onClick={() => {
                setAngle(50);
                setVelocity(18);
                setTargetDistance(10);
                setDrag(0.03);
                setWind(4.5);
                setSelected("target");
                setFocusTick((t) => t + 1);
                notify({
                  kind: "warn",
                  title: "Preset: Angin Kencang",
                  body: "θ=50° v₀=18 m/s angin=4.5 m/s — perhatikan panah angin & lintasan melengkung",
                });
              }}
              title="Angin Kencang"
            >
              Angin
            </button>
          </div>

          {/* Action buttons */}
          <div className="toolgroup">
            <button
              className="iconbtn is-solid"
              style={{
                fontSize: 9,
                width: "auto",
                padding: "4px 8px",
                borderRadius: 5,
                fontWeight: 700,
                background: "#2a6fdb",
                color: "#fff",
              }}
              onClick={throwNow}
              title="EKSEKUSI"
            >
              {" "}
              EKSEKUSI
            </button>
            <button
              className="iconbtn"
              style={{
                fontSize: 9,
                width: "auto",
                padding: "4px 8px",
                borderRadius: 5,
                fontWeight: 600,
              }}
              onClick={reset}
              title="RESET"
            >
              {" "}
              RESET
            </button>
            <button
              className="iconbtn"
              style={{
                fontSize: 9,
                width: "auto",
                padding: "4px 8px",
                borderRadius: 5,
                fontWeight: 600,
                background: isARMode ? "#f5576c" : undefined,
                color: isARMode ? "#fff" : undefined,
              }}
              onClick={() => {
                if (isARMode) handleAREnd();
                else handleARStart();
              }}
              title="TOGGLE AR"
            >
              {" "}
              AR
            </button>
          </div>
        </div>

        <div className="toolgroup transport">
          <IconButton icon={Play} label="Lempar (Spasi)" variant="solid" onClick={throwNow} />
          <IconButton icon={RotateCcw} label="Reset (R)" onClick={reset} />
        </div>
      </header>

      <div className="body">
        <aside className="panel left">
          <div className="panel-head">Hierarki</div>
          <ul className="tree">
            <li className="tree-root">
              <ChevronRight size={13} /> Arena Jemparingan
            </li>
            <li
              className={selected === "target" ? "is-active" : ""}
              onClick={() => setSelected("target")}
            >
              <Crosshair size={14} /> Target Jemparingan
            </li>
            <li
              className={selected === "lintasan" ? "is-active" : ""}
              onClick={() => setSelected("lintasan")}
            >
              <Spline size={14} /> Lintasan
            </li>
            <li className="muted">Bangunan · Tiang Kawat</li>
          </ul>

          <div className="panel-head">Elemen Budaya Jawa</div>
          <ul className="tree">
            <li className="muted">Candi bentar · gerbang belah</li>
            <li className="muted">Gong ageng · bedug · bonang</li>
            <li className="muted">Umbul-umbul hias arena</li>
            <li className="muted">Pohon kelapa (vegetasi)</li>
            <li className="muted">Wayang kulit · gunungan</li>
            <li className="muted">Kuda lumping · tikar anyaman</li>
            <li className="muted">Sesajen · gentong · clingeng</li>
            <li className="muted">Joglo · batik kawung</li>
          </ul>

          <div className="panel-head">Statistik Sesi</div>
          <dl className="stats">
            <div>
              <dt>Percobaan</dt>
              <dd>{attempts}</dd>
            </div>
            <div>
              <dt>Tepat sasaran</dt>
              <dd>{hits}</dd>
            </div>
            <div>
              <dt>Akurasi</dt>
              <dd>{accuracy}%</dd>
            </div>
            <div>
              <dt>Selisih terbaik</dt>
              <dd>{best === null ? "—" : `${best.toFixed(2)} m`}</dd>
            </div>
          </dl>

          <div className="panel-head">Pintasan Keyboard</div>
          <div className="keys-row">
            <span className="key-item">
              <kbd>Spasi</kbd>
              <button className="iconbtn" onClick={throwNow}>
                <Play size={14} strokeWidth={2} />
              </button>
            </span>
            <span className="key-item">
              <kbd>R</kbd>
              <button className="iconbtn" onClick={reset}>
                <RotateCcw size={14} strokeWidth={2} />
              </button>
            </span>
            <span className="key-item">
              <kbd>C</kbd>
              <button
                className="iconbtn"
                onClick={() =>
                  setCameraMode((m) =>
                    m === "orbit" ? "follow" : m === "follow" ? "side" : "orbit",
                  )
                }
              >
                <Orbit size={14} strokeWidth={2} />
              </button>
            </span>
            <span className="key-item">
              <kbd>T</kbd>
              <button className="iconbtn" onClick={() => setShowTrajectory((s) => !s)}>
                <Eye size={14} strokeWidth={2} />
              </button>
            </span>
            <span className="key-item">
              <kbd>F</kbd>
              <button className="iconbtn" onClick={() => setFocusTick((t) => t + 1)}>
                <Crosshair size={14} strokeWidth={2} />
              </button>
            </span>
          </div>
          <div className="keys-hint">2× Klik objek → Fokus kamera</div>
        </aside>

        <main className="viewport">
          <ClientOnly fallback={<div className="viewport-loading">Memuat scene 3D…</div>}>
            <Suspense fallback={<div className="viewport-loading">Memuat scene 3D…</div>}>
              <ARViewport
                angle={angle}
                velocity={effectiveVelocity}
                running={running}
                showTrajectory={showTrajectory}
                showVectors={showVectors}
                targetDistance={targetDistance}
                drag={drag}
                wind={wind}
                timeScale={timeScale}
                cameraMode={preview ? "follow" : cameraMode}
                isPreview={preview}
                previewStyle={previewStyle}
                selected={selected}
                focusTick={focusTick}
                gender="male"
                onSelect={handleSelect}
                onTick={onTick}
                onLanded={onLanded}
                isARMode={isARMode}
                dartMass={dartMass}
                featherArea={featherArea}
                featherCd={featherCd}
                needleSharpness={needleSharpness}
                targetHardness={targetHardness}
                showRestoringTorque={showRestoringTorque}
              />
            </Suspense>
          </ClientOnly>

          <div className="hud tl">
            <div className="hud-cell">
              <span>Mode</span>
              <strong style={{ fontSize: 10 }}>Tangan</strong>
            </div>
            <div className="hud-cell">
              <span>Sudut (θ)</span>
              <strong>{angle}°</strong>
            </div>
            <div className="hud-cell">
              <span>Kec. Awal (v₀)</span>
              <strong>{effectiveVelocity.toFixed(1)} m/s</strong>
            </div>
            <div className="hud-cell">
              <span>Waktu (t)</span>
              <strong>{live.t.toFixed(2)} s</strong>
            </div>
            <div className="hud-cell">
              <span>Tinggi (h)</span>
              <strong>{live.h.toFixed(2)} m</strong>
            </div>
            <div className="hud-cell">
              <span>Jarak (x)</span>
              <strong>{live.x.toFixed(2)} m</strong>
            </div>
            <div className="hud-cell">
              <span>vx (konstan)</span>
              <strong>
                {(effectiveVelocity * Math.cos((angle * Math.PI) / 180)).toFixed(2)} m/s
              </strong>
            </div>
            <div className="hud-cell">
              <span>vy (t)</span>
              <strong>
                {(effectiveVelocity * Math.sin((angle * Math.PI) / 180) - G * live.t).toFixed(2)} m/s
              </strong>
            </div>
          </div>

          <div className="hud tr">
            <Trophy size={13} />
            <strong>
              {hits}/{attempts}
            </strong>
          </div>

          {multiplayer && (
            <div className="hud mp" aria-live="polite">
              <span
                className={`chip ${turn === 1 ? "is-turn" : ""}`}
                style={{ "--pc": PLAYER_COLORS[1] } as React.CSSProperties}
              >
                P1 · {scores[1]}
              </span>
              <span className="vs">vs</span>
              <span
                className={`chip ${turn === 2 ? "is-turn" : ""}`}
                style={{ "--pc": PLAYER_COLORS[2] } as React.CSSProperties}
              >
                P2 · {scores[2]}
              </span>
            </div>
          )}

          {result && !resultModalOpen && !preview && (
            <div className={`hud result ${result.hit ? "is-hit" : ""}`}>
              <span className="result-flag">{result.hit ? "TEPAT SASARAN" : "MELESET"}</span>
              <span className="sep" />
              {result.zone && ZONE_META[result.zone] ? (
                <>
                  <span>
                    {ZONE_META[result.zone]!.label} +{ZONE_META[result.zone]!.points}
                  </span>
                  <span className="sep" />
                </>
              ) : null}
              <span>Jangkauan {result.range.toFixed(2)} m</span>
              <span className="sep" />
              <span>Tinggi Maks {result.maxH.toFixed(2)} m</span>
              <span className="sep" />
              <span>Waktu {result.time.toFixed(2)} s</span>
              {result.impactEnergy !== undefined && result.impactEnergy > 0 && (
                <>
                  <span className="sep" />
                  <span style={{ color: "#c06600", fontWeight: 700 }}>
                    {result.impactEnergy.toFixed(4)} J
                  </span>
                </>
              )}
              {result.stuck !== undefined && (
                <>
                  <span className="sep" />
                  <span>{result.stuck ? "Menancap!" : "Memantul"}</span>
                </>
              )}
            </div>
          )}

          {/* In-app notifications, anchored inside the viewport */}
          <ToastStack />

          {/* Popup hasil di tengah layar setelah lempar — bergaya panel kontrol */}
          {resultModalOpen && result && !preview && (
            <div
              className="result-modal"
              onClick={() => setResultModalOpen(false)}
              role="dialog"
              aria-modal="true"
            >
              <div className="result-card" onClick={(e) => e.stopPropagation()}>
                <button
                  className="result-close"
                  type="button"
                  onClick={() => setResultModalOpen(false)}
                  aria-label="Tutup"
                >
                  ×
                </button>

                <div className={`result-flag-big ${result.hit ? "is-hit" : ""}`}>
                  {result.hit ? "TEPAT SASARAN" : "MELESET"}
                </div>
                {result.zone && ZONE_META[result.zone] ? (
                  <div className="result-zone">
                    {ZONE_META[result.zone]?.label} ·{" "}
                    <strong>+{ZONE_META[result.zone]?.points}</strong> Poin
                  </div>
                ) : (
                  <div className="result-zone">Tidak mengenai papan</div>
                )}

                <div className="panel-head">Parameter Lemparan</div>
                <div className="result-params">
                  <div className="field">
                    <div className="field-top">
                      <span>Mode</span>
                    </div>
                    <div className="mode-static">🤾 Lemparan Tangan (manual)</div>
                  </div>
                  <Slider
                    label="Sudut Elevasi (θ)"
                    value={angle}
                    min={10}
                    max={80}
                    step={1}
                    unit="°"
                    onChange={setAngle}
                  />
                  <Slider
                    label="Kecepatan Awal (v₀)"
                    value={velocity}
                    min={5}
                    max={26}
                    step={0.5}
                    unit="m/s"
                    onChange={setVelocity}
                  />
                  <Slider
                    label="Jarak Target"
                    value={targetDistance}
                    min={5}
                    max={38}
                    step={1}
                    unit="m"
                    onChange={setTargetDistance}
                  />
                </div>

                <div className="panel-head">Hasil Analitik</div>
                <div className="stat-grid">
                  <div className="stat">
                    <span>Jangkauan (R)</span>
                    <strong>{result.range.toFixed(2)} m</strong>
                  </div>
                  <div className="stat">
                    <span>Tinggi Maks (H)</span>
                    <strong>{result.maxH.toFixed(2)} m</strong>
                  </div>
                  <div className="stat">
                    <span>Waktu (t)</span>
                    <strong>{result.time.toFixed(2)} s</strong>
                  </div>
                  <div className="stat">
                    <span>vx (konstan)</span>
                    <strong>
                      {(velocity * Math.cos((angle * Math.PI) / 180)).toFixed(2)} m/s
                    </strong>
                  </div>
                  <div className="stat">
                    <span>vy (t)</span>
                    <strong>
                      {(velocity * Math.sin((angle * Math.PI) / 180) - G * result.time).toFixed(2)} m/s
                    </strong>
                  </div>
                </div>

                <div className="result-actions">
                  <button
                    className="btn-game primary"
                    type="button"
                    onClick={() => {
                      setResultModalOpen(false);
                      throwNow();
                    }}
                  >
                    Lempar Lagi
                  </button>
                  <button
                    className="btn-game"
                    type="button"
                    onClick={() => setResultModalOpen(false)}
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          )}

          {preview && (
            <PreviewOverlay
              paused={running}
              progress={p.time > 0 ? Math.min(1, live.t / p.time) : 0}
              style={previewStyle}
              styles={PREVIEW_STYLES}
              onSkip={() => {
                setPreview(false);
                setRunning(false);
                setResult(null);
                setLive({ t: 0, h: 0, x: 0, v: 0 });
              }}
              onToggle={() => {
                if (running) return;
                setResult(null);
                setLive({ t: 0, h: 0, x: 0, v: 0 });
                setRunning(true);
              }}
              onStyle={(s) => setPreviewStyle(s)}
              recording={recording}
              recordCount={records.length}
              onToggleRecord={() => setRecording((v) => !v)}
              lastRecord={
                records.length
                  ? {
                      angle: records[records.length - 1]!.angle,
                      velocity: records[records.length - 1]!.velocity,
                      range: records[records.length - 1]!.range,
                      maxH: records[records.length - 1]!.maxH,
                      points: records[records.length - 1]!.points,
                      hit: records[records.length - 1]!.hit,
                    }
                  : null
              }
            />
          )}
        </main>

        <aside className="panel right">
          <div className="panel-head">
            Parameter ·{" "}
            {selected === "target" ? "Target" : selected === "lintasan" ? "Lintasan" : "Lemparan"}
          </div>

          <Slider
            label="Sudut Elevasi (θ)"
            value={angle}
            min={10}
            max={80}
            step={1}
            unit="°"
            onChange={setAngle}
          />
          <Slider
            label="Kecepatan Awal (v₀)"
            value={velocity}
            min={5}
            max={26}
            step={0.5}
            unit="m/s"
            onChange={setVelocity}
          />
          <Slider
            label="Jarak Target"
            value={targetDistance}
            min={5}
            max={38}
            step={1}
            unit="m"
            onChange={setTargetDistance}
          />
          <Slider
            label="Koefisien Hambatan Udara (k)"
            value={drag}
            min={0}
            max={0.05}
            step={0.002}
            unit=""
            onChange={setDrag}
          />
          <Slider
            label="Angin Lateral (w)"
            value={wind}
            min={-6}
            max={6}
            step={0.5}
            unit="m/s"
            onChange={setWind}
          />

          <div className="panel-head">Mode Luncur</div>
          <div style={{ padding: "6px 14px" }}>
            <span style={{ fontSize: 11, color: "oklch(0.42 0.01 95)", fontWeight: 600 }}>
              🤾 Lemparan Tangan (manual)
            </span>
          </div>

          <div className="panel-head">Panah & Target</div>
          <Slider
            label="Massa Panah (m)"
            value={dartMass}
            min={0.005}
            max={0.03}
            step={0.001}
            unit="kg"
            onChange={setDartMass}
          />
          <Slider
            label="Luas Bulu (A)"
            value={featherArea}
            min={0.0002}
            max={0.002}
            step={0.0001}
            unit="m²"
            onChange={setFeatherArea}
          />
          <Slider
            label="Cd Bulu"
            value={featherCd}
            min={0.1}
            max={1.0}
            step={0.05}
            unit=""
            onChange={setFeatherCd}
          />
          <Slider
            label="Ketajaman Jarum"
            value={needleSharpness}
            min={0.1}
            max={1.0}
            step={0.05}
            unit=""
            onChange={setNeedleSharpness}
          />

          <div className="panel-head">Target Material</div>
          <div style={{ padding: "6px 14px", display: "flex", gap: 4 }}>
            {(["foam", "cement", "banana"] as TargetHardness[]).map((h) => (
              <button
                key={h}
                className="iconbtn"
                style={{
                  fontSize: 9,
                  width: "auto",
                  padding: "3px 8px",
                  borderRadius: 5,
                  fontWeight: 600,
                  background: targetHardness === h ? "oklch(0.86 0.04 235)" : undefined,
                }}
                onClick={() => setTargetHardness(h)}
              >
                {h === "foam" ? "Foam" : h === "cement" ? "Semen" : "Pisang"}
              </button>
            ))}
          </div>

          <div className="panel-head">Visualisasi</div>
          <div style={{ padding: "4px 14px" }}>
            <button
              className="iconbtn"
              style={{
                fontSize: 10,
                width: "auto",
                padding: "4px 10px",
                borderRadius: 5,
                fontWeight: 600,
                background: showRestoringTorque ? "oklch(0.86 0.04 235)" : undefined,
              }}
              onClick={() => setShowRestoringTorque((s) => !s)}
            >
              Restoring Torque
            </button>
          </div>

          <div className="panel-head">Komponen Vektor Kecepatan</div>
          <dl className="stats">
            <div>
              <dt>v₀ₓ = v₀ cos θ</dt>
              <dd>{p.vd.toFixed(2)} m/s</dd>
            </div>
            <div>
              <dt>v₀_y = v₀ sin θ</dt>
              <dd>{p.vy.toFixed(2)} m/s</dd>
            </div>
            <div>
              <dt>Jangkauan (R)</dt>
              <dd>{p.range.toFixed(2)} m</dd>
            </div>
            <div>
              <dt>Tinggi Maksimum (H)</dt>
              <dd>{p.maxH.toFixed(2)} m</dd>
            </div>
            <div>
              <dt>Waktu Tempuh</dt>
              <dd>{p.time.toFixed(2)} s</dd>
            </div>
            <div>
              <dt>Percepatan Gravitasi (g)</dt>
              <dd>{G.toFixed(2)} m/s²</dd>
            </div>
            {p.impactSpeed !== undefined && p.impactSpeed > 0 && (
              <div>
                <dt>Energi Impact</dt>
                <dd style={{ color: "#c06600" }}>
                  {(0.5 * dartMass * p.impactSpeed * p.impactSpeed).toFixed(4)} J
                </dd>
              </div>
            )}
          </dl>

          <div className="panel-head">Catatan Fisika & Ethnosains</div>
          <p className="note">
            Jemparingan: dilempar dari ketinggian duduk bersila (y₀ ≈ 1.55m).
            <strong>SCIENCE:</strong> Gerak parabola — kombinasi gerak horizontal konstan dan gerak
            vertikal dipengaruhi gravitasi (g = 9.81 m/s²).
            <strong>TECHNOLOGY:</strong> Desain panah jemparingan dengan bulu ekor (fletching) untuk
            stabilitas.
            <strong>ENGINEERING:</strong> Teknik lemparan duduk bersila dengan putaran poros.
            <strong>MATEMATIKA:</strong> R = v₀²sin(2θ)/g, H = v₀²sin²(θ)/2g.
            <strong>ETNOSAINS:</strong> Kearifan lokal Yogyakarta — permainan tradisional sebagai
            medium pembelajaran fisika.
          </p>
        </aside>
      </div>

      <footer className="bar bottom">
        <span>Geser untuk memutar kamera · Scroll untuk zoom</span>
        <span className="dot" />
        <span>
          Terpilih:{" "}
          {selected === "target" ? "Target" : selected === "lintasan" ? "Lintasan" : "Murid"}
        </span>
        <span className="dot" />
        <span className={running ? "state is-live" : "state"}>
          {running ? "Simulasi Berjalan" : "Siap"}
        </span>
        <span className="dot" />
        <span>{drag > 0 ? `Hambatan Udara k=${drag.toFixed(3)}` : "Tanpa Hambatan Udara"}</span>
      </footer>
    </div>
  );
}
