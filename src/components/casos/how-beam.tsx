"use client";

// «Cómo funciona» en una imagen: las dos organizaciones del caso y el Comité
// convergen en Sculptor, y de Sculptor salen el acta, WhatsApp y la voz (los
// canales del Comité, src/integrations/). Adaptado de 21st.dev (34961): los rayos
// son trazos SVG animados con CSS, sin framer-motion, y se recalculan al cambiar
// el tamaño. Con prefers-reduced-motion quedan quietos (casos.css).

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Building2, FileText, Mic, MessageCircle, Scale } from "lucide-react";
import { Mark } from "@/components/landing/mark";

type Node = { label: string; icon: ReactNode };
type Path = { d: string; out: boolean; delay: number };

function Circle({ refEl, label, icon, hub = false }: { refEl: RefObject<HTMLDivElement | null>; label: string; icon: ReactNode; hub?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={refEl}
        role="img"
        aria-label={label}
        className={`cs-node relative z-10 grid place-items-center border bg-card shadow-soft ${
          hub ? "size-20 rounded-3xl border-brand/40 ring-8 ring-brand/10 sm:size-24" : "size-12 rounded-2xl border-border text-brand-ink sm:size-14"
        }`}
      >
        {icon}
      </div>
      <span className={`small max-w-[9rem] text-center font-semibold leading-tight ${hub ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
    </div>
  );
}

export function HowBeam({ orgs, arbiter }: { orgs: [string, string]; arbiter: string }) {
  const box = useRef<HTMLDivElement>(null);
  const hub = useRef<HTMLDivElement>(null);
  const left = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const right = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [paths, setPaths] = useState<Path[]>([]);

  const ins: Node[] = [
    { label: orgs[0], icon: <Building2 className="size-6" aria-hidden /> },
    { label: orgs[1], icon: <Building2 className="size-6" aria-hidden /> },
    { label: arbiter, icon: <Scale className="size-6" aria-hidden /> },
  ];
  const outs: Node[] = [
    { label: "Acta", icon: <FileText className="size-6" aria-hidden /> },
    { label: "WhatsApp", icon: <MessageCircle className="size-6" aria-hidden /> },
    { label: "Voz", icon: <Mic className="size-6" aria-hidden /> },
  ];

  const measure = useCallback(() => {
    const container = box.current?.getBoundingClientRect();
    const center = hub.current?.getBoundingClientRect();
    if (!container || !center) return;
    const mid = (rect: DOMRect) => ({ x: rect.left - container.left + rect.width / 2, y: rect.top - container.top + rect.height / 2 });
    const c = mid(center);
    const line = (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const cx = (from.x + to.x) / 2;
      // Siempre un poco curvo: una línea recta horizontal tiene alto 0 y el degradado del rayo no se dibuja.
      return `M ${from.x},${from.y} Q ${cx},${(from.y + to.y) / 2 - (to.y - from.y) * 0.25 - 14} ${to.x},${to.y}`;
    };
    const next: Path[] = [];
    left.forEach((ref, i) => {
      const rect = ref.current?.getBoundingClientRect();
      if (rect) next.push({ d: line(mid(rect), c), out: false, delay: i * 0.35 });
    });
    right.forEach((ref, i) => {
      const rect = ref.current?.getBoundingClientRect();
      if (rect) next.push({ d: line(c, mid(rect)), out: true, delay: 1 + i * 0.35 });
    });
    setSize({ w: container.width, h: container.height });
    setPaths(next);
    // Las refs son estables: se crean una vez por componente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (box.current) observer.observe(box.current);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div ref={box} className="relative mx-auto w-full max-w-3xl px-2 py-6" aria-label={`${orgs[0]}, ${orgs[1]} y ${arbiter} deciden en Sculptor; de ahí salen el acta, WhatsApp y la voz`}>
      <svg className="pointer-events-none absolute inset-0 z-0 text-foreground" width={size.w} height={size.h} viewBox={`0 0 ${size.w || 1} ${size.h || 1}`} aria-hidden>
        <defs>
          <linearGradient id="cs-beam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0" />
            <stop offset="35%" stopColor="var(--brand)" />
            <stop offset="70%" stopColor="var(--clash)" />
            <stop offset="100%" stopColor="var(--clash)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {paths.map((path, i) => (
          <g key={i}>
            <path d={path.d} className="cs-beam-base" />
            <path d={path.d} className="cs-beam-flow" stroke="url(#cs-beam)" data-out={path.out} style={{ ["--delay" as string]: `${path.delay}s` }} />
          </g>
        ))}
      </svg>
      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-10">
        <div className="flex flex-col items-start gap-6 sm:gap-8">
          {ins.map((node, i) => (
            <Circle key={node.label} refEl={left[i]} label={node.label} icon={node.icon} />
          ))}
        </div>
        <Circle refEl={hub} label="Sculptor" icon={<Mark size={46} />} hub />
        <div className="flex flex-col items-end gap-6 sm:gap-8">
          {outs.map((node, i) => (
            <Circle key={node.label} refEl={right[i]} label={node.label} icon={node.icon} />
          ))}
        </div>
      </div>
    </div>
  );
}
