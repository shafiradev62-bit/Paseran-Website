import { Pause, Play, SkipForward } from "lucide-react";

export type PreviewStyle = "cinematic" | "orbit" | "follow" | "aerial";

export const PREVIEW_STYLES: readonly PreviewStyle[] = [
  "cinematic",
  "orbit",
  "follow",
  "aerial",
];

const STYLE_LABEL: Record<PreviewStyle, string> = {
  cinematic: "TAMPAK DINAMIS",
  orbit: "TAMPAK ORBITAL",
  follow: "TAMPAK SUSUL",
  aerial: "TAMPAK UDARA",
};

export type RecordEntry = {
  angle: number;
  velocity: number;
  range: number;
  maxH: number;
  points: number;
  hit: boolean;
};

type PreviewOverlayProps = {
  paused: boolean;
  progress: number;
  style: PreviewStyle;
  styles: readonly PreviewStyle[];
  onSkip: () => void;
  onToggle: () => void;
  onStyle: (s: PreviewStyle) => void;
  recording?: boolean;
  recordCount?: number;
  onToggleRecord?: () => void;
  onClearRecords?: () => void;
  lastRecord?: RecordEntry | null;
};

export function PreviewOverlay({
  paused,
  progress,
  style,
  styles,
  onSkip,
  onToggle,
  onStyle,
  recording = false,
  recordCount = 0,
  onToggleRecord,
  onClearRecords,
  lastRecord,
}: PreviewOverlayProps) {
  const cinematic = style === "cinematic" || style === "aerial";
  return (
    <div className={`preview-overlay${cinematic ? " cinematic" : ""}`}>
      <div className="preview-top">
        <div className="preview-headrow">
          <div className="preview-title">
            <span className="preview-dot" />
            AR GERAK PARABOLA · Terintegrasi Paseran
          </div>
          <button className="preview-skip" type="button" onClick={onSkip}>
            Lewati <SkipForward size={15} />
          </button>
        </div>
        <div className="preview-styles">
          {styles.map((s) => (
            <button
              key={s}
              type="button"
              className={`preview-chip${s === style ? " is-active" : ""}`}
              onClick={() => onStyle(s)}
            >
              {STYLE_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="preview-bottom">
        <button
          className="preview-play"
          type="button"
          onClick={onToggle}
          aria-label={paused ? "Putar" : "Jeda"}
        >
          {paused ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          className={`preview-rec${recording ? " is-on" : ""}`}
          type="button"
          onClick={onToggleRecord}
          aria-label="Rekam lemparan"
          title="Rekam lemparan (koordinat)"
        >
          <span className="rec-dot" />
          Rekam{recording ? ` · ${recordCount}` : ""}
        </button>
        <div className="preview-track">
          <div className="preview-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <span className="preview-tag">{STYLE_LABEL[style]}</span>
      </div>

      {lastRecord && (
        <div className="preview-record-readout">
          <span className="rec-text">
            📋 θ {lastRecord.angle}° · v₀ {lastRecord.velocity.toFixed(1)} m/s · x{" "}
            {lastRecord.range.toFixed(2)} m · H {lastRecord.maxH.toFixed(2)} m ·{" "}
            {lastRecord.hit ? `+${lastRecord.points} Poin` : "Miss"}
          </span>
          {onClearRecords && (
            <button
              type="button"
              className="rec-clear"
              onClick={onClearRecords}
              title="Bersihkan rekam (mulai demo baru)"
            >
              Reset
            </button>
          )}
        </div>
      )}

      {cinematic && (
        <>
          <div className="preview-bar top" />
          <div className="preview-bar bottom" />
        </>
      )}
    </div>
  );
}
