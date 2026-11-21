// Página de un caso de uso: el mismo armado para cualquier rubro. Recibe el texto
// (CaseStudy, content.ts) y las cifras del motor (CaseView, data.ts). Cinco
// partes: el problema, cómo se resuelve en 3 pasos, qué ve cada uno, para qué
// más sirve y el llamado a probar la demo. Pocas palabras y números grandes.

import Link from "next/link";
import { ArrowRight, Check, Lock, MonitorPlay, Star } from "lucide-react";
import { Logo } from "@/components/landing/mark";
import type { CaseView } from "./data";
import type { CaseStudy } from "./types";

function DemoButton({ room, large = false }: { room: string; large?: boolean }) {
  return (
    <Link href={`/stage/${room}`} className={`btn btn-primary ${large ? "btn-lg" : ""}`}>
      <MonitorPlay className="size-5" aria-hidden />
      Probar la demo
    </Link>
  );
}

export function CasePage({ study, view }: { study: CaseStudy; view: CaseView }) {
  const Icon = study.icon;
  return (
    <>
      <header className="border-b border-border">
        <div className="wrap flex h-16 items-center justify-between gap-4">
          <Link href="/" aria-label="Sculptor: inicio">
            <Logo />
          </Link>
          <DemoButton room={view.demoRoom} />
        </div>
      </header>

      <main>
        {/* 1. El problema, en una frase, con los dos puntajes que da la regla. */}
        <section className="wrap grid items-center gap-10 py-14 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-24" aria-labelledby="caso-titulo">
          <div>
            <p className="small inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 font-semibold text-brand-ink">
              <Icon className="size-4" aria-hidden /> {study.kicker}
            </p>
            <h1 id="caso-titulo" className="h-hero mt-6 max-w-[12ch]">
              {study.title[0]} <span className="serif text-brand">{study.title[1]}</span>
            </h1>
            <p className="lede mt-6 max-w-[30rem] text-muted-foreground">{study.lede}</p>
            <div className="mt-8">
              <DemoButton room={view.demoRoom} large />
            </div>
          </div>
          <div className="panel p-6 md:p-8" aria-label={`${view.resource}: puntaje de cada candidato`}>
            <p className="small font-semibold text-muted-foreground">1 · {view.resource}</p>
            <ul className="mt-4 grid gap-3">
              {view.ranking.map((entry) => (
                <li key={entry.org} className={`flex items-center justify-between gap-4 rounded-2xl px-5 py-4 ${entry.winner ? "bg-calm-soft" : "bg-muted"}`}>
                  <span className="h-sub">{entry.org}</span>
                  <span className={`serif tabular flex items-center gap-2 ${entry.winner ? "text-calm" : ""}`} style={{ fontSize: "clamp(2.6rem, 2rem + 2vw, 3.6rem)", lineHeight: 0.9 }}>
                    {entry.score}
                    {entry.winner && <Star className="size-6 fill-current" aria-label="Va primero" />}
                  </span>
                </li>
              ))}
            </ul>
            <p className="small mt-4 text-muted-foreground">{view.tieBreak ? "Casi empate: gana quien más necesita." : "Gana el puntaje más alto."}</p>
          </div>
        </section>

        {/* 2. Cómo se resuelve: tres pasos. */}
        <section className="band border-t border-border" aria-labelledby="pasos-titulo">
          <div className="wrap">
            <h2 id="pasos-titulo" className="h-section">
              Tres pasos, <span className="serif text-brand">todos a la vista.</span>
            </h2>
            <ol className="mt-10 grid gap-5 md:grid-cols-3">
              {study.steps.map((step, index) => (
                <li key={step.title} className="panel p-6 md:p-7">
                  <span className="serif tabular text-clash" style={{ fontSize: "3rem", lineHeight: 0.9 }} aria-hidden>
                    {index + 1}
                  </span>
                  <h3 className="h-sub mt-4">{step.title}</h3>
                  <p className="mt-2 text-muted-foreground">{step.detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 3. Qué ve cada uno: lo calcula el motor; lo ajeno llega sin valor. */}
        <section className="band bg-brand-soft/50" aria-labelledby="ve-titulo">
          <div className="wrap">
            <h2 id="ve-titulo" className="h-section">
              Cada uno ve <span className="serif text-brand">solo lo suyo.</span>
            </h2>
            <p className="lede mt-4 max-w-[34rem] text-muted-foreground">Lo ajeno no se tapa: nunca llega.</p>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {view.viewers.map((viewer) => (
                <section key={viewer.label} className="panel p-6" aria-label={`Lo que ve ${viewer.label}`}>
                  <h3 className="h-sub">{viewer.label}</h3>
                  <ul className="mt-4 grid gap-2">
                    {viewer.rows.map((row) => (
                      <li key={row.label} className={`flex min-h-12 items-center justify-between gap-3 rounded-xl px-4 py-2 ${row.value ? "bg-muted" : "shield"}`}>
                        <span className="small">{row.label}</span>
                        {row.value ? (
                          <span className="small tabular flex items-center gap-1.5 font-semibold">
                            <Check className="size-4 text-calm" aria-hidden /> {row.value}
                          </span>
                        ) : (
                          <span className="small flex items-center gap-1.5 font-semibold">
                            <Lock className="size-4" aria-hidden /> Reservado
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </section>

        {/* 4. Sculptor sirve para más: el mismo esqueleto en otros rubros. */}
        <section className="band" aria-labelledby="mas-titulo">
          <div className="wrap">
            <h2 id="mas-titulo" className="h-section">
              Sculptor <span className="serif text-brand">sirve para más.</span>
            </h2>
            <p className="lede mt-4 text-muted-foreground">El mismo esqueleto, otro recurso.</p>
            <ul className="mt-10 grid gap-5 md:grid-cols-3">
              {study.more.map((item) => (
                <li key={item.title} className="panel flex items-start gap-4 p-6">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-clash-soft text-clash">
                    <item.icon className="size-6" aria-hidden />
                  </span>
                  <span>
                    <span className="h-sub block">{item.title}</span>
                    <span className="mt-1 block text-muted-foreground">{item.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/" className="mt-8 inline-flex min-h-11 items-center gap-2 font-semibold underline decoration-border underline-offset-4 hover:decoration-brand">
              Conoce Sculptor <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>

        {/* 5. Probar la demo. */}
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
        <p className="wrap small text-muted-foreground">Demostración simulada. No es una herramienta clínica.</p>
      </footer>
    </>
  );
}
