# Guion del pitch de Quadra (video)

Duración: **2:15** de video (`video/out/pitch.mp4`) + hasta ~25 s del presentador a pantalla completa al inicio y al final ⇒ **≤ 2:40**, dentro del máximo de 3 minutos.

Enfoque: **mostrar el producto funcionando**, no explicar el reto (el jurado ya lo conoce). Cada bloque es una función real grabada o capturada en la app, con el presentador en un **círculo de cámara** donde explica.

Idea que el jurado debe recordar: **«La factura llega sola, una IA la lee, un algoritmo decide y cada decisión queda explicada. Lo que no cumple espera a una persona.»**

## Cómo se arma

- **Cámara completa** (C): el presentador a cuadro. Solo en la apertura y el cierre.
- **Círculo de cámara** (◯): el presentador en un círculo abajo a la derecha mientras se ve la función. Va en WhatsApp, Portal y Por dentro. Grabar cada bloque por separado, mirando a cámara, y guardar el archivo en `video/public/camara/<nombre>.mp4` (nombres abajo); al volver a exportar, Remotion lo pone solo en el círculo. Mientras no exista, el video muestra un círculo de marcador.
- **Voz en off** (V): solo la voz sobre la animación (Canales, Llegan solas, Cómo funciona, Roles, Moneda, Cierre).
- Ritmo: ~150 palabras por minuto. Los textos de cada bloque caben en su tiempo leídos con calma.

## Guion

| # | Tiempo en `pitch.mp4` | Plano | Escena | Archivo de cámara | Texto hablado |
|---|---|---|---|---|---|
| 0 | (antes) 0:00–0:10 | C + rótulo | — | — | «Hola, soy {nombre}, de Quadra. Les vamos a mostrar cómo una empresa deja de pagar facturas a mano… sin perder el control.» |
| 1 | 0:00–0:05 | — | `E01-Intro` | — | (música; sin voz) |
| 2 | 0:04–0:08 | V | `E02-Canales` | — | «La factura llega por donde el proveedor ya escribe.» |
| 3 | 0:08–0:22 | ◯ | `E03-WhatsApp` | `whatsapp.mp4` | «Por ejemplo, WhatsApp. El proveedor le escribe al número de la empresa, adjunta la foto o el PDF de su factura… y ya. Quadra la recibe, le pone un número interno y le responde por el mismo chat.» |
| 4 | 0:21–0:47 | ◯ | `E04-Portal` | `portal.mp4` | «Y si prefiere un portal: tesorería le da acceso con su nombre y su correo, y Quadra genera un enlace y un código único. El proveedor entra con su correo y ese código, sin crear cuenta, sube varias facturas a la vez… y ve al instante en qué va cada una: esta ya está aprobada para pago, estas dos las revisa una persona.» |
| 5 | 0:47–1:00 | V | `E05-Llegada` | — | «Del otro lado, tesorería no tiene que hacer nada: las facturas llegan solas a la bandeja y en segundos cada una queda pagada, frenada o escalada, con el motivo en una línea.» |
| 6 | 0:59–1:15 | V | `E06-ComoFunciona` | — | «¿Cómo decide? Un agente de inteligencia artificial lee la factura, sea foto, PDF o correo. Para estar seguros, dos lectores tienen que coincidir en cada dato; si la IA duda, no se paga. Y quien decide no es la IA: es un algoritmo con once reglas: duplicados, límites, presupuesto, la cuenta bancaria, lo acordado con el proveedor.» |
| 7 | 1:15–1:33 | ◯ | `E07-PorDentro` | `por-dentro.mp4` | «Y aquí está lo que nos diferencia: cada decisión se puede abrir y auditar. Dice por qué no se pagó, en una frase. Si la factura trae un texto escondido para engañar al agente, se resalta y se ignora. Y debajo, las once reglas con los valores exactos que comparó.» |
| 8 | 1:32–1:56 | V | `E08-Roles` | — | «Cada persona ve lo suyo. El tesorero recibe, carga y sigue cada factura. El aprobador solo decide lo que el agente escaló, con comentario obligatorio. Y el administrador define las reglas, los proveedores, el equipo y la moneda.» |
| 9 | 1:56–2:08 | V | `E09-Moneda` | — | «Porque Quadra piensa en la moneda de tu empresa: dólares, pesos, reales o euros. Presupuesto, límites y facturas se convierten solos.» |
| 10 | 2:08–2:15 | V | `E10-Cierre` | — | «Quadra. Tus facturas, decididas solas, dentro de tus reglas.» |
| 11 | (después) +0:10 | C | — | — | «Hoy decide y explica cada pago; mañana, conectado a Blinka, también lo ejecuta. Gracias.» |

