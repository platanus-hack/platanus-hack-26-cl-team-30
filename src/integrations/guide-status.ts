// Lo que la guía puede decir de una sala: solo lo público. Se arma con la vista
// general de la sala (viewer "stage"), la misma que recibe la pantalla grande, así
// que ningún dato reservado llega hasta aquí. Usa las mismas reglas de texto que
// la pantalla grande (src/components/stage/story.ts), en trato de usted.

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
  const presence = room.demo ? ` Hay ${connected} de ${people.length} personas conectadas.` : "";
  const turn = demoTurn(room);
  if (turn) return `La sala va en el paso ${step}. Ahora le toca a ${turn.who}: ${FORMAL[turn.text] ?? turn.text}.${presence}`;
  return `La sala va en el paso ${step}. Falta ${missing.text}.${presence}`;
}
