"""Renderizadores deterministas: PDF (reportlab), foto PNG (Pillow), correo .eml y chat .txt.

Determinismo: reportlab en modo `invariant` (sin fecha ni id aleatorio), ruido
de imagen derivado de una semilla con SHAKE-256 (no hay azar: es solo textura
visual), correos con Message-ID y boundary fijos. Mismo
código + mismas versiones de requirements.txt = mismos bytes.
"""

from __future__ import annotations

import hashlib
import io
import os
from datetime import datetime
from email.message import EmailMessage
from email.policy import SMTP
from email.utils import format_datetime

import reportlab
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from reportlab import rl_config
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from mundo import CORREO_CUENTAS
from textos import bloques_factura, lineas_folleto, mensaje_chat

rl_config.invariant = 1

_FUENTES = os.path.join(os.path.dirname(reportlab.__file__), "fonts")
FUENTE = os.path.join(_FUENTES, "Vera.ttf")
FUENTE_NEGRITA = os.path.join(_FUENTES, "VeraBd.ttf")
pdfmetrics.registerFont(TTFont("Vera", FUENTE))
pdfmetrics.registerFont(TTFont("Vera-Bold", FUENTE_NEGRITA))

TINTA = HexColor("#1F2A24")
GRIS = HexColor("#5B6661")
LINEA = HexColor("#D5D9D3")
FONDO = HexColor("#F3F4F0")
ACENTO = {"es": HexColor("#2F5D50"), "en": HexColor("#1F4FD1"), "pt": HexColor("#7A4900")}


# ---------------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------------

def _texto_ajustado(c: canvas.Canvas, texto: str, x: float, y: float, ancho: float, fuente: str, tam: float,
                    interlinea: float) -> float:
    """Dibuja texto con salto de línea por ancho. Devuelve la y siguiente."""
    palabras = texto.split()
    linea = ""
    for palabra in palabras:
        prueba = f"{linea} {palabra}".strip()
        if pdfmetrics.stringWidth(prueba, fuente, tam) > ancho and linea:
            c.drawString(x, y, linea)
            y -= interlinea
            linea = palabra
        else:
            linea = prueba
    if linea:
        c.drawString(x, y, linea)
        y -= interlinea
    return y


