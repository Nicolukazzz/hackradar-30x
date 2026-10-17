"""Textos de los documentos por idioma, compartidos por PDF, imagen, chat y oráculo.

Una sola función arma las líneas visibles de cada factura; los renderizadores
solo las dibujan y el oráculo las usa como `texto_crudo` para R10.
"""

from __future__ import annotations

import dinero
from mundo import BEN, EMPRESA_FACTURAR_A, EXTERNOS

ETIQUETAS = {
    "es": {"titulo": "FACTURA N.º", "cuenta_cobro": "CUENTA DE COBRO N.º", "emision": "Fecha de emisión",
           "vence": "Vence", "facturar": "Facturar a", "concepto": "Concepto", "importe": "Importe",
           "subtotal": "Subtotal", "total": "Total", "pagar": "Pagar a",
           "referencia": "Referencia", "notas": "Notas", "recordatorio": "RECORDATORIO · REENVÍO",
           "pie": "Documento ficticio generado para el reto Blinka. Sin validez fiscal."},
    "en": {"titulo": "INVOICE #", "cuenta_cobro": "INVOICE #", "emision": "Issue date", "vence": "Due date",
           "facturar": "Bill to", "concepto": "Description", "importe": "Amount", "subtotal": "Subtotal",
           "total": "Total", "pagar": "Pay to", "referencia": "Reference",
           "notas": "Notes", "recordatorio": "REMINDER · RESENT",
           "pie": "Fictitious document generated for the Blinka challenge. Not a tax document."},
    "pt": {"titulo": "FATURA Nº", "cuenta_cobro": "FATURA Nº", "emision": "Data de emissão", "vence": "Vencimento",
           "facturar": "Faturar para", "concepto": "Descrição", "importe": "Valor", "subtotal": "Subtotal",
           "total": "Total", "pagar": "Pagar a", "referencia": "Referência",
           "notas": "Observações", "recordatorio": "LEMBRETE · REENVIO",
           "pie": "Documento fictício gerado para o desafio Blinka. Sem validade fiscal."},
}

TIPO_CUENTA = {
    "es": {"cuenta": "Cuenta de ahorros", "CLABE": "CLABE", "CBU": "CBU", "PIX": "Cuenta"},
    "en": {"cuenta": "Account", "CLABE": "CLABE", "CBU": "CBU", "PIX": "Account"},
    "pt": {"cuenta": "Conta", "CLABE": "CLABE", "CBU": "CBU", "PIX": "Conta corrente"},
}


def emisor(fac: dict) -> dict:
    """Datos del emisor: nombre, ciudad, id fiscal, cuenta (la de la factura si cambió)."""
    clave = fac["emisor"]
    if clave in BEN:
        b = BEN[clave]
        base = {"nombre": b["nombre"], "ciudad": b["_ciudad"], "id_fiscal": b["_id_fiscal"], "cuenta": b["cuenta"],
                "pais": b["pais"]}
    else:
        e = EXTERNOS[clave]
        base = {"nombre": e["nombre"], "ciudad": e["ciudad"], "id_fiscal": e["id_fiscal"], "cuenta": e["cuenta"],
                "pais": e["pais"]}
    if fac["cuenta"] is not None:
        base["cuenta"] = fac["cuenta"]
    return base


def estilo_numero(fac: dict, idioma: str) -> str:
    """Documentos en inglés y emisores de México escriben 1,234.56; el resto 1.234,56."""
    return "en" if idioma == "en" or emisor(fac)["pais"] == "MX" else "es"


def importe(fac: dict, monto_centavos: int, idioma: str) -> str:
    return dinero.monto(monto_centavos, fac["moneda"], estilo_numero(fac, idioma))


def cuenta_texto(fac: dict, idioma: str) -> str:
    cta = emisor(fac)["cuenta"]
    return f"{TIPO_CUENTA[idioma][cta['tipo']]} {cta['_numero_completo']}"


def es_cuenta_de_cobro(fac: dict) -> bool:
    """Personas naturales de Colombia emiten 'cuenta de cobro', no factura."""
    return fac["emisor"] in ("ben-ana-maria-gomez", "ben-juan-pablo-ortiz")


