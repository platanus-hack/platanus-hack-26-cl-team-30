"use client";

// Presentación web de 3:00 (ver slides.ts). Una lámina a la vez, en modo oscuro y
// con letra grande, como pidió la charla del evento.
//   → / Av Pág / clic: siguiente   ← / Re Pág: anterior   1–8: ir a una lámina
//   T: iniciar o pausar el reloj de 3:00   R: reiniciar el reloj
//   N: notas del orador   F: pantalla completa
// La lámina actual queda en la URL (#3) para volver al mismo lugar si se recarga.

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { EXPO, gsap, useGSAP } from "@/components/landing/gsap";
import { GalaxyMark } from "@/components/sculptor/galaxy-mark";
import { LiveDemo } from "./live-demo";
import { runWarp } from "./warp";
import { PAGES, SLIDES } from "./slides";

const DEMO_INDEX = SLIDES.findIndex((s) => s.id === "demo");

const LIMIT_MS = 3 * 60 * 1000;
const WARN_MS = 2 * 60 * 1000 + 40 * 1000;

const pct = (v: number) => `${Math.round(v * 100)} %`;
const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function Deck({ autonomous, steps, accuracy }: { autonomous: number; steps: number; accuracy: number }) {
  const root = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [notes, setNotes] = useState(false);
  const warpCanvas = useRef<HTMLCanvasElement>(null);
  const [warping, setWarping] = useState(false);
  // La demo en vivo se monta la primera vez que se llega a su lámina y no se desmonta.
  const [demoMounted, setDemoMounted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const startedAt = useRef<number | null>(null);
  const base = useRef(0);

  const hashRead = useRef(false);

  const go = useCallback((next: number) => {
    const target = Math.max(0, Math.min(SLIDES.length - 1, next));
    setIndex(target);
    if (target === DEMO_INDEX) setDemoMounted(true);
  }, []);

  // La lámina actual queda en la URL. Va en un efecto: el router de Next escucha
  // history.replaceState y no puede actualizarse en medio de otro render.
  // No se escribe hasta haber leído el #n con el que se abrió la página.
  useEffect(() => {
    if (!hashRead.current) return;
    const hash = `#${index + 1}`;
    if (window.location.hash !== hash) window.history.replaceState(window.history.state, "", hash);
  }, [index]);

  // Volver a la lámina de la URL al cargar (y si alguien cambia el #n a mano).
  useEffect(() => {
    const sync = () => {
      const n = Number(window.location.hash.slice(1));
      hashRead.current = true;
      if (n >= 1 && n <= SLIDES.length) {
        setIndex(n - 1);
        if (n - 1 === DEMO_INDEX) setDemoMounted(true);
      }
    };
    const frame = window.requestAnimationFrame(sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  // Reloj de 3:00.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (startedAt.current !== null) setElapsed(base.current + Date.now() - startedAt.current);
    }, 250);
    return () => window.clearInterval(id);
  }, [running]);

  // Salto a velocidad luz: rayos de estrellas y destello; detrás de la luz, la lámina siguiente.
  const warp = useCallback(() => {
    if (warping) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      go(index + 1);
      return;
    }
    setWarping(true);
    requestAnimationFrame(() => {
      const canvas = warpCanvas.current;
      if (!canvas) return;
      gsap.set(canvas, { opacity: 1 });
      runWarp(canvas, () => {
        go(index + 1);
        gsap.to(canvas, { opacity: 0, duration: 0.7, ease: "power2.out", onComplete: () => setWarping(false) });
      });
    });
  }, [go, index, warping]);

  const toggleTimer = useCallback(() => {
    setRunning((on) => {
      if (on) {
        base.current += Date.now() - (startedAt.current ?? Date.now());
        startedAt.current = null;
      } else {
        startedAt.current = Date.now();
      }
      return !on;
    });
  }, []);

  const resetTimer = useCallback(() => {
    base.current = 0;
    startedAt.current = running ? Date.now() : null;
    setElapsed(0);
  }, [running]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest("select, input, textarea")) return;
      const k = e.key.toLowerCase();
      if (["arrowright", "pagedown", " "].includes(k)) {
        e.preventDefault();
        go(index + 1);
      } else if (["arrowleft", "pageup"].includes(k)) {
        e.preventDefault();
        go(index - 1);
      } else if (k >= "1" && k <= String(SLIDES.length)) go(Number(k) - 1);
      else if (k === "n") setNotes((v) => !v);
      else if (k === "t") toggleTimer();
      else if (k === "r") resetTimer();
      else if (k === "f") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, toggleTimer, resetTimer]);

  // Entrada de cada lámina: los elementos marcados suben en cascada.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const slide = root.current?.querySelector(`[data-slide="${index}"]`);
        if (!slide) return;
        const parts = slide.querySelectorAll("[data-in]");
        const cells = slide.querySelectorAll("[data-galaxy] [data-cell]");
        if (parts.length) gsap.fromTo(
          parts,
          { y: 40, opacity: 0, filter: "blur(8px)" },
          { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.9, ease: EXPO, stagger: 0.08 },
        );
        if (cells.length) gsap.fromTo(
          cells,
          { scale: 0, opacity: 0, transformOrigin: "50% 50%" },
          { scale: 1, opacity: 1, duration: 0.8, ease: EXPO, stagger: { each: 0.004, from: "center" } },
        );
      });
    },
    { scope: root, dependencies: [index] },
  );

  const slide = SLIDES[index];
  const late = elapsed >= WARN_MS;
  const over = elapsed >= LIMIT_MS;

  return (
    <div ref={root} className="relative z-10 flex h-svh w-full flex-col overflow-hidden">
      {/* Barra superior: marca, progreso y reloj. */}
      <header className="relative z-20 flex items-center justify-between px-8 pt-6 font-mono text-xs tracking-[0.18em] text-(--piedra) uppercase">
        <span className="flex items-center gap-3">
          <GalaxyMark aria-hidden title="" className="h-5 w-auto" />
          <span className="font-sans text-base font-extrabold tracking-[-0.04em] text-(--marmol) normal-case">sculptor</span>
        </span>
        <span className="flex items-center gap-1.5" aria-label={`Lámina ${index + 1} de ${SLIDES.length}`}>
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(i)}
              className={`h-1.5 rounded-full transition-all duration-500 ${i === index ? "w-8 bg-(--cincel)" : "w-3 bg-(--basalto) hover:bg-(--piedra)"}`}
              aria-label={`Ir a la lámina ${i + 1}`}
            />
          ))}
        </span>
        <button
          type="button"
          onClick={toggleTimer}
          className={`rounded-full border px-4 py-1.5 tabular-nums transition-colors ${
            over ? "border-(--senal) text-(--senal)" : late ? "border-(--cincel) text-(--cincel)" : "border-(--basalto) text-(--marmol)"
          }`}
          aria-label="Iniciar o pausar el reloj de 3 minutos (tecla T)"
        >
          {running ? "●" : "❚❚"} {clock(elapsed)} / 3:00
        </button>
      </header>

      {/* Lámina actual. Un clic en el fondo avanza. */}
      <main
        className="relative flex flex-1 items-center px-[6vw]"
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest("a, button, select, iframe")) go(index + 1);
        }}
      >
        <div key={slide.id} data-slide={index} className="w-full">
          {slide.id === "hola" && <Hola />}
          {slide.id === "problema" && <Problema autonomous={autonomous} steps={steps} accuracy={accuracy} />}
          {slide.id === "validacion" && <Validacion />}
          {slide.id === "solucion" && <Solucion onNext={() => go(index + 1)} />}
          {slide.id === "desarrollo" && <Desarrollo />}
          {slide.id === "cierre" && <Cierre />}
          {slide.id === "equipo" && <Equipo />}
        </div>
        {demoMounted && <LiveDemo active={slide.id === "demo"} onWarp={warp} />}
      </main>

      <footer className="relative z-20 flex items-center justify-between px-8 pb-5 font-mono text-[11px] tracking-[0.16em] text-(--piedra)/70 uppercase">
        <span>Equipo 30 · Platanus Hack 26 · Track Multiplayer</span>
        <span>← → navegar · T reloj · N notas · F pantalla completa</span>
      </footer>

      {warping && <canvas ref={warpCanvas} aria-hidden className="pointer-events-none fixed inset-0 z-[90] h-full w-full" />}

      {notes && (
        <aside className="absolute inset-x-6 bottom-14 z-20 rounded-2xl border border-(--basalto) bg-(--obsidiana)/95 p-6 backdrop-blur-md">
          <p className="font-mono text-xs tracking-[0.16em] text-(--cincel) uppercase">
            {index + 1}/{SLIDES.length} · {slide.time}
          </p>
          <p className="mt-3 text-lg leading-relaxed text-(--marmol)">{slide.say}</p>
          {slide.do && <p className="mt-3 text-sm leading-relaxed text-(--piedra)">{slide.do}</p>}
        </aside>
      )}
    </div>
  );
}

