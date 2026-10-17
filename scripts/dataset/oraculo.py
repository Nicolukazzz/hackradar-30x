"""Oráculo independiente: recalcula la decisión de cada documento del dataset.

No es el motor del producto (ese vive en src/reglas, issue #5). Es una segunda
implementación mínima de docs/especificacion.md §4–§6 y §10 que sirve para
comprobar que cada `esperado.json` es inequívoco y coherente con las reglas.
Si el oráculo y la respuesta escrita a mano no coinciden, el generador falla.
"""

from __future__ import annotations

import re
import unicodedata
from datetime import date, timedelta
from decimal import Decimal

import dinero
from registro import CAMPOS_OBLIGATORIOS, periodo_de

FRENAN = {"R2", "R5", "R6", "R7"}
DEPENDEN_DEL_MONTO = {"R5", "R6", "R7", "R8", "R9"}

PATRONES_R10 = [
    r"nota para el sistema", r"sistema de pagos", r"ignora(r)? (las|todas) (las )?(reglas|instrucciones)",
    r"sin revision", r"ya (fue|esta) aprobad", r"aprobar automaticamente", r"procesar (sin|de inmediato)",
    r"ignore (previous|all) instructions", r"approved by", r"do not (review|escalate)", r"\bsystem:",
    r"\bassistant:", r"ignore as regras", r"pagamento aprovado",
]

_SUFIJOS = [("S", "A", "DE", "C", "V"), ("S", "A", "S"), ("S", "A"), ("SPA",), ("LTDA",), ("INC",), ("LLC",)]


def sin_tildes(texto: str) -> str:
    return "".join(ch for ch in unicodedata.normalize("NFD", texto) if unicodedata.category(ch) != "Mn")


def normalizar_nombre(nombre: str) -> str:
    tokens = re.sub(r"[^A-Z0-9]+", " ", sin_tildes(nombre).upper()).split()
    cambio = True
    while cambio:
        cambio = False
        for sufijo in _SUFIJOS:
            if len(tokens) > len(sufijo) and tuple(tokens[-len(sufijo):]) == sufijo:
                tokens = tokens[: -len(sufijo)]
                cambio = True
    return " ".join(tokens)


def normalizar_numero(numero: str) -> str:
    return re.sub(r"[^A-Z0-9]+", "-", sin_tildes(numero).upper()).strip("-")


def detectar_instrucciones(texto: str) -> list[str]:
    plano = sin_tildes(texto).lower()
    return [m.group(0) for p in PATRONES_R10 for m in [re.search(p, plano)] if m]


def _dias(a: str, b: str) -> int:
    return abs((date.fromisoformat(a) - date.fromisoformat(b)).days)


class Libro:
    """Facturas vigentes (pagadas o reservadas) a partir del historial y de lo ya procesado."""

    def __init__(self, historial: list[dict], beneficiarios: list[dict]):
        self.facturas: list[dict] = []
        resuelta = {}
        for e in historial:
            if e["tipo"] == "DECISION_HUMANA" and e["decision"] in ("APROBADA_HUMANO", "RECHAZADA_HUMANO"):
                resuelta[e["entrada_origen"]] = e["decision"]
        for e in historial:
            if e["tipo"] != "DECISION_AGENTE":
                continue
            if e["decision"] == "PAGAR":
                estado = "pagada"
            elif e["decision"] == "ESCALAR":
                estado = {"APROBADA_HUMANO": "pagada", "RECHAZADA_HUMANO": None}.get(resuelta.get(e["id"]), "reservada")
            else:
                estado = None
            if estado is None:
                continue
            ext = e["extraccion"]
            self.facturas.append({
                "ben": normalizar_nombre(e["beneficiario"]), "numero": normalizar_numero(e["factura_numero"]),
                "emision": ext["fecha_emision"]["valor"], "usd": e["monto_usd_centavos"], "sha256": e["sha256"],
                "hito": ext.get("hito_numero", {}).get("valor"), "estado": estado, "periodo": periodo_de(e["momento"]),
                "ref": e["ref_interna"],
            })

    def agregar(self, **factura):
        self.facturas.append(factura)

    def total(self, periodo: str, estado: str, ben: str | None = None) -> int:
        return sum(f["usd"] for f in self.facturas
                   if f["periodo"] == periodo and f["estado"] == estado and (ben is None or f["ben"] == ben))


