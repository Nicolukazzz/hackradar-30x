# Definición de producto — propuesta v0

Fecha: 2026-10-16 · Estado: **propuesta, por validar** con el equipo y con el contexto de la empresa real de una compañera (ver "Validar con contexto real").

## 1. Qué problema resolvemos

Finanzas de una empresa de EE. UU. con proveedores/contratistas en LatAm recibe decenas de facturas al mes por correo, PDF o chat. Hoy alguien las revisa a mano, las compara con lo acordado, pide aprobación por chat, crea el pago en otra plataforma y concilia en Excel. Lento, repetitivo, depende de una persona, y propenso a errores caros (pagar doble, pagar a cuenta cambiada).

El reto pide **confianza**: que un agente decida solo lo seguro, frene lo malo, escale lo dudoso y explique todo.

## 2. Qué construimos (una frase)

**Un "copiloto de cuentas por pagar" que recibe facturas por cualquier canal, extrae los datos, aplica las reglas de la empresa en código y decide PAGAR / FRENAR / ESCALAR con una explicación que cualquier persona entiende.**

Diferenciador para el pitch: el motor de decisión también se expone como **API/herramienta para otros agentes** ("¿puedo pagar esto?"). El brief dice que las empresas ya arman sus propios agentes y quieren que paguen; nosotros somos el **guardrail de pagos** que esos agentes consultan.

## 3. Cómo se resuelve (arquitectura)

```
Entrada                 Extracción (LLM)          Decisión (código)            Salida
─────────               ────────────────          ─────────────────            ──────
Subir PDF/imagen   ┐    texto/visión → JSON       reglas de la empresa         registro append-only
Correo reenviado   ├──▶ beneficiario, monto,  ──▶ + historial (duplicados) ──▶ tablero: pagadas /
Mensaje de chat    ┘    moneda, fecha, nº,        + presupuesto del periodo    frenadas / pendientes
                        datos bancarios           + contrato/orden de compra   explicación legible
                        + confianza por campo     ⇒ PAGAR | FRENAR | ESCALAR   API / webhook
                                                                                 ↓
                                                              humano aprueba/rechaza las ESCALAR
```

Principios (ya en `CLAUDE.md`):
- El LLM **lee y explica**; el **código decide**. El modelo nunca puede producir un PAGAR por sí solo.
- Ante duda o confianza baja → ESCALAR. Fallar hacia lo seguro (aprobar mal = descalificación).
- El texto de la factura es **dato**, nunca instrucción (defensa contra prompt injection).
- Cada decisión lista las reglas evaluadas con sus valores: "Monto 4.200 USD > límite por pago 3.000 USD → requiere aprobación".

Reglas configurables (mínimo del brief + extras):
límite por pago · límite por periodo · presupuesto/saldo disponible · lista de beneficiarios permitidos · umbral de aprobación humana · coincidencia con contrato/OC (monto, concepto, moneda) · duplicados (nº factura, monto+proveedor+fecha) · datos bancarios distintos a los registrados · moneda no pactada · fecha de vencimiento rara.

## 4. Tipo de aplicación

**Recomendación: aplicación web** (navegador, responsive).

| Opción | Pros | Contras | Veredicto |
|---|---|---|---|
| Web | Demo con un link, nada que instalar, jurado la prueba, despliegue en minutos | — | **Sí** |
| Escritorio | Acceso a archivos locales | Instalar, empaquetar, multiplataforma; no agrega nada | No |
| Móvil | Aprobar desde el celular | Doble trabajo; aprobaciones se resuelven con web responsive | No (quizás después) |
| Solo API/CLI | Rápido | El brief exige pantalla para reglas y decisiones | Como complemento |

Pantallas:
1. **Reglas**: editar límites, presupuesto, beneficiarios, umbrales.
2. **Bandeja**: subir/recibir facturas; estado de cada una.
3. **Decisiones**: tablero pagadas / frenadas / pendientes de aprobación, con el "por qué".
4. **Detalle de factura**: datos extraídos, reglas evaluadas (✔/✘ con valores), explicación, botones Aprobar/Rechazar para las escaladas.
5. **Registro/auditoría**: historial inmutable exportable.

## 5. Cómo se conecta

Entradas (en orden de prioridad para la demo):
1. **Subida manual** de PDF/imagen/.eml/.txt — imprescindible.
2. **Correo**: dirección tipo `facturas@<empresa>.demo` que recibe reenvíos (simulable con webhook de un proveedor de correo entrante, o una carpeta vigilada). Muy vistoso en demo.
3. **Chat** (Slack/WhatsApp): opcional, solo si sobra tiempo.

