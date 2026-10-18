import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { MENSAJE_401 } from "@/lib/auth/permisos";
import { clasificarRuta } from "@/lib/auth/rutas";
import { entornoPublico } from "@/lib/supabase/entorno";

// Next 16: `proxy.ts` reemplaza a `middleware.ts`. Refresca la sesión de Supabase (cookies) y hace el
// chequeo optimista: sin sesión, las páginas van a /entrar y la API responde 401. La sesión se verifica
// de nuevo en el servidor con obtenerSesion() (layout del panel y conSesion).
export async function proxy(request: NextRequest) {
  const { url, publishableKey } = entornoPublico();
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(porEscribir, cabeceras) {
        for (const { name, value } of porEscribir) request.cookies.set(name, value);
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of porEscribir) respuesta.cookies.set(name, value, options);
        for (const [clave, valor] of Object.entries(cabeceras)) respuesta.headers.set(clave, valor);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const ruta = request.nextUrl.pathname;

  switch (clasificarRuta(ruta, Boolean(data?.claims?.sub))) {
    case "seguir":
      return respuesta;
    case "no_autorizado":
      return NextResponse.json({ error: MENSAJE_401 }, { status: 401 });
    case "redirigir": {
      const destino = request.nextUrl.clone();
      destino.pathname = "/entrar";
      destino.search = ruta === "/" ? "" : `?siguiente=${encodeURIComponent(ruta + request.nextUrl.search)}`;
      return NextResponse.redirect(destino);
    }
  }
}

/** Corre en todo salvo archivos estáticos e imágenes. */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
