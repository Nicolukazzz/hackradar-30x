// Arranque del servidor (Next llama `register` una vez por proceso). Si hay buzón de correo configurado
// (#14), empieza a revisarlo cada minuto. Solo en Node: IMAP no existe en el runtime Edge.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { configBuzonDesdeEntorno } = await import("@/canales/correo/buzon");
  const config = configBuzonDesdeEntorno();
  if (!config) return;
  const { iniciarSondeo } = await import("@/canales/correo/sondeo");
  iniciarSondeo(config);
  console.info(JSON.stringify({ canal: "correo", sondeo: "activo", buzon: config.usuario.replace(/^(.).*@/, "$1…@") }));
}
