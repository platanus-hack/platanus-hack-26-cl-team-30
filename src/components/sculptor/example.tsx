"use client";

// Un ejemplo de aplicación: dos hospitales y una cama. Los puntajes, el margen de
// empate y el orden los calcula el motor (data.ts). El costo de cobertura de cada
// hospital nunca llega al navegador: se dibuja tachado, como lo ve el otro lado.

import { useRef } from "react";
import { EXPO, MOTION_OK, gsap, useGSAP } from "@/components/landing/gsap";
import { EXAMPLE } from "./content";
import type { SculptorData } from "./data";

const num = (v: number) => v.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Example({ example }: Pick<SculptorData, "example">) {
  const root = useRef<HTMLElement>(null);
  const { candidates, scoreGap, epsilon, tieBreakApplied, weights } = example;
  const best = Math.max(...candidates.map((c) => c.score), 0.01);
  // ¿El desempate cambió al ganador o solo confirmó al de mejor puntaje?
  const [first, second] = candidates;
  const confirms = !first || !second || first.score >= second.score;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const tl = gsap.timeline({
          defaults: { ease: EXPO },
          scrollTrigger: { trigger: "[data-duel]", start: "top 75%", once: true },
        });
        tl.from("[data-card='0']", { xPercent: -40, rotation: -6, opacity: 0, duration: 1.2 });
        tl.from("[data-card='1']", { xPercent: 40, rotation: 6, opacity: 0, duration: 1.2 }, "<");
        tl.from("[data-bar]", { scaleX: 0, transformOrigin: "0 50%", duration: 1.2, stagger: 0.12 }, "-=0.6");
        tl.from("[data-verdict]", { y: 30, opacity: 0, duration: 1 }, "-=0.5");
        tl.from("[data-seal]", { scale: 2.4, rotation: -24, opacity: 0, duration: 0.7, ease: "back.out(2.2)" }, "-=0.4");
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="ejemplo" className="relative px-6 py-32 md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-end">
          <div>
            <p className="font-mono text-xs tracking-[0.18em] text-(--cincel) uppercase">{EXAMPLE.kicker}</p>
            <h2 className="mt-6 text-[clamp(2.2rem,5vw,4.4rem)] leading-[1] font-extrabold tracking-[-0.035em] text-(--marmol) [font-stretch:110%]">
              {EXAMPLE.title}
            </h2>
          </div>
          <p className="max-w-xl leading-relaxed text-(--piedra)">{EXAMPLE.body}</p>
        </div>

        <div data-duel className="relative mt-16 grid gap-5 md:grid-cols-2">
          {candidates.map((c, i) => (
            <article
              key={c.patientLabel}
              data-card={i}
              className={`relative overflow-hidden rounded-[28px] border bg-(--grafito)/75 p-7 backdrop-blur-md ${
                c.rank === 1 ? "border-(--eucalipto)/70" : "border-(--basalto)"
              }`}
            >
              <p className="font-mono text-[11px] tracking-[0.16em] text-(--piedra) uppercase">
                #{c.rank} · {c.patientLabel}
              </p>
              <h3 className="mt-3 text-2xl font-extrabold tracking-[-0.02em] text-(--marmol)">{c.orgName}</h3>
              <div className="mt-7 space-y-4">
                <Meter label="Puntaje clínico" value={num(c.score)} ratio={c.score / best} tone="bg-(--eucalipto)" />
                <Meter label="Necesidad sin cubrir" value={num(c.unmetNeed)} ratio={c.unmetNeed} tone="bg-(--marmol)" />
              </div>
              <div className="mt-7 flex items-center justify-between gap-4 rounded-xl border border-dashed border-(--basalto) px-4 py-3">
                <span className="text-sm text-(--piedra)">{EXAMPLE.hidden}</span>
                <span className="redacted relative h-4 w-28 overflow-hidden rounded-sm bg-(--basalto)" aria-label="Oculto para la otra organización" />
              </div>
            </article>
          ))}
          <div
            data-seal
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 rotate-[-8deg] rounded-full border-2 border-(--cincel) bg-(--obsidiana)/90 px-6 py-3 font-mono text-sm font-bold tracking-[0.2em] text-(--cincel) uppercase shadow-[0_0_60px_rgba(215,255,61,0.25)] md:block"
          >
            Comité · sella
          </div>
        </div>

        <div data-verdict className="mt-8 grid gap-4 rounded-[28px] border border-(--basalto) bg-(--grafito)/60 p-7 font-mono text-sm backdrop-blur md:grid-cols-3">
          <p className="text-(--marmol)">
            S = {weights.severity}·gravedad + {weights.timeCriticality}·urgencia − {weights.delayRisk}·riesgo
          </p>
          <p className="text-(--piedra)">
            Diferencia {num(scoreGap)} &lt; ε {num(epsilon)}:{" "}
            <span className="text-(--cincel)">{tieBreakApplied ? "empate técnico, se aplica equidad" : "sin empate"}</span>
          </p>
          <p className="text-(--piedra)">
            {tieBreakApplied
              ? confirms
                ? "El primero ya lo era por puntaje; la equidad lo confirma."
                : "La equidad da vuelta el orden del puntaje."
              : "Gana el mejor puntaje."}{" "}
            Los costos privados nunca entran en la fórmula.
          </p>
        </div>
        <p className="mt-4 font-mono text-[11px] tracking-[0.14em] text-(--piedra)/80 uppercase">{EXAMPLE.disclaimer}</p>
      </div>
    </section>
  );
}

function Meter({ label, value, ratio, tone }: { label: string; value: string; ratio: number; tone: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-(--piedra)">{label}</span>
        <span className="font-mono text-(--marmol) tabular-nums">{value}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-(--basalto)">
        <div data-bar className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(4, Math.min(ratio, 1) * 100)}%` }} />
      </div>
    </div>
  );
}
