// Los tres celulares de la demo, con capturas reales: la Clínica a punto de
// presentar, el Hospital Rural en su turno y el Comité decidiendo. Adaptado de
// Phone Mockups de 21st.dev (20020): el marco es CSS, sin imágenes externas. En el
// celular se desplazan de lado.

import Image from "next/image";

export type PhoneShot = { label: string; src: string; alt: string; tone: string };

export function PhoneTrio({ phones }: { phones: PhoneShot[] }) {
  return (
    <ul className="-mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-3 md:gap-10 md:overflow-visible md:px-0">
      {phones.map((phone, index) => (
        <li key={phone.src} className={`flex w-[72%] shrink-0 snap-center flex-col items-center gap-5 md:w-auto ${index === 1 ? "md:-translate-y-8" : ""}`}>
          <div className="cs-phone">
            <span className="cs-phone-notch" aria-hidden />
            <Image src={phone.src} alt={phone.alt} width={780} height={1688} sizes="(min-width: 768px) 300px, 70vw" className="h-auto w-full" />
          </div>
          <p className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <span className="size-3 rounded-full" style={{ background: phone.tone }} aria-hidden /> {phone.label}
          </p>
        </li>
      ))}
    </ul>
  );
}
