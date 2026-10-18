# Facturas de prueba

Facturas ficticias en **PDF e imagen** para probar Quadra a mano: 30 que se pagan solas y 11 trampas que
rompen una regla cada una. Todo es inventado (empresas, identificaciones, bancos y cuentas que empiezan por 999).
Las genera `scripts/facturas-prueba/generar.py`; no editar a mano.

No es el dataset del CI: ese vive en `data/` y no cambia.

## Cómo probarlas

**La forma rápida:** entra con la cuenta de administrador (README principal) y en la **Bandeja** pulsa **Probar con
facturas de ejemplo**. Ahí están todas: «Enviar» manda cada una como si su proveedor la subiera por su portal y muestra
el resultado al lado, junto al esperado y el enlace a su traza; «Enviar todas» manda las que se pagan solas.

**Como lo haría un proveedor:** abre su portal (enlace y código en [ACCESOS.md](ACCESOS.md)) y sube el archivo en
«Ingrese sus facturas». Llega con el correo verificado del proveedor (R11) y, si cumple todo, se paga sola.

Los 11 proveedores de la tabla ya están en la lista permitida, con su cuenta, su correo y lo acordado.

Subirlas con **Cargar factura manualmente** también funciona, pero llegan a nombre de quien sube (no del proveedor):
por seguridad, R11 las deja esperando a una persona en vez de pagarlas.

Las facturas de `pagan/` cobran exactamente lo acordado y están separadas al menos 8 días entre sí, así R2 no las toma
por cobros repetidos. Si subes la misma dos veces, la segunda se frena por duplicada: también es parte de la prueba.

## Proveedores

| Proveedor | País | Formato | Correo (portal) | Acuerdo | Cuenta |
|---|---|---|---|---|---|
| Andes Software S.A.S. | Colombia | Factura electrónica (Colombia) | `facturacion@andessoftware.example` | AS-SOP · COP 4.165.000 | •••• 2817 |
| Camila Restrepo | Colombia | Cuenta de cobro, persona natural | `camila.restrepo@ux-estudio.example` | CR-UX · COP 3.200.000 | •••• 6034 |
| Logística Maya S.A. de C.V. | México | CFDI (México) | `cxc@logisticamaya.example` | LM-ENV · MXN 11,600.00 | •••• 7291 |
| Tropical Sound Ltda. | Brasil | Fatura de serviços (Brasil) | `financeiro@tropicalsound.example` | TS-AUD · BRL 4.800,00 | •••• 8823 |
| Pampa Code S.R.L. | Argentina | Factura E de exportación (Argentina) | `admin@pampacode.example` | PC-MOB · USD 1.350,00 | •••• 4561 |
| Cordillera Data SpA | Chile | Factura electrónica (Chile) | `pagos@cordilleradata.example` | CD-ANA · CLP 980.000 | •••• 2880 |
| Inti Consultores S.A.C. | Perú | Factura electrónica (Perú) | `cobranzas@inticonsultores.example` | IC-TRI · PEN 3.540,00 | •••• 7193 |
| Brightpath Analytics LLC | EE. UU. | Invoice (EE. UU.) | `billing@brightpath.example` | BP-SUB · USD 890.00 | •••• 2265 |
| Costa Azul Traducciones S.L. | España | Factura (España) | `facturas@costaazul.example` | CA-TRAD · EUR 726,00 | •••• 3017 |
| Nodo Verde Hosting S.A.S. | Colombia | Billing statement (hosting) | `billing@nodoverde.example` | NV-HOST · USD 640.00 | •••• 7752 |
| Vértice Arquitectura S.A.S. | Colombia | Factura electrónica (Colombia) | `contabilidad@verticearq.example` | VA-OBR · COP 14.000.000 | •••• 9418 |

## Se pagan solas (`pagan/`)