const H2 = "text-[clamp(2.4rem,5.4vw,5.6rem)] leading-[0.95] font-extrabold tracking-[-0.035em] text-(--marmol) [font-stretch:110%]";
const KICK = "font-mono text-[clamp(0.8rem,1.1vw,1.1rem)] tracking-[0.2em] text-(--cincel) uppercase";

function Hola() {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <p data-in className={KICK}>
          Equipo 30 · Platanus Hack 26
        </p>
        <h1 data-in className="mt-6 font-sans text-[clamp(4.5rem,13vw,13rem)] leading-[0.85] font-extrabold tracking-[-0.06em] text-(--marmol)">
          sculptor
        </h1>
        <p data-in className="mt-8 max-w-3xl text-[clamp(1.6rem,2.8vw,3rem)] leading-[1.1] text-(--marmol)">
          Organizaciones que deciden juntas{" "}
          <span className="font-serif text-(--eucalipto) italic">sin mostrarse sus datos.</span>
        </p>
        <p data-in className="mt-10 font-mono text-[clamp(0.85rem,1.1vw,1.15rem)] tracking-[0.12em] text-(--piedra) uppercase">
          Nahum Díaz · Ramón Molina · Sebastián Vargas
        </p>
      </div>
      <div data-galaxy className="mx-auto w-full max-w-[640px]">
        <GalaxyMark className="block w-full overflow-visible" />
      </div>
    </div>
  );
}

