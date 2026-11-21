// «Lo ajeno nunca llega»: una sola tabla oscura en vez de una tarjeta por persona.
// Filas: los datos de cada organización. Columnas: las tres personas de la demo.
// Cada celda es lo que el servidor le manda a esa persona: el valor, o un candado.
// Adaptado del bento oscuro de 21st.dev (9594), con una sola pieza y sin framer-motion.
// Lo reservado se ve cifrado y nunca se descifra (Encrypted Text, 21st 18575).

import { Check, Lock } from "lucide-react";
import type { CaseViewer } from "./data";
import { EncryptedText } from "./encrypted-text";

export function SeenBento({ viewers }: { viewers: CaseViewer[] }) {
  const rows = viewers[0]?.rows.map((row) => row.label) ?? [];
  return (
    <section className="cs-bento cs-section" aria-labelledby="ve-titulo">
      <div className="wrap">
        <h2 id="ve-titulo" className="cs-h2 max-w-[14ch]">
          Lo ajeno nunca llega.
        </h2>
        <p className="cs-lede mt-6 max-w-[34rem]" style={{ color: "var(--cs-fog)" }}>
          No se tapa: el servidor no lo envía.
        </p>
        <div className="mt-14 overflow-x-auto">
          <table className="cs-matrix w-full border-separate border-spacing-0 text-left">
            <caption className="sr-only">Qué recibe cada persona</caption>
            <thead>
              <tr>
                <th scope="col" className="w-[34%]">
                  <span className="sr-only">Dato</span>
                </th>
                {viewers.map((viewer) => (
                  <th key={viewer.label} scope="col">
                    {viewer.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((label) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {viewers.map((viewer) => {
                    const cell = viewer.rows.find((row) => row.label === label);
                    return (
                      <td key={viewer.label} data-locked={!cell?.value}>
                        {cell?.value ? (
                          <span className="inline-flex items-center gap-2">
                            <Check className="size-5" style={{ color: "var(--cs-ok)" }} aria-hidden /> {cell.value}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2" style={{ color: "var(--cs-lock)" }}>
                            <Lock className="size-5 shrink-0" aria-hidden /> <EncryptedText length={7} className="cs-lock-word" />
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
