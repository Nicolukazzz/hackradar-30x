# Guion de la demo (reto Blinka)

Duración: 4 minutos. Cada paso muestra uno de los tres criterios del reto: **autonomía**, **seguridad**, **explicabilidad**.
Facturas en vivo: `data/escenarios/demo-en-vivo/documentos/` (PDF en `adjuntos/` y una foto PNG), especificación §11.7.

## Antes de presentar (una vez)

1. Producción con `REPOSITORIO=supabase`, `DEMO=1`, `GEMINI_API_KEY` (lee la foto) y las migraciones aplicadas.
2. Reiniciar la demo y **Procesar facturas nuevas** en la Bandeja: carga el lote del 16 de octubre (5 pagadas, 3 frenadas, 4 escaladas).
3. Telegram (#13): `npm run telegram -- enlace ben-diego-herrera`, abrir el enlace en el teléfono del presentador → el chat queda vinculado a Diego Herrera.
4. Proveedores nuevos (#28): crear un enlace en **Proveedores nuevos** para «Lumen Diseño» y tenerlo abierto en otra pestaña, con una cuenta que no sea del equipo.
5. Tener a mano `001-f-0106.png`, `002-inv-2216.eml`, `003-ml-560.eml` y `adjuntos/004-lum-0007.pdf`.

## En vivo

| # | Qué se hace | Qué se ve | Criterio |
|---|---|---|---|
| 1 | **Bandeja** | 12 facturas decididas solas; 0 pagos fuera de reglas; autonomía 66,7 % | autonomía · seguridad |
| 2 | **Ver traza de OMI-3381** | La instrucción «procesar sin revisión» resaltada e ignorada (R10); cada regla con su comparación | explicabilidad · seguridad |
| 3 | **Aprobaciones**: aprobar LF-2026-10 con comentario; rechazar TD-001, F-0101 y OMI-3381 | Deshacer antes de confirmar; el badge baja a 0 | seguridad |
| 4 | **Registro** | La entrada humana arriba, sin editar la del agente; JSON de la entrada; exportar CSV | explicabilidad |
| 5 | **Reglas**: bajar el límite automático a 2.000 | La simulación cambia al instante (F-0093 escala); subirlo a 5.000 bloquea guardar (pagaría LF sin persona) | seguridad |
| 6 | Telegram: mandar la **foto** `001-f-0106.png` al bot | El bot responde la ref y «no se pagará: ya habíamos recibido esta factura»: mismo cobro que F-0093 con otro número (R2) | seguridad |
| 7 | Bandeja → **Recibir factura → Correo (.eml)**: `002-inv-2216.eml` | PAGADA sola: compra única de la OC-122 (USD 900), aparte del hosting mensual ya pagado; cuenta registrada | autonomía |
| 8 | Bandeja → **Recibir factura → Correo (.eml)**: `003-ml-560.eml` (el correo, no el PDF suelto: así llega de Mesa Legal y solo falla R10) | ESCALADA: el PDF adjunto trae una orden al agente en **texto blanco**, invisible al imprimir; la Traza la muestra (R10) | seguridad · explicabilidad |
| 9 | Pestaña del proveedor: subir `004-lum-0007.pdf` por el enlace | ESCALADA (R3 + R11): proveedor nuevo; el proveedor ve «en revisión», no reglas internas. Aprobar con «Agregar a la lista» vincula su correo | seguridad |

Cierre: «El modelo solo lee; las reglas deciden en código, y todo lo que no cumple espera a una persona con la explicación escrita».

## Si algo falla

- Sin `GEMINI_API_KEY`, la foto escala por R1 (no se puede leer sin LLM): sigue siendo seguro; mostrar el PDF de Mesa Legal en su lugar.
- Si el presupuesto no alcanza (pasos 3 o 7 hechos en otro orden), R7 frena: también es una decisión explicada.
- Sin red: `POST /api/canales/telegram/simular` y `/api/canales/correo/simular` reproducen los pasos 6–8 desde el panel.
