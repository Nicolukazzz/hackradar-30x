#!/usr/bin/env python3
"""Genera el dataset completo del reto Blinka en data/ y lo verifica.

Uso:
    python3 scripts/dataset/generar.py              # escribe en data/ del repo
    python3 scripts/dataset/generar.py --salida X   # escribe en otra carpeta (tests)

Es idempotente: borra y regenera data/escenarios/ y los JSON comunes.
Termina con código 1 si la verificación encuentra cualquier inconsistencia.
Contrato: docs/especificacion.md §3, §9 y §11.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path

import escenarios as E
import mundo
import oraculo
import registro
import render
import verificar
from textos import lineas_factura, lineas_folleto

RAIZ = Path(__file__).resolve().parents[2]
MIME = {"pdf": "application/pdf", "png": "image/png"}


def escribir_json(ruta: Path, datos) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sin_privados(obj):
    """Quita claves que empiezan por '_' (solo sirven para renderizar)."""
    if isinstance(obj, dict):
        return {k: sin_privados(v) for k, v in obj.items() if not k.startswith("_")}
    if isinstance(obj, list):
        return [sin_privados(v) for v in obj]
    return obj


def datos_comunes() -> dict:
    return {"reglas": mundo.REGLAS, "tasas": mundo.TASAS, "beneficiarios": mundo.BENEFICIARIOS,
            "aprobadores": mundo.APROBADORES}


def escribir_comunes(salida: Path) -> None:
    escribir_json(salida / "empresa.json", mundo.EMPRESA)
    escribir_json(salida / "aprobadores.json", mundo.APROBADORES)
    escribir_json(salida / "proveedores.json", sin_privados(mundo.BENEFICIARIOS))
    for version, reglas in mundo.REGLAS.items():
        escribir_json(salida / "reglas" / f"v{version}.json", reglas)
    for periodo, tabla in mundo.TASAS.items():
        escribir_json(salida / "tasas" / f"{periodo}.json", tabla)


# ---------------------------------------------------------------------------
# Historial
# ---------------------------------------------------------------------------

def historial_desde_previas(previas: list[dict]) -> list[dict]:
    entradas = []
    for i, p in enumerate(previas, start=1):
        fac = p["factura"]
        idioma = p["idioma"]
        plana = registro.extraccion_plana(fac, idioma)
        agente = registro.entrada_agente(
            id_=f"REG-HIST-{i:04d}", ref=f"INT-HIST-{i:04d}", momento=p["momento"], fac=fac, canal=p["canal"],
            formato=p["formato"], decision=p["decision"], reglas=p["reglas"], version=p["version"],
            explicacion=f"Importado del registro anterior: {p['motivo']}",
            ext=registro.extraccion_completa(plana, "\n".join(lineas_factura(fac, idioma))), sha256=None)
        entradas.append(agente)
        for j, h in enumerate(p["humanas"], start=1):
            entradas.append(registro.entrada_humana(id_=f"REG-HIST-{i:04d}-H{j}", origen=agente, h=h))
    return sorted(entradas, key=lambda e: e["momento"])


def historial_desde_lote(docs: list[dict], generados: list[dict], resolucion: dict, version: int) -> list[dict]:
    """Decisiones del lote demo (como las tomaría el motor) + su resolución humana."""
    agentes, humanas = [], []
    for d, g in zip(docs, generados):
        fac = d["factura"]
        esp = d["esperado"]
        agente = registro.entrada_agente(
            id_=f"REG-2026-{d['n']:06d}", ref=g["ref"], momento=d["recibido_en"], fac=fac, canal=d["canal"],
            formato=d["formato"], decision=esp["decision"], reglas=esp["reglas_que_fallan"], version=version,
            explicacion=esp["motivo"], ext=registro.extraccion_completa(g["plana"], g["texto_crudo"]),
            sha256=g["sha256"])
        agentes.append(agente)
        if fac["numero"] in resolucion and esp["decision"] == "ESCALAR":
            humanas.append((resolucion[fac["numero"]], agente))
    humanas.sort(key=lambda x: x[0]["momento"])
    siguiente = len(docs) + 1
    salida = list(agentes)
    for k, (h, origen) in enumerate(humanas):
        salida.append(registro.entrada_humana(id_=f"REG-2026-{siguiente + k:06d}", origen=origen, h=h))
    return salida


# ---------------------------------------------------------------------------
# Documentos
# ---------------------------------------------------------------------------

def generar_documento(d: dict, carpeta: Path, ref: str, previos: dict[int, dict]) -> dict:
    """Escribe el documento y su .meta.json. Devuelve datos para el oráculo y el esperado."""
    base = f"{d['n']:03d}-{d['slug']}"
    docs_dir = carpeta / "documentos"
    adj_dir = docs_dir / "adjuntos"
    fac, idioma, render_tipo = d["factura"], d["idioma"], d["render"]
    meta = {"canal": d["canal"], "remitente": {"tipo": d["remitente"]["tipo"], "valor": d["remitente"]["valor"]},
            "recibido_en": d["recibido_en"]}
    if d["asunto"]:
        meta["asunto"] = d["asunto"]

    adjunto: tuple[str, str, bytes] | None = None
    if fac is not None:
        lineas = lineas_factura(fac, idioma, d["variante"])
    else:
        lineas = lineas_folleto(d["folleto"])

    if render_tipo in ("pdf", "eml+pdf"):
        if d["reusar_adjunto_de"]:
            datos = previos[d["reusar_adjunto_de"]]["adjunto"][2]
        else:
            datos = render.pdf_factura(fac, idioma, d["variante"])
        adjunto = (f"{fac['numero']}.pdf", MIME["pdf"], datos)
    elif render_tipo == "eml+folleto":
        adjunto = ("Nuevas-rutas-2027.pdf", MIME["pdf"], render.pdf_folleto(d["folleto"]))
    elif render_tipo in ("png", "eml+png-ilegible"):
        legible = render_tipo == "png"
        adjunto = (f"{fac['numero']}.png", MIME["png"], render.png_factura(fac, idioma, semilla=d["n"] * 7919, legible=legible))

    if render_tipo == "chat":
        texto = render.chat(d, con_factura=True)
        ruta = docs_dir / f"{base}.txt"
        ruta.write_text(texto, encoding="utf-8")
        cuerpo = texto.split("\n\n", 1)[1].rstrip("\n")
        meta |= {"texto_mensaje": cuerpo, "adjuntos": []}
        principal = cuerpo.encode("utf-8")
        texto_crudo = cuerpo
    elif render_tipo.startswith("eml+"):
        ext_adj = adjunto[0].rsplit(".", 1)[1]
        (adj_dir / f"{base}.{ext_adj}").write_bytes(adjunto[2])
        ruta = docs_dir / f"{base}.eml"
        ruta.write_bytes(render.eml(d, adjunto, id_mensaje=f"{d['slug']}-{d['n']}"))
        meta |= {"texto_mensaje": d["mensaje"],
                 "adjuntos": [{"nombre": adjunto[0], "mime": adjunto[1],
                               "ruta": f"documentos/adjuntos/{base}.{ext_adj}"}]}
        principal = adjunto[2]
        texto_crudo = "\n".join([d["asunto"], d["mensaje"], *lineas])
    else:  # pdf o png directos (portal o foto por Telegram)
        ext_adj = adjunto[0].rsplit(".", 1)[1]
        ruta = docs_dir / f"{base}.{ext_adj}"
        ruta.write_bytes(adjunto[2])
        meta["adjuntos"] = [{"nombre": adjunto[0], "mime": adjunto[1], "ruta": f"documentos/{base}.{ext_adj}"}]
        if d["mensaje"]:
            meta["texto_mensaje"] = d["mensaje"]
        principal = adjunto[2]
        texto_crudo = "\n".join([d["mensaje"] or "", *lineas]).strip()

    archivo = f"documentos/{ruta.name}"
    escribir_json(docs_dir / f"{base}.meta.json", {"archivo_original": archivo, **meta})
    plana = registro.extraccion_plana(fac, idioma)
    return {"archivo": archivo, "ref": ref, "sha256": hashlib.sha256(principal).hexdigest(), "plana": plana,
            "texto_crudo": texto_crudo, "adjunto": adjunto, "doc": d}


def generar_escenario(esc: dict, salida: Path, historial: list[dict], primera_ref: int) -> dict:
    carpeta = salida / "escenarios" / esc["id"]
    (carpeta / "documentos" / "adjuntos").mkdir(parents=True, exist_ok=True)
    generados: dict[int, dict] = {}
    for i, d in enumerate(esc["documentos"]):
        generados[d["n"]] = generar_documento(d, carpeta, f"INT-2026-{primera_ref + i:06d}", generados)
    lista = [generados[d["n"]] for d in esc["documentos"]]

    entradas_oraculo = [{"recibido_en": g["doc"]["recibido_en"], "canal": g["doc"]["canal"],
                         "remitente": g["doc"]["remitente"], "sha256": g["sha256"],
                         "texto_crudo": g["texto_crudo"], "ext": g["plana"]} for g in lista]
    resultados = oraculo.evaluar(esc, entradas_oraculo, historial, datos_comunes())
    cierre = oraculo.cierre(esc, historial, resultados, datos_comunes())

    esperado = []
    for g in lista:
        esp = g["doc"]["esperado"]
        esperado.append({"documento": g["archivo"], "ref_esperada": g["ref"], **esp,
                         "extraccion_esperada": g["plana"]})

    escribir_json(carpeta / "escenario.json", {
        "id": esc["id"], "periodo": esc["periodo"], "ahora": esc["ahora"], "reglas_version": esc["reglas_version"],
        "presupuesto_inicial_pagado_usd": cierre["pagado_antes"], "descripcion": esc["descripcion"]})
    escribir_json(carpeta / "historial.json", historial)
    escribir_json(carpeta / "esperado.json", esperado)
    return {"escenario": esc, "carpeta": carpeta, "generados": lista, "resultados": resultados, "cierre": cierre,
            "esperado": esperado, "historial": historial}


def generar(salida: Path) -> list[dict]:
    if (salida / "escenarios").exists():
        shutil.rmtree(salida / "escenarios")
    escribir_comunes(salida)

    historial_oct = historial_desde_previas(E.HISTORIAL_OCT)
    lote = generar_escenario(E.ESCENARIOS["lote-demo-oct"], salida, historial_oct, primera_ref=1)

    historial_nov = historial_oct + historial_desde_lote(E.LOTE_DEMO, lote["generados"], E.RESOLUCION_LOTE_DEMO,
                                                         E.ESCENARIOS["lote-demo-oct"]["reglas_version"])
    historial_nov.sort(key=lambda e: e["momento"])
    trampas = generar_escenario(E.ESCENARIOS["trampas-extra"], salida, historial_nov,
                                primera_ref=len(E.LOTE_DEMO) + 1)
    return [lote, trampas]


def imprimir_resumen(corridas: list[dict]) -> None:
    for corrida in corridas:
        esc = corrida["escenario"]
        print(f"\n== {esc['id']} ({esc['periodo']}) ==")
        print(f"{'archivo':42} {'formato':8} {'trampa':38} esperado")
        conteo: dict[str, int] = {}
        for e, g in zip(corrida["esperado"], corrida["generados"]):
            trampa = ", ".join(e["trampa"]) or "—"
            print(f"{e['documento']:42} {g['doc']['formato']:8} {trampa:38} {e['decision']}")
            conteo[e["decision"]] = conteo.get(e["decision"], 0) + 1
        print("Conteo: " + " · ".join(f"{k} {v}" for k, v in sorted(conteo.items())))
        c = corrida["cierre"]
        print(f"Cierre USD: pagado antes {c['pagado_antes'] / 100:,.2f} · pagado en lote {c['pagado_en_lote'] / 100:,.2f}"
              f" · reservado {c['reservado'] / 100:,.2f} · disponible {c['disponible'] / 100:,.2f}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--salida", type=Path, default=RAIZ / "data", help="carpeta destino (por defecto data/)")
    parser.add_argument("--silencioso", action="store_true", help="no imprimir la tabla resumen")
    args = parser.parse_args(argv)

    corridas = generar(args.salida)
    errores = verificar.todo(corridas, args.salida)
    if not args.silencioso:
        imprimir_resumen(corridas)
    if errores:
        print(f"\nVERIFICACIÓN FALLIDA ({len(errores)} errores):", file=sys.stderr)
        for e in errores:
            print(f"  - {e}", file=sys.stderr)
        return 1
    print("\nVerificación OK: decisiones del oráculo = esperado.json; aritmética del lote demo = especificación §11.4.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
