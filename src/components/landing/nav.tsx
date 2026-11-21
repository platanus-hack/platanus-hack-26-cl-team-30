"use client";

import Link from "next/link";
import { useRef } from "react";
import { MonitorPlay } from "lucide-react";
import { MOTION_OK, gsap, useGSAP } from "./gsap";
import { Logo } from "./mark";

const LINKS = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#ejemplo", label: "El ejemplo" },
  { href: "#otros-rubros", label: "Otros rubros" },
  { href: "#por-que", label: "Por qué no un bot" },
  { href: "#equipo", label: "Equipo" },
];

export function Nav() {
  const bar = useRef<HTMLSpanElement>(null);

  // Cuánto de la página llevas, en la línea inferior de la barra.
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      gsap.to(bar.current, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });
    });
  });

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-(--nav-h) border-b border-border bg-background/95 backdrop-blur">
      <span ref={bar} aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 origin-left scale-x-0 bg-brand" />
      <div className="wrap flex h-full items-center gap-8">
        <a href="#top" aria-label="Volver al inicio">
          <Logo />
        </a>
        <nav aria-label="Secciones" className="small hidden gap-6 font-medium text-muted-foreground lg:flex">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors duration-150 hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <a href="#acceso" className="small hidden font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline">
            Pedir acceso
          </a>
          <Link href="/stage/demo-cross" className="btn btn-primary min-h-10! px-4! py-2! text-[0.9375rem]!">
            <MonitorPlay className="size-4" aria-hidden />
            Ver la demo
          </Link>
        </div>
      </div>
    </header>
  );
}
