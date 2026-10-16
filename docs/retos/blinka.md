# Reto Blinka: Agentes que pagan por la empresa

Fuente: https://hackradar.30x.com/recursos/blinka (copiado 2026-10-16)

## 01 Ficha
- Área: Producto. Tipo: Crear algo nuevo. Entregable: Agente funcionando.
- En una frase: construir un agente que revise las cuentas de una empresa y decida cuáles pagar por ella, dentro de las reglas que la empresa define, y que pida permiso a una persona cuando algo se sale de esas reglas.

## 02 Cómo funciona hoy
1. Llega factura o cuenta de cobro por correo, PDF o chat.
2. Alguien de finanzas la revisa, compara con lo acordado y busca datos de quien cobra.
3. Pide aprobación por chat o correo.
4. Entra a la plataforma y crea el pago a mano, muchas veces en otra moneda y hacia otro país.
5. Concilia en hoja de cálculo qué se pagó y por qué.

Todo manual, cada mes, depende de que una persona esté disponible.

## 03 A quién afecta
Empresas constituidas en EE. UU. que operan en varios países, con equipo, proveedores y contratistas en LatAm y otras regiones. Finanzas hace decenas de pagos al mes.

## 04 Por qué importa ahora
Más empresas arman sus propios agentes y quieren que también paguen. Falta resolver la **confianza**: que el agente pague solo lo que debe, explique cada decisión y nunca se pase de los límites.

## 05 Hasta dónde llega el flujo
Termina cuando el agente decide qué hacer con cada factura: **pagarla, frenarla o escalarla**. No mover dinero real ni conectarse a plataforma de pagos: decidir, registrar y explicar.

## 06 Qué entra y qué no
Entra:
- Leer factura y extraer a quién, cuánto, en qué moneda y para cuándo.
- Decidir si se paga según reglas configurables: límites por pago y por periodo, beneficiarios permitidos, aprobación humana sobre cierto monto.
- Registro de cada decisión: pagó, frenó o escaló, y por qué.

No entra: ejecutar pagos reales o mover dinero · abrir cuentas · verificar identidad de empresas · decisiones de cumplimiento o fraude · diseño de la app de Blinka.

## 07 Con qué trabajar
No hay API ni facturas de ejemplo: cada equipo arma su set. Facturas simuladas (PDF, imagen, correo o chat) o compartidas entre equipos, junto con reglas de pago de empresa ficticia. Incluir casos normales y trampa:
- Cobro duplicado.
- Beneficiario nuevo fuera de lista permitida.
- Factura que no cuadra con lo acordado.
- Monto sobre límite que necesita aprobación humana.
- Saldo o presupuesto insuficiente para el periodo.

## 08 Entregable esperado
Agente funcionando sobre su set de facturas, con pantalla simple donde la empresa define reglas y ve qué decidió pagar, qué frenó, qué dejó pendiente de aprobación y por qué.

## 09 Restricciones
- Ningún dato real de clientes ni empresas.
- El agente nunca aprueba un pago fuera de las reglas sin aprobación humana.
- Cada decisión tiene que poder explicarse después.
- Libertad total de modelo, lenguaje y framework.

## 10 Cómo se ve el éxito
- **Autonomía**: qué tanto del set decide correctamente sin persona.
- **Seguridad**: cero pagos aprobados fuera de reglas. Aprobar un pago indebido **descalifica**.
- **Explicabilidad**: cualquier persona entiende por qué pagó, frenó o escaló leyendo el registro, sin abrir el código.

## Documentos de trabajo
- Sitio de Blinka: https://blinka.co/

## Contexto Blinka (de blinka.co)
Banca para empresas globales (YC). Cuentas USD (ACH/wire, FDIC vía Portage Bank), tarjeta Visa Infinite sin markup FX, pagos USD por ACH/SWIFT a 200+ países, rieles locales (SEPA, Colombia, Brasil, México, Argentina, Chile, Perú, Bolivia, Costa Rica, Sudáfrica), USDC (Base, Ethereum, Polygon, Celo, Solana). Monedas: USD, EUR, COP, BRL, MXN, ARS, CLP, PEN, BOB, CRC, ZAR, USDC. Back office: facturación, gestión de proveedores, automatización contable (QuickBooks, Stripe). Tesorería en fondos money market. Sitio no menciona API ni agentes.

Implicación para demo: facturas multi-moneda (USD + monedas LatAm), proveedores/contratistas en varios países, métodos ACH/SWIFT/local/USDC como dato del beneficiario.