def _linea_acordada(ben: dict, ext: dict) -> tuple[dict | None, str]:
    acuerdo = ben["acuerdo"]
    if acuerdo is None:
        return None, "sin acuerdo"
    lineas = acuerdo["lineas"]
    ref = ext.get("referencia_acuerdo")
    if ref:
        por_codigo = [l for l in lineas if l["codigo"] == ref]
        if len(por_codigo) == 1:
            return por_codigo[0], "referencia"
        if ref in acuerdo["referencia"].split("/") and len(lineas) == 1:
            return lineas[0], "referencia"
    concepto = sin_tildes(ext["concepto"] or "").lower()
    candidatas = [l for l in lineas if any(sin_tildes(k).lower() in concepto for k in l["palabras_clave"])]
    if len(candidatas) == 1:
        return candidatas[0], "palabras clave"
    return None, f"{len(candidatas)} líneas candidatas"


def evaluar(escenario: dict, documentos: list[dict], historial: list[dict], datos: dict) -> list[dict]:
    """documentos: [{recibido_en, canal, remitente, sha256, texto_crudo, ext (plana)}] en orden de llegada."""
    reglas = datos["reglas"][escenario["reglas_version"]]
    lim = reglas["limites"]
    tasas = datos["tasas"][escenario["periodo"]]["tasas"]
    por_nombre = {normalizar_nombre(b["nombre"]): b for b in datos["beneficiarios"]}
    libro = Libro(historial, datos["beneficiarios"])
    periodo = escenario["periodo"]
    ahora = escenario["ahora"]
    hoy = ahora[:10]
    presupuesto = reglas["presupuesto"]["monto_usd"]
    resultados = []

    for d in documentos:
        ext = d["ext"]
        if not ext["es_factura"]:
            resultados.append({"decision": "RECHAZADA_NO_FACTURA", "reglas_que_fallan": [], "asignado_a": None,
                               "responder_antes_de": None, "usd": None, "disponible_antes": None})
            continue
        r: dict[str, str] = {}
        afectados = {k for k in CAMPOS_OBLIGATORIOS if ext.get(k) is None}
        # R1: obligatorios + validaciones.
        if ext.get("subtotal") and ext.get("monto_total") and \
                ext["subtotal"]["centavos"] + ext["impuestos"]["centavos"] != ext["monto_total"]["centavos"]:
            afectados.add("monto_total")
        if ext.get("fecha_emision") and ext["fecha_emision"] > hoy:
            afectados.add("fecha_emision")
        if ext.get("fecha_emision") and ext.get("fecha_vencimiento") and ext["fecha_vencimiento"] < ext["fecha_emision"]:
            afectados.add("fecha_vencimiento")
        r["R1"] = "FALLA" if afectados else "CUMPLE"

        monto_ok = "monto_total" not in afectados
        usd = dinero.a_usd(ext["monto_total"]["centavos"], ext["monto_total"]["moneda"], tasas) \
            if ext.get("monto_total") else None
        ben_norm = normalizar_nombre(ext["beneficiario_nombre"])
        ben = por_nombre.get(ben_norm)
        numero = normalizar_numero(ext["numero"])

        # R2: duplicados.
        dup = False
        for f in libro.facturas:
            if f["ben"] != ben_norm:
                continue
            if d["sha256"] and f["sha256"] == d["sha256"]:
                dup = True
            elif f["numero"] == numero and _dias(f["emision"], ext["fecha_emision"]) <= reglas["duplicados"]["ventana_dias"]:
                dup = True
            elif monto_ok and "fecha_emision" not in afectados and \
                    abs(Decimal(f["usd"] - usd)) <= Decimal(usd) * reglas["duplicados"]["tolerancia_monto_pct"] / 100 and \
                    _dias(f["emision"], ext["fecha_emision"]) <= reglas["duplicados"]["tolerancia_fecha_dias"]:
                dup = True
            elif ext.get("hito_numero") and f["hito"] == ext["hito_numero"] and f["estado"] == "pagada":
                dup = True
        r["R2"] = "FALLA" if dup else "CUMPLE"

        r["R3"] = "CUMPLE" if ben and ben["estado"] == "activo" else "FALLA"
        if ben is None or "cuenta_destino_ultimos4" in afectados:
            r["R4"] = "NO_APLICA"
        else:
            r["R4"] = "CUMPLE" if ext["cuenta_destino_ultimos4"] == ben["cuenta"]["ultimos4"] else "FALLA"

        if ben is None:
            r["R5"] = "NO_APLICA"
        else:
            linea, _ = _linea_acordada(ben, ext)
            if linea is None or linea["monto"]["moneda"] != (ext.get("monto_total") or {}).get("moneda"):
                r["R5"] = "INDETERMINADO"
            else:
                dif = abs(Decimal(ext["monto_total"]["centavos"] - linea["monto"]["centavos"])) / linea["monto"]["centavos"] * 100
                r["R5"] = "FALLA" if dif > lim["tolerancia_acordado_pct"] else "CUMPLE"

        disponible = presupuesto - libro.total(periodo, "pagada") - libro.total(periodo, "reservada")
        if monto_ok:
            r["R6"] = "FALLA" if usd > lim["maximo_absoluto_usd"] else "CUMPLE"
            r["R7"] = "FALLA" if usd > disponible else "CUMPLE"
            if ben is None:
                r["R8"] = "NO_APLICA"
            else:
                tope = ben["limite_mensual_usd"] or lim["mensual_por_beneficiario_default_usd"]
                acumulado = libro.total(periodo, "pagada", ben_norm) + libro.total(periodo, "reservada", ben_norm)
                r["R8"] = "FALLA" if acumulado + usd > tope else "CUMPLE"
            r["R9"] = "FALLA" if usd > lim["pago_automatico_usd"] else "CUMPLE"
        for regla in DEPENDEN_DEL_MONTO:
            if not monto_ok:
                r[regla] = "NO_APLICA"

        r["R10"] = "FALLA" if detectar_instrucciones(d["texto_crudo"]) else "CUMPLE"

        rem = d["remitente"]
        if ben is None:
            r["R11"] = "FALLA"
        else:
            canales = ben["canales"]
            vinculado = {
                "portal": rem["valor"] == canales["portal_usuario"],
                "correo": rem["valor"].lower() in [x.lower() for x in canales["correos"]],
                "telegram": rem["valor"] == canales["telegram_chat_id"],
            }[rem["tipo"]]
            r["R11"] = "CUMPLE" if vinculado else "FALLA"

        fallan = sorted((k for k, v in r.items() if v in ("FALLA", "INDETERMINADO")), key=lambda k: int(k[1:]))
        if any(r[k] == "FALLA" for k in FRENAN):
            decision = "FRENAR"
        elif fallan:
            decision = "ESCALAR"
        else:
            decision = "PAGAR"

        asignado = plazo = None
        if decision == "ESCALAR":
            asignado = "lm" if r["R9"] == "FALLA" or r["R10"] == "FALLA" or (usd or 0) > 500000 else "ap"
            limite = date.fromisoformat(ext["fecha_vencimiento"]) - timedelta(days=3)
            if limite <= date.fromisoformat(hoy):
                plazo = f"{hoy}T18:00:00{ahora[19:]}"
            else:
                plazo = f"{limite.isoformat()}T12:00:00{ahora[19:]}"

        resultados.append({"decision": decision, "reglas_que_fallan": fallan, "asignado_a": asignado,
                           "responder_antes_de": plazo, "usd": usd, "disponible_antes": disponible, "detalle": r})

        if decision in ("PAGAR", "ESCALAR"):
            libro.agregar(ben=ben_norm, numero=numero, emision=ext["fecha_emision"], usd=usd or 0, sha256=d["sha256"],
                          hito=ext.get("hito_numero"), estado="pagada" if decision == "PAGAR" else "reservada",
                          periodo=periodo, ref=None)

    return resultados


def cierre(escenario: dict, historial: list[dict], resultados: list[dict], datos: dict) -> dict:
    """Pagado en lote, reservado y disponible al final (para comparar con §11.4)."""
    periodo = escenario["periodo"]
    presupuesto = datos["reglas"][escenario["reglas_version"]]["presupuesto"]["monto_usd"]
    libro = Libro(historial, datos["beneficiarios"])
    pagado_antes = libro.total(periodo, "pagada")
    pagado = sum(x["usd"] for x in resultados if x["decision"] == "PAGAR")
    reservado = libro.total(periodo, "reservada") + sum(x["usd"] or 0 for x in resultados if x["decision"] == "ESCALAR")
    return {"pagado_antes": pagado_antes, "pagado_en_lote": pagado, "reservado": reservado,
            "disponible": presupuesto - pagado_antes - pagado - reservado}

