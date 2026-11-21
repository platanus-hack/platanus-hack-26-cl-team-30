"use client";

// Los tres pasos de la demo, cada uno con su captura real de la pantalla grande.
// En pantallas anchas la imagen queda fija a un lado y cambia a medida que se baja
// por los pasos; en el celular, cada paso lleva su imagen debajo. Adaptado de
// Scroll 01 de 21st.dev (18041) sin motion: IntersectionObserver y un fundido CSS.

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export type StepShot = { title: string; detail: string; src: string; alt: string };

export function StepsScroll({ steps }: { steps: StepShot[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
      },
      // Cuenta como activo el paso que cruza la franja central de la pantalla.
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((element) => element && observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="grid gap-12 md:grid-cols-[1.25fr_1fr] md:gap-16">
      <div className="relative hidden md:block">
        <div className="sticky top-24 aspect-[16/10] overflow-hidden rounded-[1.75rem] border-4 border-[#4d6860] bg-[#151515] shadow-lift">
          {steps.map((step, index) => (
            <Image
              key={step.src}
              src={step.src}
              alt={step.alt}
              fill
              sizes="(min-width: 1250px) 680px, 55vw"
              className="cs-fade object-cover object-top"
              data-on={index === active}
            />
          ))}
        </div>
      </div>
      <ol>
        {steps.map((step, index) => (
          <li
            key={step.title}
            ref={(element) => {
              refs.current[index] = element;
            }}
            data-index={index}
            data-on={index === active}
            className="cs-step flex flex-col justify-center py-8 md:min-h-[62vh]"
          >
            <span className="cs-step-num" aria-hidden>
              {index + 1}
            </span>
            <h3 className="mt-4 text-[clamp(1.6rem,1.2rem+1.4vw,2.4rem)] font-extrabold leading-tight tracking-tight">{step.title}</h3>
            <p className="cs-lede mt-3 text-muted-foreground">{step.detail}</p>
            <Image src={step.src} alt={step.alt} width={1440} height={900} sizes="100vw" className="mt-6 h-auto w-full rounded-2xl border-2 border-[#4d6860] md:hidden" />
          </li>
        ))}
      </ol>
    </div>
  );
}
