"use client";

import { useEffect, useState } from "react";
import { MessageSquareQuote } from "lucide-react";
import { INTERVIEW_QUESTIONS } from "./content";
import { Heading } from "./motion";

type Published = { name?: string; role?: string; clinic?: string; answers?: Record<string, unknown> };
type Load = { status: "loading" } | { status: "ready"; interview: Published | null } | { status: "unavailable" };

/** Evento que el formulario de acceso escucha para dejar el mensaje listo. */
export const PREFILL_EVENT = "nexo:prefill-access";

function initials(name: string) {
  return name
    .replace(/^(dra?|dr)\.?\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/**
 * Entrevista a quien dirige una clínica. Muestra la última publicada (GET
 * /api/interviews). Si la base todavía no existe o no responde, la sección sigue
 * funcionando: muestra las preguntas e invita a responderlas.
 */
export function Interview() {
  const [load, setLoad] = useState<Load>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/interviews", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { interview?: Published | null };
        if (!cancelled) setLoad({ status: "ready", interview: data.interview ?? null });
      })
      .catch(() => {
        if (!cancelled) setLoad({ status: "unavailable" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const interview = load.status === "ready" ? load.interview : null;
  const answers = interview?.answers ?? {};

  const askToAnswer = () => {
    window.dispatchEvent(
      new CustomEvent(PREFILL_EVENT, { detail: "Trabajo en una clínica u hospital y quiero responder la entrevista." }),
    );
    document.getElementById("acceso")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  return (
    <section id="entrevista" className="band" aria-labelledby="entrevista-titulo">
      <div className="wrap grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <div className="lg:sticky lg:top-[calc(var(--nav-h)+2.5rem)] lg:self-start">
          <Heading id="entrevista-titulo" className="max-w-[14ch]">
            Le preguntamos a quien <span className="serif text-brand">dirige una clínica.</span>
          </Heading>
          <p className="lede mt-8 max-w-[32rem] text-muted-foreground">
            Pensamos en la gente que hoy decide por teléfono a quién le toca la cama. Estas son las preguntas que les hacemos.
          </p>
          {interview?.name ? (
            <div className="mt-10 flex items-center gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-soft text-lg font-semibold text-brand-ink">
                {initials(interview.name)}
              </span>
              <div>
                <p className="font-semibold">{interview.name}</p>
                <p className="small text-muted-foreground">{[interview.role, interview.clinic].filter(Boolean).join(", ")}</p>
              </div>
            </div>
          ) : (
            <p className="mt-10 max-w-[30rem] text-muted-foreground">
              {load.status === "loading"
                ? "Buscando la última entrevista publicada…"
                : load.status === "unavailable"
                  ? "Las entrevistas no están disponibles en este momento. Las preguntas siguen aquí."
                  : "Todavía no publicamos ninguna entrevista. Si trabajas en una clínica, la primera puede ser la tuya."}
            </p>
          )}
          <button type="button" className="btn btn-primary btn-lg mt-8" onClick={askToAnswer}>
            <MessageSquareQuote className="size-5" aria-hidden />
            Quiero responderla
          </button>
        </div>

        <ol className="divide-y divide-border border-y border-border">
          {INTERVIEW_QUESTIONS.map((q, i) => {
            const answer = typeof answers[q.key] === "string" ? (answers[q.key] as string) : null;
            return (
              <li key={q.key} className="grid grid-cols-[2.5rem_1fr] gap-x-3 py-7">
                <span className="serif text-clash" style={{ fontSize: "2rem", lineHeight: 1 }}>
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold">{q.question}</p>
                  {answer ? (
                    <p className={`mt-3 text-pretty ${i === 0 ? "serif text-[1.5rem] leading-snug" : "text-muted-foreground"}`}>{i === 0 ? `«${answer}»` : answer}</p>
                  ) : (
                    interview && <p className="small mt-2 text-muted-foreground">Sin respuesta publicada.</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
