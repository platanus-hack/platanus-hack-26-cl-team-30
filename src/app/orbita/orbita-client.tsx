"use client";

// Simula la demo sobre la órbita: personas que entran, agentes que hablan y el
// Comité que decide. «Relevo» es la variante nueva; «Original» es la de /stage.

import { useEffect, useRef, useState } from "react";
import { Galaxy } from "@/components/stage/galaxy";
import { GalaxyRelay } from "@/components/stage/galaxy-relay";
import type { Seat } from "@/components/stage/seats";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTheme } from "@/components/ui/theme";

const SEATS = [
  { id: "clinica_andes/role_a", label: "Clínica · Urgencias" },
  { id: "clinica_andes/role_b", label: "Clínica · Administración" },
  { id: "hospital_rural/role_a", label: "Hospital Rural · Turno" },
  { id: "hospital_rural/role_b", label: "Hospital Rural · Administración" },
  { id: "comite_red/role_c", label: "Comité" },
];

export function OrbitaClient() {
  const theme = useTheme("dark");
  const [version, setVersion] = useState<"relevo" | "original">("relevo");
  const [variant, setVariant] = useState<"hero" | "backdrop">("hero");
  const [joined, setJoined] = useState(0);
  const [sealed, setSealed] = useState(false);
  const [speaking, setSpeaking] = useState<{ id: string; n: number } | null>(null);
  const timers = useRef<number[]>([]);

  const seats = SEATS.map(
    (seat, i) => ({ id: seat.id, label: seat.label, short: seat.label, org: seat.id.split("/")[0], tone: i, connected: i < joined, bot: false, human: true }) as unknown as Seat,
  );

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const reset = () => {
    clearTimers();
    setJoined(0);
    setSealed(false);
    setSpeaking(null);
    setVariant("hero");
  };
  const speak = () => {
    if (!joined) return;
    const seat = SEATS[Math.floor(Math.random() * Math.min(joined, 4))];
    setSpeaking((prev) => ({ id: seat.id, n: (prev?.n ?? 0) + 1 }));
  };
  // La demo completa con los tiempos de la demo real.
  const play = () => {
    reset();
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    [1500, 3500, 5200, 6800, 8600].forEach((ms, i) => at(ms, () => setJoined(i + 1)));
    at(11000, () => setVariant("backdrop"));
    [0, 1, 2, 3, 0, 2].forEach((seat, k) => at(12000 + k * 2400, () => setSpeaking({ id: SEATS[seat].id, n: k + 1 })));
    at(27000, () => setVariant("hero"));
    at(28000, () => setSealed(true));
  };

  const button = "rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-40";
  const active = "rounded-full border border-transparent bg-foreground px-4 py-2 text-sm font-semibold text-background";
  const OrbitView = version === "relevo" ? GalaxyRelay : Galaxy;

  return (
    <main className="relative min-h-svh overflow-hidden bg-background text-foreground">
      <style>{`.orbita-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; }`}</style>
      <div className="orbita-stage absolute inset-0">
        <OrbitView key={version} seats={seats} sealed={sealed} variant={variant} theme={theme} speaking={speaking?.id ?? null} speakingKey={speaking?.n ?? 0} />
      </div>

      <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Órbita: la gente se conecta a través de Sculptor</h1>
          <p className="text-sm text-muted-foreground">Nadie se conecta directo con nadie: todo pasa por el centro.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={version === "relevo" ? active : button} onClick={() => { reset(); setVersion("relevo"); }}>Relevo</button>
          <button type="button" className={version === "original" ? active : button} onClick={() => { reset(); setVersion("original"); }}>Original</button>
          <ThemeToggle />
        </div>
      </header>

      <div className="absolute inset-x-0 bottom-0 z-10 p-4 sm:p-6">
        <ul className="mb-3 flex flex-wrap justify-center gap-2">
          {SEATS.map((seat, i) => (
            <li key={seat.id} className="rounded-full border border-border bg-card/80 px-3 py-1 text-sm backdrop-blur" style={{ opacity: i < joined ? 1 : 0.45 }}>
              {seat.label}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className={active} onClick={play}>▶ Demo completa</button>
          <button type="button" className={button} disabled={joined >= 5} onClick={() => setJoined((n) => Math.min(5, n + 1))}>+ Entra alguien</button>
          <button type="button" className={button} disabled={!joined} onClick={() => setJoined((n) => Math.max(0, n - 1))}>− Sale</button>
          <button type="button" className={button} disabled={!joined} onClick={speak}>Habla un agente</button>
          <button type="button" className={button} onClick={() => setVariant((v) => (v === "hero" ? "backdrop" : "hero"))}>{variant === "hero" ? "Pasar a fondo" : "Pasar a protagonista"}</button>
          <button type="button" className={button} onClick={() => setSealed((v) => !v)}>{sealed ? "Deshacer decisión" : "El Comité decide"}</button>
          <button type="button" className={button} onClick={reset}>Reiniciar</button>
        </div>
      </div>
    </main>
  );
}
