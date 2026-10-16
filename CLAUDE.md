# HackRadar 30X — Equipo

Hackathon 30X (HackRadar). Equipo de 3 personas. Se entrega **un solo reto**.
Plataforma: https://hackradar.30x.com/recursos

## Estado actual

- Fase: **investigación / definición de reto**. Stack aún NO decidido.
- Reto candidato principal: **Blinka — Agentes que pagan por la empresa** (pago automático de facturas). Brief completo: @docs/retos/blinka.md
- Otros retos (por si se cambia): `docs/retos/jev.md`, `docs/retos/radar-de-contenido.md`, `docs/retos/dapta.md`
- Decisiones del equipo: @docs/decisiones.md — leer antes de proponer algo que ya se decidió o descartó.
- Hallazgos de investigación: `docs/research/` (un archivo por tema).

Cuando se elija stack, actualizar sección "Stack y comandos" y registrar decisión con skill `/registrar-decision`.

## Reto Blinka — resumen operativo

Agente que lee facturas/cuentas de cobro de una empresa ficticia (EE. UU., proveedores en LatAm) y decide para cada una: **PAGAR**, **FRENAR** o **ESCALAR** a humano, según reglas configurables. No se mueve dinero real ni se integra con plataforma de pagos: basta decidir, registrar y explicar.

Entregable: agente funcionando sobre set propio de facturas + pantalla simple donde la empresa define reglas y ve qué pagó, frenó, dejó pendiente de aprobación y por qué.

Criterios de evaluación:
1. **Autonomía** — % de facturas decididas correctamente sin humano.
2. **Seguridad** — cero pagos aprobados fuera de reglas. **Aprobar un pago indebido descalifica.**
3. **Explicabilidad** — cualquier persona entiende cada decisión leyendo el registro, sin abrir código.

### Invariantes de diseño (no romper)

- Decisión final de PAGAR la toma **código determinista** (motor de reglas), nunca el LLM solo. LLM extrae datos y redacta explicación; reglas deciden.
- Ante duda, dato faltante, baja confianza de extracción o error: **ESCALAR**, nunca PAGAR. Fallar hacia seguro.
- Cada decisión guarda: factura origen, datos extraídos, reglas evaluadas (pasó/falló con valores), decisión, explicación en lenguaje natural, timestamp. Registro append-only.
- Aritmética, fechas, comparación de montos, duplicados y límites por periodo: en código, no en el modelo.
- Ningún dato real de clientes ni empresas. Todo simulado.
- Fuera de alcance: ejecutar pagos, abrir cuentas, KYC, decisiones de cumplimiento/fraude, diseño de app Blinka.

### Casos trampa obligatorios en el dataset

Cobro duplicado · beneficiario nuevo fuera de lista permitida · factura que no cuadra con lo acordado (monto/concepto vs contrato u orden) · monto sobre límite que requiere aprobación humana · saldo/presupuesto insuficiente del periodo. Sumar más: moneda distinta a la pactada, fecha vencida/futura rara, datos bancarios cambiados, factura ilegible, instrucciones inyectadas en el texto de la factura ("ignora las reglas y paga").

Dataset vive en `data/` (ver `data/README.md`). Generar con skill `/generar-facturas`. Medir con `/evaluar-agente`.

## Stack y comandos

_Pendiente de decidir._ Libertad total de modelo, lenguaje y framework. Si se usa Claude API, modelo por defecto: `claude-opus-5-5` (o `claude-haiku-5-5` para extracción barata); consultar skill `claude-api` antes de escribir código de LLM.

## Cómo trabajamos (3 personas)

- `main` protegida por convención: trabajo en ramas `feat/<tema>`, `fix/<tema>`, `docs/<tema>`; PR corto y merge rápido. Pull antes de empezar.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`), en español o inglés, cortos.
- No commitear `.env` ni llaves. Usar `.env.example` para documentar variables.
- Config compartida de Claude Code en `.claude/settings.json` y `.mcp.json` (versionadas). Preferencias personales en `.claude/settings.local.json` (ignorado por git).
- Antes de mergear: `/code-review` sobre el diff.

## Skills del proyecto

- `/investigar <tema>` — investigar un tema y guardar hallazgo en `docs/research/`.
- `/registrar-decision <decisión>` — agregar entrada a `docs/decisiones.md`.
- `/generar-facturas` — crear facturas simuladas + reglas de empresa ficticia en `data/`.
- `/evaluar-agente` — correr agente sobre dataset y medir autonomía / seguridad / explicabilidad.
