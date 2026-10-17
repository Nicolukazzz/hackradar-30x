# Reglas de aprobación en Ramp, Brex y BILL + inyección de instrucciones en facturas
Fecha: 2026-10-17 · Autor: J (issue #8)

## Pregunta
1. ¿Qué reglas de aprobación de cuentas por pagar ofrecen Ramp, Brex y BILL que no estén en R1–R11 (`docs/especificacion.md` §4) o en §10? ¿Cómo tratan el cambio de cuenta bancaria de un proveedor (nuestra R4) y la doble aprobación?
2. ¿El diseño de §8 paso 4 (documento aislado, salida JSON validada, detector determinista R10, el LLM nunca decide) cubre los ataques de inyección conocidos? ¿Qué patrones faltan en R10?
3. ¿Qué ideas sirven para el pitch de explicabilidad?

Destraba: posibles reglas nuevas (#5), ampliación del detector R10 y de la extracción (#4), y el guion de la demo.

## Hallazgos

### Ramp (Bill Pay)
- Enrutamiento por **monto** en todos los planes; en Ramp Plus además por entidad, departamento, ubicación, proveedor, dueño del proveedor, **si está asociada a una orden de compra**, tipo de pago y cuentas contables — [Ramp: Bill Pay approvals](https://support.ramp.com/hc/en-us/articles/4417843897747-Bill-Pay-approvals)
- Pasos en orden; dentro de un paso "todos deben aprobar" o "basta uno". Aprobadores por rol (dueño del proveedor, dueño de la OC, admin, grupos) o personas — misma fuente.
- **Separación de funciones**: quien crea la factura no puede aprobarla; si aparece en la cadena se reemplaza por "cualquier admin" — misma fuente.
- **Liberación del pago**: aprobación aparte, después de aprobar la factura y antes de enviar el dinero — misma fuente.
- **Reaprobación obligatoria** (no se puede apagar) si cambia el proveedor, el monto, el método de pago, la **cuenta de origen o de destino** o la fecha de pago. Quien aprueba no puede editar monto, datos de pago ni proveedor durante la aprobación — misma fuente.
- Escaneo de fraude en cada factura antes de pagar: alerta por **datos bancarios nuevos o cambiados**, montos inusuales y proveedores no verificados en la red de Ramp — [Ramp: Bill Pay Fraud](https://support.ramp.com/hc/en-us/articles/37791491771027-Bill-Pay-Fraud)
- Verificación de la cuenta del proveedor: que reciba depósitos **y** que sea del proveedor (conexión bancaria, microdepósitos o extracto). Recomiendan pedir los datos ACH al proveedor por su portal en vez de digitarlos — [Ramp: Vendor verification](https://support.ramp.com/vendor-verification)

### Brex (Bill pay)
- Cadena de aprobación configurable en el Policy Engine por **monto y proveedor**; p. ej. primero el dueño del proveedor y después quien libera el pago. Aprobada la factura, el pago sale solo en la fecha indicada — [Brex: Bill pay overview](https://brex.com/support/bill-pay-overview)
- Los datos de pago del proveedor se cargan a mano o **los manda el proveedor por un enlace seguro** — [Brex: Managing vendors](https://brex.com/support/managing-vendors)
- No encontré documentación pública de qué pasa cuando cambia la cuenta de un proveedor (¿reaprobación?, ¿llamada de verificación?).

### BILL
- Políticas de aprobación por proveedor, ubicación, departamento y cuenta contable, y **"dual control"**: una segunda aprobación para cambios sensibles como **agregar una cuenta bancaria de proveedor** — [Accounting Today](https://www.accountingtoday.com/news/bill-com-adds-new-features) (nota sin fecha: confirmar vigencia)
- Un proveedor tiene una sola cuenta activa; cambiarla es borrar y crear. La API expone si BILL ya verificó la cuenta (estado agregado en mayo de 2026) — [BILL: changelog](https://developer.bill.com/changelog/2026-05-21-vendor-bank-accounts-api-improvements)
- Al cambiar la cuenta, se le escribe al proveedor para que confirme el cambio — [BILL: confirmar cambio bancario](https://vendorpayhelp.bill.com/hc/en-us/articles/360056648731) (producto de pagos a proveedores; puede no ser igual en AP)

### Inyección de instrucciones (OWASP LLM01:2025)
- Medidas de OWASP: limitar el rol del modelo; **definir y validar el formato de salida con código determinista**; filtrar entradas y salidas; mínimo privilegio (las funciones las ejecuta el código, no el modelo); **aprobación humana para acciones de alto riesgo**; **separar y marcar el contenido no confiable**; pruebas adversarias — [OWASP LLM01](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- Escenarios relevantes: texto oculto en una página, documentos envenenados, **instrucciones partidas en varios fragmentos** de un currículum, e **instrucciones dentro de una imagen** que lee un modelo multimodal. "No necesitan ser visibles ni legibles para una persona" — misma fuente.
- Formas de ocultarlas en documentos: texto blanco sobre blanco o en letra diminuta en PDF, caracteres de ancho cero, y **caracteres del bloque Unicode Tags (U+E0000–U+E007F)**: no tienen forma visible, pero el modelo los lee como texto — [CSA: Unicode instruction injection](https://labs.cloudsecurityalliance.org/wp-content/uploads/2026/03/CSA_research_note_unicode_instruction_injection_ai_skills_20260310-csa-styled.pdf), [Coralogix: indirect prompt injection](https://coralogix.com/ai-blog/indirect-prompt-injection/)

## Implicación para el proyecto

### Lo que ya cubrimos (y conviene decirlo en el pitch)
| Práctica de Ramp / Brex / BILL / OWASP | Nuestro equivalente |
|---|---|
| Aprobación por monto | R9 (automático hasta USD 3.000), R6 (máximo), doble firma desde USD 10.000 (§10) |
| Aprobación por proveedor / lista | R3 + R8 (límite mensual por beneficiario) |
| Asociar la factura a una OC | R5 (cuadra con lo acordado, ±2 %) |
| Alerta por cuenta bancaria nueva o cambiada | **R4 escala siempre** (ellos solo alertan) |
| El proveedor manda sus datos por un enlace seguro | #28 (enlace con código único) y vinculación de Telegram (#13) |
| Aprobación humana para acciones de alto riesgo (OWASP 5) | ESCALAR + Aprobaciones con comentario obligatorio |
| Validar la salida con código (OWASP 2) | zod estricto sobre el JSON del LLM; respuesta inválida se descarta entera |
| Separar el contenido no confiable (OWASP 6) | documento entre `<documento>…</documento>` y escapado |
| Mínimo privilegio (OWASP 4) | el LLM no tiene herramientas: solo extrae; el motor decide |
| Instrucciones en el texto | R10 determinista + señales del LLM; doble lectura (#58) suma señales de dos modelos |

### Lo que no tenemos (propuestas)
1. **Separación de funciones** (Ramp): quien subió la factura por el panel no puede aprobarla. Hoy una cuenta puede subir y aprobar la misma factura. Propuesta para §10 / `decidir.ts` (con #53): 403 "Quien subió la factura no puede aprobarla" si `documento.remitente.valor === sesion.correo`.
2. **Reaprobación si cambia lo aprobado** (Ramp): no aplica tal cual (el registro es append-only y no hay edición de facturas), pero sí al **reprocesar**: si una factura escalada vuelve a entrar con otro monto o cuenta, es un documento nuevo y R2 lo frena. Ya está cubierto; vale mencionarlo.
3. **Cambio de cuenta con control dual** (BILL): hoy "Agregar a la lista" crea el beneficiario con la cuenta de la factura con **una** firma. Propuesta: que agregar un beneficiario o cambiar su cuenta exija una segunda persona (o un admin, con #53), igual que la doble firma.
4. **Liberación del pago separada** (Ramp/Brex): fuera de alcance (no movemos dinero), pero se puede contar como "lo que haría Blinka después de PAGAR".

### Ampliar el detector R10 (`src/reglas/inyeccion.ts`, comentario para #5/#4)
- **Unicode Tags (U+E0000–U+E007F)** (comprobado: «ignore previous instructions» escrito con Tags da 0 hallazgos): hoy `plegar` los **borra** (son `\p{Cf}`), así que una instrucción escrita con ellos desaparece del texto que se escanea, aunque el modelo sí la lee. Propuesta: decodificarlos (U+E0020–U+E007E → ASCII), escanear también ese texto, y que la **sola presencia** de caracteres Tags cuente como hallazgo («texto invisible»).
- Patrones nuevos (es/en/pt, sin tildes): `nuevas instrucciones`, `olvida (las|todas)`, `pre-?aprobad`, `no requiere aprobacion`, `marcar(la)? como (pagad|aprobad)`, `you are an? (ai|assistant|agent)`, `as an ai`, `disregard (the )?(above|previous)`, `new instructions`, `override`, `auto-?approve`, `without review`, `already approved`, `mark (it|this)? ?as (paid|approved)`, `sem revisao`, `aprovar automaticamente`, `ignore as instrucoes`, y la etiqueta `</?documento>` (intento de cerrar nuestro bloque de datos).
- **Instrucciones partidas** (OWASP escenario 6): escanear también el texto concatenado de asunto + mensaje + documento sin saltos de línea, no solo cada fuente por separado.
- **Texto solo en imágenes**: el detector no ve el texto de una foto. Ahí depende de que el LLM lo reporte en `instrucciones_sospechosas`. Con la doble lectura basta con que uno de los dos lo reporte. No hay riesgo de pago: el LLM no decide y el resto de reglas sigue aplicando.
- **Texto oculto en PDF** (blanco sobre blanco, letra diminuta): el parser saca todo el texto sin mirar el color, así que R10 lo ve. Conviene un test con un PDF así en el dataset (`/generar-facturas`).

### Explicabilidad para el pitch
- Ramp muestra "quién aprobó qué y cuándo" (auditoría). Nosotros mostramos además **por qué**: cada regla con su comparación (`R9 · 4.500,00 > 3.000,00`), la explicación en una frase y el JSON de la entrada. Eso es explicabilidad que ellos no ofrecen.
- Frase: "Ramp te avisa que la cuenta cambió; nuestro agente **no paga** hasta que una persona lo revise, y deja escrito por qué".
- Mostrar en vivo la Traza de OMI-3381: la instrucción inyectada resaltada y "ignorada (R10)".

## Preguntas abiertas
- Brex: ¿qué hace cuando cambia la cuenta de un proveedor? No hay documentación pública; preguntar si alguien del equipo tiene acceso.
- BILL "dual control": confirmar en su centro de ayuda actual que sigue existiendo y en qué plan.
- ¿Separación de funciones como regla del motor (R12) o como validación de §10? Propongo §10: no cambia la decisión del agente, solo quién puede firmar.
