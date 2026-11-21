"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MutateForm, describeMutation } from "@/components/nexo/mutate-form";
import { PulseLine } from "@/components/organs/pulse-line";
import { Button } from "@/components/ui/button";
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

      <p className="mt-6 max-w-[58ch] text-lg leading-relaxed text-muted-foreground">
        Nexo coordina decisiones críticas entre personas y agentes. Cada quien entra con su rol y recibe solo los datos que le corresponden. Una regla escrita en código ordena los
        casos, y un Comité aprueba o veta dejando su razón por escrito.
      </p>

      <section className="mt-10 grid gap-4 sm:grid-cols-2" aria-label="Abrir una sala">
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
          <h2 className="text-xl font-semibold font-stretch-[108%]">Una clínica, tres roles</h2>
          <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
            Urgencias quiere autorizar una cama UCI. Gestión exige una firma si se cruza el umbral. El Comité Ético entra con un código QR y decide.
          </p>
          <Button className="min-h-11 px-4" disabled={busy !== null} onClick={() => open("single_org")}>
            {busy === "single_org" ? "Abriendo la sala…" : "Abrir sala de una clínica"}
          </Button>
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
          <h2 className="text-xl font-semibold font-stretch-[108%]">Dos hospitales, una cama</h2>
          <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
            Cada hospital presenta a su paciente sin ver el costo del otro. El orden sale de una fórmula fija con desempate por equidad, y el Comité de la red tiene la última palabra.
          </p>
          <Button className="min-h-11 px-4" disabled={busy !== null} onClick={() => open("cross_org")}>
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
        <h2 className="text-sm font-semibold">Salas fijas de la demostración</h2>
        <p className="mt-1 text-sm text-muted-foreground">Siempre existen: si el servidor se reinicia, se vuelven a crear solas.</p>
        <ul className="mt-3 grid gap-x-10 gap-y-3 text-sm sm:grid-cols-2">
          <li>
            <p className="font-semibold">Clínica (sala «demo»)</p>
            <p className="mt-0.5 flex gap-4">
              <Link className="underline underline-offset-4" href="/stage/demo">
                Pantalla general
              </Link>
              <Link className="underline underline-offset-4" href="/room/demo">
                Entrar con un rol
              </Link>
            </p>
          </li>
          <li>
            <p className="font-semibold">Dos hospitales (sala «demo-cross»)</p>
            <p className="mt-0.5 flex gap-4">
              <Link className="underline underline-offset-4" href="/stage/demo-cross">
                Pantalla general
              </Link>
              <Link className="underline underline-offset-4" href="/room/demo-cross">
                Entrar con un rol
              </Link>
            </p>
          </li>
        </ul>
      </section>
    </main>
  );
}
