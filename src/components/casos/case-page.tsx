// Página de un caso de uso: el mismo armado para cualquier rubro. Recibe qué caso
// es (su texto está en content.ts) y las cifras del motor (CaseView, data.ts).
//
// Una idea por sección, con ritmo: el héroe a todo el ancho con la pantalla grande
// real como protagonista; después se alternan secciones angostas (cómo funciona,
// por qué firma una persona, otros rubros) y franjas a todo el ancho (la regla, lo
// que ve cada uno, el llamado final). Solo Manrope, titulares grandes y nada de
// texto menor a 16 px. Las piezas animadas vienen de 21st.dev (docs/diseno/21st/),
// adaptadas con CSS y GSAP.

import Link from "next/link";
import { MonitorPlay } from "lucide-react";
import { Logo } from "@/components/landing/mark";
import { GuideAssistant } from "@/components/ui/guide-assistant";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import "./casos.css";
import { CASE_ORDER, CASES, otherUses, type CaseSlug } from "./content";
import type { CaseView } from "./data";
import { HowBeam } from "./how-beam";
import { KineticHero } from "./kinetic-hero";
import { RuleLab } from "./rule-lab";
import { SeenBento } from "./seen-bento";
import { StageScroll } from "./stage-scroll";

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
  const pct = (value: number) => `${Math.round(value * 100)} %`;
  return (
    <>
      <header className="border-b border-border">
        <div className="wrap flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
          <Link href="/" aria-label="Sculptor: inicio">
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
        <StageScroll src={`/casos/${slug}-pantalla.jpg`} alt={`Pantalla grande de la demo de ${study.nav.toLowerCase()}: el Comité decide`} />

        {/* 2. Angosta: cómo funciona, en una imagen y tres líneas. */}
        <section className="cs-section" aria-labelledby="pasos-titulo">
          <div className="wrap max-w-5xl">
            <h2 id="pasos-titulo" className="cs-h2 mx-auto max-w-[16ch] text-center">
              Todos deciden en la misma sala.
            </h2>
            <div className="mt-16">
              <HowBeam orgs={[view.viewers[0]?.label ?? "", view.viewers[1]?.label ?? ""]} arbiter={view.viewers[2]?.label ?? study.arbiterLabel} />
            </div>
            <ol className="mt-16 grid gap-10 md:grid-cols-3">
              {study.steps.map((step, index) => (
                <li key={step.title}>
                  <span className="cs-step-num" aria-hidden>
                    {index + 1}
                  </span>
                  <p className="mt-3 text-xl font-bold tracking-tight">{step.title}</p>
                  <p className="cs-body mt-2 text-muted-foreground">{step.detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 3. A todo el ancho: la regla, la única sección con puntajes. */}
        <section className="cs-section bg-brand-soft/60" aria-labelledby="regla-titulo">
          <div className="wrap">
            <h2 id="regla-titulo" className="cs-h2 max-w-[14ch]">
              Decide una fórmula, no una opinión.
            </h2>
            <p className="cs-lede mt-6 max-w-[34rem] text-muted-foreground">Mueve los pesos y mira cómo cambia el orden.</p>
            <div className="mt-14">
              <RuleLab scarcity={view.scarcity} labels={study.ruleLabels} orgLabels={view.orgLabels} />
            </div>
          </div>
        </section>

        {/* 4. A todo el ancho, en oscuro: qué recibe cada persona. */}
        <SeenBento viewers={view.viewers} />

        {/* 5. Angosta: por qué firma una persona, dicho con dos números. */}
        <section className="cs-section" aria-labelledby="bot-titulo">
          <div className="wrap max-w-5xl">
            <h2 id="bot-titulo" className="cs-h2 max-w-[16ch]">
              Una persona firma al final.
            </h2>
            <div className="mt-14 grid gap-12 sm:grid-cols-2">
              <p>
                <span className="cs-big text-bleed">{pct(view.reliability.autonomous)}</span>
                <span className="cs-body mt-3 block">de las veces termina bien una cadena de agentes solos.</span>
              </p>
              <p>
                <span className="cs-big text-calm">{pct(view.reliability.hybrid)}</span>
                <span className="cs-body mt-3 block">si una persona revisa y firma.</span>
              </p>
            </div>
            <p className="cs-body mt-10 text-muted-foreground">Modelo ilustrativo del motor, con {view.reliability.steps} pasos seguidos.</p>
          </div>
        </section>

        {/* 6. Angosta: el mismo esqueleto en otros rubros, como enlaces simples. */}
        <section className="cs-section border-t border-border" aria-labelledby="mas-titulo">
          <div className="wrap max-w-5xl">
            <h2 id="mas-titulo" className="cs-h2 max-w-[16ch]">
              Sirve para cualquier recurso escaso.
            </h2>
            <ul className="mt-12 divide-y divide-border border-y border-border">
              {otherUses(slug).map((item) => (
                <li key={item.title}>
                  {item.href ? (
                    <Link href={item.href} className="group flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-6">
                      <span className="text-2xl font-bold tracking-tight underline decoration-transparent underline-offset-8 transition-colors group-hover:decoration-brand">{item.title}</span>
                      <span className="cs-body text-muted-foreground">{item.detail}</span>
                    </Link>
                  ) : (
                    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-6">
                      <span className="text-2xl font-bold tracking-tight">{item.title}</span>
                      <span className="cs-body text-muted-foreground">{item.detail}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <Link href="/" className="cs-body mt-8 inline-flex min-h-11 items-center font-semibold underline decoration-border underline-offset-4 hover:decoration-brand">
              Qué es Sculptor
            </Link>
          </div>
        </section>

        {/* 7. A todo el ancho: el llamado final. */}
        <section className="cs-section cs-cta text-center" aria-labelledby="probar-titulo">
          <div className="wrap flex flex-col items-center">
            <h2 id="probar-titulo" className="cs-h2 max-w-[14ch]">
              Pruébalo con tres personas.
            </h2>
            <p className="cs-lede mt-6">Un minuto, cada una con su celular.</p>
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
