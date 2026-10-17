// URL pública de la app para enlaces que salen hacia afuera (correo, avisos al proveedor).
// Sale de la configuración (Railway la expone como RAILWAY_PUBLIC_DOMAIN), nunca de cabeceras de la
// petición: un X-Forwarded-Host falso no puede meter otro dominio en un mensaje.

export function urlPublica(ruta: string, env: NodeJS.ProcessEnv = process.env): string {
  const dominio = env.RAILWAY_PUBLIC_DOMAIN?.trim();
  const base = dominio ? `https://${dominio}` : (env.URL_PUBLICA?.trim() || "http://localhost:3000");
  return new URL(ruta, base).toString();
}
