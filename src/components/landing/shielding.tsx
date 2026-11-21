"use client";

import { useRef, useState } from "react";
import { Lock } from "lucide-react";
import type { ProjectedField } from "@/lib/genome/schema";
import type { RoleProjection } from "./data";
import { EXPO, MOTION_OK, gsap, useGSAP } from "./gsap";
import { Heading } from "./motion";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

function value(field: Extract<ProjectedField, { redacted: false }>): string {
  if (field.unit === "CLP" && typeof field.value === "number") return clp.format(field.value);
  return field.unit ? `${field.value} ${field.unit}` : String(field.value);
}

/**
 * Lo que recibe cada rol de la clínica del ejemplo. Lo calculó el servidor con el
 * mismo motor de la sala: los campos ajenos llegan sin valor, no escondidos.
 */
export function Shielding({ projections }: { projections: RoleProjection[] }) {
  const root = useRef<HTMLElement>(null);
  const [roleId, setRoleId] = useState(projections[0]?.roleId);
  const current = projections.find((p) => p.roleId === roleId) ?? projections[0];

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from("[data-row]", { opacity: 0, x: -14, duration: 0.5, ease: EXPO, stagger: 0.04 });
      });
    },
    { scope: root, dependencies: [roleId] },
  );

  if (!current) return null;

  return (
    <section ref={root} id="blindaje" className="band" aria-labelledby="blindaje-titulo">
      <div className="wrap grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
        <div>
          <Heading id="blindaje-titulo" className="max-w-[15ch]">
            Lo que no te corresponde ver <span className="serif text-brand">nunca llega a tu pantalla.</span>
          </Heading>
          <div className="mt-8 max-w-[34rem] space-y-5 text-muted-foreground">
            <p className="lede text-foreground">
              No lo tapamos con un borrón: el servidor no lo envía. Cada rol recibe solo su parte, y el agente de ese rol tiene los mismos límites.
            </p>
            <p>
              Cambia de rol y mira qué datos llegan. En la sala, si alguien pide un dato ajeno, ve «No disponible para tu rol» y el intento queda
              registrado para el comité.
            </p>
          </div>
        </div>

        <div className="self-start rounded-[1.5rem] bg-brand-soft p-3 shadow-lift md:p-6">
          <div role="tablist" aria-label="Ver el caso como" className="flex gap-1 rounded-full bg-white p-1">
            {projections.map((p) => (
              <button
                key={p.roleId}
                role="tab"
                type="button"
                aria-selected={p.roleId === current.roleId}
                onClick={() => setRoleId(p.roleId)}
                className={`min-h-11 flex-1 rounded-full px-2 text-sm font-semibold transition-colors duration-200 sm:text-base ${
                  p.roleId === current.roleId ? "bg-brand text-white shadow-soft" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.tab}
              </button>
            ))}
          </div>
          <div className="mt-5 px-1">
            <p className="h-sub">{current.title}</p>
            <p className="small mt-1 text-muted-foreground">
              {current.objective} Su agente: {current.agentName}.
            </p>
          </div>
          <ul className="mt-5 space-y-2" aria-live="polite">
            {current.fields.map((field) => (
              <li
                key={field.key}
                data-row
                className={`flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl px-4 py-2.5 ${
                  field.redacted ? "shield" : "bg-white shadow-soft"
                }`}
              >
                <span className={field.redacted ? "" : "text-muted-foreground"}>{field.label}</span>
                {field.redacted ? (
                  <span className="small flex items-center gap-1.5 font-semibold">
                    <Lock className="size-4" aria-hidden /> No disponible para este rol
                  </span>
                ) : (
                  <span className="tabular font-semibold">{value(field)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
