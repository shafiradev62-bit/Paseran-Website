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

type PreviewOverlayProps = {
  paused: boolean;
  progress: number;
  style: PreviewStyle;
  styles: readonly PreviewStyle[];
  onSkip: () => void;
  onToggle: () => void;
  onStyle: (s: PreviewStyle) => void;
};

export function PreviewOverlay({
  paused,
  progress,
  style,
  styles,
  onSkip,
  onToggle,
  onStyle,
}: PreviewOverlayProps) {
  const cinematic = style === "cinematic" || style === "aerial";
  return (
    <div className={`preview-overlay${cinematic ? " cinematic" : ""}`}>
      <div className="preview-top">
        <div className="preview-headrow">
          <div className="preview-title">
            <span className="preview-dot" />
            AR JEMPARINGAN · Simulasi Gerak Parabola
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
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
        <div className="preview-track">
          <div className="preview-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <span className="preview-tag">{paused ? "DIJEDA" : STYLE_LABEL[style]}</span>
      </div>

      {cinematic && (
        <>
          <div className="preview-bar top" />
          <div className="preview-bar bottom" />
        </>
      )}
    </div>
  );
}
