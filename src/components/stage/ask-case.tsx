"use client";

import { useState } from "react";
import { MessageCircleQuestion, Search, X } from "lucide-react";
import type { ProjectedRoomState } from "@/lib/genome/schema";
import { SUGGESTIONS, answer } from "./ask";

/** Buscador superior: «Pregúntale al caso». Responde con los datos de la sala, sin modelo. */
export function AskCase({ room }: { room: ProjectedRoomState }) {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const reply = asked ? answer(room, asked) : null;

  const ask = (text: string) => {
    const clean = text.trim();
    if (clean) setAsked(clean);
  };

  return (
    <div className="relative w-full max-w-2xl">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          ask(question);
        }}
        className="flex h-14 items-center gap-3 rounded-full bg-white pr-2 pl-5 shadow-[inset_0_0_0_1.5px_var(--border)] focus-within:shadow-[inset_0_0_0_2px_var(--brand)]"
      >
        <MessageCircleQuestion className="size-6 shrink-0 text-brand" aria-hidden />
        <label htmlFor="pregunta" className="sr-only">
          Pregúntale al caso
        </label>
        <input
          id="pregunta"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Pregúntale al caso"
          className="h-full min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
          autoComplete="off"
        />
        <button type="submit" className="grid size-10 place-items-center rounded-full bg-brand text-white hover:bg-brand-ink" aria-label="Preguntar">
          <Search className="size-5" aria-hidden />
        </button>
      </form>
      {reply && (
        <div role="status" className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-30 rounded-3xl bg-white p-5 shadow-lift ring-1 ring-black/5">
          <div className="flex items-start justify-between gap-3">
            <p className="small font-semibold text-muted-foreground">«{asked}»</p>
            <button type="button" className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-muted" onClick={() => setAsked(null)} aria-label="Cerrar la respuesta">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <p className="mt-2 text-xl leading-snug">{reply}</p>
          <p className="mt-3 text-xs text-muted-foreground">Respondido con los datos que ve esta pantalla. Sin modelo y sin datos reservados.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.filter((s) => s !== asked).slice(0, 4).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setQuestion(suggestion);
                  ask(suggestion);
                }}
                className="rounded-full bg-brand-soft px-3 py-1.5 text-sm font-medium text-brand-ink hover:bg-brand hover:text-white"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
