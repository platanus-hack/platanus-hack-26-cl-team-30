"use client";

// El problema y el nombre. Las fuerzas en choque (área contra área, agente contra
// agente…) flotan desordenadas y, al bajar, se "tallan" en una fila: del caos al protocolo.

import { useRef } from "react";
import { EXPO, MOTION_OK, SplitText, gsap, useGSAP } from "@/components/landing/gsap";
import { ORIGIN } from "./content";
import { GalaxyMark } from "./galaxy-mark";

const SCATTER = [
  { x: -120, y: -90, r: -18 },
  { x: 90, y: 70, r: 14 },
  { x: -40, y: 110, r: 9 },
  { x: 150, y: -60, r: -11 },
  { x: -170, y: 40, r: 22 },
];

export function Origin() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const split = SplitText.create("[data-origin-title]", { type: "words", mask: "words" });
        gsap.from(split.words, {
          yPercent: 110,
          duration: 1,
          ease: EXPO,
          stagger: 0.035,
          scrollTrigger: { trigger: "[data-origin-title]", start: "top 85%", once: true },
        });
        const chips = gsap.utils.toArray<HTMLElement>("[data-chip]");
        gsap.fromTo(
          chips,
          { x: (i) => SCATTER[i % SCATTER.length].x, y: (i) => SCATTER[i % SCATTER.length].y, rotation: (i) => SCATTER[i % SCATTER.length].r, opacity: 0.55 },
          {
            x: 0,
            y: 0,
            rotation: 0,
            opacity: 1,
            ease: "none",
            scrollTrigger: { trigger: "[data-chips]", start: "top 90%", end: "center 45%", scrub: 1 },
          },
        );
        gsap.from("[data-name-card]", {
          y: 60,
          opacity: 0,
          duration: 1.2,
          ease: EXPO,
          scrollTrigger: { trigger: "[data-name-card]", start: "top 85%", once: true },
        });
        return () => split.revert();
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="problema" className="relative px-6 py-32 md:px-10">
      <div className="mx-auto max-w-7xl">
        <p className="font-mono text-xs tracking-[0.18em] text-(--cincel) uppercase">{ORIGIN.kicker}</p>
        <h2
          data-origin-title
          className="mt-6 max-w-5xl text-[clamp(2.2rem,5.4vw,4.8rem)] leading-[1] font-extrabold tracking-[-0.035em] text-balance text-(--marmol) [font-stretch:110%]"
        >
          {ORIGIN.title}
        </h2>
        <div className="mt-14 grid gap-14 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="max-w-xl text-lg leading-relaxed text-pretty text-(--piedra)">{ORIGIN.body}</p>
            <ul data-chips aria-label="Fuerzas en choque" className="mt-12 flex flex-wrap gap-3">
              {ORIGIN.channels.map((c) => (
                <li
                  key={c}
                  data-chip
                  className="rounded-full border border-(--basalto) bg-(--grafito)/80 px-5 py-2.5 font-mono text-sm text-(--marmol) backdrop-blur"
                >
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <aside
            data-name-card
            className="relative overflow-hidden rounded-[28px] border border-(--basalto) bg-(--grafito)/70 p-8 backdrop-blur-md"
          >
            <GalaxyMark aria-hidden title="" className="absolute -top-6 -right-10 w-56 opacity-30" />
            <p className="font-mono text-[11px] tracking-[0.18em] text-(--eucalipto) uppercase">NGC 253 · Sculptor Galaxy</p>
            <h3 className="mt-4 font-serif text-4xl text-(--marmol) italic">{ORIGIN.name.title}</h3>
            <p className="relative mt-4 leading-relaxed text-(--piedra)">{ORIGIN.name.body}</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
