"use client";

import { useEffect, useRef, useState } from "react";
import { BedDouble, Construction, Lock, Truck, Wallet, type LucideIcon } from "lucide-react";
import { HERO_SCENES } from "./content";
import { EXPO, MOTION_OK, gsap, useGSAP } from "./gsap";

const ICONS: Record<(typeof HERO_SCENES)[number]["icon"], LucideIcon> = {
  bed: BedDouble,
  construction: Construction,
  truck: Truck,
  wallet: Wallet,
};

/*
 * «El puente»: el dibujo del héroe de la portada.
 *
 * Dos organizaciones, cada una en su tarjeta con sus datos reservados (el nombre del
 * dato y una barra rayada en lugar del valor, con candado). Una frontera punteada
 * las separa y la única puerta es Sculptor, al centro, con la cosa que escasea.
 * De cada dato sale un haz de luz que llega a Sculptor y no sigue: lo que viaja es
 * una señal, nunca el valor. Los rubros rotan (cama UCI, grúa, camión, presupuesto)
 * para decir que sirve en cualquier parte.
 *
 * Técnica: «Animated Beam Integration» de 21st.dev (id 34961, nodos a cada lado que
 * mandan haces a un centro), rehecha en un solo SVG con GSAP en vez de framer-motion
 * y sin medir el DOM: todo vive en el mismo sistema de coordenadas (560 × 400), y
 * los textos HTML se ubican con porcentajes de ese mismo lienzo.
 */

const W = 560;
const H = 400;
const HUB = { x: 280, y: 196, size: 88 };
const CARD = { y: 86, w: 160, h: 236 };
const LEFT_X = 12;
const RIGHT_X = W - 12 - CARD.w;
const ROWS = [0, 1, 2];
const rowY = (i: number) => 186 + i * 50;
const RING_R = 74;
/** Largo de la vuelta del anillo, menos un respiro para que el último punto no toque la primera S. */
const RING_LEN = Math.round(2 * Math.PI * RING_R - 12);
const hubL = HUB.x - HUB.size / 2;
const hubR = HUB.x + HUB.size / 2;
const portL = LEFT_X + CARD.w;
const portR = RIGHT_X;
const beamL = (i: number) => `M${portL} ${rowY(i)} C ${portL + 36} ${rowY(i)}, ${hubL - 30} ${HUB.y}, ${hubL} ${HUB.y}`;
const beamR = (i: number) => `M${portR} ${rowY(i)} C ${portR - 36} ${rowY(i)}, ${hubR + 30} ${HUB.y}, ${hubR} ${HUB.y}`;

/** Posición en % del lienzo, para ubicar HTML sobre el SVG. */
const px = (x: number) => `${(x / W) * 100}%`;
const py = (y: number) => `${(y / H) * 100}%`;

const SIDES = [
  { key: "a", x: LEFT_X, color: "var(--brand)" },
  { key: "b", x: RIGHT_X, color: "var(--clash)" },
] as const;

