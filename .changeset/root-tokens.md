---
'tokens-to-css': minor
---

Lee `$root`, el token propio de un grupo, en lugar de descartarlo en silencio

El lector DTCG trataba como metadata **toda** clave que empezara por `$`, y el
recorrido del árbol hacía `continue` sobre ella antes de mirar lo que colgaba
debajo. Un nodo cuya clave empieza por `$` pero que lleva `$value` es un token, y
desaparecía: no se emitía, no se contaba y tampoco se reportaba en `skipped`. Era
exactamente el descarte silencioso en un camino de éxito que FR-20 y FR-24
existen para impedir.

`$root` no es una convención de Terrazzo ni de Figma SDS: el spec DTCG (2025.10,
§6.2) lo define como **nombre de token reservado** para el valor propio de un
grupo. Medido sobre `terrazzoapp/dtcg-examples` (108 ficheros JSON), es la única
clave `$`-prefijada que lleva `$value` en todo el corpus, y esconde 56 tokens —
28 en `figma-sds/theme-light.tokens.json` y 28 en `theme-dark.tokens.json`, el
color base de cada grupo semántico.

**El path conserva el segmento; el nombre lo elide.** Son las dos mitades de la
decisión y van separadas a propósito:

- El path del token sigue siendo `color.background.brand.$root`, que es lo que
  dice §6.7.2 palabra por palabra. Así un alias escrito `{color.brand.$root}`
  resuelve, y los mensajes de error y las entradas de `skipped` nombran el token
  como lo escribió el documento.
- La regla de nombres elide el segmento: `--color-background-brand`. En CSS no
  hay grupos, así que el nombre del valor propio de un grupo es el nombre del
  grupo.

Elidirlo en el *path* habría sido incorrecto: dejaría colgando
`{color.brand.$root}` y afirmaría un token en `color.brand`, que el spec declara
inválido para resolución.

Esto **añade** nombres, no cambia ninguno. Ningún path podía contener `$root`
antes, porque esos tokens se descartaban antes de nombrarse — así que el
contrato de nombres congelado por semver (`src/emit/name.ts`) sigue produciendo
exactamente lo mismo para toda entrada que ya lo alcanzaba. Las colisiones las
sigue cazando FR-21.

Además, una clave `$`-prefijada que **no** es `$root` ni metadata conocida y que
lleva un `$value` directo ahora se rechaza por su nombre (`FORMAT_NOT_ALLOWED`)
en vez de desaparecer. `$type`, `$description`, `$extensions`, `$deprecated`,
`$extends` y `$ref` quedan exentas y no se inspeccionan: `$extensions` sobre todo,
porque guarda datos de terceros que el spec obliga a preservar y que pueden
contener un `$value` anidado que no es un token.
