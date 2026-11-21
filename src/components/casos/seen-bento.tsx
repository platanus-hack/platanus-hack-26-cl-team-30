// «Qué ve cada uno» como bento oscuro, adaptado de 21st.dev (9594) sin
// framer-motion. Una tarjeta por persona con lo que el servidor le manda: el dato
// propio con su valor y el ajeno con candado. Abajo, dos tarjetas anchas: los
// candados que se encienden (CSS) y la cifra medida de docs/MEDICIONES.md.

import { Check, Lock, Radio } from "lucide-react";
import type { CaseViewer } from "./data";

export function SeenBento({ viewers }: { viewers: CaseViewer[] }) {
  return (
    <section className="cs-bento band" aria-labelledby="ve-titulo">
      <div className="wrap">
        <h2 id="ve-titulo" className="h-section">
          Cada uno ve <span className="serif" style={{ color: "#8fd3bd" }}>solo lo suyo.</span>
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-6">
          {viewers.map((viewer) => (
            <section key={viewer.label} className="cs-bento-card p-6 md:col-span-2" aria-label={`Lo que ve ${viewer.label}`}>
              <h3 className="h-sub">{viewer.label}</h3>
              <ul className="mt-4 grid gap-2">
                {viewer.rows.map((row) => (
                  <li key={row.label} className={`flex min-h-12 items-center justify-between gap-3 rounded-xl px-4 py-2 ${row.value ? "bg-white/5" : "cs-hatch"}`}>
                    <span className="small" style={{ color: "var(--cs-fog)" }}>
                      {row.label}
                    </span>
                    {row.value ? (
                      <span className="small tabular flex items-center gap-1.5 font-semibold">
                        <Check className="size-4" style={{ color: "var(--cs-ok)" }} aria-hidden /> {row.value}
                      </span>
                    ) : (
                      <span className="small flex items-center gap-1.5 font-semibold" style={{ color: "var(--cs-lock)" }}>
                        <Lock className="size-4" aria-hidden /> Reservado
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <div className="cs-bento-card flex flex-col gap-5 p-6 md:col-span-3">
            <div className="flex gap-2" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span key={i} className="cs-lock grid size-12 place-items-center rounded-lg" style={{ ["--i" as string]: i }}>
                  <Lock className="size-5" />
                </span>
              ))}
            </div>
            <div>
              <h3 className="h-sub">Lo ajeno no se tapa: nunca llega.</h3>
              <p className="small mt-1" style={{ color: "var(--cs-fog)" }}>
                El servidor no lo envía.
              </p>
            </div>
          </div>
          <div className="cs-bento-card flex flex-col gap-5 p-6 md:col-span-3">
            <span className="serif tabular" style={{ fontSize: "clamp(3rem, 2.4rem + 2vw, 4.2rem)", lineHeight: 0.9, color: "#8fd3bd" }}>
              200
            </span>
            <div>
              <h3 className="h-sub flex items-center gap-2">
                <Radio className="size-5" aria-hidden /> conexiones a la vez
              </h3>
              <p className="small mt-1" style={{ color: "var(--cs-fog)" }}>
                Medido: cada una recibió solo lo suyo.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
