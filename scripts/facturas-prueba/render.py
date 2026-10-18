"""Dibuja cada factura en PDF (reportlab) o como imagen (Pillow).

Los renglones con datos usan las etiquetas que entiende el parser de la app (src/extraccion/parsers/etiquetas.ts):
«FACTURA N.º», «Fecha de emisión», «Total a pagar», «Pagar a», «Concepto», «Referencia»… Así los PDF se leen sin IA y
las imágenes las lee el modelo con el mismo texto. Determinista: reportlab en modo invariant y ruido con semilla fija.
"""

from __future__ import annotations

import hashlib
import io
import os
import random
from dataclasses import dataclass

import reportlab
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from reportlab import rl_config
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from mundo import POR_CLAVE, Factura, Proveedor

rl_config.invariant = 1
_FUENTES = os.path.join(os.path.dirname(reportlab.__file__), "fonts")
FUENTE = os.path.join(_FUENTES, "Vera.ttf")
NEGRITA = os.path.join(_FUENTES, "VeraBd.ttf")
MONO = os.path.join(_FUENTES, "VeraMono.ttf") if os.path.exists(os.path.join(_FUENTES, "VeraMono.ttf")) else FUENTE
pdfmetrics.registerFont(TTFont("Vera", FUENTE))
pdfmetrics.registerFont(TTFont("VeraBd", NEGRITA))
pdfmetrics.registerFont(TTFont("VeraMono", MONO))

CLIENTE = "Nébula Studio Inc."
CLIENTE_DIR = "Wilmington, DE, EE. UU."

MESES_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

ESTILOS = {
    # color principal, color suave, alineación del encabezado
    "electronica_co": ("#1F4E79", "#E8EFF7", "izq"),
    "cuenta_cobro": ("#3D3D3D", "#F2F2F2", "centro"),
    "cfdi_mx": ("#7A1F3D", "#F8EBF0", "izq"),
    "fatura_br": ("#0B6B47", "#E3F4EC", "der"),
    "factura_ar": ("#2A5DB0", "#E9F0FB", "izq"),
    "factura_cl": ("#B4471F", "#FBEDE7", "der"),
    "factura_pe": ("#9E1B32", "#FBE9EC", "izq"),
    "invoice_us": ("#111827", "#F3F4F6", "der"),
    "factura_es": ("#0E7490", "#E6F6F9", "izq"),
    "recibo_en": ("#4C1D95", "#F1ECFB", "centro"),
}


# ---------------------------------------------------------------------------- formato
def monto(centavos: int, moneda: str, idioma: str) -> str:
    """Número con el formato del país: COP/CLP sin decimales, inglés y MXN con coma de miles."""
    entero, cent = divmod(abs(centavos), 100)
    sin_decimales = moneda in ("COP", "CLP")
    ingles = idioma == "en" or moneda == "MXN"
    miles = f"{entero:,}"
    if ingles:
        texto = miles if sin_decimales else f"{miles}.{cent:02d}"
    else:
        miles = miles.replace(",", ".")
        texto = miles if sin_decimales else f"{miles},{cent:02d}"
    return f"{moneda} {texto}"


def cifras(texto: str, n: int) -> str:
    """n dígitos estables derivados de `texto` (códigos de autorización ficticios)."""
    return str(int(hashlib.sha256(texto.encode()).hexdigest(), 16))[:n]


def fecha(iso: str, idioma: str) -> str:
    a, m, d = iso.split("-")
    if idioma == "en":
        return f"{MESES_EN[int(m) - 1]} {int(d)}, {a}"
    return f"{d}/{m}/{a}"


# ---------------------------------------------------------------------------- contenido
@dataclass
class Contenido:
    """Lo que dice una factura, ya resuelto (con los cambios de la trampa aplicados)."""

    p: Proveedor
    f: Factura
    nombre: str
    nit: str
    moneda: str
    subtotal: int
    impuesto: int
    total: int
    cuenta: str
    concepto: str
    referencia: str
    correo: str
    idioma: str


