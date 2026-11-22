// Página de un caso de uso: el mismo armado para cualquier rubro. Recibe qué caso
// es (su texto está en content.ts) y las cifras del motor (CaseView, data.ts).
//
// Una idea por sección, con ritmo: el héroe a todo el ancho con la pantalla grande
// real como protagonista; después, los tres pasos con sus capturas, los celulares,
// la regla, lo que ve cada uno, el acta, por qué firma una persona, otros rubros (una fila de
// tarjetas como la de la landing) y
// el llamado final. Todas las capturas son reales (public/casos/). Solo Manrope, titulares grandes y nada de
// texto menor a 16 px. Las piezas animadas vienen de 21st.dev (docs/diseno/21st/),
// adaptadas con CSS y GSAP.

import Link from "next/link";
import { MonitorPlay } from "lucide-react";
import { Logo, SCULPTOR_HOME } from "@/components/landing/mark";
import { GuideAssistant } from "@/components/ui/guide-assistant";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import "./casos.css";
import { CASE_ORDER, CASES, otherUses, type CaseSlug } from "./content";
import type { CaseView } from "./data";
import { ActaFeed } from "./acta-feed";
import { KineticHero } from "./kinetic-hero";
import { PhoneTrio } from "./phone-trio";
import { SeenBento } from "./seen-bento";
import { StageScroll } from "./stage-scroll";
import { StepsScroll } from "./steps-scroll";
import { Ticker } from "./ticker";
import { UsesTrack } from "./uses-track";

function DemoButton({ room, large = false }: { room: string; large?: boolean }) {
  return (
    <Link href={`/stage/${room}`} className={`btn btn-primary ${large ? "btn-lg" : ""}`}>
      <MonitorPlay className="size-5" aria-hidden />
      Probar la demo
    </Link>
  );
}

