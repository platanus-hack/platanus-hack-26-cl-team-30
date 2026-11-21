import { EyeOff, PenLine, Scale } from "lucide-react";
import { Heading, Stagger } from "./motion";

// Es una secuencia real (entrar, ordenar, firmar), por eso va numerada.
const STEPS = [
  {
    icon: EyeOff,
    title: "Cada uno entra con su rol",
    body: "Por QR. Ve solo lo que su rol permite.",
  },
  {
    icon: Scale,
    title: "Una regla conocida ordena los casos",
    body: "La misma fórmula para todos. El costo no entra.",
  },
  {
    icon: PenLine,
    title: "Una persona firma con su razón",
    body: "Aprueba o veta por escrito. Queda en un acta.",
  },
];

export function How() {
  return (
    <section id="como-funciona" className="band border-t border-border" aria-labelledby="como-titulo">
      <div className="wrap">
        <Heading id="como-titulo" className="max-w-[18ch]">
          Tres pasos, <span className="serif text-brand">todos lo ven.</span>
        </Heading>
        <Stagger className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="panel p-6 md:p-7">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-full bg-brand-soft text-brand-ink">
                  <step.icon className="size-5" aria-hidden />
                </span>
                <span className="serif tabular text-clash" style={{ fontSize: "2.75rem", lineHeight: 0.9 }} aria-label={`Paso ${i + 1}`}>
                  {i + 1}
                </span>
              </div>
              <h3 className="h-sub mt-5">{step.title}</h3>
              <p className="mt-2 text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