function Problema({ autonomous, steps, accuracy }: { autonomous: number; steps: number; accuracy: number }) {
  return (
    <div className="grid items-end gap-14 lg:grid-cols-[1.2fr_0.8fr]">
      <div>
        <p data-in className={KICK}>
          El problema
        </p>
        <h2 data-in className={`mt-6 ${H2}`}>
          Una organización es un <span className="font-serif font-normal text-(--eucalipto) italic [font-stretch:100%]">choque de fuerzas.</span>
        </h2>
        <p data-in className="mt-8 max-w-3xl text-[clamp(1.5rem,2.6vw,2.8rem)] leading-[1.15] text-(--marmol)">
          Un área contra otra. Un hospital contra otro. Cuando necesitan lo mismo,{" "}
          <span className="text-(--senal)">no pueden decidir juntas:</span> cada una tiene datos que no puede mostrar.
        </p>
      </div>
      <div data-in className="rounded-[32px] border border-(--basalto) bg-(--grafito)/70 p-8 backdrop-blur-md">
        <p className="font-mono text-sm tracking-[0.14em] text-(--piedra) uppercase">Agentes que tiran cada uno para su lado</p>
        <p className="mt-4 text-[clamp(5rem,10vw,10rem)] leading-none font-extrabold tracking-[-0.05em] text-(--senal) tabular-nums">
          {pct(autonomous)}
        </p>
        <p className="mt-4 text-[clamp(1.1rem,1.6vw,1.6rem)] leading-snug text-(--marmol)">
          {steps} pasos con {pct(accuracy)} de acierto cada uno.
          <br />
          <span className="text-(--eucalipto)">No es inteligencia: es caos más rápido.</span>
        </p>
        <p className="mt-4 font-mono text-xs tracking-[0.12em] text-(--piedra) uppercase">Modelo ilustrativo · pⁿ</p>
      </div>
    </div>
  );
}

/** Audio de WhatsApp a 1,5×, con un botón grande y su barra de avance. */
function AudioCard({ src, label, quote }: { src: string; label: string; quote: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) {
      document.querySelectorAll("audio").forEach((other) => other !== el && other.pause());
      el.playbackRate = 1.5;
      void el.play();
    } else el.pause();
  };
  return (
    <div className="flex items-center gap-5 rounded-[24px] border border-(--basalto) bg-(--grafito)/80 p-5 backdrop-blur-md">
      <button
        type="button"
        onClick={toggle}
        className="grid size-16 shrink-0 place-items-center rounded-full bg-(--cincel) text-2xl text-(--obsidiana) transition-transform hover:scale-105"
        aria-label={playing ? "Pausar audio" : "Reproducir audio a 1,5×"}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <div className="min-w-0 flex-1">
        <p className="flex justify-between font-mono text-xs tracking-[0.14em] text-(--eucalipto) uppercase">
          <span>{label}</span>
          <span className="text-(--piedra)">1,5×</span>
        </p>
        <p className="mt-2 text-[clamp(1.05rem,1.5vw,1.5rem)] leading-snug text-(--marmol)">{quote}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-(--basalto)">
          <div className="h-full rounded-full bg-(--cincel)" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      <audio
        ref={audio}
        src={src}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(1);
        }}
        onTimeUpdate={(e) => setProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)}
      />
    </div>
  );
}

