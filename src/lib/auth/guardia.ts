import { ErrorAuth, exigirSesion, MENSAJE_401, MENSAJE_403, type Sesion } from "@/lib/auth/permisos";

// Envoltura para route handlers: CSRF por Origin y sesión verificada. Dependencias inyectadas
// para probar sin red; la versión conectada a Supabase es `conSesion` de ruta.ts.

export type EventoAuditoria = {
  tipo: "entrar" | "registro" | "salir" | "error_envio" | "401" | "403";
  usuario_id: string | null;
  ruta: string;
  motivo?: string;
};

export type DependenciasGuardia = {
  obtenerSesion: () => Promise<Sesion | null>;
  auditar: (evento: EventoAuditoria) => void;
};

export type Manejador<C> = (req: Request, ctx: C, sesion: Sesion) => Promise<Response>;

const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Los navegadores mandan Origin en todo POST/PUT/DELETE; si falta o es de otro sitio, se rechaza. */
function mismoOrigen(req: Request): boolean {
  const origen = req.headers.get("origin");
  if (!origen) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  try {
    return new URL(origen).host === host;
  } catch {
    return false;
  }
}

export function crearGuardia({ obtenerSesion, auditar }: DependenciasGuardia) {
  function conSesion<C>(manejador: Manejador<C>) {
    // ctx opcional: las rutas sin parámetros (`/api/bandeja`) se llaman solo con la petición.
    return async (req: Request, ctx?: C): Promise<Response> => {
      const ruta = new URL(req.url).pathname;
      let sesion: Sesion | null = null;
      try {
        if (!METODOS_SEGUROS.has(req.method) && !mismoOrigen(req)) throw new ErrorAuth(403);
        sesion = await obtenerSesion();
        return await manejador(req, ctx as C, exigirSesion(sesion));
      } catch (e) {
        if (!(e instanceof ErrorAuth)) throw e;
        const evento: EventoAuditoria = { tipo: e.status === 401 ? "401" : "403", usuario_id: sesion?.usuario_id ?? null, ruta };
        if (e.message !== MENSAJE_401 && e.message !== MENSAJE_403) evento.motivo = e.message;
        auditar(evento);
        return Response.json({ error: e.message }, { status: e.status });
      }
    };
  }
  return { conSesion };
}
