"use client";

// pⁿ contra la compuerta humana. La sección se fija mientras se baja: la curva
// autónoma se desploma, la híbrida se sostiene y los porcentajes cuentan con el
// scroll. Todos los números vienen del motor (data.ts), no de este archivo.

import { useRef } from "react";
import { MOTION_OK, gsap, useGSAP } from "@/components/landing/gsap";
import { RELIABILITY } from "./content";
import type { SculptorData } from "./data";

const W = 560;
const H = 320;
const MAX_N = 24;

const pct = (v: number) => `${(v * 100).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

function curve(f: (n: number) => number) {
  const pts: string[] = [];
  for (let n = 0; n <= MAX_N; n++) pts.push(`${(n / MAX_N) * W},${H - f(n) * H}`);
  return `M${pts.join(" L")}`;
}

export function Reliability({ single, cross }: Pick<SculptorData, "single" | "cross">) {
  const root = useRef<HTMLElement>(null);
  const step = 1 - (1 - single.p) * (1 - single.h);
  const auto = curve((n) => single.p ** n);
  const hybrid = curve((n) => step ** n);
  const mx = (single.n / MAX_N) * W;

  useGSAP(
    () => {
      const counters = gsap.utils.toArray<HTMLElement>("[data-pct]");
      const setAll = (k: number) =>
        counters.forEach((el) => {
          const to = Number(el.dataset.pct);
          el.textContent = pct(1 + (to - 1) * k);
        });

      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const wide = window.matchMedia("(min-width: 1024px)").matches;
        const k = { v: 0 };
        const tl = gsap.timeline({
          scrollTrigger: wide
            ? { trigger: root.current, start: "top top", end: "+=140%", pin: true, scrub: 1 }
            : { trigger: root.current, start: "top 70%", end: "bottom 60%", scrub: 1 },
        });
        tl.fromTo("[data-path]", { strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: "none", duration: 1, stagger: 0.1 });
        tl.to(k, { v: 1, ease: "none", duration: 1, onUpdate: () => setAll(k.v) }, 0);
        tl.from("[data-marker]", { scale: 0, transformOrigin: "50% 50%", duration: 0.2, stagger: 0.05 }, 0.45);
        tl.from("[data-gap]", { scaleY: 0, transformOrigin: "50% 100%", duration: 0.3 }, 0.6);
        setAll(0);
      });
      mm.add("(prefers-reduced-motion: reduce)", () => setAll(1));
    },
    { scope: root },
  );

  return (
    <section ref={root} id="matematica" className="relative flex min-h-svh items-center px-6 py-24 md:px-10">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-14 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="font-mono text-xs tracking-[0.18em] text-(--cincel) uppercase">{RELIABILITY.kicker}</p>
          <h2 className="mt-6 text-[clamp(2.1rem,4.6vw,4rem)] leading-[1] font-extrabold tracking-[-0.035em] text-balance text-(--marmol) [font-stretch:110%]">
            {RELIABILITY.title}
          </h2>
          <p className="mt-6 max-w-lg leading-relaxed text-(--piedra)">{RELIABILITY.body}</p>
          <div className="mt-8 space-y-2 font-mono text-sm">
            <p className="text-(--senal)">{RELIABILITY.formulaAuto}</p>
            <p className="text-(--eucalipto)">{RELIABILITY.formulaHybrid}</p>
          </div>
          <dl className="mt-10 grid grid-cols-2 gap-4">
            <Stat label={`1 organización · n = ${single.n}`} auto={single.autonomous} hybrid={single.hybrid} />
            <Stat label={`2 organizaciones · n = ${cross.n}`} auto={cross.autonomous} hybrid={cross.hybrid} />
          </dl>
          <p className="mt-6 max-w-lg text-xs leading-relaxed text-(--piedra)/80">
            {RELIABILITY.note} p = {single.p.toLocaleString("es-CL")}, h = {single.h.toLocaleString("es-CL")}.
          </p>
        </div>

        <figure className="relative rounded-[28px] border border-(--basalto) bg-(--grafito)/70 p-6 backdrop-blur-md md:p-8">
          <svg viewBox={`-8 -12 ${W + 16} ${H + 40}`} className="w-full overflow-visible" role="img" aria-label="Confiabilidad de la cadena según el número de pasos">
            {[0, 0.25, 0.5, 0.75, 1].map((g) => (
              <g key={g}>
                <line x1={0} x2={W} y1={H - g * H} y2={H - g * H} stroke="#2A2F2D" strokeDasharray="2 6" />
                <text x={W + 6} y={H - g * H + 4} fontSize="11" fill="#A3A69D" className="font-mono">
                  {g * 100}%
                </text>
              </g>
            ))}
            <line data-gap x1={mx} x2={mx} y1={H - single.hybrid * H} y2={H - single.autonomous * H} stroke="#D7FF3D" strokeWidth="2" strokeDasharray="4 4" />
            <path data-path d={hybrid} pathLength={1} strokeDasharray="1" fill="none" stroke="#6FAF9B" strokeWidth="4" strokeLinecap="round" />
            <path data-path d={auto} pathLength={1} strokeDasharray="1" fill="none" stroke="#F0524A" strokeWidth="4" strokeLinecap="round" />
            <circle data-marker cx={mx} cy={H - single.hybrid * H} r="7" fill="#6FAF9B" />
            <circle data-marker cx={mx} cy={H - single.autonomous * H} r="7" fill="#F0524A" />
            <text x={mx + 12} y={H - single.autonomous * H + 4} fontSize="12" fill="#F3F0E8" className="font-mono">
              n = {single.n}
            </text>
            <text x={0} y={H + 26} fontSize="11" fill="#A3A69D" className="font-mono">
              pasos de la cadena →
            </text>
          </svg>
          <figcaption className="mt-4 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs">
            <span className="flex items-center gap-2 text-(--marmol)">
              <span className="h-1 w-6 rounded-full bg-(--senal)" /> Agentes solos
            </span>
            <span className="flex items-center gap-2 text-(--marmol)">
              <span className="h-1 w-6 rounded-full bg-(--eucalipto)" /> Con compuerta humana
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function Stat({ label, auto, hybrid }: { label: string; auto: number; hybrid: number }) {
  return (
    <div className="rounded-2xl border border-(--basalto) bg-(--grafito)/60 p-5 backdrop-blur">
      <dt className="font-mono text-[11px] tracking-[0.14em] text-(--piedra) uppercase">{label}</dt>
      <dd className="mt-3 space-y-1">
        <span data-pct={auto} className="block text-3xl font-extrabold tracking-[-0.03em] text-(--senal) tabular-nums">
          {pct(auto)}
        </span>
        <span data-pct={hybrid} className="block text-3xl font-extrabold tracking-[-0.03em] text-(--eucalipto) tabular-nums">
          {pct(hybrid)}
        </span>
      </dd>
    </div>
  );
}
