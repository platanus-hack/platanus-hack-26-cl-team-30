"use client";

// Cifras medidas, copiadas de docs/MEDICIONES.md con su contexto. Entran en
// cascada y una luz lima barre los números.

import { useRef } from "react";
import { EXPO, MOTION_OK, gsap, useGSAP } from "@/components/landing/gsap";
import { MEASURED } from "./content";

export function Measured() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from("[data-metric]", {
          y: 50,
          opacity: 0,
          duration: 1.1,
          ease: EXPO,
          stagger: 0.12,
          scrollTrigger: { trigger: root.current, start: "top 75%", once: true },
        });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="medido" className="relative px-6 py-32 md:px-10">
      <div className="mx-auto max-w-7xl">
        <p className="font-mono text-xs tracking-[0.18em] text-(--cincel) uppercase">{MEASURED.kicker}</p>
        <h2 className="mt-6 text-[clamp(2.2rem,5vw,4.4rem)] leading-[1] font-extrabold tracking-[-0.035em] text-(--marmol) [font-stretch:110%]">
          {MEASURED.title}
        </h2>
        <dl className="mt-14 grid gap-5 md:grid-cols-3">
          {MEASURED.items.map((m) => (
            <div key={m.label} data-metric className="flex flex-col-reverse rounded-[28px] border border-(--basalto) bg-(--grafito)/70 p-7 backdrop-blur-md">
              <dd className="mt-4 text-sm leading-relaxed text-(--piedra)">{m.detail}</dd>
              <dt>
                <span className="shine block text-[clamp(3.5rem,7vw,5.5rem)] leading-none font-extrabold tracking-[-0.05em] tabular-nums [font-stretch:115%]">
                  {m.value}
                </span>
                <span className="mt-3 block font-mono text-xs tracking-[0.14em] text-(--marmol) uppercase">{m.label}</span>
              </dt>
            </div>
          ))}
        </dl>
        <p className="mt-6 font-mono text-[11px] tracking-[0.14em] text-(--piedra)/80 uppercase">{MEASURED.source}</p>
      </div>
    </section>
  );
}