function Validacion() {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
      <div>
        <p data-in className={KICK}>
          Un caso real · TopSol
        </p>
        <h2 data-in className={`mt-6 ${H2}`}>
          ¿Y tiene <span className="font-serif font-normal text-(--eucalipto) italic [font-stretch:100%]">posibilidad?</span>
        </h2>
        <div className="mt-10 space-y-4">
          <div data-in>
            <AudioCard src="/presentacion/validacion/problema.m4a" label="El problema" quote="«No sabemos qué es prioridad en el presupuesto anual.»" />
          </div>
          <div data-in>
            <AudioCard src="/presentacion/validacion/respuesta.m4a" label="Después de probarlo" quote="«Nos juntamos con el equipo a evaluar el sistema y pudimos organizar todo.»" />
          </div>
        </div>
      </div>
      <div data-in className="mx-auto w-full max-w-[440px] overflow-hidden rounded-[24px] border border-(--basalto)">
        <Image src="/presentacion/validacion/whatsapp.jpg" alt="Conversación por WhatsApp con TopSol: el audio del problema y el acceso al sistema." width={908} height={1070} sizes="440px" className="h-auto w-full" />
      </div>
    </div>
  );
}

function Solucion({ onNext }: { onNext: () => void }) {
  const items = [
    ["01", "Cada persona, su agente", "que la asesora en privado."],
    ["02", "Los agentes negocian", "a la vista, sin cruzar datos."],
    ["03", "Decide una persona", "del Comité, con una razón."],
  ];
  return (
    <div>
      <p data-in className={KICK}>
        La solución
      </p>
      <h2 data-in className={`mt-6 ${H2}`}>
        Los agentes conversan. <span className="font-serif font-normal text-(--eucalipto) italic [font-stretch:100%]">El código gobierna.</span>
      </h2>
      <ol className="mt-14 grid gap-5 md:grid-cols-3">
        {items.map(([n, a, b]) => (
          <li key={n} data-in className="rounded-[28px] border border-(--basalto) bg-(--grafito)/70 p-7 backdrop-blur-md">
            <span className="font-mono text-base text-(--cincel)">{n}</span>
            <p className="mt-4 text-[clamp(1.5rem,2.2vw,2.4rem)] leading-tight font-extrabold tracking-[-0.02em] text-(--marmol)">{a}</p>
            <p className="mt-2 text-[clamp(1.1rem,1.5vw,1.5rem)] text-(--piedra)">{b}</p>
          </li>
        ))}
      </ol>
      <button
        data-in
        type="button"
        onClick={onNext}
        className="mt-12 inline-flex items-center gap-4 rounded-full bg-(--cincel) px-9 py-5 text-[clamp(1.2rem,1.8vw,1.8rem)] font-extrabold text-(--obsidiana) transition-transform duration-300 ease-out hover:-translate-y-1"
      >
        Ahora ustedes: saquen el celular <span aria-hidden>→</span>
      </button>
    </div>
  );
}

// Velocidad del recorrido automático (px por segundo) y pausa al llegar al final (ms).
const SCROLL_SPEED = 300;
const END_PAUSE = 2000;

/**
 * Una página del deploy dentro de un iframe que baja sola, de corrido y a velocidad
 * pareja; al llegar al final espera un momento y vuelve arriba. No se detiene con el
 * mouse encima: en la presentación el cursor puede quedar sobre la pantalla. Como el
 * iframe es del mismo dominio, se mueve su propio scroll (así también corren sus
 * animaciones de scroll). Con movimiento reducido no baja sola.
 */