def contenido(f: Factura) -> Contenido:
    p = POR_CLAVE[f.proveedor]
    subtotal = f.subtotal if f.subtotal is not None else p.subtotal
    if f.impuesto is not None:
        impuesto = f.impuesto
    elif f.subtotal is not None:
        impuesto = round(subtotal * p.impuesto / p.subtotal)
    else:
        impuesto = p.impuesto
    total = f.total if f.total is not None else subtotal + impuesto
    return Contenido(
        p=p,
        f=f,
        nombre=f.nombre or p.nombre,
        nit=f.nit or p.nit,
        moneda=f.moneda or p.moneda,
        subtotal=subtotal,
        impuesto=impuesto,
        total=total,
        cuenta=f.cuenta or p.cuenta,
        concepto=f.extra.get("concepto", p.concepto),
        referencia=f.extra.get("referencia", p.referencia),
        correo=f.extra.get("correo", p.correo),
        idioma=p.idioma,
    )


ETIQUETAS = {
    "es": {
        "emision": "Fecha de emisión", "vence": "Fecha de vencimiento", "concepto": "Concepto", "ref": "Referencia",
        "cliente": "Facturar a", "pagar": "Pagar a", "subtotal": "Subtotal", "total": "Total a pagar",
        "detalle": ("Descripción", "Cant.", "Valor unitario", "Importe"), "gracias": "Gracias por su pago oportuno.",
    },
    "en": {
        "emision": "Issue date", "vence": "Due date", "concepto": "Description", "ref": "Reference",
        "cliente": "Bill to", "pagar": "Pay to", "subtotal": "Subtotal", "total": "Amount due",
        "detalle": ("Item", "Qty", "Unit price", "Amount"), "gracias": "Thank you for your business.",
    },
    "pt": {
        "emision": "Data de emissão", "vence": "Vencimento", "concepto": "Descrição", "ref": "Referência",
        "cliente": "Faturar para", "pagar": "Beneficiário", "subtotal": "Subtotal", "total": "Valor total",
        "detalle": ("Descrição", "Qtd.", "Valor unitário", "Valor"), "gracias": "Obrigado pela preferência.",
    },
}

TITULO = {
    "electronica_co": ("FACTURA ELECTRÓNICA DE VENTA", "FACTURA N.º"),
    "cuenta_cobro": ("CUENTA DE COBRO", "CUENTA DE COBRO N.º"),
    "cfdi_mx": ("COMPROBANTE FISCAL DIGITAL", "FACTURA N.º"),
    "fatura_br": ("FATURA DE SERVIÇOS", "FATURA N.º"),
    "factura_ar": ("FACTURA E · EXPORTACIÓN DE SERVICIOS", "FACTURA N.º"),
    "factura_cl": ("FACTURA ELECTRÓNICA", "FACTURA N.º"),
    "factura_pe": ("FACTURA ELECTRÓNICA", "FACTURA N.º"),
    "invoice_us": ("INVOICE", "INVOICE #"),
    "factura_es": ("FACTURA", "FACTURA N.º"),
    "recibo_en": ("BILLING STATEMENT", "INVOICE #"),
}

CUENTA_ETIQUETA = {"cuenta": "Cuenta de ahorros", "CLABE": "CLABE", "PIX": "PIX", "CBU": "CBU", "ACH": "Account number"}


def cuenta_texto(c: Contenido) -> str:
    etiqueta = CUENTA_ETIQUETA[c.p.cuenta_tipo]
    if c.p.estilo == "fatura_br":
        etiqueta = "PIX"
    if c.p.estilo == "factura_cl":
        etiqueta = "Cuenta corriente"
    if c.p.estilo == "factura_es":
        etiqueta = "Cuenta"
    return f"{etiqueta}: {c.cuenta}"


