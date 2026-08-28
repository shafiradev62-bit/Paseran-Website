/* WebAudio SFX: gong jemparingan & thud tanah — dibuat lazy saat gesture pertama */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Dentum gong saat panah kena sasaran */
export function playGong(strength = 1) {
  try {
    const ac = getCtx();
    if (!ac) return;
    const now = ac.currentTime;
    const master = ac.createGain();
    master.gain.value = Math.min(0.5, 0.22 * strength);
    master.connect(ac.destination);

    // Partial inharmonis khas gong perunggu
    [1, 1.48, 2.39, 2.83, 4.27].forEach((mult, i) => {
      const osc = ac.createOscillator();
      osc.type = i === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(148 * mult, now);
      const g = ac.createGain();
      const amp = 0.9 / (i + 1.2);
      g.gain.setValueAtTime(amp, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.6 - i * 0.22);
      osc.connect(g);
      g.connect(master);
      osc.start(now);
      osc.stop(now + 1.7);
    });

    // Transien strike
    const bufLen = Math.floor(ac.sampleRate * 0.05);
    const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
    const noise = ac.createBufferSource();
    noise.buffer = buf;
    const nf = ac.createBiquadFilter();
    nf.type = "bandpass";
    nf.frequency.value = 620;
    nf.Q.value = 1.4;
    const ng = ac.createGain();
    ng.gain.value = 0.5 * strength;
    noise.connect(nf);
    nf.connect(ng);
    ng.connect(master);
    noise.start(now);
  } catch {
    /* audio opsional — abaikan kegagalan */
  }
}

/** Suara lembut saat panah menghantam pasir */
export function playThud() {
  try {
    const ac = getCtx();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(46, now + 0.12);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  } catch {
    /* ignore */
  }
}
