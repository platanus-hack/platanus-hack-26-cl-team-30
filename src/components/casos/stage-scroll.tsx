"use client";

// La pantalla grande del caso, en una captura real, dentro de un marco que se
// endereza en 3D al hacer scroll. Adaptado de 21st.dev (1081) con GSAP
// ScrollTrigger en vez de framer-motion. Con prefers-reduced-motion el marco queda
// derecho y quieto (gsap.matchMedia).

import Image from "next/image";
import { useRef, type ReactNode } from "react";
import { MOTION_OK, gsap, useGSAP } from "@/components/landing/gsap";

export function StageScroll({ src, alt, title }: { src: string; alt: string; title: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add({ motion: MOTION_OK, mobile: "(max-width: 768px)" }, (context) => {
        if (!context.conditions?.motion) return;
        const mobile = context.conditions.mobile;
        const timeline = gsap.timeline({ scrollTrigger: { trigger: root.current, start: "top 85%", end: "center 45%", scrub: true } });
        timeline
          .fromTo("[data-card]", { rotateX: 20, scale: mobile ? 0.86 : 1.04 }, { rotateX: 0, scale: 1, ease: "none" }, 0)
          .fromTo("[data-title]", { y: 0 }, { y: -40, ease: "none" }, 0);
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} className="wrap py-16 md:py-24" style={{ perspective: "1000px" }}>
      <div data-title className="mx-auto max-w-3xl text-center">
        {title}
      </div>
      <div
        data-card
        className="mx-auto mt-10 w-full max-w-5xl rounded-[30px] border-4 border-[#4d6860] bg-[#222220] p-2 md:p-4"
        style={{ boxShadow: "0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026", transformOrigin: "50% 0%" }}
      >
        <div className="overflow-hidden rounded-2xl bg-[#151515]">
          <Image src={src} alt={alt} width={1440} height={900} sizes="(min-width: 1100px) 1024px, 100vw" className="h-auto w-full" />
        </div>
      </div>
    </div>
  );
}
