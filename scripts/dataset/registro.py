"""Construye Extraccion y EntradaRegistro (docs/especificacion.md §3 y §9)."""

from __future__ import annotations

import dinero
from mundo import APROBADORES, TASAS
from textos import emisor

APROBADOR = {a["id"]: a for a in APROBADORES}
CAMPOS_OBLIGATORIOS = ("beneficiario_nombre", "numero", "monto_total", "fecha_emision", "fecha_vencimiento",
                       "cuenta_destino_ultimos4", "concepto")


def periodo_de(momento: str) -> str:
    return momento[:7]


def extraccion_plana(fac: dict | None, idioma: str) -> dict:
    """Valores que un extractor perfecto devolvería (esperado.json → extraccion_esperada)."""
    if fac is None:
        vacio = dict.fromkeys(CAMPOS_OBLIGATORIOS)
        return {"es_factura": False, **vacio, "idioma": idioma}
    plana = {
        "es_factura": True,
        "beneficiario_nombre": emisor(fac)["nombre"],
        "numero": fac["numero"],
        "monto_total": {"centavos": fac["total_impreso"], "moneda": fac["moneda"]} if fac["total_legible"] else None,
        "fecha_emision": fac["fecha_emision"],
        "fecha_vencimiento": fac["fecha_vencimiento"],
        "cuenta_destino_ultimos4": emisor(fac)["cuenta"]["ultimos4"],
        "concepto": fac["concepto"],
    }
    if fac["subtotal"] is not None:
        plana["subtotal"] = {"centavos": fac["subtotal"], "moneda": fac["moneda"]}
        plana["impuestos"] = {"centavos": fac["impuestos"], "moneda": fac["moneda"]}
    if fac["referencia"]:
        plana["referencia_acuerdo"] = fac["referencia"]
    if fac["hito"]:
        plana["hito_numero"] = fac["hito"]
    plana["idioma"] = idioma
    return plana


def extraccion_completa(plana: dict, texto_crudo: str) -> dict:
    """Extraccion con Campo<T> por campo (forma de §3), confianza 1,0. Para el historial."""
    def campo(valor):
        return {"valor": valor, "confianza": 1.0, "fuente": "parser"}

    ext = {"es_factura": campo(plana["es_factura"])}
    for nombre in (*CAMPOS_OBLIGATORIOS, "subtotal", "impuestos", "referencia_acuerdo", "hito_numero"):
        if nombre in plana:
            ext[nombre] = campo(plana[nombre])
    ext["idioma"] = plana["idioma"]
    ext["texto_crudo"] = texto_crudo
    ext["senales_llm"] = {"instrucciones_sospechosas": []}
    ext["proveedor_llm"] = "ninguno"
    return ext


def montos(fac: dict, momento: str) -> tuple[dict, int, str | None]:
    """(monto_original, monto_usd_centavos, tasa_usada) con la tabla del periodo del momento."""
    tasas = TASAS[periodo_de(momento)]["tasas"]
    original = {"centavos": fac["total_impreso"], "moneda": fac["moneda"]}
    return original, dinero.a_usd(fac["total_impreso"], fac["moneda"], tasas), dinero.tasa_texto(fac["moneda"], tasas)


def entrada_agente(*, id_, ref, momento, fac, canal, formato, decision, reglas, version, explicacion, ext, sha256):
    original, usd, tasa = montos(fac, momento)
    return {
        "id": id_, "momento": momento, "actor": {"tipo": "agente"}, "tipo": "DECISION_AGENTE",
        "ref_interna": ref, "factura_numero": fac["numero"], "beneficiario": emisor(fac)["nombre"],
        "canal": canal, "formato": formato, "monto_original": original, "monto_usd_centavos": usd,
        "tasa_usada": tasa, "decision": decision, "reglas_version": version, "evaluaciones": [],
        "reglas_que_fallaron": list(reglas), "comparaciones": [], "explicacion": explicacion, "comentario": None,
        "entrada_origen": None, "extraccion": ext, "sha256": sha256,
    }


def entrada_humana(*, id_, origen: dict, h: dict):
    aprobador = APROBADOR[h["aprobador"]]
    nombre = aprobador["nombre"]
    if h["decision"] == "APROBADA_HUMANO":
        explicacion = f"Aprobada por {nombre}: «{h['comentario']}»."
    elif h["decision"] == "RECHAZADA_HUMANO":
        explicacion = f"Rechazada por {nombre}: «{h['comentario']}». La reserva volvió al presupuesto."
    else:
        explicacion = f"Primera aprobación (1 de 2) por {nombre}: «{h['comentario']}». Falta una segunda firma."
    return {
        "id": id_, "momento": h["momento"],
        "actor": {"tipo": "humano", "aprobador_id": aprobador["id"], "nombre": nombre},
        "tipo": "DECISION_HUMANA", "ref_interna": origen["ref_interna"], "factura_numero": origen["factura_numero"],
        "beneficiario": origen["beneficiario"], "canal": origen["canal"], "formato": origen["formato"],
        "monto_original": origen["monto_original"], "monto_usd_centavos": origen["monto_usd_centavos"],
        "tasa_usada": origen["tasa_usada"], "decision": h["decision"], "reglas_version": origen["reglas_version"],
        "evaluaciones": [], "reglas_que_fallaron": origen["reglas_que_fallaron"], "comparaciones": [],
        "explicacion": explicacion, "comentario": h["comentario"], "entrada_origen": origen["id"],
        "extraccion": None, "sha256": None,
    }
