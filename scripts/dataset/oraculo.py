"""Oráculo independiente: recalcula la decisión de cada documento del dataset.

No es el motor del producto (ese vive en src/reglas, issue #5). Es una segunda
implementación mínima de docs/especificacion.md §4–§6 y §10 que sirve para
comprobar que cada `esperado.json` es inequívoco y coherente con las reglas.
Si el oráculo y la respuesta escrita a mano no coinciden, el generador falla.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
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

    def __init__(self, historial: list[dict]):
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


def _falla_si(condicion: bool) -> str:
    return "FALLA" if condicion else "CUMPLE"


@dataclass
class Caso:
    """Un documento en evaluación, con lo derivado de su extracción."""
    doc: dict
    ext: dict
    ben: dict | None
    ben_norm: str
    numero: str
    usd: int | None
    afectados: set[str]

    @property
    def monto_ok(self) -> bool:
        return "monto_total" not in self.afectados

    @property
    def r3_falla(self) -> bool:
        return self.ben is None or self.ben["estado"] != "activo"


def _campos_afectados(ext: dict, hoy: str, tasas: dict[str, str]) -> set[str]:
    """R1: obligatorios faltantes + campos que participan en una validación fallida (§4.3)."""
    afectados = {k for k in CAMPOS_OBLIGATORIOS if ext.get(k) is None}
    subtotal, impuestos, total = ext.get("subtotal"), ext.get("impuestos"), ext.get("monto_total")
    if total and (total["centavos"] <= 0 or total["moneda"] not in tasas):
        afectados.add("monto_total")
    if subtotal and impuestos and total and subtotal["centavos"] + impuestos["centavos"] != total["centavos"]:
        afectados.add("monto_total")
    emision, vence = ext.get("fecha_emision"), ext.get("fecha_vencimiento")
    if emision and emision > hoy:
        afectados.add("fecha_emision")
    if emision and vence and vence < emision:
        afectados.add("fecha_vencimiento")
    return afectados


def _es_duplicado(caso: Caso, f: dict, dup: dict) -> bool:
    """R2 contra una factura vigente del mismo beneficiario (§4.3)."""
    ext = caso.ext
    mismo_hash = bool(caso.doc["sha256"]) and f["sha256"] == caso.doc["sha256"]
    emision = None if "fecha_emision" in caso.afectados else ext["fecha_emision"]
    fechas = emision is not None and f["emision"] is not None
    mismo_numero = bool(caso.numero) and f["numero"] == caso.numero and (
        not fechas or _dias(f["emision"], emision) <= dup["ventana_dias"])
    parecida = (caso.monto_ok and fechas
                and abs(Decimal(f["usd"] - caso.usd)) <= Decimal(caso.usd) * dup["tolerancia_monto_pct"] / 100
                and _dias(f["emision"], emision) <= dup["tolerancia_fecha_dias"])
    hito_pagado = bool(ext.get("hito_numero")) and f["hito"] == ext["hito_numero"] and f["estado"] == "pagada"
    return mismo_hash or mismo_numero or parecida or hito_pagado


def _r4(caso: Caso) -> str:
    if caso.r3_falla or "cuenta_destino_ultimos4" in caso.afectados:
        return "NO_APLICA"
    return _falla_si(caso.ext["cuenta_destino_ultimos4"] != caso.ben["cuenta"]["ultimos4"])


def _r5(caso: Caso, tolerancia_pct: int) -> str:
    if caso.r3_falla:
        return "NO_APLICA"
    linea, _ = _linea_acordada(caso.ben, caso.ext)
    total = caso.ext.get("monto_total")
    if linea is None or total is None or linea["monto"]["moneda"] != total["moneda"]:
        return "INDETERMINADO"
    acordado = linea["monto"]["centavos"]
    return _falla_si(abs(Decimal(total["centavos"] - acordado)) / acordado * 100 > tolerancia_pct)


def _reglas_de_monto(caso: Caso, libro: "Libro", periodo: str, lim: dict, disponible: int) -> dict[str, str]:
    """R5–R9. Si R1 marcó el monto como no confiable, todas NO_APLICA (§4.3)."""
    if not caso.monto_ok:
        return dict.fromkeys(DEPENDEN_DEL_MONTO, "NO_APLICA")
    usd = caso.usd
    r = {"R5": _r5(caso, lim["tolerancia_acordado_pct"]),
         "R6": _falla_si(usd > lim["maximo_absoluto_usd"]),
         "R7": _falla_si(usd > disponible),
         "R9": _falla_si(usd > lim["pago_automatico_usd"])}
    if caso.r3_falla:
        r["R8"] = "NO_APLICA"
    else:
        tope = caso.ben["limite_mensual_usd"]
        if tope is None:
            tope = lim["mensual_por_beneficiario_default_usd"]
        acumulado = libro.total(periodo, "pagada", caso.ben_norm) + libro.total(periodo, "reservada", caso.ben_norm)
        r["R8"] = _falla_si(acumulado + usd > tope)
    return r


def _r11(caso: Caso) -> str:
    if caso.ben is None:
        return "FALLA"
    rem, canales = caso.doc["remitente"], caso.ben["canales"]
    if rem["tipo"] == "interno":  # empleado de la empresa reenviando: vale solo si R3 cumple
        return _falla_si(caso.r3_falla)
    vinculado = {
        "portal": rem["valor"] == canales["portal_usuario"],
        "correo": rem["valor"].lower() in [x.lower() for x in canales["correos"]],
        "telegram": rem["valor"] == canales["telegram_chat_id"],
    }[rem["tipo"]]
    return _falla_si(not vinculado)


def _combinar(r: dict[str, str]) -> tuple[str, list[str]]:
    fallan = sorted((k for k, v in r.items() if v in ("FALLA", "INDETERMINADO")), key=lambda k: int(k[1:]))
    if any(r[k] == "FALLA" for k in FRENAN):
        return "FRENAR", fallan
    return ("ESCALAR" if fallan else "PAGAR"), fallan


def _asignacion(r: dict[str, str], caso: Caso, ahora: str, aprobadores: list[dict]) -> tuple[str, str]:
    """Aprobador y plazo de respuesta (§10): al principal si falla R9 o R10 o el monto supera al otro aprobador."""
    principal = next(a for a in aprobadores if a["principal"])
    otro = next(a for a in aprobadores if not a["principal"])
    supera_otro = otro["limite_usd"] is not None and (caso.usd or 0) > otro["limite_usd"]
    asignado = principal["id"] if r["R9"] == "FALLA" or r["R10"] == "FALLA" or supera_otro else otro["id"]
    hoy, zona = ahora[:10], ahora[19:]
    vence = None if "fecha_vencimiento" in caso.afectados else caso.ext.get("fecha_vencimiento")
    limite = date.fromisoformat(vence) - timedelta(days=3) if vence else date.fromisoformat(hoy)
    if limite <= date.fromisoformat(hoy):
        return asignado, f"{hoy}T18:00:00{zona}"
    return asignado, f"{limite.isoformat()}T12:00:00{zona}"


def evaluar(escenario: dict, documentos: list[dict], historial: list[dict], datos: dict) -> list[dict]:
    """documentos: [{recibido_en, canal, remitente, sha256, texto_crudo, ext (plana)}] en orden de llegada."""
    reglas = datos["reglas"][escenario["reglas_version"]]
    tasas = datos["tasas"][escenario["periodo"]]["tasas"]
    por_nombre = {normalizar_nombre(b["nombre"]): b for b in datos["beneficiarios"]}
    libro = Libro(historial)
    periodo, ahora = escenario["periodo"], escenario["ahora"]
    resultados = []

    for d in documentos:
        ext = d["ext"]
        if not ext["es_factura"]:
            resultados.append({"decision": "RECHAZADA_NO_FACTURA", "reglas_que_fallan": [], "asignado_a": None,
                               "responder_antes_de": None, "usd": None, "disponible_antes": None})
            continue
        afectados = _campos_afectados(ext, ahora[:10], tasas)
        total = ext.get("monto_total")
        ben_norm = normalizar_nombre(ext["beneficiario_nombre"] or "")
        caso = Caso(doc=d, ext=ext, ben=por_nombre.get(ben_norm) if ben_norm else None, ben_norm=ben_norm,
                    numero=normalizar_numero(ext["numero"] or ""),
                    usd=dinero.a_usd(total["centavos"], total["moneda"], tasas) if "monto_total" not in afectados else None,
                    afectados=afectados)
        disponible = reglas["presupuesto"]["monto_usd"] - libro.total(periodo, "pagada") - libro.total(periodo, "reservada")

        r = {"R1": _falla_si(bool(caso.afectados)),
             "R2": _falla_si(any(_es_duplicado(caso, f, reglas["duplicados"]) for f in libro.facturas if f["ben"] == ben_norm)),
             "R3": _falla_si(caso.r3_falla),
             "R4": _r4(caso),
             **_reglas_de_monto(caso, libro, periodo, reglas["limites"], disponible),
             "R10": _falla_si(bool(detectar_instrucciones(d["texto_crudo"]))),
             "R11": _r11(caso)}
        decision, fallan = _combinar(r)
        asignado, plazo = _asignacion(r, caso, ahora, datos["aprobadores"]) if decision == "ESCALAR" else (None, None)
        resultados.append({"decision": decision, "reglas_que_fallan": fallan, "asignado_a": asignado,
                           "responder_antes_de": plazo, "usd": caso.usd, "disponible_antes": disponible, "detalle": r})

        if decision in ("PAGAR", "ESCALAR"):
            libro.agregar(ben=ben_norm, numero=caso.numero, emision=ext["fecha_emision"], usd=caso.usd or 0,
                          sha256=d["sha256"], hito=ext.get("hito_numero"),
                          estado="pagada" if decision == "PAGAR" else "reservada", periodo=periodo, ref=None)

    return resultados


def cierre(escenario: dict, historial: list[dict], resultados: list[dict], datos: dict) -> dict:
    """Pagado en lote, reservado y disponible al final (para comparar con §11.4)."""
    periodo = escenario["periodo"]
    presupuesto = datos["reglas"][escenario["reglas_version"]]["presupuesto"]["monto_usd"]
    libro = Libro(historial)
    pagado_antes = libro.total(periodo, "pagada")
    pagado = sum(x["usd"] for x in resultados if x["decision"] == "PAGAR")
    reservado = libro.total(periodo, "reservada") + sum(x["usd"] or 0 for x in resultados if x["decision"] == "ESCALAR")
    return {"pagado_antes": pagado_antes, "pagado_en_lote": pagado, "reservado": reservado,
            "disponible": presupuesto - pagado_antes - pagado - reservado}

