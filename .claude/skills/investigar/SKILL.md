---
name: investigar
description: Investigar un tema para el hackathon y guardar hallazgos en docs/research/. Usar cuando alguien del equipo diga "investiga", "averigua", "qué existe sobre", "cómo lo hacen otros" o pida comparar enfoques para el reto.
argument-hint: <tema o pregunta>
---

Tema: $ARGUMENTS

1. Leer `CLAUDE.md`, `docs/decisiones.md` y `ls docs/research/` para no repetir lo ya investigado. Si existe archivo del tema, ampliarlo en vez de crear otro.
2. Formular la pregunta concreta que responde la investigación y qué decisión del proyecto destraba.
3. Buscar (WebSearch/WebFetch, context7 para docs de librerías). Preferir fuentes primarias. Anotar URL de cada dato.
4. Escribir `docs/research/<tema-kebab>.md`:

```markdown
# <Tema>
Fecha: AAAA-MM-DD · Autor: <iniciales si se saben>

## Pregunta
## Hallazgos
- dato concreto — [fuente](url)
## Implicación para el proyecto
Qué cambia en diseño, alcance o demo. Relacionar con criterios: autonomía, seguridad, explicabilidad.
## Preguntas abiertas
```

5. Si el hallazgo sugiere decisión, proponerla y ofrecer `/registrar-decision`. No marcarla aceptada sin confirmación del usuario.
6. Responder en chat con resumen de 3-5 líneas + ruta del archivo.