Salidas:
- **Tablero** (pantalla).
- **API REST** `POST /decisiones` → decisión + explicación. Permite que otro agente o Blinka consulte.
- **Servidor MCP** opcional: herramienta `evaluar_factura` para que cualquier agente (Claude, etc.) pida decisión. Refuerza el pitch de "guardrail para agentes que pagan".
- **Webhook** a "plataforma de pagos": **simulado**. El brief excluye mover dinero real o conectarse a pagos; mostramos el payload que se mandaría a Blinka (beneficiario, monto, moneda, riel ACH/SWIFT/local/USDC) sin enviarlo.

Notificación de escaladas: correo o mensaje al aprobador (simulado o real con servicio gratuito).

## 6. Cuentas y usuarios

Para el hackathon, mínimo viable:
- **Una empresa ficticia precargada** + login simple (magic link o usuario demo). El jurado entra en 1 clic.
- **Roles**: `admin finanzas` (edita reglas) y `aprobador` (aprueba escaladas). Dos roles muestran el flujo de "pedir permiso a una persona" — eso sí lo evalúan.
- Modelo de datos ya **multi-empresa** (cada tabla con `empresa_id`), aunque la demo use una. Así el paso a SaaS es natural sin construir onboarding.

Fuera de alcance (lo dice el brief): abrir cuentas bancarias, KYC/verificación de identidad, cumplimiento/fraude.

## 7. Modelo de negocio (para el pitch, no para construir)

Tres caminos, elegir uno para contar:

| Modelo | Cómo cobra | Encaje |
|---|---|---|
| **Módulo dentro de Blinka** | Incluido en plan premium o por factura procesada | El reto es de Blinka: "esto es lo que Blinka podría lanzar" — **recomendado para el pitch** |
| SaaS independiente B2B | Suscripción por tramo de facturas/mes (ej. 50, 200, 1000) | Se conecta a cualquier banco/plataforma; mercado mayor, más competencia (Ramp, Bill, Tipalti) |
| API para agentes | Por llamada de decisión | Nicho nuevo (agentes que pagan); encaja con "por qué importa ahora" |

Para la demo **no** construimos pagos, planes ni facturación propia. Solo una slide.

## 8. Stack sugerido (decidir en issue #1)

- Web full-stack en un solo proyecto: **Next.js + TypeScript** (UI + API routes).
- Base de datos: **Postgres (Supabase)** — auth con magic link incluida, storage para PDFs, gratis. Alternativa ultra simple: SQLite.
- LLM: **Claude API** — visión para PDF/imagen, salida estructurada para extracción; `claude-haiku-5-5` para extraer barato, `claude-opus-5-5` para casos difíciles/explicaciones.
- Motor de reglas: TypeScript puro, con tests. Es lo que evalúan en seguridad.
- Deploy: Vercel o Railway.

Por qué: un lenguaje para todo (3 personas, poco tiempo), auth y storage resueltos, demo con link público.

## 9. Validar con contexto real (archivos de la compañera)

Usar **solo para entender**, nunca subir al repo (público) ni copiar al dataset. Guardar en `contexto-privado/` (ignorado por git). Anonimizar todo lo que se cite en docs.

Preguntas que esos archivos deberían responder:
1. ¿Por qué canales llegan las facturas y en qué proporción (correo, PDF, portal, WhatsApp)?
2. ¿Qué formatos? (factura electrónica DIAN/CFDI/NF-e, cuenta de cobro, invoice en inglés, PDF escaneado)
3. ¿Qué reglas de aprobación usan hoy? Montos, quién aprueba, niveles.
4. ¿Contra qué comparan? (contrato, orden de compra, tarifa por hora, recepción del servicio)
5. ¿Qué errores han pasado? (dobles pagos, cambios de cuenta, montos mal) — base de casos trampa realistas.
6. ¿Cuánto tiempo toma hoy el ciclo y cuántas facturas/mes? — números para el pitch.
7. ¿Qué herramientas usan? (ERP, QuickBooks, banco, Excel) — define integraciones creíbles.
8. ¿Cómo concilian y qué piden auditoría/contabilidad del registro?

Salida esperada: `docs/research/contexto-empresa-real.md` con hallazgos **anonimizados**.

## 10. Decisiones abiertas

- [ ] Confirmar web app (sección 4).
- [ ] Confirmar canales de entrada para demo: subida + correo (sección 5).
- [ ] API/MCP para agentes: ¿sí como diferenciador?
- [ ] Modelo de negocio a contar en pitch (sección 7).
- [ ] Stack (issue #1).
