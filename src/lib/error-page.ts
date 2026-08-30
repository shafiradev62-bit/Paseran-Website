export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <title>AR Gerak Parabola — Scene Error</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { 
        font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
        background: oklch(0.93 0.006 95);
        color: oklch(0.28 0.012 95);
        display: grid;
        place-items: center;
        min-height: 100vh;
        padding: 1.5rem;
      }
      .error-panel {
        background: oklch(0.972 0.004 95);
        border: 1px solid oklch(0.86 0.008 95);
        border-radius: 8px;
        padding: 2.5rem 2rem;
        max-width: 28rem;
        width: 100%;
        text-align: center;
        box-shadow: 0 4px 12px oklch(0 0 0 / 0.08);
      }
      .error-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
        opacity: 0.75;
      }
      h1 {
        font-size: 1.5rem;
        font-weight: 600;
        margin-bottom: 0.75rem;
        letter-spacing: -0.01em;
      }
      p {
        color: oklch(0.52 0.01 95);
        margin-bottom: 1.75rem;
        line-height: 1.5;
      }
      .actions {
        display: flex;
        gap: 0.75rem;
        justify-content: center;
        flex-wrap: wrap;
      }
      button, a {
        padding: 0.625rem 1.25rem;
        border-radius: 6px;
        font: inherit;
        font-size: 0.9375rem;
        font-weight: 500;
        cursor: pointer;
        text-decoration: none;
        border: none;
        transition: all 0.15s ease;
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
      }
      .primary {
        background: oklch(0.55 0.11 235);
        color: #fff;
      }
      .primary:hover {
        background: oklch(0.50 0.11 235);
        transform: translateY(-1px);
      }
      .secondary {
        background: oklch(0.86 0.008 95);
        color: oklch(0.28 0.012 95);
      }
      .secondary:hover {
        background: oklch(0.82 0.008 95);
      }
    </style>
  </head>
  <body>
    <div class="error-panel">
      <div class="error-icon">⚠</div>
      <h1>Scene Error</h1>
      <p>Gagal memuat simulator. Coba refresh atau kembali ke halaman utama.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">🔄 Coba Lagi</button>
        <a class="secondary" href="/">🏠 Halaman Utama</a>
      </div>
    </div>
  </body>
</html>`;
}