def pdf_factura(fac: dict, idioma: str, variante: str | None = None) -> bytes:
    b = bloques_factura(fac, idioma, variante)
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter, invariant=1, pageCompression=1)
    c.setTitle(f"{b['titulo']} {b['numero']}")
    c.setAuthor(b["emisor"])
    c.setCreator("blinka-dataset")
    ancho, alto = letter
    m = 54
    acento = ACENTO[b["acento"]]

    # Banda superior y emisor.
    c.setFillColor(acento)
    c.rect(0, alto - 10, ancho, 10, stroke=0, fill=1)
    c.setFillColor(TINTA)
    c.setFont("Vera-Bold", 18)
    c.drawString(m, alto - 64, b["emisor"])
    c.setFont("Vera", 9.5)
    c.setFillColor(GRIS)
    c.drawString(m, alto - 80, b["ciudad"])
    c.drawString(m, alto - 93, b["id_fiscal"])

    # Caja de número y fechas.
    caja_x, caja_w = ancho - m - 210, 210
    c.setFillColor(FONDO)
    c.setStrokeColor(LINEA)
    c.roundRect(caja_x, alto - 132, caja_w, 92, 6, stroke=1, fill=1)
    c.setFillColor(GRIS)
    c.setFont("Vera", 8.5)
    c.drawString(caja_x + 12, alto - 56, b["titulo"])
    c.setFillColor(TINTA)
    c.setFont("Vera-Bold", 15)
    c.drawString(caja_x + 12, alto - 74, b["numero"])
    c.setFont("Vera", 9)
    y = alto - 94
    for etiqueta, valor in b["fechas"]:
        c.setFillColor(GRIS)
        c.drawString(caja_x + 12, y, etiqueta)
        c.setFillColor(TINTA)
        c.drawRightString(caja_x + caja_w - 12, y, valor)
        y -= 14

    if b["sello"]:
        c.saveState()
        c.setFillColor(HexColor("#B42318"))
        c.setFont("Vera-Bold", 13)
        c.translate(m + 250, alto - 112)
        c.rotate(8)
        c.drawString(0, 0, b["sello"])
        c.restoreState()

    # Facturar a.
    y = alto - 168
    c.setFillColor(GRIS)
    c.setFont("Vera", 8.5)
    c.drawString(m, y, b["facturar"][0].upper())
    c.setFillColor(TINTA)
    c.setFont("Vera", 10.5)
    c.drawString(m, y - 15, b["facturar"][1])

    # Tabla de conceptos.
    y -= 50
    c.setFillColor(FONDO)
    c.rect(m, y - 6, ancho - 2 * m, 22, stroke=0, fill=1)
    c.setFillColor(GRIS)
    c.setFont("Vera-Bold", 9)
    c.drawString(m + 10, y + 1, b["cabecera_tabla"][0])
    c.drawRightString(ancho - m - 10, y + 1, b["cabecera_tabla"][1])
    y -= 26
    c.setFillColor(TINTA)
    c.setFont("Vera", 10.5)
    c.drawString(m + 10, y, b["item"][0])
    c.drawRightString(ancho - m - 10, y, b["item"][1])
    y -= 14
    c.setStrokeColor(LINEA)
    c.line(m, y, ancho - m, y)

    # Totales.
    y -= 22
    for i, (etiqueta, valor) in enumerate(b["totales"]):
        es_total = i == len(b["totales"]) - 1
        c.setFont("Vera-Bold" if es_total else "Vera", 12 if es_total else 10)
        c.setFillColor(TINTA if es_total else GRIS)
        c.drawRightString(ancho - m - 170, y, etiqueta)
        c.setFillColor(TINTA)
        c.drawRightString(ancho - m - 10, y, valor)
        y -= 20

    if b["referencia"]:
        c.setFont("Vera", 9.5)
        c.setFillColor(GRIS)
        c.drawString(m, y - 4, f"{b['referencia'][0]}: {b['referencia'][1]}")
        y -= 20

    # Pagar a.
    y -= 18
    c.setFillColor(FONDO)
    c.setStrokeColor(LINEA)
    c.roundRect(m, y - 62, 300, 74, 6, stroke=1, fill=1)
    c.setFillColor(GRIS)
    c.setFont("Vera", 8.5)
    c.drawString(m + 12, y - 4, b["pagar"][0].upper())
    c.setFillColor(TINTA)
    c.setFont("Vera", 10)
    yy = y - 20
    for linea in b["pagar"][1]:
        c.drawString(m + 12, yy, linea)
        yy -= 14
    y -= 90

    if b["nota"]:
        c.setFillColor(GRIS)
        c.setFont("Vera", 8.5)
        c.drawString(m, y, b["nota"][0].upper())
        c.setFillColor(TINTA)
        c.setFont("Vera", 10)
        y = _texto_ajustado(c, b["nota"][1], m, y - 15, ancho - 2 * m, "Vera", 10, 14)

    if b["nota_oculta"]:
        # Blanco sobre blanco y de 4 pt: invisible al imprimir, pero queda en el texto del PDF (trampa de R10, #8).
        c.setFillColor(HexColor("#FFFFFF"))
        c.setFont("Vera", 4)
        c.drawString(m, 52, b["nota_oculta"])

    c.setFillColor(GRIS)
    c.setFont("Vera", 7.5)
    c.drawString(m, 40, b["pie"])
    c.showPage()
    c.save()
    return buf.getvalue()