/** Fila de enlaces entre los casos de uso, con el actual marcado. */
function CaseLinks({ current }: { current: CaseSlug }) {
  return (
    <nav aria-label="Casos de uso" className="flex gap-1 overflow-x-auto rounded-full bg-muted p-1">
      {CASE_ORDER.map((slug) => (
        <Link
          key={slug}
          href={`/casos/${slug}`}
          aria-current={slug === current ? "page" : undefined}
          className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-base font-semibold transition-colors ${
            slug === current ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {CASES[slug].nav}
        </Link>
      ))}
    </nav>
  );
}

export function CasePage({ slug, view }: { slug: CaseSlug; view: CaseView }) {
  const study = CASES[slug];
  return (
    <>
      <header className="border-b border-border">
        <div className="wrap flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
          <Link href={SCULPTOR_HOME} aria-label="Ir a la landing de Sculptor">
            <Logo />
          </Link>
          <div className="order-last w-full sm:order-none sm:w-auto">
            <CaseLinks current={slug} />
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <DemoButton room={view.demoRoom} />
          </div>
        </div>
      </header>

      <main>
        {/* 1. El problema en una frase, y la pantalla grande real enderezándose al bajar: lo primero que se ve es el producto. */}
        <KineticHero title={study.title} lede={study.lede}>
          <DemoButton room={view.demoRoom} large />
        </KineticHero>
        <StageScroll src={`/casos/${slug}-negociacion-pantalla.webp`} alt={`Pantalla grande de la demo de ${study.nav.toLowerCase()}: el Comité decide`} />

        {/* 2. Cómo se decide: tres pasos, cada uno con su captura real de la pantalla grande. */}
        <section className="cs-section" aria-labelledby="pasos-titulo">
          <div className="wrap">
            <h2 id="pasos-titulo" className="cs-h2 max-w-[14ch]">
              Así se decide, en tres pasos.
            </h2>
            <div className="mt-14">
              <StepsScroll
                steps={study.steps.map((step, index) => ({
                  title: step.title,
                  detail: step.detail,
                  src: `/casos/${slug}-negociacion-paso-${index + 1}.webp`,
                  alt: `Pantalla grande de la demo de ${study.nav.toLowerCase()}, paso ${index + 1}: ${step.title.toLowerCase()}`,
                }))}
              />
            </div>
          </div>
        </section>

        {/* 3. A todo el ancho: cada persona, en su celular (capturas reales de la demo con negociación:
            el consejo de su agente, el debate en vivo y el Comité decidiendo). */}
        <section className="cs-section bg-muted/60" aria-labelledby="cel-titulo">
          <div className="wrap">
            <h2 id="cel-titulo" className="cs-h2 max-w-[16ch]">
              Cada persona, en su celular.
            </h2>
            <p className="cs-lede mt-6 max-w-[34rem] text-muted-foreground">Su agente le aconseja. Usted decide con un toque.</p>
            <div className="mt-16">
              <PhoneTrio
                phones={view.viewers.map((viewer, index) => ({
                  label: viewer.label,
                  src: `/casos/${slug}-negociacion-cel-${index + 1}.webp`,
                  alt: `Celular de ${viewer.label} en la demo`,
                  // El color de cada rol en su celular: eucalipto, arcilla y lavanda.
                  tone: ["#6faf9b", "#e0a891", "#b9aaf0"][index] ?? "#6faf9b",
                }))}
              />
            </div>
          </div>
        </section>

        {/* 5. A todo el ancho, en oscuro: qué recibe cada persona; lo reservado se ve cifrado. */}
        <SeenBento viewers={view.viewers} />

        {/* 6. Angosta: el acta de una ronda, como línea de tiempo, y cuánto dura como máximo. */}
        <section className="cs-section" aria-labelledby="acta-titulo">
          <div className="wrap grid max-w-6xl gap-14 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <h2 id="acta-titulo" className="cs-h2 max-w-[12ch]">
                Todo queda en el acta.
              </h2>
              <p className="mt-10">
                {/* Plazos del servidor: 60 s para las posturas, 4 mensajes cada 7 s, la propuesta y 20 s para el Comité (unos 125 s). */}
                <Ticker value={2} suffix=" min" className="cs-big text-brand" />
                <span className="cs-body mt-3 block">aproximadamente, como máximo por ronda, con las cinco personas adentro.</span>
              </p>
              <p className="cs-body mt-6 max-w-[28rem] text-muted-foreground">Si alguien no responde a tiempo, lo juega el sistema y queda marcado como automático.</p>
            </div>
            <ActaFeed entries={view.acta} />
          </div>
        </section>

        {/* 7. Angosta: por qué firma una persona, dicho con dos números que cuentan. */}
        <section className="cs-section" aria-labelledby="bot-titulo">
          <div className="wrap max-w-5xl">
            <h2 id="bot-titulo" className="cs-h2 max-w-[16ch]">
              Una persona firma al final.
            </h2>
            <div className="mt-14 grid gap-12 sm:grid-cols-2">
              <p>
                <Ticker value={Math.round(view.reliability.autonomous * 100)} suffix=" %" className="cs-big text-bleed" />
                <span className="cs-body mt-3 block">de las veces termina bien una cadena de agentes solos.</span>
              </p>
              <p>
                <Ticker value={Math.round(view.reliability.hybrid * 100)} suffix=" %" className="cs-big text-calm" />
                <span className="cs-body mt-3 block">si una persona revisa y firma.</span>
              </p>
            </div>
            <p className="cs-body mt-10 text-muted-foreground">Modelo ilustrativo del motor, con {view.reliability.steps} pasos seguidos.</p>
          </div>
        </section>

        {/* 8. A todo el ancho: el mismo esqueleto en otros rubros, cada uno con la pregunta que se hace la gente
            (la misma lista y presentación que «Mismo esqueleto, otro genoma» en la landing de Sculptor). */}
        <UsesTrack uses={otherUses(slug)} />

        {/* 9. A todo el ancho: el llamado final. */}
        <section className="cs-section cs-cta text-center" aria-labelledby="probar-titulo">
          <div className="wrap flex flex-col items-center">
            <h2 id="probar-titulo" className="cs-h2 max-w-[14ch]">
              Pruébalo con cinco personas.
            </h2>
            <p className="cs-lede mt-6">Cada una con su celular y su agente.</p>
            <div className="mt-10">
              <DemoButton room={view.demoRoom} large />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-10">
        <p className="wrap cs-body text-muted-foreground">{study.disclaimer}</p>
      </footer>
      <GuideAssistant page={`el caso de ${study.nav.toLowerCase()}`} roomId={view.demoRoom} />
    </>
  );
}
