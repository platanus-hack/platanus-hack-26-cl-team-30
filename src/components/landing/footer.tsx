import { TEAM } from "./content";
import { Logo, SCULPTOR_HOME } from "./mark";

export function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="wrap grid gap-10 md:grid-cols-[auto_1fr_1fr] md:gap-16">
        <a href={SCULPTOR_HOME} aria-label="Ir a la landing de Sculptor" className="self-start">
          <Logo size={36} />
        </a>
        <div>
          <p className="font-semibold">El equipo</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {TEAM.map((member) => (
              <li key={member.github}>
                <a href={`https://github.com/${member.github}`} className="underline decoration-border transition-colors hover:text-foreground hover:decoration-brand">
                  {member.name}
                </a>
              </li>
            ))}
          </ul>
          <p className="small mt-4 text-muted-foreground">Equipo 30, track Multiplayer, Platanus Hack 26: Santiago ft. Buk.</p>
        </div>
        <div>
          <p className="font-semibold">Sobre el ejemplo</p>
          <p className="small mt-2 max-w-[30rem] text-muted-foreground">
            Demostración simulada. No es una herramienta clínica ni usa datos reales de pacientes.
          </p>
        </div>
      </div>
    </footer>
  );
}
