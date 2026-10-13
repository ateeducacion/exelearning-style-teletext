# eXeTexto

- `theme/` es la fuente del estilo (nombre interno `teletext`); la raíz es el ejemplo ELPX descomprimido.
- No modificar eXeLearning ni los otros repositorios de estilos para arreglar eXeTexto.
- Los ocho colores del teletexto y nada más: negro, rojo, verde, amarillo, azul, magenta, cian
  y blanco. Texto oscuro sobre amarillo, verde, cian, magenta y blanco; blanco sobre azul y
  sobre el rojo `--tt-red-key` (#e00000, 5:1). Sin negrita ni cursiva: el énfasis es color.
- Bedstead (Font Library, CC0) en `theme/fonts/`: la ultracondensada al doble de tamaño es la
  doble altura. No forzar mayúsculas: Bedstead dibuja las mayúsculas acentuadas como minúsculas.
- `style.js` añade `html.tt-js` en el `<head>` y monta la pantalla en `body.exe-web-site`
  después de los manejadores `ready` de eXeLearning (el buscador ya existe). Mueve nodos
  (índice, cabecera, cajas `tt-side`, botones de navegación); no clona ni reescribe iDevices.
- Las teclas y el tecleo de números no actúan dentro de campos ni de iDevices que no sean de texto.
- Sin JavaScript, en el editor o al imprimir, el contenido se lee como página normal; el negro
  va en `.exe-content`, así que el editor también lo hereda.
- Los iconos se regeneran con `NODE_PATH=/ruta/a/exelearning/node_modules node scripts/pixel_icons.cjs /ruta/a/exelearning/public/files/perm/themes/base/zen/icons`
  y las ilustraciones con `python3 scripts/pixel_art.py`.
- El enlace «Edit with eXeLearning» es sólo del ejemplo publicado: vive en `edit-in-exelearning.js`
  (raíz) y `package.py` lo enlaza en el HTML. Nunca en `theme/`, o saldría en los recursos exportados.
- `python3 scripts/package.py` reconstruye ambos paquetes, el manifiesto de descarga y el enlace anterior.
- Validar con `python3 scripts/check.py` y `NODE_PATH=/ruta/a/exelearning/node_modules node scripts/check-browser.cjs`.
- Para regenerar el HTML del ejemplo, usar el CLI de eXeLearning desde su propio directorio:
  `bun dist/cli.js elp:export /ruta/al/ciclo-del-agua.elpx /tmp/teletext elpx` y copiar
  `index.html`, `html/`, `search_index.js`, `libs/` e `idevices/` (no el `content.xml`).
- Licencias: repositorio, estilo y ejemplo CC0; Bedstead CC0; iconos Apache 2.0 (`theme/icons/LICENSE.txt`).
