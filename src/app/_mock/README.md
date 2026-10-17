# Respuestas de ejemplo de la API (§12)

Mientras #17 no esté, las pantallas leen estas respuestas a través de `src/app/_datos/` (nunca importan el JSON directo).
Cada archivo tiene la forma de la respuesta del endpoint en §12, con los números del lote demo (§11.4).
Cuando #17 publique `/api/*`, se cambia la implementación en `src/app/_datos/` y se borra esta carpeta en el mismo PR.

| Archivo | Endpoint |
|---|---|
| `aprobaciones.json` | `GET /api/aprobaciones` → `{ pendientes: TarjetaAprobacion[], reservado_usd }` |

`TarjetaAprobacion` no está en §3: la forma de este mock es una propuesta (campos de `EntradaRegistro` §9 + `asignado_a` y `responder_antes_de` de `ResultadoMotor`). #17 y 6d la fijan.