function Pane({ initial }: { initial: string }) {
  const [href, setHref] = useState(initial);
  const frame = useRef<HTMLIFrameElement>(null);
  const tween = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cancelled = false;
    let timer = 0;
    const wait = (ms: number) => new Promise<void>((resolve) => (timer = window.setTimeout(resolve, ms)));

    const run = async () => {
      // Esperar a que la página tenga secciones y termine su intro, si la tiene.
      for (let i = 0; i < 150 && !cancelled; i++) {
        const doc = frame.current?.contentDocument;
        if (doc?.body && !doc.querySelector("[data-intro]") && doc.querySelector("section")) break;
        await wait(200);
      }
      await wait(1200);

      while (!cancelled) {
        const win = frame.current?.contentWindow;
        const doc = frame.current?.contentDocument;
        if (!win || !doc) return;

        const max = doc.documentElement.scrollHeight - win.innerHeight;
        if (win.scrollY >= max - 4) {
          await wait(END_PAUSE);
          win.scrollTo({ top: 0, behavior: "instant" });
          await wait(1200);
          continue;
        }
        // Hasta el final de lo que hay ahora; si la página crece (secciones fijadas), sigue.
        await new Promise<void>((resolve) => {
          const proxy = { y: win.scrollY };
          tween.current = gsap.to(proxy, {
            y: max,
            duration: Math.max(1, (max - proxy.y) / SCROLL_SPEED),
            ease: "none",
            // instant: el sitio tiene scroll-behavior: smooth, que cortaría cada paso.
            onUpdate: () => win.scrollTo({ top: proxy.y, behavior: "instant" }),
            onComplete: resolve,
          });
        });
      }
    };
    void run();

    return () => {
      cancelled = true;
      tween.current?.kill();
      window.clearTimeout(timer);
    };
  }, [href]);

  return (
    <div
      className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-(--basalto) bg-(--grafito)"
    >
      <div className="flex items-center justify-between gap-3 border-b border-(--basalto) px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-(--basalto)" />
          <span className="size-2.5 rounded-full bg-(--basalto)" />
          <span className="size-2.5 rounded-full bg-(--basalto)" />
        </span>
        <select
          value={href}
          onChange={(e) => setHref(e.target.value)}
          className="rounded-full border border-(--basalto) bg-(--obsidiana) px-3 py-1 font-mono text-xs text-(--marmol)"
          aria-label="Página a mostrar"
        >
          {PAGES.map((p) => (
            <option key={p.href} value={p.href}>
              {p.label} · {p.href}
            </option>
          ))}
        </select>
      </div>
      <iframe ref={frame} key={href} src={href} title={href} className="h-full min-h-[46vh] w-full bg-(--obsidiana)" />
    </div>
  );
}

function Desarrollo() {
  const stack = ["Next.js 16 · React 19", "Tiempo real por SSE", "Motor determinista", "507 pruebas", "Una capa de modelos: Claude o local"];
  return (
    <div className="flex h-[78svh] flex-col">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p data-in className={KICK}>
            Desarrollo
          </p>
          <h2 data-in className="mt-4 text-[clamp(2rem,3.8vw,4rem)] leading-[0.95] font-extrabold tracking-[-0.035em] text-(--marmol) [font-stretch:110%]">
            La cama fue el primer átomo.
          </h2>
        </div>
        <ul data-in className="flex max-w-xl flex-wrap justify-end gap-2">
          {stack.map((s) => (
            <li key={s} className="rounded-full border border-(--basalto) px-3 py-1.5 font-mono text-xs text-(--marmol)">
              {s}
            </li>
          ))}
        </ul>
      </div>
      <div data-in className="mt-6 grid min-h-0 flex-1 gap-4 md:grid-cols-2">
        <Pane initial="/" />
        <Pane initial="/casos/logistica" />
      </div>
    </div>
  );
}

function Cierre() {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-[1fr_1fr]">
      <div>
        <p data-in className={KICK}>
          NGC 253 · La galaxia del Escultor
        </p>
        <h2 data-in className="mt-6 font-sans text-[clamp(4rem,10vw,10rem)] leading-[0.85] font-extrabold tracking-[-0.06em] text-(--marmol)">
          sculptor<span className="text-(--cincel)"> |</span>
        </h2>
        <p data-in className={`mt-8 ${H2}`}>
          Donde el caos aprende <span className="font-serif font-normal text-(--eucalipto) italic [font-stretch:100%]">a evolucionar.</span>
        </p>
      </div>
      <div data-galaxy className="mx-auto w-full max-w-[680px]">
        <GalaxyMark className="block w-full overflow-visible" />
      </div>
    </div>
  );
}

