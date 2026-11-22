"use client";

// Banco de pruebas de la galaxia en píxeles: simula la demo (personas que entran,
// agentes que hablan, el Comité que decide) para elegir entre el modo «armado» y
// el modo «nemo» antes de ponerla en la pantalla grande.

import { useEffect, useRef, useState } from "react";
import { PixelGalaxy, type PixelGalaxyMode, type PixelGalaxySeat } from "@/components/brand/pixel-galaxy";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTheme } from "@/components/ui/theme";

const SEATS = [
  { id: "clinica_andes/role_a", label: "Clínica · Urgencias", color: "#6faf9b" },
  { id: "clinica_andes/role_b", label: "Clínica · Administración", color: "#9fd2c1" },
  { id: "hospital_rural/role_a", label: "Hospital Rural · Turno", color: "#c58f7b" },
  { id: "hospital_rural/role_b", label: "Hospital Rural · Administración", color: "#e0b8a6" },
  { id: "comite_red/role_c", label: "Comité", color: "#b9a7ff" },
];

export function OrbitaClient() {
  const theme = useTheme("dark");
  const [mode, setMode] = useState<PixelGalaxyMode>("nemo");
  const [variant, setVariant] = useState<"hero" | "backdrop">("hero");
  const [joined, setJoined] = useState(0);
  const [sealed, setSealed] = useState(false);
  const [speaking, setSpeaking] = useState<{ id: string; n: number } | null>(null);
  const timers = useRef<number[]>([]);

  const seats: PixelGalaxySeat[] = SEATS.map((seat, i) => ({ id: seat.id, tone: i, connected: i < joined }));

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

  // La demo completa, con los tiempos de la demo real (unirse, debate, decisión).
  const play = () => {
    reset();
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    [2500, 4500, 6200, 7800, 9600].forEach((ms, i) => at(ms, () => setJoined(i + 1)));
    at(12500, () => setVariant("backdrop"));
    [0, 2, 1, 3, 0, 2].forEach((seat, k) => at(13500 + k * 2200, () => setSpeaking({ id: SEATS[seat].id, n: k + 1 })));
    at(27500, () => setVariant("hero"));
    at(28500, () => setSealed(true));
  };

  const button = "rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-40";
  const active = "rounded-full border border-transparent bg-foreground px-4 py-2 text-sm font-semibold text-background";

  return (
    <main className="relative min-h-svh bg-background text-foreground">
      <PixelGalaxy
        seats={seats}
        sealed={sealed}
        mode={mode}
        variant={variant}
        theme={theme}
        speaking={speaking?.id ?? null}
        speakingKey={speaking?.n ?? 0}
        seatColors={SEATS.map((s) => s.color)}
        style={{ position: "absolute", inset: 0 }}
      />

      <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Galaxia de la pantalla grande</h1>
          <p className="text-sm text-muted-foreground">Banco de pruebas: elige el modo y simula la demo.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={mode === "nemo" ? active : button} onClick={() => { reset(); setMode("nemo"); }}>
            Punto Nemo
          </button>
          <button type="button" className={mode === "armado" ? active : button} onClick={() => { reset(); setMode("armado"); }}>
            Armado
          </button>
          <ThemeToggle />
        </div>
      </header>

      <div className="absolute inset-x-0 bottom-0 z-10 p-4 sm:p-6">
        <ul className="mb-3 flex flex-wrap justify-center gap-2">
          {SEATS.map((seat, i) => (
            <li
              key={seat.id}
              className="flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-sm backdrop-blur"
              style={{ opacity: i < joined ? 1 : 0.45 }}
            >
              <span className="size-2.5 rounded-full" style={{ background: i < joined ? seat.color : "transparent", border: `1.5px solid ${seat.color}` }} />
              {seat.label}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className={active} onClick={play}>▶ Demo completa</button>
          <button type="button" className={button} disabled={joined >= 5} onClick={() => setJoined((n) => Math.min(5, n + 1))}>+ Entra alguien</button>
          <button type="button" className={button} disabled={!joined} onClick={() => setJoined((n) => Math.max(0, n - 1))}>− Sale</button>
          <button type="button" className={button} disabled={!joined} onClick={speak}>Habla un agente</button>
          <button type="button" className={button} onClick={() => setVariant((v) => (v === "hero" ? "backdrop" : "hero"))}>
            {variant === "hero" ? "Pasar a fondo" : "Pasar a protagonista"}
          </button>
          <button type="button" className={button} onClick={() => setSealed((v) => !v)}>{sealed ? "Deshacer decisión" : "El Comité decide"}</button>
          <button type="button" className={button} onClick={reset}>Reiniciar</button>
        </div>
      </div>
    </main>
  );
}
