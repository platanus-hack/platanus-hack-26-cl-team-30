"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MutateForm, describeMutation } from "@/components/nexo/mutate-form";
import { PulseLine } from "@/components/organs/pulse-line";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createRoom, mutateRoom } from "@/lib/client/use-room";
import type { RoomMode } from "@/lib/genome/schema";

// Portada: abrir una sala (una clínica o dos hospitales), generar una
// organización a partir de una frase, o ir a las salas fijas de la demo.
export default function Home() {
  const router = useRouter();
  const [busy, setBusy] = useState<RoomMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open(mode: RoomMode) {
    setBusy(mode);
    setError(null);
    try {
      router.push(`/stage/${encodeURIComponent(await createRoom(mode))}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la sala");
      setBusy(null);
    }
  }

  // Frase libre: crea una sala de una organización y le pide al servidor que
  // reemplace la organización de partida por la generada.
  async function generate(description: string) {
    try {
      const roomId = await createRoom("single_org");
      const outcome = describeMutation(await mutateRoom(roomId, description));
      if (outcome.ok) router.push(`/stage/${encodeURIComponent(roomId)}`);
      return outcome;
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "No se pudo crear la sala" };
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pt-10 pb-16 sm:px-8 sm:pt-16">
      <p className="text-lg font-semibold font-stretch-[115%]">Nexo</p>

      <h1 className="mt-6 max-w-[17ch] text-[clamp(2.4rem,7.5vw,5.25rem)] leading-[0.98] font-bold tracking-tight font-stretch-[88%]">
        Hay una cama. Dos hospitales la necesitan. Quien decide no ve el dato del otro.
      </h1>

      <div className="relative mt-6 h-12 overflow-hidden">
        <PulseLine beating className="absolute inset-x-0 top-0 h-12" />
      </div>

      <p className="mt-6 max-w-[56ch] text-xl leading-relaxed">
        Nexo es una sala en tiempo real donde personas y agentes de distintas organizaciones deciden juntos sobre un recurso escaso, y cada uno recibe solo los datos que su rol
        puede ver.
      </p>

      {/* Camino corto para un juez: un clic a la sala fija, otro para elegir rol. */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link href="/room/demo-cross" className={cn(buttonVariants(), "min-h-12 px-5 text-base")}>
          Entrar a la sala de demostración
        </Link>
        <Link href="/stage/demo-cross" className={cn(buttonVariants({ variant: "outline" }), "min-h-12 px-5 text-base")}>
          Ver la pantalla general
        </Link>
      </div>
      <p className="mt-3 max-w-[60ch] text-sm text-muted-foreground">
        Elige un rol (Urgencias, Gestión, el hospital rural o el Comité) y decide. Abre la pantalla general en otra pestaña o en otro teléfono para ver cómo cambia al
        instante.
      </p>

      <h2 className="mt-14 text-sm font-semibold">O abre una sala nueva</h2>
      <section className="mt-3 grid gap-4 sm:grid-cols-2" aria-label="Abrir una sala nueva">
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
          <h2 className="text-xl font-semibold font-stretch-[108%]">Una clínica, tres roles</h2>
          <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
            Urgencias quiere autorizar una cama UCI. Gestión exige una firma si se cruza el umbral. El Comité Ético entra con un código QR y decide.
          </p>
          <Button variant="outline" className="min-h-11 px-4" disabled={busy !== null} onClick={() => open("single_org")}>
            {busy === "single_org" ? "Abriendo la sala…" : "Abrir sala de una clínica"}
          </Button>
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
          <h2 className="text-xl font-semibold font-stretch-[108%]">Dos hospitales, una cama</h2>
          <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
            Cada hospital presenta a su paciente sin ver el costo del otro. El orden sale de una fórmula fija con desempate por equidad, y el Comité de la red tiene la última palabra.
          </p>
          <Button variant="outline" className="min-h-11 px-4" disabled={busy !== null} onClick={() => open("cross_org")}>
            {busy === "cross_org" ? "Abriendo la sala…" : "Abrir sala entre dos hospitales"}
          </Button>
        </div>
      </section>

      {error && (
        <p role="alert" className="mt-3 text-sm text-bleed">
          {error}
        </p>
      )}

      <section className="mt-10 max-w-2xl">
        <MutateForm action="Generar organización y abrir su sala" onSubmit={generate} />
        <p className="mt-2 text-sm text-muted-foreground">
          Un modelo propone los roles, los datos y el caso. El servidor valida esa propuesta antes de usarla; los permisos, la compuerta y los cálculos siguen siendo código.
        </p>
      </section>

      <section className="mt-12 border-t border-border pt-6">
        <h2 className="text-sm font-semibold">Sala fija de una clínica</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          La versión con una sola organización. Igual que la de demostración, siempre existe: si el servidor se reinicia, se vuelve a crear sola.
        </p>
        <p className="mt-2 flex gap-5 text-sm">
          <Link className="font-semibold underline underline-offset-4" href="/room/demo">
            Entrar con un rol
          </Link>
          <Link className="font-semibold underline underline-offset-4" href="/stage/demo">
            Pantalla general
          </Link>
        </p>
      </section>
    </main>
  );
}
