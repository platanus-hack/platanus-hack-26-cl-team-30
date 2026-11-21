// Página de un caso de uso: el mismo armado para cualquier rubro. Recibe qué caso
// es (su texto está en content.ts) y las cifras del motor (CaseView, data.ts). Seis
// partes: el problema (héroe cinético), cómo funciona (rayos que convergen en
// Sculptor), la pantalla grande real (marco 3D con scroll), qué ve cada uno (bento
// oscuro), para qué más sirve y el llamado a probar la demo. Las tres piezas
// animadas se adaptaron de 21st.dev (docs/diseno/21st/) con CSS y GSAP.

import Link from "next/link";
import { ArrowRight, Bot, MonitorPlay, Star, UserCheck } from "lucide-react";
import { Logo } from "@/components/landing/mark";
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
          className={`small inline-flex min-h-10 shrink-0 items-center rounded-full px-4 font-semibold transition-colors ${
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
  const Icon = study.icon;
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
          <DemoButton room={view.demoRoom} />
        </div>
      </header>

      <main>
        {/* 1. El problema, en una frase que aparece palabra por palabra, con los dos puntajes de la regla. */}
        <KineticHero
          kicker={
            <p className="small inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 font-semibold text-brand-ink">
              <Icon className="size-4" aria-hidden /> {study.kicker}
            </p>
          }
          title={study.title}
          lede={study.lede}
        >
          <DemoButton room={view.demoRoom} large />
          <ul className="flex flex-wrap justify-center gap-2" aria-label={`${view.resource}: puntaje de cada candidato`}>
            {view.ranking.map((entry) => (
              <li key={entry.org} className={`flex items-center gap-3 rounded-full px-4 py-2 ${entry.winner ? "bg-calm-soft text-calm" : "bg-muted"}`}>
                <span className="small font-semibold text-foreground">{entry.org}</span>
                <span className="serif tabular flex items-center gap-1 text-2xl leading-none">
                  {entry.score}
                  {entry.winner && <Star className="size-4 fill-current" aria-label="Va primero" />}
                </span>
              </li>
            ))}
          </ul>
          <p className="small text-muted-foreground">{view.tieBreak ? "Casi empate: gana quien más necesita." : "Gana el puntaje más alto."}</p>
        </KineticHero>

        {/* 2. Cómo funciona: las organizaciones y el Comité convergen en Sculptor; de ahí salen acta, WhatsApp y voz. */}
        <section className="band border-t border-border" aria-labelledby="pasos-titulo">
          <div className="wrap">
            <h2 id="pasos-titulo" className="h-section text-center">
              Tres pasos, <span className="serif text-brand">todos a la vista.</span>
            </h2>
            <div className="mt-10">
              <HowBeam orgs={[view.viewers[0]?.label ?? "", view.viewers[1]?.label ?? ""]} arbiter={view.viewers[2]?.label ?? study.arbiterLabel} />
            </div>
            <ol className="mt-10 grid gap-5 md:grid-cols-3">
              {study.steps.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span className="serif tabular text-clash" style={{ fontSize: "2.6rem", lineHeight: 0.9 }} aria-hidden>
                    {index + 1}
                  </span>
                  <span>
                    <span className="h-sub block">{step.title}</span>
                    <span className="mt-1 block text-muted-foreground">{step.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* La regla a la vista: se pueden mover los pesos y ver cómo cambia el orden. */}
        <section className="band bg-brand-soft/50" aria-labelledby="regla-titulo">
          <div className="wrap">
            <h2 id="regla-titulo" className="h-section">
              Decide una fórmula, <span className="serif text-brand">no una opinión.</span>
            </h2>
            <p className="lede mt-4 text-muted-foreground">Mueve los pesos: cambia el orden.</p>
            <div className="mt-10">
              <RuleLab scarcity={view.scarcity} labels={study.ruleLabels} orgLabels={view.orgLabels} />
            </div>
          </div>
        </section>

        {/* 3. La pantalla grande de este caso: una captura real de la sala de demo jugada. */}
        <section className="border-t border-border" aria-label="La pantalla grande">
          <StageScroll
            src={`/casos/${slug}-pantalla.jpg`}
            alt={`Pantalla grande de la demo de ${study.nav.toLowerCase()}: el Comité decide`}
            title={
              <h2 className="h-section">
                Así se ve <span className="serif text-brand">en la sala.</span>
              </h2>
            }
          />
        </section>

        {/* 4. Qué ve cada uno: bento oscuro con candados en lo reservado. */}
        <SeenBento viewers={view.viewers} />

        {/* Por qué firma una persona: el modelo ilustrativo p^n del motor, para este escenario. */}
        <section className="band" aria-labelledby="bot-titulo">
          <div className="wrap grid items-center gap-10 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <h2 id="bot-titulo" className="h-section">
                Un agente solo <span className="serif text-brand">acumula errores.</span>
              </h2>
              <p className="lede mt-4 text-muted-foreground">Por eso los agentes proponen y una persona firma.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="panel p-6">
                <p className="small flex items-center gap-2 font-semibold text-muted-foreground">
                  <Bot className="size-5 text-bleed" aria-hidden /> Agentes solos
                </p>
                <p className="serif tabular mt-3 text-bleed" style={{ fontSize: "clamp(3.4rem, 2.6rem + 3vw, 5rem)", lineHeight: 0.85 }}>
                  {Math.round(view.reliability.autonomous * 100)}%
                </p>
              </div>
              <div className="panel p-6">
                <p className="small flex items-center gap-2 font-semibold text-muted-foreground">
                  <UserCheck className="size-5 text-calm" aria-hidden /> Con una persona que firma
                </p>
                <p className="serif tabular mt-3 text-calm" style={{ fontSize: "clamp(3.4rem, 2.6rem + 3vw, 5rem)", lineHeight: 0.85 }}>
                  {Math.round(view.reliability.hybrid * 100)}%
                </p>
              </div>
              <p className="small text-muted-foreground sm:col-span-2">Modelo ilustrativo del motor: {view.reliability.steps} pasos seguidos que terminan bien.</p>
            </div>
          </div>
        </section>

        {/* 5. Sculptor sirve para más: el mismo esqueleto en otros rubros. */}
        <section className="band" aria-labelledby="mas-titulo">
          <div className="wrap">
            <h2 id="mas-titulo" className="h-section">
              Sculptor <span className="serif text-brand">sirve para más.</span>
            </h2>
            <p className="lede mt-4 text-muted-foreground">El mismo esqueleto, otro recurso.</p>
            <ul className="mt-10 grid gap-5 md:grid-cols-3">
              {otherUses(slug).map((item) => {
                const body = (
                  <>
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-clash-soft text-clash">
                      <item.icon className="size-6" aria-hidden />
                    </span>
                    <span>
                      <span className="h-sub flex items-center gap-1.5">
                        {item.title}
                        {item.href && <ArrowRight className="size-4 text-muted-foreground" aria-hidden />}
                      </span>
                      <span className="mt-1 block text-muted-foreground">{item.detail}</span>
                    </span>
                  </>
                );
                return (
                  <li key={item.title}>
                    {item.href ? (
                      <Link href={item.href} className="panel flex h-full items-start gap-4 p-6 transition-shadow hover:shadow-lift">
                        {body}
                      </Link>
                    ) : (
                      <div className="panel flex h-full items-start gap-4 p-6">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
            <Link href="/" className="mt-8 inline-flex min-h-11 items-center gap-2 font-semibold underline decoration-border underline-offset-4 hover:decoration-brand">
              Conoce Sculptor <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>

        {/* 6. Probar la demo. */}
        <section className="band border-t border-border text-center" aria-labelledby="probar-titulo">
          <div className="wrap flex flex-col items-center">
            <h2 id="probar-titulo" className="h-section">
              Pruébalo <span className="serif text-brand">con tres personas.</span>
            </h2>
            <p className="lede mt-4 text-muted-foreground">Un minuto. Cada uno con su celular.</p>
            <div className="mt-8">
              <DemoButton room={view.demoRoom} large />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <p className="wrap small text-muted-foreground">{study.disclaimer}</p>
      </footer>
    </>
  );
}