Todos los nombres, montos y empresas que aparecen son **ficticios** (set de prueba del proyecto, `data/`) o de plantillas de factura de ejemplo. Las grabaciones del portal y la bandeja se hicieron en la app local con ese set; la de WhatsApp, con el número de prueba del equipo. La respuesta de WhatsApp al final de la escena 3 es ilustrativa (la grabación termina antes de que llegue).

## Grabación del presentador

- Horizontal 1920×1080 (o 1080×1080), 30 fps, luz de frente, micrófono de solapa o el del teléfono a 30 cm.
- Para el círculo: encuadre de pecho hacia arriba, centrado, con aire arriba de la cabeza (el círculo recorta las esquinas). Fondo liso.
- Duración de cada archivo de cámara: `whatsapp.mp4` ≤ 14 s · `portal.mp4` ≤ 26 s · `por-dentro.mp4` ≤ 18 s. Si es más largo, se corta al final de la escena.
- Bloques 0 y 11: mirar a cámara; agregar `video/out/rotulo.mov` (nombre y rol; se edita en Remotion Studio → `Rotulo`).
- Voz en off: grabar en un lugar silencioso y montarla sobre `pitch.mp4` en el editor.

## Qué muestra cada escena (para el editor)

| Escena | Contenido |
|---|---|
| `E03-WhatsApp` | Grabación real de WhatsApp: el proveedor adjunta dos fotos de factura; respuesta automática ilustrada al final |
| `E04-Portal` | Grabación real: Proveedores → «Dar acceso al portal» (nombre, correo, código) y el portal del proveedor (entrar con correo + código, subir 3 facturas, estados) |
| `E05-Llegada` | Animación de la bandeja recibiendo facturas: «Leyendo…» → Pagada / Frenada / Escalada con su motivo |
| `E06-ComoFunciona` | Canales → recibe → la IA lee (doble lectura) → 11 reglas → veredicto → registro |
| `E07-PorDentro` | Traza real de OMI-3381: explicación, instrucción escondida resaltada, reglas con valores |
| `E08-Roles` | Vista del tesorero (bandeja), del aprobador (decisión humana) y del administrador (ajustes) |
| `E09-Moneda` | Cambio de moneda base USD → COP → MXN → EUR → BRL con los montos convirtiéndose |

## Preguntas probables del jurado

| Pregunta | Respuesta corta |
|---|---|
| ¿Y si la IA lee mal un monto? | En modo de doble lectura, dos lectores deben coincidir; si dudan o la suma no cuadra, se escala y nunca se paga. La persona puede corregir el dato al aprobar y queda escrito. |
| ¿Y si la factura le da órdenes a la IA? | El texto va como dato, nunca como instrucción, y un detector en código busca esas frases (incluso invisibles). Si las encuentra, escala. |
| ¿Cómo saben que nunca paga mal? | Pruebas automáticas con miles de facturas aleatorias y un set de 30 facturas con trampas: cero pagos fuera de reglas. El CI bloquea cualquier cambio que pague algo indebido. |
| ¿Mueve dinero? | No: decide, registra y explica (alcance del reto). El siguiente paso es conectarlo a los pagos de Blinka. |
| ¿Cuánto cuesta? | Casi nada: los PDF se leen sin IA; la IA (plan gratuito) solo entra con fotos o documentos desordenados. |