def bloques(c: Contenido) -> dict:
    """Renglones de la factura agrupados por zona. Igual para PDF e imagen."""
    e = ETIQUETAS[c.idioma]
    f = c.f
    encabezado, titulo = TITULO[c.p.estilo]
    lineas_emisor = [c.nombre, f"{c.p.nit_etiqueta}: {c.nit}", f"{c.p.ciudad} · {c.correo}"]
    if c.p.estilo == "cuenta_cobro":
        lineas_emisor = [c.nombre, f"{c.p.nit_etiqueta} {c.nit}", f"{c.p.ciudad} · {c.correo}"]
    datos = [
        f"{e['emision']}: {fecha(f.emision, c.idioma)}",
        f"{e['vence']}: {fecha(f.vence, c.idioma)}",
    ]
    cliente = [f"{e['cliente']}: {CLIENTE}", CLIENTE_DIR]
    detalle = [e["detalle"], (c.concepto, "1", monto(c.subtotal, c.moneda, c.idioma), monto(c.subtotal, c.moneda, c.idioma))]
    totales = []
    if c.impuesto:
        totales.append(f"{e['subtotal']}: {monto(c.subtotal, c.moneda, c.idioma)}")
        totales.append(f"{c.p.impuesto_etiqueta}: {monto(c.impuesto, c.moneda, c.idioma)}")
    totales.append(f"{e['total']}: {monto(c.total, c.moneda, c.idioma)}")
    pago = [f"{e['pagar']}: {c.nombre} · {c.p.banco}", cuenta_texto(c)]
    extra = []
    if c.p.estilo == "electronica_co":
        extra.append(f"CUFE: {cifras(f.numero + c.nombre, 40)}")
        extra.append("Régimen común · Autorización DIAN 18764000001234 del 01/01/2026")
    if c.p.estilo == "cfdi_mx":
        extra.append(f"Folio fiscal (UUID): {cifras(f.numero, 8)}-4C21-4B8E-9F3A-{cifras(c.nombre, 12)}")
        extra.append("Uso CFDI: G03 Gastos en general · Método de pago: PUE")
    if c.p.estilo == "factura_ar":
        extra.append(f"CAE N.º {cifras(f.numero, 14)} · Vto. CAE: {fecha(f.vence, 'es')}")
    if c.p.estilo == "factura_pe":
        extra.append("Representación impresa de la factura electrónica · Consulte en sunat.example")
    if c.p.estilo == "factura_cl":
        extra.append("Timbre electrónico SII · Res. 80 de 2014 · Verifique documento en sii.example")
    if c.p.estilo == "fatura_br":
        extra.append("Nota fiscal de serviços eletrônica emitida conforme legislação municipal.")
    if f.nota_visible:
        extra.append(f.nota_visible)
    return {
        "encabezado": encabezado,
        "titulo": f"{titulo} {f.numero}",
        "emisor": lineas_emisor,
        "datos": datos,
        "cliente": cliente,
        "concepto": f"{e['concepto']}: {c.concepto}",
        "referencia": f"{e['ref']}: {c.referencia}",
        "detalle": detalle,
        "totales": totales,
        "pago": pago,
        "extra": extra,
        "gracias": e["gracias"],
    }


# ---------------------------------------------------------------------------- PDF
def _texto(cv: canvas.Canvas, x: float, y: float, s: str, tam: float = 9.5, negrita: bool = False, color: str = "#1F2A24",
           alinear: str = "izq", fuente: str | None = None) -> None:
    cv.setFont(fuente or ("VeraBd" if negrita else "Vera"), tam)
    cv.setFillColor(HexColor(color))
    if alinear == "der":
        cv.drawRightString(x, y, s)
    elif alinear == "centro":
        cv.drawCentredString(x, y, s)
    else:
        cv.drawString(x, y, s)


def _iniciales(nombre: str) -> str:
    palabras = [w for w in nombre.replace(".", " ").split() if w[0].isupper()]
    return "".join(w[0] for w in palabras[:2]) or nombre[:2].upper()


