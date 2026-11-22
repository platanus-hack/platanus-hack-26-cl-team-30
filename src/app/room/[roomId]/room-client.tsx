"use client";

import { useEffect, useState } from "react";
import { Dices } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { seatTurn } from "@/components/nexo/guide";
import { committeeKeyStorageKey } from "@/components/nexo/voice-assistant";
import { findOrg, isArbiter, isRoleViewer, roleLabel } from "@/components/organs/format";
import { DemoSeatView, demoSeatList } from "@/components/seat/demo-view";
import { NegotiationSeatView } from "@/components/seat/negotiation-view";
import { RevealCard } from "@/components/seat/reveal-card";
import { RoomView } from "@/components/seat/room-view";
import { SeatPicker } from "@/components/seat/seat-picker";
import { freeDrawSeats } from "@/components/seat/screen";
import { SeatActions, SeatMain, SeatShell, type SeatTab } from "@/components/seat/seat-shell";
import { SecretsView } from "@/components/seat/secrets-view";
import { TurnView } from "@/components/seat/turn-view";
import { actaUrl, useRoom } from "@/lib/client/use-room";

// La tarjeta «Te tocó» se muestra una vez por silla: al tocar «Entrar a mi
// silla» se recuerda en esta pestaña, y recargar no la vuelve a mostrar.
const enteredKey = (roomId: string) => `nexo:${roomId}:entered`;

function loadEntered(roomId: string): string | null {
  try {
    return window.sessionStorage.getItem(enteredKey(roomId));
  } catch {
    return null;
  }
}

function storeEntered(roomId: string, seat: string | null): void {
  try {
    if (seat) window.sessionStorage.setItem(enteredKey(roomId), seat);
    else window.sessionStorage.removeItem(enteredKey(roomId));
  } catch {
    // Sin almacenamiento la tarjeta de entrada vuelve a aparecer al recargar.
  }
}

/** Clave del QR del Comité, si este teléfono entró con ella. Solo así el Comité entra a su sorteo. */
function loadCommitteeKey(roomId: string): string | undefined {
  try {
    return new URLSearchParams(window.location.search).get("key") ?? window.sessionStorage.getItem(committeeKeyStorageKey(roomId)) ?? undefined;
  } catch {
    return undefined;
  }
}

/** true si el enlace nombra un rol (QR de un rol): entonces no hay sorteo. */
function linkNamesRole(): boolean {
  const query = new URLSearchParams(window.location.search);
  return query.has("orgId") && query.has("roleId");
}

