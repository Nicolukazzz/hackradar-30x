"""Tests del generador de dataset. Correr: .venv/bin/pytest scripts/dataset -q"""

from __future__ import annotations

import copy
import hashlib
from pathlib import Path

import pytest

import dinero
import escenarios as E
import generar
import mundo
import oraculo
import verificar

RAIZ = Path(__file__).resolve().parents[3]


def _hashes(carpeta: Path) -> dict[str, str]:
    return {str(p.relative_to(carpeta)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(carpeta.rglob("*")) if p.is_file() and p.name != "README.md"}


@pytest.fixture(scope="module")
def corrida(tmp_path_factory):
    salida = tmp_path_factory.mktemp("data")
    return salida, generar.generar(salida)


def test_genera_y_verifica_sin_errores(tmp_path):
    assert generar.main(["--salida", str(tmp_path), "--silencioso"]) == 0


def test_es_determinista(corrida, tmp_path):
    salida, _ = corrida
    generar.generar(tmp_path)
    assert _hashes(tmp_path) == _hashes(salida)


def test_data_versionada_esta_al_dia(corrida):
    """Si falla: alguien cambió el generador sin regenerar. Correr scripts/dataset/generar.py y commitear data/."""
    salida, _ = corrida
    assert _hashes(RAIZ / "data") == _hashes(salida)


def test_lote_demo_reproduce_el_prototipo(corrida):
    _, (lote, _) = corrida
    assert verificar.aritmetica_lote_demo(lote) == []
    decisiones = [e["decision"] for e in lote["esperado"]]
    assert decisiones == ["PAGAR"] * 5 + ["FRENAR", "FRENAR", "ESCALAR", "ESCALAR", "ESCALAR", "ESCALAR", "FRENAR"]
    assert [e["ref_esperada"] for e in lote["esperado"]][-1] == "INT-2026-000012"


def test_oraculo_detecta_un_esperado_mal_escrito(corrida):
    _, (lote, _) = corrida
    roto = copy.deepcopy(lote)
    roto["esperado"][6]["decision"] = "PAGAR"  # PX-77 no cuadra con la OC: jamás PAGAR
    errores = verificar.oraculo_vs_esperado(roto)
    assert any("007-px-77" in e and "decision" in e for e in errores)


def test_ningun_pagar_esperado_tiene_reglas_fallidas(corrida):
    _, corridas = corrida
    for c in corridas:
        for e in c["esperado"]:
            if e["decision"] == "PAGAR":
                assert e["reglas_que_fallan"] == [], e["documento"]


def test_duplicado_exacto_comparte_hash(corrida):
    _, (_, trampas) = corrida
    original, reenvio = trampas["generados"][0], trampas["generados"][1]
    assert original["sha256"] == reenvio["sha256"]
    assert original["archivo"] != reenvio["archivo"]


def test_recordatorio_del_lote_demo_tiene_otro_hash(corrida):
    """INV-2210 duplicada debe detectarse por número, no por hash (PDF re-exportado)."""
    _, (lote, _) = corrida
    assert lote["generados"][1]["sha256"] != lote["generados"][5]["sha256"]


def test_detector_r10_sin_falsos_positivos(corrida):
    _, corridas = corrida
    for c in corridas:
        for g, e in zip(c["generados"], c["esperado"]):
            detectado = bool(oraculo.detectar_instrucciones(g["texto_crudo"]))
            assert detectado == ("inyeccion" in e["trampa"]), e["documento"]


def test_cobertura_de_trampas(corrida):
    _, corridas = corrida
    assert verificar.cobertura_trampas(corridas) == []


@pytest.mark.parametrize("monto,moneda,usd", [
    (dinero.centavos(8400000), "COP", dinero.centavos("2000.00")),
    (dinero.centavos("38000.00"), "MXN", dinero.centavos("2054.05")),
    (dinero.centavos("12000.00"), "MXN", dinero.centavos("648.65")),
    (dinero.centavos("22000.00"), "BRL", dinero.centavos("4000.00")),
    (dinero.centavos("259000.00"), "MXN", dinero.centavos("14000.00")),
])
def test_conversion_a_usd(monto, moneda, usd):
    assert dinero.a_usd(monto, moneda, mundo.TASAS["2026-10"]["tasas"]) == usd


def test_redondeo_half_up():
    assert dinero.a_usd(1, "MXN", {"MXN": "2"}) == 1  # 0,5 centavos -> 1


@pytest.mark.parametrize("centavos,estilo,texto", [
    (744405, "es", "7.444,05"),
    (3800000, "en", "38,000.00"),
    (840000000, "es", "8.400.000,00"),
])
def test_formato_numero(centavos, estilo, texto):
    assert dinero.numero(centavos, estilo) == texto


def test_formato_monto_sin_decimales_para_cop():
    assert dinero.monto(840000000, "COP") == "COP 8.400.000"


@pytest.mark.parametrize("a,b", [
    ("Servicios Ómicron S.A.", "SERVICIOS OMICRON"),
    ("CloudNorte S.A.S.", "CLOUDNORTE"),
    ("Grupo Alba Logística S.A. de C.V.", "GRUPO ALBA LOGISTICA"),
    ("Tecnologías Delta SpA", "TECNOLOGIAS DELTA"),
    ("Pixel & Co.", "PIXEL CO"),
])
def test_normalizar_nombre(a, b):
    assert oraculo.normalizar_nombre(a) == b


def test_detecta_dominio_y_banco_reales(tmp_path):
    (tmp_path / "x.json").write_text('{"de": "pagos@empresa.com", "banco": "Banco Inventado Real"}', encoding="utf-8")
    errores = verificar.datos_ficticios(tmp_path)
    assert any("empresa.com" in e for e in errores)
    assert any("Banco Inventado Real" in e for e in errores)


def test_acepta_dominios_example_y_bancos_de_la_lista(tmp_path):
    (tmp_path / "x.json").write_text('{"de": "billing@cloudnorte.example.", "banco": "Banco Nopal"}', encoding="utf-8")
    assert verificar.datos_ficticios(tmp_path) == []
