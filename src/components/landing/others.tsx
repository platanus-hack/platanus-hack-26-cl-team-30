"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Construction, Lock, LoaderCircle, MonitorPlay, Sparkles, Truck, Wallet } from "lucide-react";
import { createRoom } from "@/lib/client/use-room";
import { CROSS_ORG_SCENARIOS } from "@/lib/genome/scenarios";
import { OTHER_EXAMPLES } from "./content";
import { Heading, Stagger } from "./motion";
import { Why } from "./why";

const ICONS = { construction: Construction, truck: Truck, wallet: Wallet } as const;

/** Frase lista para cada rubro: se usa al tocar una tarjeta. */
const PHRASES: Record<string, string> = {
  construction: "Dos constructoras que comparten una grúa torre y deben decidir quién la usa el jueves sin mostrar el atraso real de cada obra",
  truck: "Dos distribuidoras que comparten un camión refrigerado y deben decidir qué pedido sale primero sin mostrar su margen",
  wallet: "Dos áreas de una empresa que se reparten el presupuesto que queda del trimestre sin mostrar los sueldos de cada equipo",
};

/**
 * Otros rubros y el formulario para probar con una organización propia. La frase
 * va al servidor, que pide al modelo un genoma (roles, datos y caso), lo valida y,
 * si no sirve, usa uno de respaldo. La estructura sigue siendo código.
 */
export function Others() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const ready = description.trim().length >= 8;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      // La sala nace ya armada desde la frase; si el modelo falla, el servidor usa la semilla más parecida.
      const { roomId } = await createRoom("single_org", { description: description.trim() });
      router.push(`/stage/${encodeURIComponent(roomId)}`);
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "No se pudo abrir la sala. Intenta de nuevo." });
      setBusy(false);
    }
  }

  return (
    <section id="otros-rubros" className="band" aria-labelledby="otros-titulo">
      <div className="wrap">
        <Heading id="otros-titulo" className="max-w-[18ch]">
          Lo mismo pasa <span className="serif text-brand">en cualquier rubro.</span>
        </Heading>

        <Stagger className="mt-12 grid gap-5 md:grid-cols-3">
          {OTHER_EXAMPLES.map((example) => {
            const Icon = ICONS[example.icon];
            const fixedRoom = example.scenario ? CROSS_ORG_SCENARIOS[example.scenario].fixedRoomId : null;
            return (
              <div key={example.who} className="panel flex flex-col items-start p-6 md:p-7">
                <span className="grid size-12 place-items-center rounded-full bg-clash-soft text-clash">
                  <Icon className="size-6" aria-hidden />
                </span>
                <p className="h-sub mt-5">{example.who}</p>
                <p className="mt-1 text-muted-foreground">y {example.resource}.</p>
                <p className="small mt-4 flex flex-1 items-start gap-2 text-brand-ink">
                  <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>{example.privateData}</span>
                </p>
                {fixedRoom ? (
                  <Link href={`/stage/${fixedRoom}`} className="btn btn-line mt-5 w-full">
                    <MonitorPlay className="size-4" aria-hidden />
                    Ver ejemplo
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="btn btn-line mt-5 w-full"
                    onClick={() => {
                      setDescription(PHRASES[example.icon]);
                      document.getElementById("frase")?.focus();
                    }}
                  >
                    <ArrowRight className="size-4" aria-hidden />
                    Usar ejemplo
                  </button>
                )}
              </div>
            );
          })}
        </Stagger>

        <div id="probar" className="panel mt-10 grid gap-8 p-6 md:p-10 lg:grid-cols-[1fr_1.2fr] lg:gap-14">
          <div>
            <p className="h-sub flex items-center gap-2">
              <Sparkles className="size-5 text-brand" aria-hidden /> Prueba con tu caso
            </p>
            <p className="mt-3 text-muted-foreground">Una frase basta: armamos la sala.</p>
            <Why label="¿Qué hace el modelo?" className="mt-4">
              <p>Propone los nombres y los datos; el servidor los revisa antes de usarlos. Quién ve qué y cómo se decide lo sigue haciendo el código.</p>
            </Why>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="font-semibold">Tu caso en una frase</span>
              <textarea
                id="frase"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                maxLength={300}
                placeholder="Dos colegios que comparten un bus y deben decidir qué salida va primero"
                className="field mt-1.5 resize-y"
              />
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="submit" className="btn btn-primary btn-lg" disabled={!ready || busy}>
                {busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <Sparkles className="size-5" aria-hidden />}
                {busy ? "Armando la sala…" : "Armar mi sala"}
              </button>
              <Link href="/stage/demo-cross" className="btn btn-line btn-lg">
                <MonitorPlay className="size-5" aria-hidden />
                Ver el ejemplo
              </Link>
            </div>
            {!ready && !busy && <p className="small text-muted-foreground">Escribe una frase corta.</p>}
            {busy && <p className="small text-muted-foreground">Puede tardar unos segundos.</p>}
            {message && (
              <p role="alert" className={`small rounded-xl px-3 py-2 ${message.ok ? "bg-calm-soft text-calm" : "bg-bleed-soft text-bleed"}`}>
                {message.text}
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
