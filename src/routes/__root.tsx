import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="editor">
      <div className="error-screen">
        <div className="error-panel">
          <div className="error-icon">🔍</div>
          <h1 className="error-title">404 — Halaman Tidak Ditemukan</h1>
          <p className="error-msg">Halaman yang Anda cari tidak ada atau sudah dipindahkan.</p>
          <div className="error-actions">              <Link to="/" className="btn-game primary">
              🏠 Kembali ke Simulator Paseran
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    console.error("[AR Gerak Parabola] Root error:", error);
  }, [error]);

  return (
    <div className="editor">
      <div className="error-screen">
        <div className="error-panel">
          <div className="error-icon">⚠</div>
          <h1 className="error-title">Scene Error</h1>
          <p className="error-msg">
            Gagal memuat simulator. Coba refresh atau kembali ke halaman utama.
          </p>
          <div className="error-actions">
            <button
              onClick={() => {
                router.invalidate();
                reset();
              }}
              className="btn-game primary"
            >
              🔄 Coba Lagi
            </button>
            <a href="/" className="btn-game secondary">
              🏠 Halaman Utama
            </a>
          </div>
          {error.message && (
            <details className="error-details">
              <summary>Detail Error</summary>
              <code>{error.message}</code>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },      { title: "AR Gerak Parabola terintegrasi Paseran" },
      {
        name: "description",
        content:
          "Simulator 3D Gerak Parabola terintegrasi Paseran: atur sudut, kecepatan awal, dan hambatan udara.",
      },
      { property: "og:title", content: "AR Gerak Parabola terintegrasi Paseran" },
      { property: "og:description", content:
          "Editor 3D interaktif untuk memvisualisasikan lintasan parabola dengan Paseran.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