def pdf(f: Factura) -> bytes:
    c = contenido(f)
    b = bloques(c)
    principal, suave, alineacion = ESTILOS[c.p.estilo]
    buf = io.BytesIO()
    cv = canvas.Canvas(buf, pagesize=letter, invariant=1)
    cv.setTitle(b["titulo"])
    cv.setAuthor(c.nombre)
    ancho, alto = letter
    x0, x1 = 54, ancho - 54
    mono = "VeraMono" if c.p.estilo == "recibo_en" else None

    # Encabezado: banda de color, monograma del emisor y título.
    if c.p.estilo in ("electronica_co", "factura_pe", "invoice_us", "recibo_en"):
        cv.setFillColor(HexColor(principal))
        cv.rect(0, alto - 96, ancho, 96, stroke=0, fill=1)
        color_enc, color_sub = "#FFFFFF", "#DDE3EA"
    else:
        cv.setFillColor(HexColor(suave))
        cv.rect(0, alto - 96, ancho, 96, stroke=0, fill=1)
        cv.setFillColor(HexColor(principal))
        cv.rect(0, alto - 100, ancho, 4, stroke=0, fill=1)
        color_enc, color_sub = principal, "#4A5550"
    if alineacion == "centro":
        _texto(cv, ancho / 2, alto - 46, b["encabezado"], 17, True, color_enc, "centro", mono)
        _texto(cv, ancho / 2, alto - 68, c.nombre, 10.5, False, color_sub, "centro", mono)
    else:
        lado_logo = x0 if alineacion == "izq" else x1 - 44
        cv.setFillColor(HexColor(principal if color_enc != "#FFFFFF" else "#FFFFFF"))
        cv.roundRect(lado_logo, alto - 74, 44, 44, 9, stroke=0, fill=1)
        _texto(cv, lado_logo + 22, alto - 58, _iniciales(c.nombre), 15, True, "#FFFFFF" if color_enc != "#FFFFFF" else principal, "centro")
        if alineacion == "izq":
            _texto(cv, x0 + 58, alto - 48, b["encabezado"], 15, True, color_enc)
            _texto(cv, x0 + 58, alto - 66, c.nombre, 10, False, color_sub)
        else:
            _texto(cv, x1 - 58, alto - 48, b["encabezado"], 15, True, color_enc, "der")
            _texto(cv, x1 - 58, alto - 66, c.nombre, 10, False, color_sub, "der")

    y = alto - 130
    # Número de la factura (renglón propio: lo lee el parser).
    _texto(cv, x0, y, b["titulo"], 13, True, principal if color_enc != "#FFFFFF" else "#1F2A24", fuente=mono)
    y -= 26
    # Emisor a la izquierda, fechas a la derecha (cada dato en su renglón).
    for i, linea in enumerate(b["emisor"]):
        _texto(cv, x0, y - i * 15, linea, 9.5, i == 0, fuente=mono)
    for i, linea in enumerate(b["datos"]):
        _texto(cv, x1, y - i * 15, linea, 9.5, False, alinear="der", fuente=mono)
    y -= 15 * max(len(b["emisor"]), len(b["datos"])) + 16
    # Cliente.
    cv.setFillColor(HexColor(suave))
    cv.roundRect(x0, y - 34, x1 - x0, 44, 8, stroke=0, fill=1)
    _texto(cv, x0 + 12, y - 6, b["cliente"][0], 9.5, True, fuente=mono)
    _texto(cv, x0 + 12, y - 22, b["cliente"][1], 9, color="#4A5550", fuente=mono)
    y -= 62
    # Concepto (renglón propio).
    _texto(cv, x0, y, b["concepto"], 10, False, fuente=mono)
    y -= 16
    _texto(cv, x0, y, b["referencia"], 9.5, False, "#4A5550", fuente=mono)
    y -= 26
    # Detalle en tabla.
    cols = [x0 + 8, x0 + 290, x0 + 340, x1 - 8]
    cv.setFillColor(HexColor(principal))
    cv.rect(x0, y - 6, x1 - x0, 20, stroke=0, fill=1)
    for i, h in enumerate(b["detalle"][0]):
        _texto(cv, cols[i], y, h, 8.5, True, "#FFFFFF", "der" if i == 3 else "izq", mono)
    y -= 22
    fila = b["detalle"][1]
    _texto(cv, cols[0], y, fila[0][:46], 9, fuente=mono)
    _texto(cv, cols[1], y, fila[1], 9, fuente=mono)
    _texto(cv, cols[2], y, fila[2], 9, fuente=mono)
    _texto(cv, cols[3], y, fila[3], 9, alinear="der", fuente=mono)
    cv.setStrokeColor(HexColor("#D5D9D3"))
    cv.line(x0, y - 10, x1, y - 10)
    y -= 34
    # Totales a la derecha.
    for i, linea in enumerate(b["totales"]):
        ultima = i == len(b["totales"]) - 1
        _texto(cv, x1, y, linea, 11 if ultima else 9.5, ultima, alinear="der", fuente=mono)
        y -= 17
    y -= 14
    # Pago.
    cv.setStrokeColor(HexColor(principal))
    cv.setLineWidth(1)
    cv.roundRect(x0, y - 36, x1 - x0, 50, 8, stroke=1, fill=0)
    _texto(cv, x0 + 12, y - 4, b["pago"][0], 9.5, True, fuente=mono)
    _texto(cv, x0 + 12, y - 22, b["pago"][1], 9.5, fuente=mono)
    y -= 66
    for linea in b["extra"]:
        _texto(cv, x0, y, linea, 8, color="#5B6661", fuente=mono)
        y -= 13
    if f.nota_oculta:
        # Texto blanco de 4 pt: invisible al imprimir, pero está en la capa de texto del PDF.
        cv.setFont("Vera", 4)
        cv.setFillColor(white)
        cv.drawString(x0, y - 4, f.nota_oculta)
    _texto(cv, ancho / 2, 40, b["gracias"], 8.5, color="#8A938E", alinear="centro")
    cv.showPage()
    cv.save()
    return buf.getvalue()