def pdf_folleto(folleto: dict) -> bytes:
    lineas = lineas_folleto(folleto)
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter, invariant=1, pageCompression=1)
    c.setTitle(folleto["titulo"])
    c.setCreator("blinka-dataset")
    ancho, alto = letter
    c.setFillColor(ACENTO["es"])
    c.rect(0, alto - 180, ancho, 180, stroke=0, fill=1)
    c.setFillColor(HexColor("#FFFFFF"))
    c.setFont("Vera-Bold", 26)
    c.drawString(54, alto - 90, lineas[2])
    c.setFont("Vera", 12)
    c.drawString(54, alto - 115, f"{lineas[0]} · {lineas[1]}")
    c.setFillColor(TINTA)
    c.setFont("Vera", 13)
    y = alto - 240
    for linea in lineas[3:-1]:
        c.drawString(72, y, f"•  {linea}")
        y -= 28
    c.setFillColor(GRIS)
    c.setFont("Vera", 7.5)
    c.drawString(54, 40, lineas[-1])
    c.showPage()
    c.save()
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Foto PNG (factura impresa fotografiada)
# ---------------------------------------------------------------------------

def _fuente(tam: int, negrita: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FUENTE_NEGRITA if negrita else FUENTE, tam)


def hoja_factura(fac: dict, idioma: str, legible: bool = True) -> tuple[Image.Image, list[tuple[int, int, int, int]]]:
    """Factura impresa (sin efecto foto) y las zonas donde aparece un monto."""
    b = bloques_factura(fac, idioma, None)
    w, h = 1275, 1650  # carta a 150 dpi
    hoja = Image.new("RGB", (w, h), (252, 251, 247))
    d = ImageDraw.Draw(hoja)
    m = 110
    tinta, gris, linea, fondo = (31, 42, 36), (91, 102, 97), (213, 217, 211), (243, 244, 240)
    acento = {"es": (47, 93, 80), "en": (31, 79, 209), "pt": (122, 73, 0)}[idioma]

    d.rectangle([0, 0, w, 20], fill=acento)
    d.text((m, 95), b["emisor"], font=_fuente(40, True), fill=tinta)
    d.text((m, 150), b["ciudad"], font=_fuente(22), fill=gris)
    d.text((m, 180), b["id_fiscal"], font=_fuente(22), fill=gris)

    cx = w - m - 440
    d.rounded_rectangle([cx, 85, w - m, 285], radius=12, fill=fondo, outline=linea, width=2)
    d.text((cx + 24, 105), b["titulo"], font=_fuente(20), fill=gris)
    d.text((cx + 24, 135), b["numero"], font=_fuente(34, True), fill=tinta)
    y = 200
    for etiqueta, valor in b["fechas"]:
        d.text((cx + 24, y), etiqueta, font=_fuente(21), fill=gris)
        d.text((w - m - 24, y), valor, font=_fuente(21), fill=tinta, anchor="ra")
        y += 34

    d.text((m, 340), b["facturar"][0].upper(), font=_fuente(19), fill=gris)
    d.text((m, 370), b["facturar"][1], font=_fuente(25), fill=tinta)

    y = 470
    d.rectangle([m, y, w - m, y + 50], fill=fondo)
    d.text((m + 20, y + 13), b["cabecera_tabla"][0], font=_fuente(21, True), fill=gris)
    d.text((w - m - 20, y + 13), b["cabecera_tabla"][1], font=_fuente(21, True), fill=gris, anchor="ra")
    y += 80
    d.text((m + 20, y), b["item"][0], font=_fuente(25), fill=tinta)
    d.text((w - m - 20, y), b["item"][1], font=_fuente(25), fill=tinta, anchor="ra")
    zonas_monto = [(w - m - 420, y - 15, w - m, y + 45)]  # importe de la fila
    y += 50
    d.line([m, y, w - m, y], fill=linea, width=2)

    y += 40
    for i, (etiqueta, valor) in enumerate(b["totales"]):
        es_total = i == len(b["totales"]) - 1
        tam = 30 if es_total else 23
        d.text((w - m - 380, y), etiqueta, font=_fuente(tam, es_total), fill=tinta if es_total else gris, anchor="ra")
        d.text((w - m - 20, y), valor, font=_fuente(tam, es_total), fill=tinta, anchor="ra")
        zonas_monto.append((w - m - 520, y - 15, w - m, y + 50))
        y += 48

    if b["referencia"]:
        d.text((m, y + 10), f"{b['referencia'][0]}: {b['referencia'][1]}", font=_fuente(22), fill=gris)
        y += 50

    y += 40
    d.rounded_rectangle([m, y, m + 700, y + 175], radius=12, fill=fondo, outline=linea, width=2)
    d.text((m + 24, y + 18), b["pagar"][0].upper(), font=_fuente(19), fill=gris)
    yy = y + 55
    for texto in b["pagar"][1]:
        d.text((m + 24, yy), texto, font=_fuente(23), fill=tinta)
        yy += 36

    d.text((m, h - 90), b["pie"], font=_fuente(17), fill=gris)

    if not legible:  # ningún monto debe poder leerse: fila del concepto y todos los totales
        margen = 30  # se difumina con contexto y se pega solo el centro: sin borde visible
        for x0, y0, x1, y1 in zonas_monto:
            borrosa = hoja.crop((x0 - margen, y0 - margen, x1 + margen, y1 + margen)).filter(ImageFilter.GaussianBlur(14))
            hoja.paste(borrosa.crop((margen, margen, margen + x1 - x0, margen + y1 - y0)), (x0, y0))
    return hoja, zonas_monto


