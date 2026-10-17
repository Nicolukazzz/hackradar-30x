# Generador del dataset

Genera todo `data/` (datos comunes + escenarios) y lo verifica. Contrato: `docs/especificacion.md` §11.

## Uso

```bash
python3 -m venv .venv
.venv/bin/pip install -r scripts/dataset/requirements.txt
.venv/bin/python scripts/dataset/generar.py      # regenera data/ y verifica; exit 1 si algo no cuadra
.venv/bin/pytest scripts/dataset -q              # 27 tests
```

`--salida <carpeta>` escribe en otro lugar (lo usan los tests). `--silencioso` omite la tabla resumen.

## Módulos

| Archivo | Qué hace |
|---|---|
| `mundo.py` | Mundo ficticio: empresa, aprobadores, reglas v6/v7, tasas, bancos permitidos, 14 beneficiarios, emisores externos |
| `escenarios.py` | Historial previo y documentos de cada escenario, con su **respuesta esperada escrita a mano** |
| `textos.py` | Etiquetas por idioma (es, en, pt) y texto visible de cada documento |
| `render.py` | PDF (reportlab), foto PNG (Pillow), correo `.eml` y chat `.txt` |
| `registro.py` | Construye `Extraccion` y `EntradaRegistro` (§3, §9) |
| `oraculo.py` | Segunda implementación mínima de las reglas R1–R11: recalcula cada decisión |
| `verificar.py` | Oráculo = esperado, aritmética del lote demo = §11.4, archivos completos, cobertura de trampas, solo datos ficticios |
| `generar.py` | Orquesta todo y escribe `data/` |

## Garantías

- **Determinista:** mismas versiones de `requirements.txt` ⇒ mismos bytes (reportlab `invariant`, semillas fijas, Message-ID y boundary fijos). El test `test_data_versionada_esta_al_dia` falla si alguien cambia el generador y no regenera `data/`.
- **Doble verificación:** cada decisión esperada está escrita a mano en `escenarios.py` y además la recalcula `oraculo.py`. Si no coinciden, el generador falla con el detalle regla por regla.
- **Lote demo = prototipo:** disponibles antes de cada factura y cierre (pagado 7.444,05 · reservado 9.278,65 · disponible 2.277,30) se comparan con la especificación.

## Agregar una factura

1. Agregar un `doc(...)` en `escenarios.py` (nuevo escenario si la trampa interfiere con el presupuesto de otro).
2. Escribir su `esperado(...)` a mano, sin mirar el oráculo.
3. Correr `generar.py`. Si el oráculo discrepa, revisar primero la regla en la especificación, no "arreglar" el esperado.
4. Correr `pytest`, commitear `scripts/` y `data/` juntos.

El oráculo **no** reemplaza al motor del producto (`src/reglas`, #5): es solo una comprobación del dataset.