export function BridgeDrawing() {
  const [index, setIndex] = useState(0);
  const scene = HERO_SCENES[index];
  const Icon = ICONS[scene.icon];
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!window.matchMedia(MOTION_OK).matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % HERO_SCENES.length), 4600);
    return () => window.clearInterval(id);
  }, []);

  // Movimiento continuo: los haces viajan de cada dato a Sculptor, el anillo gira
  // y Sculptor responde con una onda cada vez que llegan.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const period = 2.4;
        gsap.utils.toArray<SVGPathElement>(".br-beam").forEach((beam) => {
          const row = Number(beam.dataset.row);
          gsap.fromTo(
            beam,
            { strokeDashoffset: 26 },
            { strokeDashoffset: -100, duration: 1.5, ease: "power2.in", repeat: -1, repeatDelay: period - 1.5, delay: row * 0.14 },
          );
        });
        gsap.fromTo(
          ".br-ripple",
          { attr: { r: 46 }, opacity: 0.55 },
          { attr: { r: 112 }, opacity: 0, duration: 1.6, ease: "power2.out", repeat: -1, repeatDelay: period - 1.6, delay: 1.45 },
        );
        gsap.fromTo(".br-hub", { scale: 1 }, { scale: 1.06, duration: 0.18, yoyo: true, repeat: -1, repeatDelay: period - 0.18, delay: 1.45, ease: "sine.out", transformOrigin: "50% 50%" });
        gsap.to(".br-orbit", { rotation: 360, svgOrigin: `${HUB.x} ${HUB.y}`, duration: 40, ease: "none", repeat: -1 });
        gsap.to(".br-dash", { rotation: -360, svgOrigin: `${HUB.x} ${HUB.y}`, duration: 26, ease: "none", repeat: -1 });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  // En cada escena: los nombres y los datos entran, las barras rayadas se tienden.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const tl = gsap.timeline({ defaults: { ease: EXPO } });
        tl.fromTo(".br-text", { opacity: 0, y: 6, filter: "blur(6px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7, stagger: 0.04 }, 0)
          .fromTo(".br-bar", { scaleX: 0 }, { scaleX: 1, duration: 0.8, stagger: 0.05, transformOrigin: "0% 50%" }, 0.1)
          .fromTo(".br-icon", { scale: 0.6, opacity: 0, rotate: -20 }, { scale: 1, opacity: 1, rotate: 0, duration: 0.9, ease: "back.out(2)" }, 0.05);
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [index], revertOnUpdate: true },
  );

  return (
    <figure ref={root} className="relative mx-auto w-full max-w-[39rem]" aria-label="Dos organizaciones conectadas a través de Sculptor">
      <div className="relative" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full overflow-visible" aria-hidden>
          <defs>
            <pattern id="br-dots" width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="var(--foreground)" fillOpacity="0.16" />
            </pattern>
            <radialGradient id="br-fade" cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor="#fff" stopOpacity="1" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <mask id="br-fade-mask">
              <rect width={W} height={H} fill="url(#br-fade)" />
            </mask>
            <pattern id="br-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="currentColor" fillOpacity="0.1" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeOpacity="0.45" strokeWidth="2.4" />
            </pattern>
            <radialGradient id="br-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
            </radialGradient>
            <filter id="br-blur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <path id="br-ring-path" d={`M ${HUB.x} ${HUB.y - RING_R} a ${RING_R} ${RING_R} 0 1 1 -0.01 0`} />
          </defs>

          {/* Fondo: grilla de puntos que se desvanece hacia los bordes. */}
          <rect width={W} height={H} fill="url(#br-dots)" mask="url(#br-fade-mask)" />
          <circle cx={HUB.x} cy={HUB.y} r="140" fill="url(#br-glow)" />

          {/* La frontera: nada la cruza, salvo por Sculptor. */}
          <g stroke="var(--foreground)" strokeOpacity="0.22" strokeWidth="1.2" strokeDasharray="2 6" strokeLinecap="round">
            <line x1={HUB.x} y1="8" x2={HUB.x} y2={HUB.y - 84} />
            <line x1={HUB.x} y1={HUB.y + 84} x2={HUB.x} y2={H - 8} />
          </g>

          {/* Las dos organizaciones. */}
          {SIDES.map((s) => (
            <g key={s.key}>
              <rect x={s.x} y={CARD.y} width={CARD.w} height={CARD.h} rx="22" fill="var(--card)" fillOpacity="0.92" stroke="var(--border)" strokeWidth="1.2" />
              <rect x={s.x + 22} y={CARD.y - 1} width={CARD.w - 44} height="3" rx="1.5" fill={s.color} />
              {ROWS.map((i) => (
                <g key={i} className="br-bar" style={{ color: s.color }}>
                  <rect x={s.x + 16} y={rowY(i) - 6} width={CARD.w - 32} height="12" rx="6" fill="url(#br-hatch)" />
                </g>
              ))}
            </g>
          ))}

          {/* Haces: el camino tenue siempre; el cometa lo recorre del dato a Sculptor. */}
          {ROWS.map((i) => (
            <g key={i} fill="none" strokeLinecap="round">
              <path d={beamL(i)} stroke="var(--brand)" strokeOpacity="0.22" strokeWidth="1.2" />
              <path d={beamR(i)} stroke="var(--clash)" strokeOpacity="0.22" strokeWidth="1.2" />
              <path className="br-beam" data-row={i} d={beamL(i)} pathLength={100} stroke="var(--brand)" strokeWidth="2.8" strokeDasharray="26 100" strokeDashoffset="-40" filter="url(#br-blur)" />
              <path className="br-beam" data-row={i} d={beamR(i)} pathLength={100} stroke="var(--clash)" strokeWidth="2.8" strokeDasharray="26 100" strokeDashoffset="-40" filter="url(#br-blur)" />
            </g>
          ))}
          {ROWS.map((i) => (
            <g key={`p${i}`}>
              <circle cx={portL} cy={rowY(i)} r="4" fill="var(--card)" stroke="var(--brand)" strokeWidth="1.6" />
              <circle cx={portR} cy={rowY(i)} r="4" fill="var(--card)" stroke="var(--clash)" strokeWidth="1.6" />
            </g>
          ))}

          {/* Sculptor: el anillo con su nombre, la órbita punteada y la onda. */}
          <circle className="br-ripple" cx={HUB.x} cy={HUB.y} r="46" fill="none" stroke="var(--brand)" strokeWidth="1.6" opacity="0" />
          <g className="br-dash">
            <circle cx={HUB.x} cy={HUB.y} r="60" fill="none" stroke="var(--brand)" strokeOpacity="0.45" strokeWidth="1.2" strokeDasharray="1 7" strokeLinecap="round" />
          </g>
          <g className="br-orbit">
            <text fontSize="9.5" fontWeight="700" fill="var(--muted-foreground)" fillOpacity="0.75">
              {/* textLength reparte el texto justo en la vuelta completa, sin que se monte. */}
              <textPath href="#br-ring-path" textLength={RING_LEN} lengthAdjust="spacing">
                SCULPTOR · SCULPTOR · SCULPTOR · SCULPTOR ·
              </textPath>
            </text>
          </g>
          <g className="br-hub">
            <rect x={hubL} y={HUB.y - HUB.size / 2} width={HUB.size} height={HUB.size} rx="28" fill="var(--foreground)" />
            <rect x={hubL + 0.75} y={HUB.y - HUB.size / 2 + 0.75} width={HUB.size - 1.5} height={HUB.size - 1.5} rx="27.25" fill="none" stroke="var(--background)" strokeOpacity="0.18" strokeWidth="1.5" />
          </g>
        </svg>

        {/* Textos en HTML, ubicados con el mismo lienzo. */}
        {SIDES.map((s) => (
          <div key={s.key} className="pointer-events-none absolute" style={{ left: px(s.x), width: px(CARD.w), top: py(CARD.y), height: py(CARD.h) }}>
            <div className="flex h-[22%] items-center px-[10%]">
              <p key={`${s.key}-${index}`} className="br-text text-[11px] font-bold leading-tight text-foreground sm:text-sm">
                {s.key === "a" ? scene.a : scene.b}
              </p>
            </div>
            {ROWS.map((i) => (
              <p
                key={`${s.key}-${index}-${i}`}
                className="br-text absolute flex items-center gap-1 text-[10px] font-semibold leading-none text-muted-foreground sm:text-xs"
                style={{ left: "10%", top: `${((rowY(i) - 24 - CARD.y) / CARD.h) * 100}%` }}
              >
                <Lock className="size-[1.05em]" style={{ color: s.color }} aria-hidden />
                {scene.data[i]}
              </p>
            ))}
          </div>
        ))}

        <div className="pointer-events-none absolute grid place-items-center" style={{ left: px(hubL), top: py(HUB.y - HUB.size / 2), width: px(HUB.size), height: py(HUB.size) }}>
          <Icon key={`i-${index}`} className="br-icon size-[42%] text-background" strokeWidth={1.75} aria-hidden />
        </div>

        <div className="pointer-events-none absolute inset-x-0 flex flex-col items-center gap-1" style={{ top: py(HUB.y + 92) }}>
          <span key={`r-${index}`} className="br-text rounded-full border border-border bg-card px-3 py-1 text-xs font-bold whitespace-nowrap shadow-sm sm:text-sm">
            {scene.resource}
          </span>
          {"tag" in scene && scene.tag ? (
            <span key={`t-${index}`} className="br-text text-[11px] font-semibold text-clash sm:text-xs">
              {scene.tag}
            </span>
          ) : null}
        </div>
      </div>
      <figcaption className="sr-only">
        Ejemplos: dos hospitales y una cama UCI; dos constructoras y una grúa; dos distribuidoras y un camión; dos áreas y un presupuesto.
        Los datos de cada organización quedan en su lado, con candado; solo una señal llega a Sculptor, que está al centro con lo que escasea.
      </figcaption>
    </figure>
  );
}