def png_factura(fac: dict, idioma: str, semilla: int, legible: bool = True) -> bytes:
    hoja, _ = hoja_factura(fac, idioma, legible)

    # Efecto foto: mesa de fondo, leve rotación, ruido y desenfoque.
    flujo = hashlib.shake_256(f"blinka-foto-{semilla}".encode())
    cabecera = flujo.digest(5)
    angulo = (1.0 + 1.5 * int.from_bytes(cabecera[:4], "big") / 2**32) * (1 if cabecera[4] % 2 else -1)
    rotada = hoja.rotate(angulo, resample=Image.Resampling.BICUBIC, expand=True, fillcolor=(196, 188, 174))
    lienzo = Image.new("RGB", (rotada.width + 80, rotada.height + 80), (196, 188, 174))
    lienzo.paste(rotada, (40, 40))
    ruido_bytes = flujo.digest(5 + lienzo.width * lienzo.height)[5:]
    ruido = Image.frombytes("L", lienzo.size, ruido_bytes).convert("RGB")
    foto = Image.blend(lienzo, ruido, 0.035).filter(ImageFilter.GaussianBlur(0.8 if legible else 1.4))
    foto = foto.resize((foto.width * 2 // 3, foto.height * 2 // 3), Image.Resampling.LANCZOS)

    buf = io.BytesIO()
    foto.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Correo y chat
# ---------------------------------------------------------------------------

def eml(d: dict, adjunto: tuple[str, str, bytes], id_mensaje: str) -> bytes:
    """Correo con un adjunto. Message-ID y boundary fijos para que sea determinista."""
    rem = d["remitente"]
    msg = EmailMessage()
    msg["From"] = f'"{rem["nombre"]}" <{rem["valor"]}>'
    msg["To"] = CORREO_CUENTAS
    msg["Subject"] = d["asunto"]
    msg["Date"] = format_datetime(datetime.fromisoformat(d["recibido_en"]))
    msg["Message-ID"] = f"<{id_mensaje}@{rem['valor'].split('@')[1]}>"
    msg.set_content(d["mensaje"] + "\n")
    nombre, mime, datos = adjunto
    principal, sub = mime.split("/")
    msg.add_attachment(datos, maintype=principal, subtype=sub, filename=nombre)
    msg.set_boundary(f"=_blinka_{id_mensaje}")
    return msg.as_bytes(policy=SMTP)


def chat(d: dict, con_factura: bool) -> str:
    """Mensaje de Telegram exportado: cabecera + cuerpo."""
    rem = d["remitente"]
    cuerpo = mensaje_chat(d) if con_factura else (d["mensaje"] or "")
    return (f"canal: telegram\nchat_id: {rem['valor']}\nde: {rem['nombre']}\nfecha: {d['recibido_en']}\n\n"
            f"{cuerpo}\n")
