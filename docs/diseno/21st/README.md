# Componentes de 21st.dev elegidos para Sculptor

Código descargado de 21st.dev (cuenta del equipo) para adaptar a la paleta oficial
(docs/DISENO.md). Sirven para las páginas de caso (/casos/*) y, si Ramón quiere,
para la landing general.

| Archivo | Componente | Uso en Sculptor |
|---|---|---|
| 34961.md | Animated Beam Integration | Organizaciones (Clínica, Hospital Rural, Comité) a la izquierda y canales (WhatsApp, voz, acta) a la derecha, con rayos que convergen en Sculptor al centro: la idea multijugador en una imagen. |
| 1081.md | Container Scroll Animation | Captura real de la pantalla grande que gira en 3D al hacer scroll: muestra el producto sin texto. |
| 9594.md | Bento grid 01 (oscuro) | «Qué ve cada uno»: tarjetas con candados para los datos reservados, o «Sculptor sirve para más» con los rubros. |
| 45143.md | Spotlight Hero con tipografía cinética | Héroe: frase corta que aparece palabra por palabra con un foco que sigue al mouse. |

Los cuatro usan framer-motion. Antes de agregar la dependencia, preferir adaptar
con GSAP (ya instalado) o CSS; si no se puede, agregar `motion`.

## Segunda búsqueda (24 categorías, 95 componentes revisados)

### Para la landing de Sculptor (Ramón)

| Archivo | Componente | Por qué |
|---|---|---|
| 29928.md | Shader Dithering | Fondo animado en dithering ordenado: la misma estética de 1 bit del logo (galaxia en píxeles). Recolorear a verde oscuro, eucalipto y lima. Sin dependencias. |
| 18257.md | Particle Galaxy | Galaxia espiral 3D de partículas que se puede rotar: el héroe perfecto para «NGC 253». Usa three.js: cargar diferido solo en el héroe. |
| 4518.md | Logo Particles | El logo se dispersa en partículas al pasar el mouse y vuelve: complemento del logo en píxeles. Sin dependencias. |
| 46517.md | X-Ray Figma Cursor | Cursores multijugador estilo Figma: muestra «varias personas en la misma sala» en la landing. Usa GSAP (ya instalado). |
| 18575.md | Encrypted Text | Texto que se desordena y se descifra: para la idea «cada uno ve solo lo suyo». Sin dependencias. |

### Para la página del caso (hospitales y otros rubros)

| Archivo | Componente | Por qué |
|---|---|---|
| 18041.md | Scroll 01 | Imagen fija a un lado que cambia mientras se hace scroll: contar los 3 pasos con capturas reales de la pantalla grande. |
| 20020.md | Phone Mockups 1 | Carrusel de iPhones: mostrar los celulares de la Clínica, el Hospital Rural y el Comité. |
| 20459.md | Number Ticker | Números que cuentan: 0,52 contra 0,53, decidido en 103 s. |
| 18575.md | Encrypted Text | Los datos reservados aparecen cifrados y nunca se descifran para quien no debe verlos. |
| 29394.md | Activity Feed | Línea de tiempo del acta: quién hizo qué y cuándo. |
| 9386.md | Reading Text Reveal | Frase clave que se ilumina palabra por palabra al hacer scroll. |
