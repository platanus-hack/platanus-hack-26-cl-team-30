"use client";

// Estado compartido de la intro: el hero espera a que la galaxia "nos absorba"
// para hacer su propia entrada. Si la persona pidió menos movimiento, la intro
// no corre y todo queda visible desde el principio.

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Intro } from "./intro";

type IntroState = { revealed: boolean };

const IntroContext = createContext<IntroState>({ revealed: true });

export function useIntro() {
  return useContext(IntroContext);
}

export function SculptorShell({ children }: { children: ReactNode }) {
  // revealed: la página ya se ve (la intro está saliendo o terminó).
  // finished: la intro se desmonta.
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);

  const onReveal = useCallback(() => setRevealed(true), []);
  const onFinish = useCallback(() => {
    setRevealed(true);
    setFinished(true);
  }, []);

  return (
    <IntroContext.Provider value={{ revealed }}>
      {children}
      {!finished && <Intro onReveal={onReveal} onFinish={onFinish} />}
    </IntroContext.Provider>
  );
}
