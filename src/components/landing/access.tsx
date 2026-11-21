"use client";

import { useEffect, useRef, useState } from "react";
import { CircleCheck, LoaderCircle, Send } from "lucide-react";
import { PREFILL_EVENT } from "./interview";
import { Heading } from "./motion";

type Errors = Partial<Record<"name" | "email" | "organization" | "message", string>>;
type State = { status: "idle" } | { status: "sending" } | { status: "ok" } | { status: "error"; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(values: Record<string, string>): Errors {
  const errors: Errors = {};
  if (values.name.trim().length < 2) errors.name = "Escribe tu nombre.";
  if (!EMAIL.test(values.email.trim())) errors.email = "Ese correo no parece válido. Revisa que tenga @ y dominio.";
  if (values.organization.trim().length < 2) errors.organization = "Escribe el nombre de tu organización.";
  if (values.message.length > 1000) errors.message = "El mensaje puede tener hasta 1.000 caracteres.";
  return errors;
}

/**
 * Formulario de acceso: POST /api/access-requests. Si la base todavía no está
 * lista (503 STORAGE_UNAVAILABLE), lo dice con claridad y la página sigue entera.
 */
export function Access() {
  const [values, setValues] = useState({ name: "", email: "", organization: "", message: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<State>({ status: "idle" });
  const messageRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const prefill = (event: Event) => {
      const text = (event as CustomEvent<string>).detail;
      setValues((prev) => ({ ...prev, message: prev.message || text }));
      window.setTimeout(() => messageRef.current?.focus({ preventScroll: true }), 400);
    };
    window.addEventListener(PREFILL_EVENT, prefill);
    return () => window.removeEventListener(PREFILL_EVENT, prefill);
  }, []);

  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((prev) => ({ ...prev, [key]: event.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setState({ status: "sending" });
    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim(),
          organization: values.organization.trim(),
          ...(values.message.trim() ? { message: values.message.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return setState({ status: "ok" });
      const message =
        data.code === "STORAGE_UNAVAILABLE"
          ? "Todavía no podemos guardar solicitudes. Escríbenos a través del repositorio del equipo o vuelve a intentarlo más tarde."
          : typeof data.error === "string"
            ? data.error
            : "No pudimos enviar tu solicitud. Intenta de nuevo.";
      setState({ status: "error", message });
    } catch {
      setState({ status: "error", message: "No pudimos llegar al servidor. Revisa tu conexión e intenta de nuevo." });
    }
  }

  const field = (key: "name" | "email" | "organization", label: string, type: string, auto: string) => (
    <label className="block">
      <span className="font-medium">{label}</span>
      <input
        name={key}
        type={type}
        autoComplete={auto}
        value={values[key]}
        onChange={set(key)}
        className="field mt-1.5"
        aria-invalid={Boolean(errors[key])}
        aria-describedby={`err-${key}`}
      />
      <span id={`err-${key}`} className="small mt-1 block text-bleed">
        {errors[key]}
      </span>
    </label>
  );

  return (
    <section id="acceso" className="band relative overflow-clip bg-brand text-primary-foreground" aria-labelledby="acceso-titulo">
      <svg viewBox="0 0 900 600" aria-hidden className="pointer-events-none absolute -bottom-[30%] -left-[10%] w-[max(46rem,70vw)] text-primary-foreground/15">
        <circle cx="330" cy="300" r="270" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="570" cy="300" r="270" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <div className="wrap relative grid gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <Heading id="acceso-titulo" className="max-w-[13ch]">
            Llévalo a tu <span className="serif">organización.</span>
          </Heading>
          <p className="lede mt-8 max-w-[32rem] text-primary-foreground/90">
            Déjanos tus datos y lo probamos con tu caso.
          </p>
        </div>

        <div className="rounded-[1.5rem] bg-card p-6 text-foreground shadow-lift md:p-8">
          {state.status === "ok" ? (
            <div className="flex min-h-[18rem] flex-col justify-center" role="status">
              <span className="grid size-12 place-items-center rounded-full bg-calm-soft text-calm">
                <CircleCheck className="size-7" aria-hidden />
              </span>
              <p className="h-sub mt-5">Listo, recibimos tu solicitud.</p>
              <p className="mt-2 text-muted-foreground">Solo usaremos tu correo para escribirte sobre esto.</p>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {field("name", "Nombre", "text", "name")}
                {field("email", "Correo", "email", "email")}
              </div>
              {field("organization", "Organización", "text", "organization")}
              <label className="block">
                <span className="font-medium">
                  ¿Qué tendrían que decidir juntos? <span className="font-normal text-muted-foreground">(opcional)</span>
                </span>
                <textarea
                  ref={messageRef}
                  name="message"
                  rows={3}
                  maxLength={1000}
                  value={values.message}
                  onChange={set("message")}
                  className="field mt-1.5 resize-y"
                  aria-invalid={Boolean(errors.message)}
                />
                <span className="small mt-1 block text-bleed">{errors.message}</span>
              </label>
              <div className="mt-1 flex flex-col gap-3">
                <button type="submit" className="btn btn-primary btn-lg" disabled={state.status === "sending"}>
                  {state.status === "sending" ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <Send className="size-5" aria-hidden />}
                  {state.status === "sending" ? "Enviando…" : "Quiero probarlo"}
                </button>
                {state.status === "error" && (
                  <p className="small rounded-xl bg-bleed-soft px-3 py-2 text-bleed" role="alert">
                    {state.message}
                  </p>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
