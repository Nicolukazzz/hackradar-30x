// GET /api/salud: Railway lo consulta al desplegar (railway.json → healthcheckPath). Si el servidor nuevo no responde
// 200, el deploy no reemplaza al que está funcionando. No toca la base ni devuelve datos. Está en API_PUBLICAS.
export function GET(): Response {
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