def pdf_folleto(f: Factura) -> bytes:
    """Folleto comercial: sin montos ni palabras de cobro (la app debe decir que no es factura)."""
    p = POR_CLAVE[f.proveedor]
    buf = io.BytesIO()
    cv = canvas.Canvas(buf, pagesize=letter, invariant=1)
    ancho, alto = letter
    cv.setFillColor(HexColor("#7A1F3D"))
    cv.rect(0, alto - 220, ancho, 220, stroke=0, fill=1)
    _texto(cv, 54, alto - 90, p.nombre, 24, True, "#FFFFFF")
    _texto(cv, 54, alto - 124, "Nuevas rutas 2027: llegamos a todo el sureste", 15, False, "#F8EBF0")
    y = alto - 280
    for linea in [
        "Desde enero conectamos Mérida, Campeche, Chetumal y Cancún con salidas diarias.",
        "Rastreo en línea de cada envío, con aviso por WhatsApp cuando llega a destino.",
        "Bodega nueva en Progreso con temperatura controlada para mercancía delicada.",
        "Equipo de atención disponible de lunes a sábado, de 8:00 a 20:00.",
        "Escríbenos para conocer los horarios de recolección en tu zona.",
    ]:
        _texto(cv, 54, y, f"•  {linea}", 11)
        y -= 26
    _texto(cv, 54, y - 30, p.correo, 11, True, "#7A1F3D")
    cv.showPage()
    cv.save()
    return buf.getvalue()


