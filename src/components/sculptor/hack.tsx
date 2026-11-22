"use client";

// Platanus Hack 26. Un bloque lima, como el cartel del evento: el fondo se "enciende"
// desde una franja al llegar, las cifras cuentan desde cero, la foto entra girando
// y una franja sin fin cierra la sección.

import Image from "next/image";
import { useRef } from "react";
import { Marquee } from "@/components/landing/motion";
import { EXPO, MOTION_OK, gsap, useGSAP } from "@/components/landing/gsap";
import { HACK } from "./content";

export function Hack() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const tl = gsap.timeline({
          defaults: { ease: EXPO },
          scrollTrigger: { trigger: root.current, start: "top 75%", once: true },
        });
        tl.from("[data-panel]", { clipPath: "inset(48% 0% 48% 0%)", duration: 1.3 });
        tl.from("[data-kick] > *", { opacity: 0, y: -12, duration: 0.8, stagger: 0.06 }, 0.4);
        tl.from("[data-big] > *", { yPercent: 105, duration: 1.1, stagger: 0.08 }, 0.45);
        tl.from("[data-photo]", { rotation: 14, y: 120, opacity: 0, duration: 1.4 }, 0.5);
        tl.from("[data-copy]", { opacity: 0, y: 16, duration: 1 }, 0.7);

        for (const el of gsap.utils.toArray<HTMLElement>("[data-count]")) {
          const target = Number(el.dataset.count);
          const n = { v: 0 };
          tl.to(n, { v: target, duration: 1.6, ease: "power3.out", onUpdate: () => { el.textContent = String(Math.round(n.v)); } }, 0.8);
        }

        // La foto cuelga inclinada y se endereza un poco con el scroll.
        gsap.fromTo("[data-hang]", { rotation: 4 }, {
          rotation: -2,
          y: -40,
          ease: "none",
          scrollTrigger: { trigger: root.current, start: "top bottom", end: "bottom top", scrub: 1 },
        });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="hackathon" className="px-3 py-10 md:px-6">
      <div data-panel className="overflow-hidden rounded-[28px] bg-(--cincel) text-(--obsidiana)">
        <div className="px-6 pt-8 md:px-12 md:pt-10">
          <p data-kick className="flex flex-wrap justify-between gap-3 font-mono text-[11px] tracking-[0.16em] uppercase md:text-xs">
            {HACK.kicker.map((k) => (
              <span key={k}>[{k}]</span>
            ))}
          </p>
          <div className="mt-12 grid items-end gap-12 pb-14 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <p className="font-mono text-xs tracking-[0.18em] uppercase">[08] Dónde nació</p>
              <h2 data-big className="mt-5 text-[clamp(2.6rem,7.5vw,6.5rem)] leading-[0.92] font-extrabold tracking-[-0.04em] [font-stretch:115%]">
                <span className="block overflow-hidden"><span className="block">Platanus</span></span>
                <span className="block overflow-hidden"><span className="block">Hack 26.</span></span>
              </h2>
              <p className="mt-8 font-mono text-[clamp(1.1rem,2.2vw,1.6rem)] leading-snug font-bold uppercase">{HACK.title}</p>
              <p data-copy className="mt-6 max-w-xl leading-relaxed text-(--obsidiana)/75">
                {HACK.body}
              </p>
              <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
                {HACK.facts.map((f) => (
                  <div key={f.label} className="flex flex-col-reverse border-t border-(--obsidiana)/25 pt-4">
                    <dt className="mt-1 font-mono text-[11px] tracking-[0.16em] uppercase">{f.label}</dt>
                    <dd data-count={f.value} className="text-5xl font-extrabold tracking-[-0.05em] tabular-nums">
                      {f.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div data-hang className="mx-auto w-full max-w-[340px]">
            <figure data-photo className="rounded-2xl bg-(--obsidiana) p-3 pb-4 shadow-[0_30px_60px_-20px_rgba(12,14,13,0.55)]">
              <Image
                src="/sculptor/equipo/equipo-vertical-2.jpg"
                alt="El equipo 30 frente al cartel de Platanus Hack 26 en Santiago."
                width={1125}
                height={2000}
                sizes="(min-width: 1024px) 340px, 80vw"
                className="aspect-[4/5] w-full rounded-xl object-cover object-[50%_45%]"
              />
              <figcaption className="mt-3 flex justify-between font-mono text-[10px] tracking-[0.16em] text-(--marmol) uppercase">
                <span>Equipo 30</span>
                <span>{HACK.track}</span>
              </figcaption>
            </figure>
            </div>
          </div>
        </div>
        <Marquee label="Platanus Hack 26" seconds={26} className="border-t border-(--obsidiana)/20 py-4">
          {["Platanus Hack 26", "ft. Buk", HACK.track, "Santiago", "36 horas", "Equipo 30"].map((t) => (
            <span key={t} className="flex shrink-0 items-center gap-6 pr-6 font-mono text-sm font-bold tracking-[0.14em] uppercase">
              {t}
              <span aria-hidden className="size-2 bg-(--obsidiana)" />
            </span>
          ))}
        </Marquee>
      </div>
    </section>
  );
}