| Archivo | Proveedor | Número | Tipo | Total | Resultado | Reglas | Por qué |
|---|---|---|---|---|---|---|---|
| [`andes-fe-2041.pdf`](pagan/andes-fe-2041.pdf) | Andes Software S.A.S. | FE-2041 | PDF | COP 4.165.000 | **PAGAR** | — | Cumple todas las reglas. |
| [`andes-fe-2042.pdf`](pagan/andes-fe-2042.pdf) | Andes Software S.A.S. | FE-2042 | PDF | COP 4.165.000 | **PAGAR** | — | Cumple todas las reglas. |
| [`andes-fe-2043.png`](pagan/andes-fe-2043.png) | Andes Software S.A.S. | FE-2043 | Imagen PNG · escaneada | COP 4.165.000 | **PAGAR** | — | Cumple todas las reglas. |
| [`camila-cc-18.pdf`](pagan/camila-cc-18.pdf) | Camila Restrepo | CC-18 | PDF | COP 3.200.000 | **PAGAR** | — | Cumple todas las reglas. |
| [`camila-cc-19.jpg`](pagan/camila-cc-19.jpg) | Camila Restrepo | CC-19 | Foto JPG · foto con el teléfono | COP 3.200.000 | **PAGAR** | — | Cumple todas las reglas. |
| [`camila-cc-20.pdf`](pagan/camila-cc-20.pdf) | Camila Restrepo | CC-20 | PDF | COP 3.200.000 | **PAGAR** | — | Cumple todas las reglas. |
| [`maya-a-7310.pdf`](pagan/maya-a-7310.pdf) | Logística Maya S.A. de C.V. | A-7310 | PDF | MXN 11,600.00 | **PAGAR** | — | Cumple todas las reglas. |
| [`maya-a-7311.pdf`](pagan/maya-a-7311.pdf) | Logística Maya S.A. de C.V. | A-7311 | PDF | MXN 11,600.00 | **PAGAR** | — | Cumple todas las reglas. |
| [`maya-a-7312.jpg`](pagan/maya-a-7312.jpg) | Logística Maya S.A. de C.V. | A-7312 | Foto JPG · foto con el teléfono | MXN 11,600.00 | **PAGAR** | — | Cumple todas las reglas. |
| [`tropical-ts-211.png`](pagan/tropical-ts-211.png) | Tropical Sound Ltda. | TS-211 | Imagen PNG · escaneada | BRL 4.800,00 | **PAGAR** | — | Cumple todas las reglas. |
| [`tropical-ts-212.pdf`](pagan/tropical-ts-212.pdf) | Tropical Sound Ltda. | TS-212 | PDF | BRL 4.800,00 | **PAGAR** | — | Cumple todas las reglas. |
| [`tropical-ts-213.pdf`](pagan/tropical-ts-213.pdf) | Tropical Sound Ltda. | TS-213 | PDF | BRL 4.800,00 | **PAGAR** | — | Cumple todas las reglas. |
| [`pampa-0003-0000841.pdf`](pagan/pampa-0003-0000841.pdf) | Pampa Code S.R.L. | 0003-0000841 | PDF | USD 1.350,00 | **PAGAR** | — | Cumple todas las reglas. |
| [`pampa-0003-0000842.jpg`](pagan/pampa-0003-0000842.jpg) | Pampa Code S.R.L. | 0003-0000842 | Foto JPG · foto con el teléfono | USD 1.350,00 | **PAGAR** | — | Cumple todas las reglas. |
| [`pampa-0003-0000843.pdf`](pagan/pampa-0003-0000843.pdf) | Pampa Code S.R.L. | 0003-0000843 | PDF | USD 1.350,00 | **PAGAR** | — | Cumple todas las reglas. |
| [`cordillera-1287.pdf`](pagan/cordillera-1287.pdf) | Cordillera Data SpA | 1287 | PDF | CLP 980.000 | **PAGAR** | — | Cumple todas las reglas. |
| [`cordillera-1288.pdf`](pagan/cordillera-1288.pdf) | Cordillera Data SpA | 1288 | PDF | CLP 980.000 | **PAGAR** | — | Cumple todas las reglas. |
| [`cordillera-1289.png`](pagan/cordillera-1289.png) | Cordillera Data SpA | 1289 | Imagen PNG · escaneada | CLP 980.000 | **PAGAR** | — | Cumple todas las reglas. |
| [`inti-f001-000452.jpg`](pagan/inti-f001-000452.jpg) | Inti Consultores S.A.C. | F001-000452 | Foto JPG · foto con el teléfono | PEN 3.540,00 | **PAGAR** | — | Cumple todas las reglas. |
| [`inti-f001-000453.pdf`](pagan/inti-f001-000453.pdf) | Inti Consultores S.A.C. | F001-000453 | PDF | PEN 3.540,00 | **PAGAR** | — | Cumple todas las reglas. |
| [`inti-f001-000454.pdf`](pagan/inti-f001-000454.pdf) | Inti Consultores S.A.C. | F001-000454 | PDF | PEN 3.540,00 | **PAGAR** | — | Cumple todas las reglas. |
| [`brightpath-bp-1042.pdf`](pagan/brightpath-bp-1042.pdf) | Brightpath Analytics LLC | BP-1042 | PDF | USD 890.00 | **PAGAR** | — | Cumple todas las reglas. |
| [`brightpath-bp-1043.png`](pagan/brightpath-bp-1043.png) | Brightpath Analytics LLC | BP-1043 | Imagen PNG · escaneada | USD 890.00 | **PAGAR** | — | Cumple todas las reglas. |
| [`brightpath-bp-1044.pdf`](pagan/brightpath-bp-1044.pdf) | Brightpath Analytics LLC | BP-1044 | PDF | USD 890.00 | **PAGAR** | — | Cumple todas las reglas. |
| [`costa-ca-2026-031.pdf`](pagan/costa-ca-2026-031.pdf) | Costa Azul Traducciones S.L. | CA-2026-031 | PDF | EUR 726,00 | **PAGAR** | — | Cumple todas las reglas. |
| [`costa-ca-2026-032.pdf`](pagan/costa-ca-2026-032.pdf) | Costa Azul Traducciones S.L. | CA-2026-032 | PDF | EUR 726,00 | **PAGAR** | — | Cumple todas las reglas. |
| [`costa-ca-2026-033.jpg`](pagan/costa-ca-2026-033.jpg) | Costa Azul Traducciones S.L. | CA-2026-033 | Foto JPG · foto con el teléfono | EUR 726,00 | **PAGAR** | — | Cumple todas las reglas. |
| [`nodo-nv-5520.png`](pagan/nodo-nv-5520.png) | Nodo Verde Hosting S.A.S. | NV-5520 | Imagen PNG · escaneada | USD 640.00 | **PAGAR** | — | Cumple todas las reglas. |
| [`nodo-nv-5521.pdf`](pagan/nodo-nv-5521.pdf) | Nodo Verde Hosting S.A.S. | NV-5521 | PDF | USD 640.00 | **PAGAR** | — | Cumple todas las reglas. |
| [`nodo-nv-5522.pdf`](pagan/nodo-nv-5522.pdf) | Nodo Verde Hosting S.A.S. | NV-5522 | PDF | USD 640.00 | **PAGAR** | — | Cumple todas las reglas. |

