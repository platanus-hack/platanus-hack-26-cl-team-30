"use client";

import { useRef, useState } from "react";
import { Bot, UserCheck } from "lucide-react";
import type { ReliabilityTable } from "./data";
import { EXPO, MOTION_OK, gsap, useGSAP } from "./gsap";
import { Heading, Stagger } from "./motion";

const pct = (value: number) => `${Math.round(value * 100)}%`;

/** Una cadena de pasos: cada vaso muestra cuánto queda de la decisión en ese paso. */
function Chain({ steps, perStep, total, tone, label, icon: Icon }: { steps: number; perStep: number; total: number; tone: "bleed" | "calm"; label: string; icon: typeof Bot }) {
  return (
    <div data-chain>
      <div className="flex items-end justify-between gap-4">
        <p className="flex items-center gap-2 font-semibold">
          <Icon className={`size-5 ${tone === "bleed" ? "text-bleed" : "text-calm"}`} aria-hidden /> {label}
        </p>
        <p className={`serif tabular ${tone === "bleed" ? "text-bleed" : "text-calm"}`} style={{ fontSize: "clamp(2.75rem, 2rem + 3vw, 4.25rem)", lineHeight: 0.85 }}>
          {pct(total)}
        </p>
      </div>
      <div className="mt-4 flex gap-1 md:gap-2" aria-hidden>
        {Array.from({ length: steps }, (_, i) => (
          <span key={i} className="relative h-20 flex-1 overflow-hidden rounded-full bg-white md:h-24">
            <span
              data-fill
              className={`absolute inset-x-0 bottom-0 rounded-full transition-[height] duration-500 ${tone === "bleed" ? "bg-bleed/80" : "bg-calm/85"}`}
              // Redondeado: el servidor y el navegador no calculan potencias con los mismos decimales.
              style={{ height: `${(perStep ** (i + 1) * 100).toFixed(1)}%` }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

/** Por qué no decide un bot. Los porcentajes salen del motor (computeReliabilityPn), calculados en el servidor. */
export function Reliability({ table }: { table: ReliabilityTable }) {
  const root = useRef<HTMLElement>(null);
  const [p, setP] = useState(Math.round(table.defaultP * 100));
  const [n, setN] = useState(table.defaultN);
  const [autonomous, hybrid] = table.values[`${p}:${n}`] ?? [0, 0];
  const hybridStep = n > 0 ? hybrid ** (1 / n) : 0;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from("[data-fill]", {
          scaleY: 0,
          transformOrigin: "50% 100%",
          duration: 0.9,
          ease: EXPO,
          stagger: { each: 0.05, from: "start" },
          scrollTrigger: { trigger: "[data-chain]", start: "top 80%", once: true },
        });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="por-que" className="band bg-muted/60" aria-labelledby="por-que-titulo">
      <div className="wrap grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
        <div>
          <Heading id="por-que-titulo" className="max-w-[15ch]">
            Un agente solo se equivoca <span className="serif text-brand">un poco en cada paso.</span>
          </Heading>
          <Stagger className="mt-8 max-w-[34rem] space-y-5 text-muted-foreground">
            <p className="lede text-foreground">
              Acertar {p}% de las veces suena bien. Pero una decisión importante son muchos pasos seguidos, y los errores se multiplican.
            </p>
            <p>Por eso aquí no decide un bot. Los agentes proponen, cada uno con los permisos de su rol, y una persona frena lo que cruza el límite.</p>
          </Stagger>
          <div className="mt-10 grid max-w-[34rem] gap-6 sm:grid-cols-2">
            <label className="block">
              <span className="flex justify-between font-medium">
                Acierto por paso <span className="tabular">{p}%</span>
              </span>
              <input type="range" className="slider" min={80} max={99} step={1} value={p} onChange={(event) => setP(Number(event.target.value))} />
            </label>
            <label className="block">
              <span className="flex justify-between font-medium">
                Pasos seguidos <span className="tabular">{n}</span>
              </span>
              <input type="range" className="slider" min={3} max={15} step={1} value={n} onChange={(event) => setN(Number(event.target.value))} />
            </label>
          </div>
        </div>
        <div className="space-y-10 self-center">
          <Chain steps={n} perStep={p / 100} total={autonomous} tone="bleed" label="Agente solo, sin freno" icon={Bot} />
          <Chain steps={n} perStep={hybridStep} total={hybrid} tone="calm" label="Agentes con una persona que firma" icon={UserCheck} />
          <p className="small text-muted-foreground">
            Modelo ilustrativo, calculado por el mismo código de la sala. Supone que la persona que firma detecta {pct(table.h)} de los errores.
          </p>
        </div>
      </div>
    </section>
  );
}
