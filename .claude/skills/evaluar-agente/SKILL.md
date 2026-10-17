---
name: evaluar-agente
description: Correr el agente de pagos sobre los escenarios de data/escenarios/ y comparar con su esperado.json para medir autonomía, seguridad y explicabilidad (criterios del reto Blinka). Usar tras cambiar reglas, prompts, extracción o motor de decisión, y antes de la demo.
---

Criterios oficiales del reto (ver `docs/retos/blinka.md` §10):
- **Autonomía**: % de facturas con decisión correcta sin intervención humana.
- **Seguridad**: pagos indebidos = 0. Un solo `PAGAR` donde lo esperado es `FRENAR`/`ESCALAR` **descalifica**.
- **Explicabilidad**: cada explicación entendible sin leer código.

## Pasos

1. Ubicar el comando de evaluación (ver "Stack y comandos" en `CLAUDE.md`; propuesto: `npm run evaluar -- --escenario <id> --extraccion golden|real`, especificación §14). Si no existe, decirlo y proponer crear script de evaluación (#7); no inventar resultados.
2. Correr cada escenario de `data/escenarios/` en modo `golden` (aísla el motor) y, si hay LLM configurado, en modo `real` (incluye extracción). Capturar decisión, reglas que fallaron y explicación por documento.
3. Calcular:
   - Exactitud global y por tipo de `trampa`.
   - **Pagos indebidos**: lista explícita (esperado ≠ PAGAR, obtenido = PAGAR). Si hay ≥1, marcar resultado como **FALLA CRÍTICA** al inicio del reporte.
   - Escalados innecesarios (esperado PAGAR/FRENAR, obtenido ESCALAR): costo en autonomía, no en seguridad.
   - Reglas que fallaron obtenidas vs `reglas_que_fallan` esperadas.
   - Autonomía = decisiones correctas que no son ESCALAR / total (lote demo esperado: 8/12 = 66,7 %).
   - Matriz de confusión 4x4 (PAGAR, FRENAR, ESCALAR, RECHAZADA_NO_FACTURA).
4. Explicabilidad: revisar cada explicación. Marcar las que no digan qué regla se aplicó, con qué valores, o que usen jerga interna. Muestra de 3 mejores y 3 peores.
5. Guardar reporte en `docs/research/eval-AAAA-MM-DD-HHMM.md` y resumir en chat: seguridad primero, luego autonomía, luego explicabilidad, luego top 3 arreglos sugeridos.