// Silla de un rol, pensada para el celular: una tarjeta por pantalla, un botón
// en la zona del pulgar y tres pestañas (Tu turno, Secretos, Sala). Solo dibuja
// el estado que el servidor ya filtró para este rol y envía las mismas acciones
// de siempre; las piezas están en src/components/seat/.
export default function RoomClient() {
  const { roomId } = useParams<{ roomId: string }>();
  const { room, status, unreachable, problem, session, notice, join, joinRandom, leave, act } = useRoom(roomId);
  // La pestaña se recuerda por silla (token): una silla nueva empieza en «Tu turno».
  const [tabState, setTabState] = useState<{ token: string | null; tab: SeatTab }>({ token: null, tab: "turn" });
  const tab: SeatTab = tabState.token === (session?.token ?? null) ? tabState.tab : "turn";
  const setTab = (next: SeatTab) => setTabState({ token: session?.token ?? null, tab: next });
  const [enteredSeat, setEnteredSeat] = useState<string | null>(() => (typeof window === "undefined" ? null : loadEntered(roomId)));
  // Sorteo de silla: quien llega con el QR único de la sala (sin rol en el enlace
  // y sin silla guardada) recibe una al azar. "failed": no quedaban sillas libres.
  const [draw, setDraw] = useState<"idle" | "pending" | "failed">(() => (typeof window !== "undefined" && !session && !linkNamesRole() ? "pending" : "idle"));
  const [byLink] = useState(() => typeof window !== "undefined" && linkNamesRole());

  const drawSeat = () => joinRandom(loadCommitteeKey(roomId));

  // Entrada por código QR. El de un rol trae la organización, el rol y, para el
  // Comité, su clave. El QR único de la sala no trae rol: se sortea una silla.
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const orgId = query.get("orgId");
    const roleId = query.get("roleId");
    const key = query.get("key") ?? undefined;
    if (key) {
      try {
        window.sessionStorage.setItem(committeeKeyStorageKey(roomId), key);
      } catch {
        // Sin almacenamiento la voz pedirá volver a escanear el código.
      }
    }
    if (orgId && roleId && !(session?.orgId === orgId && session.roleId === roleId)) void join(orgId, roleId, key);
    else if (draw === "pending") void joinRandom(key).then((result) => setDraw(result.ok ? "idle" : "failed"));
    // Solo al cargar: después manda lo que la persona elija en pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alert = notice ?? problem;

  if (!room) {
    return (
      <SeatShell who={{ title: "Sculptor", org: `Sala ${roomId}` }} stakes={null} status={status} alert={alert}>
        <SeatMain>
          <section className="st-card">
            {unreachable ? (
              <>
                <h1 className="st-title" style={{ marginBlockStart: 0 }}>
                  No encontramos esta sala
                </h1>
                <p className="st-support">Pide un código nuevo en la pantalla grande.</p>
                <Link className="st-btn" style={{ marginBlockStart: 16 }} href="/">
                  Volver a la portada
                </Link>
              </>
            ) : (
              <Entering title="Conectando con la sala" />
            )}
          </section>
        </SeatMain>
      </SeatShell>
    );
  }

  const me = isRoleViewer(room.viewer) ? room.viewer : null;
  const subtitle = room.mode === "cross_org" && room.scarcity ? room.scarcity.resource : (room.orgs[0]?.orgName ?? `Sala ${roomId}`);

  // Sin silla todavía: elegir una (o esperar a que el servidor confirme la del enlace).
  if (!me) {
    return (
      <SeatShell who={{ title: "Sculptor", org: subtitle }} stakes={room.stakes} status={status} alert={alert}>
        {session || draw === "pending" ? (
          <SeatMain>
            <section className="st-card">
              <Entering title={session ? "Entrando a tu silla" : "Sorteando tu silla"} />
            </section>
          </SeatMain>
        ) : (
          <SeatPicker room={room} onJoin={join}>
            {freeDrawSeats(room, !!loadCommitteeKey(roomId)) > 0 && (
              <SeatActions>
                <button type="button" className="st-btn" onClick={() => void drawSeat()}>
                  <Dices aria-hidden />
                  {room.demo ? "Entrar" : "Sortear mi rol"}
                </button>
              </SeatActions>
            )}
          </SeatPicker>
        )}
      </SeatShell>
    );
  }

  const myOrg = findOrg(room, me.orgId);
  const myRole = myOrg?.roles.find((role) => role.id === me.roleId);
  const arbiter = isArbiter(room);
  // La tarjeta «Te tocó» se muestra una vez por silla recibida: cada sorteo o
  // ronda nueva trae otro token, así que vuelve a aparecer aunque toque la misma silla.
  const seat = session?.token ?? `${me.orgId}/${me.roleId}`;
  const who = { title: roleLabel(room, me.orgId, me.roleId), org: arbiter ? "Entre organizaciones" : myOrg?.orgName, accent: myRole?.accentColor ?? ("violet" as const) };

  function leaveSeat() {
    storeEntered(roomId, null);
    setEnteredSeat(null);
    setTab("turn");
    void leave();
  }

  // Demo pauteada: quien tiene uno de los 3 asientos humanos ve solo quién es y, cuando
  // le toca, un botón. Sin tarjeta de entrada, sin «Sortear otro rol» y sin pestañas.
  const demoSeat = room.demo ? demoSeatList(room).find((entry) => entry.orgId === me.orgId && entry.roleId === me.roleId) : undefined;
  if (demoSeat) {
    return (
      <SeatShell who={{ title: demoSeat.label, org: arbiter ? undefined : myOrg?.orgName, accent: demoSeat.accent }} stakes={room.stakes} status={status} alert={alert}>
        {/* Negociación entre agentes: posturas, debate y propuesta en su vista; la decisión y el acta, en la de demo. */}
        {room.negotiation && ["positions", "debate", "proposal"].includes(room.negotiation.phase) ? (
          <NegotiationSeatView room={room} me={me} act={act} />
        ) : (
          <DemoSeatView room={room} me={me} act={act} acta={{ md: actaUrl(roomId, "md") }} session={session} />
        )}
      </SeatShell>
    );
  }

  // «Sortear otro rol» solo para quien llegó por sorteo y mientras quede otra silla libre.
  const canReroll = !byLink && !room.demo && freeDrawSeats(room, !!loadCommitteeKey(roomId), me) > 0;

  // Recién llegado: la tarjeta «Te tocó», antes de mostrar el turno.
  if (enteredSeat !== seat) {
    return (
      <SeatShell who={who} stakes={room.stakes} status={status} alert={alert}>
        <RevealCard
          room={room}
          me={me}
          onEnter={() => {
            storeEntered(roomId, seat);
            setEnteredSeat(seat);
          }}
          onChange={canReroll ? drawSeat : undefined}
          changeLabel="Sortear otro rol"
        />
      </SeatShell>
    );
  }

  const turn = seatTurn(room);
  const acta = { md: actaUrl(roomId, "md"), json: actaUrl(roomId, "json") };
  // El Comité: el árbitro entre organizaciones o, en una sola organización, el rol que entra por QR.
  const committee = arbiter || myRole?.isQrOptional === true;
  const myMove = turn?.kind === "action" || turn?.kind === "sign-gate" || turn?.kind === "sign-allocation";

  return (
    <SeatShell who={who} stakes={room.stakes} status={status} alert={alert} tab={tab} onTab={setTab} turnPending={myMove}>
      {tab === "turn" &&
        (turn ? (
          // La clave reinicia el formulario (razón, valor) cuando cambia el turno.
          <TurnView key={`${turn.kind}/${room.allocation?.winnerCaseId ?? ""}`} room={room} me={me} turn={turn} act={act} acta={acta} />
        ) : (
          <SeatMain>
            <section className="st-card">
              <Entering title="Preparando tu turno" />
            </section>
          </SeatMain>
        ))}
      {tab === "secrets" && <SecretsView room={room} me={me} act={act} />}
      {tab === "room" && <RoomView room={room} me={me} roomId={roomId} act={act} acta={acta} committee={committee} onLeave={leaveSeat} />}
    </SeatShell>
  );
}

function Entering({ title }: { title: string }) {
  return (
    <>
      <h1 className="st-title" style={{ marginBlockStart: 0 }}>
        {title}
      </h1>
      <p className="st-dots" aria-hidden>
        <i />
        <i />
        <i />
      </p>
    </>
  );
}