// Fotos del equipo durante la hackathon para el collage de fondo de la lámina final:
// public/equipo, las de frente al cartel, fotos de la cámara y cuadros de sus videos.
const COLLAGE = [
  "/equipo/equipo-0.webp",
  "/sculptor/equipo/equipo-vertical-1.jpg",
  "/equipo/equipo-4.webp",
  "/equipo/equipo-7.webp",
  "/equipo/equipo-2.webp",
  "/sculptor/equipo/equipo-vertical-2.jpg",
  "/equipo/equipo-3.webp",
  "/equipo/equipo-6.webp",
  "/equipo/equipo-1.webp",
  "/equipo/equipo-5.webp",
  "/sculptor/equipo/equipo-horizontal.jpg",
  // Cuadros de los videos de la cámara del equipo (tarjeta SD, 21 de noviembre).
  "/presentacion/sd/sd-0.webp",
  "/presentacion/sd/sd-1.webp",
  "/presentacion/sd/sd-2.webp",
  "/presentacion/sd/sd-3.webp",
  "/presentacion/sd/sd-4.webp",
  "/presentacion/sd/sd-5.webp",
  "/presentacion/sd/sd-6.webp",
  "/presentacion/sd/sd-7.webp",
  "/presentacion/sd/sd-8.webp",
  "/presentacion/sd/sd-9.webp",
  "/presentacion/sd/sd-10.webp",
  "/presentacion/sd/sd-11.webp",
  // Fotos de la cámara del equipo (tarjeta SD).
  "/presentacion/sd/foto-0.webp",
  "/presentacion/sd/foto-1.webp",
  "/presentacion/sd/foto-2.webp",
  "/presentacion/sd/foto-3.webp",
  "/presentacion/sd/foto-4.webp",
];
const COLUMNS = 5;

/**
 * Collage de fondo en movimiento: columnas de fotos que suben y bajan lento, en
 * sentidos alternos. Cada columna repite sus fotos dos veces para que el bucle no
 * se note. Va oscurecido detrás de los nombres.
 */
function Collage() {
  const columns = Array.from({ length: COLUMNS }, (_, c) =>
    Array.from({ length: 6 }, (_, i) => COLLAGE[(c * 5 + i * 3) % COLLAGE.length]),
  );
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-[-6%] flex rotate-[-6deg] gap-4 opacity-70">
        {columns.map((photos, c) => (
          <div key={c} className={`collage-col flex flex-1 flex-col gap-4 ${c % 2 ? "down" : ""}`} style={{ animationDuration: `${70 + c * 9}s` }}>
            {[...photos, ...photos].map((src, i) => (
              <div key={i} className="relative aspect-[4/5] w-full shrink-0 overflow-hidden rounded-2xl">
                <Image src={src} alt="" fill sizes="20vw" className="object-cover saturate-[0.85]" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_68%_50%,rgba(12,14,13,0.72),rgba(12,14,13,0.45)_75%)]" />
      <div className="absolute inset-0 bg-gradient-to-r from-(--obsidiana)/30 via-transparent to-(--obsidiana)/70" />
    </div>
  );
}

function Equipo() {
  const team = [
    ["Nahum Díaz", "AI Product Strategist · negocio y pitch"],
    ["Ramón Molina", "Software Engineer · producto web"],
    ["Sebastián Vargas", "AI Engineer · agentes e infraestructura"],
  ];
  return (
    <>
    <Collage />
    <div className="relative z-10 grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
      <div data-in className="overflow-hidden rounded-[28px] border border-(--basalto) shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]">
        <Image
          src="/sculptor/equipo/equipo-horizontal.webp"
          alt="El equipo 30 frente al cartel de Platanus Hack 26."
          width={2000}
          height={1125}
          sizes="60vw"
          className="aspect-[16/9] w-full object-cover"
          priority
        />
      </div>
      <div>
        <p data-in className={KICK}>
          Equipo 30
        </p>
        <h2 data-in className={`mt-6 ${H2}`}>Preguntas.</h2>
        <ul className="mt-10 space-y-5">
          {team.map(([n, r]) => (
            <li key={n} data-in>
              <p className="text-[clamp(1.6rem,2.4vw,2.6rem)] font-extrabold tracking-[-0.02em] text-(--marmol)">{n}</p>
              <p className="font-mono text-sm tracking-[0.14em] text-(--eucalipto) uppercase">{r}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
    </>
  );
}
