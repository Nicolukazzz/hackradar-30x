# Reto 30X: JEV

Fuente: https://hackradar.30x.com/recursos/jev (copiado 2026-10-16)

**Pregunta:** ¿Qué decisiones de 30X podría tomar JEV miles de veces al día, en milisegundos y por fracciones de centavo, y cómo se ve eso funcionando?

- Área: Comercial, Media o Tech (equipo elige). Tipo: Explorar una oportunidad.

## Qué es JEV
Primer modelo público de TypeSafe AI. No conversa: **decide**. Recibe un estado (perfil, post, correo, fila de datos) + set de preguntas tipadas y devuelve todas las respuestas en una pasada, cada una con probabilidad calibrada.

Tipos de pregunta:
- **Choice**: elige entre opciones (hasta 255) con probabilidad por opción.
- **Score**: escala ordenada con confianza.
- **Noul**: sí/no con probabilidad.

Modelo "System One" (Kahneman): JEV decisiones rápidas/repetitivas; LLM lo lento (redactar, explicar, razonar). 70–500 ms, 0,042 USD por millón de tokens entrada, salida gratis, 32k tokens contexto. Disponible en consola TypeSafe, Vercel AI Gateway, DigitalOcean, LangChain.

Límites: nunca formato inválido pero puede equivocarse con confianza; no sirve para contar, aritmética ni comparar fechas (va en código); mejor preguntas simples combinadas en código. Buenos diseños: opción "otro", umbrales de confianza, camino a persona.

## Por qué en 30X
Muchas decisiones pequeñas repetidas (segmento, qué contenido mandar, lead listo para comercial, pieza vale la pena). Hoy a mano o reglas fijas; LLM es lento y caro.

## Cómo abordarlo
1. Conocer 30X y JEV, probar modelo, elegir área.
2. Playbook: decisiones, preguntas tipadas, umbrales para actuar solo vs pasar a persona/LLM, métricas.
3. Prototipo funcional sobre el playbook.

## Ideas de interés (no obligatorias)
- Clusterización dinámica (inscritos a Luma segmentados según perfil y momento de empresa, recalculado, con contenido/propuesta sugerida).
- Calificación de contenido (aprobar/descartar piezas generadas, dudosos al equipo).
- Alertas de riesgo de abandono en programas.
- Guardrails para agentes internos (validar antes de correo masivo, cambio CRM, publicación).

## Entra / no entra
Entra: cualquier uso de JEV para comercial, media o tech de 30X con playbook y prototipo. No entra: clones de personas de 30X ni soluciones que supongan que 30X vende algo que no vende.

## Entregable
- Playbook (máx 5 páginas u 8 slides).
- Prototipo funcional con **repositorio público**.

## Restricciones
Sin datos personales reales. Prototipo corre fuera de sistemas de 30X.

## Documentos
- Documentación oficial de JEV (TypeSafe)
- Guía de DigitalOcean: qué es JEV

Nota: JEV podría servir en Blinka como clasificador rápido (ej. "¿factura cuadra con contrato?" Noul con probabilidad), pero aritmética/fechas siguen en código.
