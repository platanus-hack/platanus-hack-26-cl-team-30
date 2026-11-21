import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import { SPONSORS, STORY, TEAM } from "./content";
import { Heading, Marquee, Stagger } from "./motion";

const PHOTO_DIR = "equipo";
const PHOTO_EXT = /\.(jpe?g|png|webp|avif)$/i;

/** Fotos del equipo: cada imagen de public/equipo aparece en la franja, en orden de nombre. */
function readTeamPhotos(): string[] {
  try {
    return fs
      .readdirSync(path.join(process.cwd(), "public", PHOTO_DIR))
      .filter((file) => PHOTO_EXT.test(file))
      .sort((a, b) => a.localeCompare(b, "es", { numeric: true }))
      .map((file) => `/${PHOTO_DIR}/${file}`);
  } catch {
    return [];
  }
}

const TILE_WIDTHS = ["w-[20rem] md:w-[28rem]", "w-[17rem] md:w-[22rem]", "w-[22rem] md:w-[30rem]", "w-[18rem] md:w-[24rem]"];

export function Origin() {
  const photos = readTeamPhotos();

  return (
    <section id="equipo" className="bg-brand-ink pt-[clamp(4rem,2.5rem+6vw,8rem)] text-white" aria-labelledby="equipo-titulo">
      <div className="wrap">
        <p className="small font-semibold text-white/80">Platanus Hack 26: Santiago ft. Buk · track Multiplayer</p>
        <Heading id="equipo-titulo" className="mt-6 max-w-[17ch]">
          Tres amigos, 36 horas y <span className="serif text-[#99f6e4]">una pregunta que no soltamos.</span>
        </Heading>
        <Stagger className="mt-8 max-w-[40rem] space-y-5 text-white/85">
          {STORY.map((paragraph, i) => (
            <p key={i} className={i === 0 ? "lede text-white" : ""}>
              {paragraph}
            </p>
          ))}
        </Stagger>
        <ul className="mt-10 flex flex-wrap gap-2">
          {TEAM.map((member) => (
            <li key={member.github}>
              <a
                href={`https://github.com/${member.github}`}
                className="inline-flex min-h-10 items-center rounded-full px-4 font-medium text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.35)] transition-colors hover:bg-white/10"
              >
                {member.name}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {photos.length > 0 && (
        <Marquee label="Fotos del equipo durante la hackathon" seconds={70} className="mt-14 pb-6 md:mt-20">
          {photos.map((src, i) => (
            <figure
              key={src}
              className={`relative mr-4 h-56 shrink-0 overflow-hidden rounded-2xl bg-black/20 md:mr-6 md:h-72 ${TILE_WIDTHS[i % TILE_WIDTHS.length]} ${
                i % 2 === 1 ? "mt-8 md:mt-12" : ""
              }`}
            >
              <Image src={src} alt="El equipo durante Platanus Hack 26" fill sizes="(min-width: 768px) 30rem, 22rem" className="object-cover" />
            </figure>
          ))}
        </Marquee>
      )}

      <div className="mt-12 bg-white text-foreground md:mt-16">
        <div className="wrap flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1 pt-6">
          <p className="small font-semibold">Patrocinadores de la hackathon</p>
          <p className="small text-muted-foreground">Son de Platanus Hack 26, no de este proyecto.</p>
        </div>
        <Marquee label="Patrocinadores de Platanus Hack 26" seconds={40} reverse className="py-8">
          {SPONSORS.map((sponsor) => (
            <span
              key={sponsor.name}
              role="img"
              aria-label={sponsor.name}
              className="mr-14 block h-8 shrink-0 bg-foreground/80 md:mr-20"
              style={{
                width: `${Math.min(sponsor.ratio, 6.5) * 2}rem`,
                maskImage: `url(/sponsors/${sponsor.file})`,
                maskSize: "contain",
                maskRepeat: "no-repeat",
                maskPosition: "center",
              }}
            />
          ))}
        </Marquee>
      </div>
    </section>
  );
}
