"""Genera `facturas-de-prueba/`: facturas en PDF e imagen para subir a la app, y los proveedores que las cobran.

    .venv/bin/python scripts/facturas-prueba/generar.py            # escribe facturas-de-prueba/
    .venv/bin/python scripts/facturas-prueba/generar.py --salida X  # en otra carpeta

`pagan/`: cada proveedor cobra lo acordado, con su referencia, desde su cuenta registrada; subidas por su portal se
pagan solas. `trampas/`: cada una rompe una regla a propósito. `proveedores.json` es exactamente lo que recibe
`POST /api/proveedores` (el asistente de Proveedores). Distinto de `data/` (dataset del CI), que no se toca.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(__file__))

from mundo import POR_CLAVE, PROVEEDORES, Factura, facturas_que_pagan, trampas  # noqa: E402
from render import contenido, fecha, imagen, monto, pdf, pdf_folleto  # noqa: E402

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

PAIS = {"CO": "Colombia", "MX": "México", "BR": "Brasil", "AR": "Argentina", "CL": "Chile", "PE": "Perú", "US": "EE. UU.", "ES": "España"}
FORMATO = {"pdf": "PDF", "png": "Imagen PNG", "jpg": "Foto JPG"}
EFECTO = {"limpio": "", "escaneo": " · escaneada", "foto": " · foto con el teléfono", "borroso": " · foto movida"}
ESTILO = {
    "electronica_co": "Factura electrónica (Colombia)",
    "cuenta_cobro": "Cuenta de cobro, persona natural",
    "cfdi_mx": "CFDI (México)",
    "fatura_br": "Fatura de serviços (Brasil)",
    "factura_ar": "Factura E de exportación (Argentina)",
    "factura_cl": "Factura electrónica (Chile)",
    "factura_pe": "Factura electrónica (Perú)",
    "invoice_us": "Invoice (EE. UU.)",
    "factura_es": "Factura (España)",
    "recibo_en": "Billing statement (hosting)",
}


def archivo(f: Factura, semilla: int) -> bytes:
    if f.esperado == "RECHAZADA_NO_FACTURA":
        return pdf_folleto(f)
    return pdf(f) if f.formato == "pdf" else imagen(f, semilla)


def proveedor_api(p) -> dict:
    """Cuerpo de POST /api/proveedores."""
    return {
        "nombre": p.nombre,
        "identificacion_fiscal": p.nit,
        "pais": p.pais,
        "tipo": p.tipo,
        "categoria": p.categoria,
        "cuenta": {"tipo": p.cuenta_tipo, "banco": p.banco, "ultimos4": p.ultimos4},
        "correos": [p.correo],
        "limite_mensual_usd": p.limite_mensual_usd,
        "acuerdo": {"referencia": p.referencia, "concepto": p.concepto, "monto": {"centavos": p.total, "moneda": p.moneda}},
        "estado": "activo",
    }


def fila(f: Factura, carpeta: str) -> str:
    c = contenido(f)
    tipo = f"{FORMATO[f.formato]}{EFECTO[f.efecto]}"
    total = monto(c.total, c.moneda, c.idioma) if f.esperado != "RECHAZADA_NO_FACTURA" else "—"
    reglas = ", ".join(f.reglas) if f.reglas else "—"
    return f"| [`{f.archivo}`]({carpeta}/{f.archivo}) | {c.nombre} | {f.numero or '—'} | {tipo} | {total} | **{f.esperado}** | {reglas} | {f.motivo} |"


def readme(pagan: list[Factura], malas: list[Factura]) -> str:
    provs = "\n".join(
        f"| {p.nombre} | {PAIS[p.pais]} | {ESTILO[p.estilo]} | `{p.correo}` | {p.referencia} · {monto(p.total, p.moneda, p.idioma)} | •••• {p.ultimos4} |"
        for p in PROVEEDORES
    )
    return f"""# Facturas de prueba

Facturas ficticias en **PDF e imagen** para probar Quadra a mano: {len(pagan)} que se pagan solas y {len(malas)} trampas que
rompen una regla cada una. Todo es inventado (empresas, identificaciones, bancos y cuentas que empiezan por 999).
Las genera `scripts/facturas-prueba/generar.py`; no editar a mano.

No es el dataset del CI: ese vive en `data/` y no cambia.

## Cómo probarlas

1. Entra con la cuenta de administrador (README principal) y abre **Proveedores**: los {len(PROVEEDORES)} proveedores de la tabla
   ya están en la lista permitida, con su cuenta, su correo y lo acordado.
2. Abre el **portal del proveedor** que cobra la factura (enlace y código en [ACCESOS.md](ACCESOS.md)) y súbela en
   «Ingrese sus facturas». Así llega con el correo verificado del proveedor (R11) y, si cumple todo, se paga sola.
3. Mira el resultado en la **Bandeja** y abre la factura para ver la traza.

Subirlas con **Cargar factura manualmente** también funciona, pero llegan a nombre de quien sube (no del proveedor):
por seguridad, R11 las deja esperando a una persona en vez de pagarlas.

Las facturas de `pagan/` cobran exactamente lo acordado y están separadas al menos 8 días entre sí, así R2 no las toma
por cobros repetidos. Si subes la misma dos veces, la segunda se frena por duplicada: también es parte de la prueba.

## Proveedores

| Proveedor | País | Formato | Correo (portal) | Acuerdo | Cuenta |
|---|---|---|---|---|---|
{provs}

## Se pagan solas (`pagan/`)

| Archivo | Proveedor | Número | Tipo | Total | Resultado | Reglas | Por qué |
|---|---|---|---|---|---|---|---|
{chr(10).join(fila(f, "pagan") for f in pagan)}

## Trampas (`trampas/`)

Súbelas por el portal del proveedor que dice la factura, salvo la 06 (proveedor desconocido): esa va por **Cargar
factura manualmente**, porque no tiene portal.

| Archivo | Proveedor | Número | Tipo | Total | Resultado | Reglas | Por qué |
|---|---|---|---|---|---|---|---|
{chr(10).join(fila(f, "trampas") for f in malas)}
"""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--salida", default=os.path.join(RAIZ, "facturas-de-prueba"))
    args = ap.parse_args()

    pagan, malas = facturas_que_pagan(), trampas()
    accesos = os.path.join(args.salida, "ACCESOS.md")
    guardado = open(accesos).read() if os.path.exists(accesos) else None
    for sub in ("pagan", "trampas"):
        shutil.rmtree(os.path.join(args.salida, sub), ignore_errors=True)
        os.makedirs(os.path.join(args.salida, sub))
    for i, f in enumerate(pagan):
        with open(os.path.join(args.salida, "pagan", f.archivo), "wb") as fh:
            fh.write(archivo(f, 1000 + i))
    for i, f in enumerate(malas):
        with open(os.path.join(args.salida, "trampas", f.archivo), "wb") as fh:
            fh.write(archivo(f, 2000 + i))
    with open(os.path.join(args.salida, "proveedores.json"), "w") as fh:
        json.dump([proveedor_api(p) for p in PROVEEDORES], fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    with open(os.path.join(args.salida, "README.md"), "w") as fh:
        fh.write(readme(pagan, malas))
    if guardado is not None:  # los accesos los crea la app: se conservan al regenerar
        with open(accesos, "w") as fh:
            fh.write(guardado)
    print(f"{len(pagan)} que pagan + {len(malas)} trampas · {len(PROVEEDORES)} proveedores → {os.path.relpath(args.salida, RAIZ)}/")


if __name__ == "__main__":
    main()
