import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import { ORIGIN, SPONSORS, TEAM } from "./content";
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
    <section id="equipo" className="bg-brand-ink pt-[clamp(4rem,2.5rem+6vw,8rem)] text-primary-foreground" aria-labelledby="equipo-titulo">
      <div className="wrap">
        <p className="small font-semibold text-primary-foreground/80">Platanus Hack 26: Santiago ft. Buk · track Multiplayer</p>
        <Heading id="equipo-titulo" className="mt-6 max-w-[17ch]">
          Una pregunta <span className="serif text-brand-soft">que no soltamos.</span>
        </Heading>
        <p className="lede mt-8 max-w-[40rem] text-primary-foreground">{ORIGIN.question}</p>
        <Stagger className="mt-10 flex flex-wrap gap-x-14 gap-y-6">
          {ORIGIN.stats.map((stat) => (
            <p key={stat.label}>
              <span className="serif tabular block text-brand-soft" style={{ fontSize: "clamp(3.5rem, 2.5rem + 4vw, 6rem)", lineHeight: 0.9 }}>
                {stat.value}
              </span>
              <span className="mt-2 block font-medium text-primary-foreground/85">{stat.label}</span>
            </p>
          ))}
        </Stagger>
        <ul className="mt-10 flex flex-wrap gap-2">
          {TEAM.map((member) => (
            <li key={member.github}>
              <a
                href={`https://github.com/${member.github}`}
                className="inline-flex min-h-10 items-center rounded-full px-4 font-medium text-primary-foreground ring-1 ring-inset ring-current/35 transition-colors hover:bg-card/10"
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
              className={`relative mr-4 h-56 shrink-0 overflow-hidden rounded-2xl bg-foreground/15 md:mr-6 md:h-72 ${TILE_WIDTHS[i % TILE_WIDTHS.length]} ${
                i % 2 === 1 ? "mt-8 md:mt-12" : ""
              }`}
            >
              <Image src={src} alt="El equipo durante Platanus Hack 26" fill sizes="(min-width: 768px) 30rem, 22rem" className="object-cover" />
            </figure>
          ))}
        </Marquee>
      )}

      <div className="mt-12 bg-card text-foreground md:mt-16">
        <div className="wrap flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1 pt-6">
          <p className="small font-semibold">Patrocinadores de Platanus Hack 26</p>
          <p className="small text-muted-foreground">No son de este proyecto.</p>
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
