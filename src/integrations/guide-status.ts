// Lo que la guía puede decir de una sala: solo lo público. Se arma con la vista
// general de la sala (viewer "stage"), la misma que recibe la pantalla grande, así
// que ningún dato reservado llega hasta aquí. Usa las mismas reglas de texto que
// la pantalla grande (src/components/stage/story.ts), en trato de usted.

import { readNegotiation, roomCode, stageStep } from "@/components/stage/negotiation";
import { demoTurn, storyMissing, storyProgress } from "@/components/stage/story";
import { stageSeats } from "@/components/stage/seats";
import type { ProjectedRoomState } from "@/lib/genome/schema";

const FORMAL: Record<string, string> = {
  "presenta a tu paciente": "que presente su caso con el botón Presentar",
  "¿aceptas o rechazas?": "que acepte o rechace la propuesta de la regla",
  "escanea el QR": "que escanee el código de la pantalla grande",
};

export function guideRoomStatus(room: ProjectedRoomState): string {
  const progress = storyProgress(room);
  const step = progress.steps[progress.index]?.label ?? "";
  const missing = storyMissing(room);

  if (progress.done) return `La decisión ya está tomada: ${missing.text}. El acta se puede descargar en la pantalla grande.`;

  const people = stageSeats(room).filter((seat) => seat.human);
  const connected = people.filter((seat) => seat.connected).length;

  // Demo con negociación entre agentes: las fases son otras (docs/DECISIONES.md).
  const negotiation = readNegotiation(room);
  if (negotiation) {
    const given = negotiation.positions.filter((entry) => entry.position).length;
    switch (stageStep(room, negotiation)) {
      case "join":
        return `La sala ${roomCode(room)} espera a sus participantes: hay ${connected} de ${people.length} personas conectadas. Para entrar, escanee el código de la pantalla grande.`;
      case "positions":
        return `Cada persona está dando su postura en su celular, con un toque. Van ${given} de ${negotiation.positions.length} posturas.`;
      case "debate":
        return "Los agentes están negociando a la vista en la pantalla grande. Por ahora no hay que hacer nada: solo leer.";
      case "proposal":
        return "La regla visible ya calculó la propuesta con los casos presentados; el debate no la cambia. Enseguida le toca al Comité.";
      case "decision":
        return "Ahora le toca al Comité: que acepte o rechace la propuesta en su celular.";
    }
  }
  const presence = room.demo ? ` Hay ${connected} de ${people.length} personas conectadas.` : "";
  const turn = demoTurn(room);
  if (turn) return `La sala va en el paso ${step}. Ahora le toca a ${turn.who}: ${FORMAL[turn.text] ?? turn.text}.${presence}`;
  return `La sala va en el paso ${step}. Falta ${missing.text}.${presence}`;
}