# ---------------------------------------------------------------------------- imagen
def _fuente(tam: int, negrita: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(NEGRITA if negrita else FUENTE, tam)


def hoja(f: Factura) -> Image.Image:
    """La misma factura como hoja impresa (para foto o escaneo)."""
    c = contenido(f)
    b = bloques(c)
    principal, suave, _ = ESTILOS[c.p.estilo]
    W, H = 1275, 1650
    img = Image.new("RGB", (W, H), "#FFFFFF")
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 170], fill=suave)
    d.rectangle([0, 170, W, 178], fill=principal)
    d.rounded_rectangle([70, 45, 160, 135], 18, fill=principal)
    d.text((115, 90), _iniciales(c.nombre), font=_fuente(40, True), fill="#FFFFFF", anchor="mm")
    d.text((190, 62), b["encabezado"], font=_fuente(34, True), fill=principal)
    d.text((190, 112), c.nombre, font=_fuente(24), fill="#4A5550")
    y = 230
    d.text((70, y), b["titulo"], font=_fuente(34, True), fill="#1F2A24")
    y += 70
    for i, linea in enumerate(b["emisor"]):
        d.text((70, y + i * 36), linea, font=_fuente(24, i == 0), fill="#1F2A24")
    for i, linea in enumerate(b["datos"]):
        d.text((W - 70, y + i * 36), linea, font=_fuente(24), fill="#1F2A24", anchor="ra")
    y += 36 * 3 + 40
    d.rounded_rectangle([70, y, W - 70, y + 100], 14, fill=suave)
    d.text((95, y + 18), b["cliente"][0], font=_fuente(24, True), fill="#1F2A24")
    d.text((95, y + 56), b["cliente"][1], font=_fuente(22), fill="#4A5550")
    y += 140
    d.text((70, y), b["concepto"], font=_fuente(25), fill="#1F2A24")
    y += 40
    d.text((70, y), b["referencia"], font=_fuente(23), fill="#4A5550")
    y += 56
    d.rectangle([70, y, W - 70, y + 50], fill=principal)
    cols = [90, 720, 830, W - 90]
    for i, h in enumerate(b["detalle"][0]):
        d.text((cols[i], y + 12), h, font=_fuente(21, True), fill="#FFFFFF", anchor="ra" if i == 3 else "la")
    y += 70
    fila = b["detalle"][1]
    d.text((cols[0], y), fila[0][:40], font=_fuente(22), fill="#1F2A24")
    d.text((cols[1], y), fila[1], font=_fuente(22), fill="#1F2A24")
    d.text((cols[2], y), fila[2], font=_fuente(22), fill="#1F2A24")
    d.text((cols[3], y), fila[3], font=_fuente(22), fill="#1F2A24", anchor="ra")
    d.line([70, y + 45, W - 70, y + 45], fill="#D5D9D3", width=2)
    y += 85
    for i, linea in enumerate(b["totales"]):
        ultima = i == len(b["totales"]) - 1
        d.text((W - 70, y), linea, font=_fuente(30 if ultima else 24, ultima), fill="#1F2A24", anchor="ra")
        y += 46
    y += 30
    d.rounded_rectangle([70, y, W - 70, y + 120], 14, outline=principal, width=3)
    d.text((95, y + 22), b["pago"][0], font=_fuente(24, True), fill="#1F2A24")
    d.text((95, y + 66), b["pago"][1], font=_fuente(24), fill="#1F2A24")
    y += 160
    for linea in b["extra"]:
        d.text((70, y), linea[:95], font=_fuente(19), fill="#5B6661")
        y += 32
    d.text((W / 2, H - 70), b["gracias"], font=_fuente(21), fill="#8A938E", anchor="mm")
    return img


def imagen(f: Factura, semilla: int) -> bytes:
    """Hoja con efecto: `escaneo` (recta, gris suave), `foto` (girada sobre una mesa), `borroso` (movida, ilegible)."""
    rnd = random.Random(semilla)
    h = hoja(f)
    if f.efecto == "escaneo":
        h = h.convert("L").filter(ImageFilter.GaussianBlur(0.6)).convert("RGB")
        ruido = Image.effect_noise(h.size, 6).convert("RGB")
        h = Image.blend(h, ruido, 0.04).rotate(rnd.uniform(-0.6, 0.6), expand=False, fillcolor="#FFFFFF")
        salida = h.resize((1020, 1320))
    else:
        angulo = rnd.uniform(-3.2, 3.2)
        girada = h.rotate(angulo, expand=True, fillcolor="#6B5B4D")
        fondo = Image.new("RGB", (girada.width + 160, girada.height + 160), "#6B5B4D")
        sombra = Image.new("RGB", girada.size, "#3C3229")
        fondo.paste(sombra, (95, 100))
        fondo = fondo.filter(ImageFilter.GaussianBlur(14))
        fondo.paste(girada, (80, 80))
        # Viñeta suave: los bordes un poco más oscuros, como una foto con el teléfono.
        vineta = Image.radial_gradient("L").resize(fondo.size).point(lambda v: int(v * 0.38))
        fondo = Image.composite(Image.new("RGB", fondo.size, "#1E1914"), fondo, vineta)
        if f.efecto == "borroso":
            fondo = fondo.filter(ImageFilter.BoxBlur(9)).filter(ImageFilter.GaussianBlur(4))
        else:
            fondo = fondo.filter(ImageFilter.GaussianBlur(0.8))
        salida = fondo.resize((int(fondo.width * 0.72), int(fondo.height * 0.72)))
    buf = io.BytesIO()
    if f.formato == "jpg":
        salida.save(buf, "JPEG", quality=82, optimize=True)
    else:
        salida.save(buf, "PNG", optimize=True)
    return buf.getvalue()
