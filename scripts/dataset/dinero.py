"""Dinero en centavos enteros, conversión con tasas fijas y formatos por idioma.

Misma convención que docs/especificacion.md §3 y §6: montos como enteros en
centavos, tasas como string decimal (1 USD = X), redondeo half-up.
"""

from __future__ import annotations

from datetime import date
from decimal import ROUND_HALF_UP, Decimal

# Monedas que se muestran sin decimales en documentos y UI.
SIN_DECIMALES = {"COP", "CLP"}

MESES_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def centavos(unidades: str | int) -> int:
    """'8400000' -> 840000000. Acepta enteros o strings con punto decimal ('1240.00')."""
    valor = (Decimal(str(unidades)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return int(valor)


def a_usd(monto_centavos: int, moneda: str, tasas: dict[str, str]) -> int:
    """Convierte a centavos de USD con la tasa del periodo (1 USD = tasa)."""
    if moneda == "USD":
        return monto_centavos
    tasa = Decimal(tasas[moneda])
    return int((Decimal(monto_centavos) / tasa).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _agrupar(entero: int, separador: str) -> str:
    texto = str(entero)
    grupos = []
    while texto:
        grupos.append(texto[-3:])
        texto = texto[:-3]
    return separador.join(reversed(grupos))


def numero(monto_centavos: int, estilo: str, decimales: bool = True) -> str:
    """Formatea un número.

    estilo 'es' -> 1.234,56 (CO, AR, BR, UI interna)
    estilo 'en' -> 1,234.56 (EE. UU., México)
    """
    if monto_centavos < 0:
        raise ValueError("montos negativos no existen en el dataset")
    miles, decimal_sep = (".", ",") if estilo == "es" else (",", ".")
    enteros, resto = divmod(monto_centavos, 100)
    texto = _agrupar(enteros, miles)
    if decimales:
        texto += f"{decimal_sep}{resto:02d}"
    elif resto:
        raise ValueError(f"monto con centavos en moneda sin decimales: {monto_centavos}")
    return texto


def monto(monto_centavos: int, moneda: str, estilo: str = "es") -> str:
    """'USD 7.444,05', 'COP 8.400.000', 'MXN 38,000.00' (estilo en)."""
    return f"{moneda} {numero(monto_centavos, estilo, moneda not in SIN_DECIMALES)}"


def usd_es(monto_centavos: int) -> str:
    """Formato de la UI interna: 7.444,05."""
    return numero(monto_centavos, "es")


def tasa_texto(moneda: str, tasas: dict[str, str]) -> str | None:
    """'MXN 18,50' o None si es USD (formato de EntradaRegistro.tasa_usada)."""
    if moneda == "USD":
        return None
    entero, _, dec = Decimal(tasas[moneda]).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP).to_eng_string().partition(".")
    return f"{moneda} {_agrupar(int(entero), '.')},{dec}"


def fecha(iso: str, idioma: str) -> str:
    """'2026-10-08' -> '08/10/2026' (es, pt) u 'Oct 8, 2026' (en)."""
    d = date.fromisoformat(iso)
    if idioma == "en":
        return f"{MESES_EN[d.month - 1]} {d.day}, {d.year}"
    return f"{d.day:02d}/{d.month:02d}/{d.year}"
