"use client";

// El mercado: la clínica es un ejemplo. En escritorio la sección se fija y las
// industrias pasan de lado mientras se baja (scroll horizontal). En el teléfono es
// una fila que se desliza con el dedo.

import { useRef } from "react";
import { MOTION_OK, gsap, useGSAP } from "@/components/landing/gsap";
import { MARKET } from "./content";

export function Market() {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(`${MOTION_OK} and (min-width: 1024px)`, () => {
        const el = track.current;
        const viewport = el?.parentElement;
        if (!el || !viewport) return;
        const distance = () => Math.max(0, el.scrollWidth - viewport.clientWidth);
        const slide = gsap.to(el, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });
        for (const card of gsap.utils.toArray<HTMLElement>("[data-sector]")) {
          gsap.fromTo(
            card.querySelector("[data-orbit]"),
            { rotation: -60 },
            {
              rotation: 60,
              ease: "none",
              scrollTrigger: { trigger: card, containerAnimation: slide, start: "left right", end: "right left", scrub: true },
            },
          );
        }
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="mercado" className="relative flex min-h-svh flex-col justify-center overflow-hidden py-24">
      <div className="mx-auto w-full max-w-7xl px-6 md:px-10">
        <p className="font-mono text-xs tracking-[0.18em] text-(--cincel) uppercase">{MARKET.kicker}</p>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-end">
          <h2 className="text-[clamp(2.2rem,5vw,4.4rem)] leading-[1] font-extrabold tracking-[-0.035em] text-(--marmol) [font-stretch:110%]">
            {MARKET.title}
          </h2>
          <p className="max-w-lg leading-relaxed text-(--piedra)">{MARKET.body}</p>
        </div>
      </div>
      <div className="mt-14 overflow-x-auto px-6 md:px-10 lg:overflow-visible">
        <div ref={track} className="flex w-max gap-5 pb-4">
          {MARKET.sectors.map((s, i) => {
            const live = s.status === "En la demo";
            return (
              <article
                key={s.name}
                data-sector
                className="relative flex h-[340px] w-[300px] shrink-0 flex-col justify-between overflow-hidden rounded-[28px] border border-(--basalto) bg-(--grafito)/75 p-7 backdrop-blur-md md:w-[360px]"
              >
                <Orbit index={i} live={live} />
                <div className="relative flex items-start justify-between">
                  <span className="font-mono text-sm text-(--piedra)">{String(i + 1).padStart(2, "0")}</span>
                  <span
                    className={`rounded-full px-3 py-1 font-mono text-[10px] tracking-[0.14em] uppercase ${
                      live ? "bg-(--cincel) text-(--obsidiana)" : "border border-(--basalto) text-(--eucalipto)"
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
                <div className="relative">
                  <h3 className="text-4xl font-extrabold tracking-[-0.03em] text-(--marmol) [font-stretch:112%]">{s.name}</h3>
                  <p className="mt-3 leading-relaxed text-(--piedra)">{s.case}</p>
                </div>
              </article>
            );
          })}
          <div className="flex w-[300px] shrink-0 items-center md:w-[420px]">
            <p className="font-serif text-3xl leading-tight text-(--marmol) italic md:text-4xl">
              Cualquier organización que deba decidir con otra sin mostrar sus datos.
            </p>
          </div>
        </div>
      </div>
      <p className="mx-auto mt-6 w-full max-w-7xl px-6 text-xs leading-relaxed text-(--piedra)/80 md:px-10">{MARKET.statusNote}</p>
    </section>
  );
}

/** Un sistema solar mínimo por industria: un núcleo y sus organizaciones en órbita. */
function Orbit({ index, live }: { index: number; live: boolean }) {
  const planets = 2 + (index % 3);
  return (
    <svg data-orbit aria-hidden viewBox="-100 -100 200 200" className="absolute -top-20 -right-20 w-60 opacity-50">
      <circle r="70" fill="none" stroke="#2A2F2D" />
      <circle r="42" fill="none" stroke="#2A2F2D" strokeDasharray="2 5" />
      <rect x="-6" y="-6" width="12" height="12" fill={live ? "#D7FF3D" : "#6FAF9B"} />
      {Array.from({ length: planets }, (_, k) => {
        const a = (k / planets) * Math.PI * 2 + index;
        const r = k % 2 ? 42 : 70;
        return <rect key={k} x={Math.round(Math.cos(a) * r - 4)} y={Math.round(Math.sin(a) * r - 4)} width="8" height="8" fill={k % 2 ? "#F3F0E8" : "#6FAF9B"} />;
      })}
    </svg>
  );
}
