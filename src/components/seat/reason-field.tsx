"use client";

import { useEffect, useId, useRef, useState } from "react";
import { REASON_MAX_LENGTH } from "@/lib/store/actions";

/** Razón sugerida: un toque en el chip escribe el texto, que después se puede editar. */
export type ReasonChip = { label: string; text: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
  chips: ReasonChip[];
};

/**
 * La razón de una decisión. Es obligatoria: sin ella los botones de la zona del
 * pulgar no se habilitan y el servidor también la exige. Los chips no deciden
 * nada: solo rellenan el texto, que la persona puede cambiar antes de firmar.
 */
export function ReasonField({ value, onChange, chips }: Props) {
  const id = useId();
  return (
    <section className="st-card" aria-label="Tu razón">
      <label className="st-reason-label" htmlFor={id}>
        Tu razón
        <small>{value.length > REASON_MAX_LENGTH - 80 ? `${value.length} de ${REASON_MAX_LENGTH}` : "obligatoria"}</small>
      </label>
      <div className="st-chips">
        {chips.map((chip) => (
          <button key={chip.label} type="button" className="st-chip" aria-pressed={value === chip.text} onClick={() => onChange(chip.text)}>
            {chip.label}
          </button>
        ))}
      </div>
      <textarea
        id={id}
        className="st-reason"
        rows={2}
        required
        maxLength={REASON_MAX_LENGTH}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Toca una o escribe la tuya"
      />
    </section>
  );
}

/**
 * Deslizador que se ve moverse en las demás pantallas: mientras se arrastra
 * muestra el valor local y envía al servidor como máximo cada 120 ms. Al soltar
 * vuelve al valor del servidor, que ya debería ser el mismo.
 */
export function useLiveSlider(serverValue: number, onCommit: (value: number) => void) {
  const [draft, setDraft] = useState<number | null>(null);
  const pending = useRef<number | null>(null);
  const sendTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      clearTimeout(sendTimer.current);
      clearTimeout(releaseTimer.current);
    },
    [],
  );

  function change(next: number) {
    setDraft(next);
    pending.current = next;
    clearTimeout(releaseTimer.current);
    releaseTimer.current = setTimeout(() => setDraft(null), 900);
    if (sendTimer.current) return;
    sendTimer.current = setTimeout(() => {
      sendTimer.current = undefined;
      if (pending.current !== null) onCommit(pending.current);
      pending.current = null;
    }, 120);
  }

  return { shown: draft ?? serverValue, change };
}
