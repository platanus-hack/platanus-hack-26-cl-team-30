"use client";

// "Del átomo a la galaxia": la simulación 3D del pitch (public/sculptor/orbital.html,
// de docs/diseno/nahum/) dentro de la landing. Es del mismo dominio, así que la página
// la maneja por window.__ORBITAL__: en escritorio la sección se fija y el scroll
// recorre sus nueve etapas (0 a 8). El iframe se carga recién cuando la sección está
// cerca, para no pagar el WebGL durante la intro.

import { useEffect, useRef, useState } from "react";
import { MOTION_OK, ScrollTrigger, gsap, useGSAP } from "@/components/landing/gsap";
import { ORBITAL } from "./content";

const SRC = "/sculptor/orbital.html";
const LAST_STAGE = 8;

type OrbitalApi = { setStage: (stage: number) => void };

export function Orbital() {
  const root = useRef<HTMLElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const api = useRef<OrbitalApi | null>(null);
  const stage = useRef(-1);
  const [load, setLoad] = useState(false);
  const [current, setCurrent] = useState(0);

  // Cargar el iframe cuando la sección está a una pantalla y media.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoad(true);
          io.disconnect();
        }
      },
      { rootMargin: "150% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const goTo = (next: number) => {
    if (next === stage.current) return;
    stage.current = next;
    setCurrent(next);
    api.current?.setStage(next);
  };

  // Con el iframe montado: esperar a que la simulación exponga su API y esconder sus
  // propios controles. No se usa onLoad: el evento "load" espera el video de fondo de
  // la simulación, que puede tardar mucho o no llegar nunca.
  useEffect(() => {
    if (!load) return;
    let tries = 0;
    let timer = 0;
    const poll = () => {
      const win = frame.current?.contentWindow as (Window & { __ORBITAL__?: OrbitalApi }) | null | undefined;
      if (win?.__ORBITAL__) {
        api.current = win.__ORBITAL__;
        const doc = frame.current?.contentDocument;
        for (const key of ["h", "q"]) doc?.dispatchEvent(new KeyboardEvent("keydown", { key }));
        api.current.setStage(Math.max(stage.current, 0));
      } else if (tries++ < 120) {
        timer = window.setTimeout(poll, 150);
      }
    };
    poll();
    return () => window.clearTimeout(timer);
  }, [load]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(`${MOTION_OK} and (min-width: 1024px)`, () => {
        ScrollTrigger.create({
          trigger: root.current,
          start: "top top",
          end: "+=300%",
          pin: true,
          scrub: true,
          onUpdate: (self) => goTo(Math.min(LAST_STAGE, Math.floor(self.progress * (LAST_STAGE + 1)))),
        });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="galaxia" className="relative flex min-h-svh flex-col bg-(--obsidiana) px-3 pt-24 pb-6 md:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-end justify-between gap-6 px-3 md:px-4">
        <div>
          <p className="font-mono text-xs tracking-[0.18em] text-(--cincel) uppercase">{ORBITAL.kicker}</p>
          <h2 className="mt-4 max-w-3xl text-[clamp(1.9rem,4vw,3.4rem)] leading-[1] font-extrabold tracking-[-0.035em] text-(--marmol) [font-stretch:110%]">
            {ORBITAL.title}
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-(--piedra)">{ORBITAL.body}</p>
      </div>

      <div className="relative mt-8 flex-1 overflow-hidden rounded-[28px] border border-(--basalto) bg-black">
        <div className="relative h-[70svh] min-h-[420px] w-full lg:h-full">
          {load ? (
            <iframe
              ref={frame}
              src={SRC}
              title="Simulación orbital de Sculptor: del primer nodo a la galaxia NGC 253"
              className="absolute inset-0 h-full w-full"
              allow="fullscreen"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center font-mono text-xs tracking-[0.2em] text-(--piedra) uppercase">
              Cargando telescopio…
            </div>
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-black/80 to-transparent p-5">
          <ol aria-label="Etapas" className="flex gap-1.5">
            {Array.from({ length: LAST_STAGE + 1 }, (_, i) => (
              <li
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${i <= current ? "w-6 bg-(--cincel)" : "w-3 bg-(--basalto)"}`}
              />
            ))}
          </ol>
          <a
            href={SRC}
            target="_blank"
            rel="noreferrer"
            className="pointer-events-auto rounded-full border border-(--basalto) bg-(--obsidiana)/80 px-4 py-2 font-mono text-[11px] tracking-[0.14em] text-(--marmol) uppercase backdrop-blur transition-colors hover:border-(--cincel)"
          >
            Pantalla completa ↗
          </a>
        </div>
      </div>
      <p className="mx-auto mt-3 w-full max-w-7xl px-3 font-mono text-[11px] tracking-[0.14em] text-(--piedra)/80 uppercase md:px-4">
        {ORBITAL.hint} · Prototipo visual del pitch, no la app.
      </p>
    </section>
  );
}
