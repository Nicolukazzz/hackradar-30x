"""Verificaciones del dataset generado. Cada función devuelve una lista de errores (vacía = OK)."""

from __future__ import annotations

import json
import re
from pathlib import Path

import escenarios as E
from mundo import BANCOS

TRAMPAS_VALIDAS = {
    "duplicado", "duplicado-exacto", "beneficiario-nuevo", "no-cuadra", "sobre-limite", "sobre-maximo",
    "sin-presupuesto", "limite-mensual", "moneda-distinta", "datos-bancarios-cambiados", "ilegible",
    "no-es-factura", "suma-no-cuadra", "remitente-no-vinculado", "hito-repetido", "inyeccion", "fecha-invalida",
}
# Las cinco del brief (docs/retos/blinka.md §07) + las que CLAUDE.md pide sumar.
TRAMPAS_OBLIGATORIAS = {
    "duplicado", "beneficiario-nuevo", "no-cuadra", "sobre-limite", "sin-presupuesto", "moneda-distinta",
    "fecha-invalida", "datos-bancarios-cambiados", "ilegible", "inyeccion",
}
# Lineal: toma lo que sigue a "@" y luego se recortan signos finales.
_DOMINIO = re.compile(r"@([\w.-]+)")
_BANCO = re.compile(r"\bBanco [A-ZÁÉÍÓÚ][\wÁÉÍÓÚáéíóúâêôãõç]*(?: [A-ZÁÉÍÓÚ][\wÁÉÍÓÚáéíóúâêôãõç]*)*")


def oraculo_vs_esperado(corrida: dict) -> list[str]:
    errores = []
    for e, r in zip(corrida["esperado"], corrida["resultados"]):
        for campo in ("decision", "reglas_que_fallan", "asignado_a", "responder_antes_de"):
            if e[campo] != r[campo]:
                errores.append(f"{e['documento']}: {campo} esperado {e[campo]!r}, oráculo {r[campo]!r} "
                               f"(detalle {r.get('detalle')})")
    return errores


def aritmetica_lote_demo(corrida: dict) -> list[str]:
    errores = []
    obtenidos = [r["disponible_antes"] for r in corrida["resultados"]]
    if obtenidos != E.LOTE_DEMO_DISPONIBLES:
        errores.append(f"disponibles antes de cada documento {obtenidos} ≠ especificación {E.LOTE_DEMO_DISPONIBLES}")
    for clave, valor in E.LOTE_DEMO_CIERRE.items():
        if corrida["cierre"][clave] != valor:
            errores.append(f"cierre {clave} = {corrida['cierre'][clave]} ≠ {valor}")
    if corrida["cierre"]["pagado_antes"] != 4100000:
        errores.append(f"pagado antes del lote = {corrida['cierre']['pagado_antes']} ≠ 4100000 (USD 41.000,00)")
    conteo = {d: sum(1 for e in corrida["esperado"] if e["decision"] == d) for d in ("PAGAR", "FRENAR", "ESCALAR")}
    if conteo != {"PAGAR": 5, "FRENAR": 5, "ESCALAR": 2}:
        errores.append(f"conteo del lote demo {conteo} ≠ 5 PAGAR · 5 FRENAR · 2 ESCALAR")
    return errores


def _revisar_documento(carpeta: Path, p: Path, en_esperado: set[str]) -> list[str]:
    rel = f"documentos/{p.name}"
    errores = [] if rel in en_esperado else [f"{rel} no tiene entrada en esperado.json"]
    meta = p.with_name(p.name.rsplit(".", 1)[0] + ".meta.json")
    if not meta.is_file():
        return [*errores, f"{rel} no tiene .meta.json"]
    datos = json.loads(meta.read_text(encoding="utf-8"))
    errores += [f"{meta.name}: adjunto {a['ruta']} no existe" for a in datos["adjuntos"] if not (carpeta / a["ruta"]).is_file()]
    return errores


def _revisar_esperado(carpeta: Path, e: dict) -> list[str]:
    errores = []
    if not (carpeta / e["documento"]).is_file():
        errores.append(f"esperado.json apunta a {e['documento']}, que no existe")
    desconocidas = set(e["trampa"]) - TRAMPAS_VALIDAS
    if desconocidas:
        errores.append(f"{e['documento']}: trampas desconocidas {desconocidas}")
    return errores


def archivos_completos(corrida: dict) -> list[str]:
    carpeta: Path = corrida["carpeta"]
    errores = [f"falta {carpeta / n}" for n in ("escenario.json", "historial.json", "esperado.json")
               if not (carpeta / n).is_file()]
    documentos = sorted(p for p in (carpeta / "documentos").iterdir() if p.is_file() and not p.name.endswith(".meta.json"))
    en_esperado = {e["documento"] for e in corrida["esperado"]}
    for p in documentos:
        errores += _revisar_documento(carpeta, p, en_esperado)
    for e in corrida["esperado"]:
        errores += _revisar_esperado(carpeta, e)
    return errores


def cobertura_trampas(corridas: list[dict]) -> list[str]:
    vistas = {t for c in corridas for e in c["esperado"] for t in e["trampa"]}
    faltan = TRAMPAS_OBLIGATORIAS - vistas
    return [f"trampas obligatorias sin caso: {sorted(faltan)}"] if faltan else []


def datos_ficticios(salida: Path) -> list[str]:
    """Solo dominios .example y bancos inventados en todo lo generado (texto, JSON, correos)."""
    errores = []
    permitidos = set(BANCOS.values())
    for p in sorted(salida.rglob("*")):
        if not p.is_file() or p.suffix in (".pdf", ".png"):
            continue
        texto = p.read_text(encoding="utf-8", errors="ignore")
        for dominio in {d.rstrip(".-") for d in _DOMINIO.findall(texto)}:
            if "." in dominio and not dominio.endswith(".example"):
                errores.append(f"{p.relative_to(salida)}: dominio no ficticio {dominio}")
        for banco in set(_BANCO.findall(texto)):
            if banco not in permitidos:
                errores.append(f"{p.relative_to(salida)}: banco no permitido «{banco}»")
    return errores


def todo(corridas: list[dict], salida: Path) -> list[str]:
    errores = []
    for corrida in corridas:
        errores += oraculo_vs_esperado(corrida)
        errores += archivos_completos(corrida)
    errores += aritmetica_lote_demo(corridas[0])
    errores += cobertura_trampas(corridas)
    errores += datos_ficticios(salida)
    return errores
