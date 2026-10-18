"use client";

// Último respaldo: un error en el layout raíz. Reemplaza todo el documento, así que trae su propio <html> y estilos
// mínimos en línea (el CSS de la app puede no haber cargado).
export default function ErrorGlobal({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#F7F8F5", color: "#101614", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>No pudimos cargar la aplicación</h1>
          <p style={{ color: "#5B6661", margin: "0 0 20px", lineHeight: 1.5 }}>Intenta de nuevo en unos segundos. Nada se pagó ni se registró a medias.</p>
          <button
            type="button"
            onClick={reset}
            style={{ minHeight: 44, padding: "0 20px", borderRadius: 10, border: 0, background: "#101614", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
          >
            Intentar de nuevo
          </button>
        </main>
      </body>
    </html>
  );
}