## Trampas (`trampas/`)

Súbelas por el portal del proveedor que dice la factura, salvo la 06 (proveedor desconocido): esa va por **Cargar
factura manualmente**, porque no tiene portal.

| Archivo | Proveedor | Número | Tipo | Total | Resultado | Reglas | Por qué |
|---|---|---|---|---|---|---|---|
| [`01-duplicado-andes-fe-2041.jpg`](trampas/01-duplicado-andes-fe-2041.jpg) | Andes Software S.A.S. | FE-2041 | Foto JPG · foto con el teléfono | COP 4.165.000 | **FRENAR** | R2 | Es la misma factura FE-2041 (otra foto): ya se pagó una vez. Súbela después de `andes-fe-2041.pdf`. |
| [`02-no-cuadra-brightpath-bp-1045.pdf`](trampas/02-no-cuadra-brightpath-bp-1045.pdf) | Brightpath Analytics LLC | BP-1045 | PDF | USD 1,290.00 | **FRENAR** | R5 | Cobra USD 1,290.00 y la suscripción acordada es USD 890.00 (+44,9 %). |
| [`03-cuenta-nueva-camila-cc-21.pdf`](trampas/03-cuenta-nueva-camila-cc-21.pdf) | Camila Restrepo | CC-21 | PDF | COP 3.200.000 | **ESCALAR** | R4 | La cuenta de cobro trae otra cuenta bancaria («cambié de banco»). |
| [`04-sobre-limite-vertice-fe-118.pdf`](trampas/04-sobre-limite-vertice-fe-118.pdf) | Vértice Arquitectura S.A.S. | FE-118 | PDF | COP 14.000.000 | **ESCALAR** | R9 | Cuadra con lo acordado, pero COP 14.000.000 supera el pago automático de USD 3.000: decide una persona. |
| [`05-instruccion-oculta-andes-fe-2050.pdf`](trampas/05-instruccion-oculta-andes-fe-2050.pdf) | Andes Software S.A.S. | FE-2050 | PDF | COP 4.165.000 | **ESCALAR** | R10 | Trae una orden para el agente en texto blanco de 4 pt, invisible al imprimir. |
| [`06-proveedor-desconocido-delta.pdf`](trampas/06-proveedor-desconocido-delta.pdf) | Delta Prints S.A.S. | DP-0091 | PDF | COP 2.142.000 | **FRENAR** | R3 | Delta Prints S.A.S. no está en la lista de proveedores. |
| [`07-fecha-futura-nodo-nv-5530.png`](trampas/07-fecha-futura-nodo-nv-5530.png) | Nodo Verde Hosting S.A.S. | NV-5530 | Imagen PNG · escaneada | USD 640.00 | **ESCALAR** | R1 | La fecha de emisión (01/12/2026) es posterior a hoy. |
| [`08-suma-no-cuadra-maya-a-7320.pdf`](trampas/08-suma-no-cuadra-maya-a-7320.pdf) | Logística Maya S.A. de C.V. | A-7320 | PDF | MXN 12,600.00 | **ESCALAR** | R1 | Subtotal 10,000.00 + IVA 1,600.00 no da el total impreso de 12,600.00. |
| [`09-moneda-distinta-tropical-ts-219.pdf`](trampas/09-moneda-distinta-tropical-ts-219.pdf) | Tropical Sound Ltda. | TS-219 | PDF | USD 1.150,00 | **ESCALAR** | R5 | Cobra en USD y lo acordado está en BRL: no se puede comparar sin una persona. |
| [`10-ilegible-cordillera-1299.jpg`](trampas/10-ilegible-cordillera-1299.jpg) | Cordillera Data SpA | 1299 | Foto JPG · foto movida | CLP 980.000 | **ESCALAR** | R1 | Foto movida: el agente no puede leer el total ni la cuenta con seguridad. |
| [`11-no-es-factura-folleto-maya.pdf`](trampas/11-no-es-factura-folleto-maya.pdf) | Logística Maya S.A. de C.V. | — | PDF | — | **RECHAZADA_NO_FACTURA** | — | Es un folleto de servicios, no un cobro. |
