"use client";

// Animación de la landing. Todo pasa por aquí para registrar los plugins una vez.
// Cada animación se arma dentro de gsap.matchMedia(MOTION_OK): si la persona pidió
// menos movimiento, no corre ninguna y la página queda quieta y completa.

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

/** Una sola familia de curvas: salida exponencial. */
export const EXPO = "expo.out";

/** Solo hay movimiento para quien no pidió reducirlo. */
export const MOTION_OK = "(prefers-reduced-motion: no-preference)";

export { gsap, ScrollTrigger, SplitText, useGSAP };