def bloques_factura(fac: dict, idioma: str, variante: str | None) -> dict:
    """Contenido visible de la factura por zonas de la página. Única fuente: PDF, foto y texto plano salen de aquí."""
    et = ETIQUETAS[idioma]
    em = emisor(fac)
    titulo = et["cuenta_cobro"] if es_cuenta_de_cobro(fac) else et["titulo"]
    totales = []
    if fac["subtotal"] is not None:
        totales.append((et["subtotal"], importe(fac, fac["subtotal"], idioma)))
        totales.append((fac["etiqueta_impuesto"], importe(fac, fac["impuestos"], idioma)))
    totales.append((et["total"], importe(fac, fac["total_impreso"], idioma)))
    referencia = None
    if fac["referencia"]:
        referencia = fac["referencia"] + (f" · hito {fac['hito']}" if fac["hito"] else "")
    return {
        "emisor": em["nombre"], "ciudad": em["ciudad"], "id_fiscal": em["id_fiscal"],
        "titulo": titulo, "numero": fac["numero"],
        "fechas": [(et["emision"], dinero.fecha(fac["fecha_emision"], idioma)),
                   (et["vence"], dinero.fecha(fac["fecha_vencimiento"], idioma))],
        "facturar": (et["facturar"], EMPRESA_FACTURAR_A),
        "cabecera_tabla": (et["concepto"], et["importe"]),
        "item": (fac["concepto"], importe(fac, fac["subtotal"] if fac["subtotal"] is not None else fac["total_impreso"], idioma)),
        "totales": totales,
        "referencia": (et["referencia"], referencia) if referencia else None,
        "pagar": (et["pagar"], [em["nombre"], em["cuenta"]["banco"], cuenta_texto(fac, idioma)]),
        "nota": (et["notas"], fac["nota"]) if fac["nota"] else None,
        "sello": et["recordatorio"] if variante == "recordatorio" else None,
        "pie": et["pie"],
        "acento": idioma,
    }


def lineas_factura(fac: dict, idioma: str, variante: str | None = None) -> list[str]:
    """Texto plano de la factura en orden de lectura (texto_crudo para R10 y el historial)."""
    b = bloques_factura(fac, idioma, variante)
    lineas = [b["emisor"], b["ciudad"], b["id_fiscal"], f"{b['titulo']} {b['numero']}"]
    if b["sello"]:
        lineas.append(b["sello"])
    lineas += [f"{etiqueta}: {valor}" for etiqueta, valor in b["fechas"]]
    lineas.append(f"{b['facturar'][0]}: {b['facturar'][1]}")
    lineas.append(f"{b['cabecera_tabla'][0]}: {b['item'][0]} · {b['cabecera_tabla'][1]}: {b['item'][1]}")
    lineas += [f"{etiqueta}: {valor}" for etiqueta, valor in b["totales"]]
    if b["referencia"]:
        lineas.append(f"{b['referencia'][0]}: {b['referencia'][1]}")
    lineas.append(f"{b['pagar'][0]}: {' · '.join(b['pagar'][1])}")
    if b["nota"]:
        lineas.append(f"{b['nota'][0]}: {b['nota'][1]}")
    lineas.append(b["pie"])
    return lineas


def mensaje_chat(d: dict) -> str:
    """Cuerpo del mensaje de Telegram con los datos de la cuenta de cobro."""
    fac = d["factura"]
    em = emisor(fac)
    titulo = "Cuenta de cobro N.º" if es_cuenta_de_cobro(fac) else "Factura"
    ref = ""
    if fac["referencia"]:
        ref = f" ({fac['referencia']}" + (f", hito {fac['hito']} de {_hitos_total(fac)}" if fac["hito"] else "") + ")"
    partes = [
        d["mensaje"] or "",
        f"{titulo} {fac['numero']}",
        f"Fecha: {dinero.fecha(fac['fecha_emision'], 'es')} · Vence: {dinero.fecha(fac['fecha_vencimiento'], 'es')}",
        f"Concepto: {fac['concepto']}{ref}",
        f"Valor: {importe(fac, fac['total_impreso'], 'es')}",
        f"Pagar a: {em['nombre']} · {em['cuenta']['banco']} · {cuenta_texto(fac, 'es')}",
    ]
    return "\n".join(p for p in partes if p)


def _hitos_total(fac: dict) -> int:
    for linea in BEN[fac["emisor"]]["acuerdo"]["lineas"]:
        if "hitos_total" in linea:
            return linea["hitos_total"]
    raise ValueError(f"{fac['numero']}: hito sin línea de hitos en el acuerdo")


def lineas_folleto(folleto: dict) -> list[str]:
    em = BEN[folleto["emisor"]]
    return [em["nombre"], em["_ciudad"], folleto["titulo"], *folleto["lineas"], ETIQUETAS["es"]["pie"]]
