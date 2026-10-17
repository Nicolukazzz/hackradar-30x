# Guion de la demo (reto Blinka)

Duración: 4 minutos. Cada paso muestra uno de los tres criterios del reto: **autonomía**, **seguridad**, **explicabilidad**.
Facturas en vivo: `data/escenarios/demo-en-vivo/documentos/` (PDF en `adjuntos/` y una foto PNG), especificación §11.7.

## Antes de presentar (una vez)

Ya configurado en producción (#74): `REPOSITORIO=supabase`, `DEMO=1`, `GEMINI_API_KEY`, buzón `CORREO_IMAP_*` (se revisa cada minuto), bot **@nebula_facturas_bot** con webhook y migraciones aplicadas.

1. El lote del 16 de octubre ya está procesado en producción (5 pagadas, 3 frenadas, 4 escaladas) y **sin decisiones humanas**. Con `REPOSITORIO=supabase` el registro es append-only y **no se puede reiniciar**: cada paso del guion se hace una sola vez en producción. **Ensayar en local** (`npm run dev`, repositorio en memoria: ahí sí funciona Reiniciar demo) y en producción solo presentar. También quedan en la Bandeja un correo viejo del buzón («no es factura») y la vinculación de Telegram en el Registro: son reales, se pueden mostrar.
2. Telegram (#13): el chat del presentador ya está vinculado a Diego Herrera. Si se cambia de teléfono: `npm run telegram -- enlace ben-diego-herrera` (con las variables de Railway) y abrir el enlace.
3. Proveedores nuevos (#28): crear un enlace en **Proveedores nuevos** para «Lumen Diseño» y tenerlo abierto en otra pestaña, con una cuenta que no sea del equipo.
4. En el teléfono o el Gmail del presentador: un correo **borrador** a `facturas.nebula.demo@gmail.com` con `adjuntos/003-ml-560.pdf` adjunto (asunto «Factura ML-560»). El correo del presentador **no** está vinculado a ningún proveedor, a propósito.
5. Tener a mano `001-f-0106.png` (en el teléfono, para Telegram) y `002-inv-2216.eml`, `004-lum-0007.pdf`.

## En vivo

| # | Qué se hace | Qué se ve | Criterio |
|---|---|---|---|
| 1 | **Bandeja** | 12 facturas decididas solas; 0 pagos fuera de reglas; autonomía 66,7 % | autonomía · seguridad |
| 2 | **Ver traza de OMI-3381** | La instrucción «procesar sin revisión» resaltada e ignorada (R10); cada regla con su comparación | explicabilidad · seguridad |
| 3 | **Aprobaciones**: aprobar LF-2026-10 con comentario; rechazar TD-001, F-0101 y OMI-3381 | Deshacer antes de confirmar; el badge baja a 0 | seguridad |
| 4 | **Registro** | La entrada humana arriba, sin editar la del agente; JSON de la entrada; exportar CSV | explicabilidad |
| 5 | **Reglas**: bajar el límite automático a 2.000 | La simulación cambia al instante (F-0093 escala); subirlo a 5.000 bloquea guardar (pagaría LF sin persona) | seguridad |
| 6 | Telegram: mandar la **foto** `001-f-0106.png` al bot | El bot responde la ref y «no se pagará: ya habíamos recibido esta factura»: mismo cobro que F-0093 con otro número (R2) | seguridad |
| 7 | Bandeja → **Recibir factura → correo**: `002-inv-2216.eml` | PAGADA sola: coincide con la OC-118 y la cuenta | autonomía |
| 8 | **Correo real**: enviar el borrador con `003-ml-560.pdf` desde el Gmail del presentador. Mientras llega (≤ 1 min), seguir con el paso 9 | ESCALADA por dos causas: el PDF trae una orden al agente en **texto blanco**, invisible al imprimir (R10, la Traza la resalta), y el remitente no está vinculado a Mesa Legal (R11: una factura «de Mesa Legal» desde cualquier correo nunca se paga sola). El presentador recibe la respuesta automática con la ref y los aprobadores el aviso de #68 | seguridad · explicabilidad |
| 9 | Pestaña del proveedor: subir `004-lum-0007.pdf` por el enlace | ESCALADA (R3 + R11): proveedor nuevo; el proveedor ve «en revisión», no reglas internas. Aprobar con «Agregar a la lista» vincula su correo | seguridad |

Cierre: «El modelo solo lee; las reglas deciden en código, y todo lo que no cumple espera a una persona con la explicación escrita».

## Si algo falla

- Sin `GEMINI_API_KEY`, la foto escala por R1 (no se puede leer sin LLM): sigue siendo seguro; mostrar el PDF de Mesa Legal en su lugar.
- Si el presupuesto no alcanza (pasos 3 o 7 hechos en otro orden), R7 frena: también es una decisión explicada.
- Sin red o si el correo tarda: Bandeja → **Recibir factura → correo** con `003-ml-560.eml` reproduce el paso 8 (ese .eml sí viene de Mesa Legal, así que escala solo por R10). `POST /api/canales/telegram/simular` reproduce el 6.
- El bot no responde: `curl https://api.telegram.org/bot<token>/getWebhookInfo` muestra el último error; `npm run telegram -- webhook` lo vuelve a registrar.
