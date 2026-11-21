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
