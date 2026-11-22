"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ConnectionBadge } from "@/components/nexo/connection-badge";
import { RoomHeader } from "@/components/nexo/room-header";
import { CommandCenter } from "@/components/stage/command-center";
import { isDemoRoom } from "@/components/stage/seats";
import { actaUrl, claimHostCredentials, createRoom, loadHostCredentials, useRoom, type CreateRoomOptions, type HostCredentials } from "@/lib/client/use-room";
import { CROSS_ORG_SCENARIOS } from "@/lib/genome/scenarios";

const FIXED_ROOMS = new Set(["demo", ...Object.values(CROSS_ORG_SCENARIOS).map((scenario) => scenario.fixedRoomId)]);

// /stage/demo-cross ya no es una sala: abre una sala de demo nueva, con código
// propio, y lleva a ella. Así el código de una sala no se reutiliza nunca.
const NEW_DEMO_PATH = "demo-cross";
let opening: Promise<string> | null = null;

export default function StageClient() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  // Si no se pudo abrir la sala nueva (sin red, límite de salas), se muestra la fija: la demo no se cae.
  const [fallback, setFallback] = useState(false);
  const redirecting = roomId === NEW_DEMO_PATH && !fallback;

  useEffect(() => {
    if (!redirecting) return;
    let cancelled = false;
    // Una sola sala aunque el efecto corra dos veces (modo estricto de React en desarrollo).
    opening ??= createRoom("cross_org", { scenario: "hospitales", demo: true }).then((created) => created.roomId);
    opening
      .then((id) => !cancelled && router.replace(`/stage/${encodeURIComponent(id)}`))
      .catch(() => !cancelled && setFallback(true))
      .finally(() => (opening = null));
    return () => {
      cancelled = true;
    };
  }, [redirecting, router]);

  if (redirecting) return <main className="p-6 text-lg text-muted-foreground">Abriendo una sala nueva…</main>;
  return <StageRoom roomId={roomId} />;
}

// Pantalla grande. Mira la sala como "stage": recibe solo lo que todos pueden
// ver, y lo muestra en el centro de mando (src/components/stage/command-center.tsx).
function StageRoom({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { room, status, unreachable, problem } = useRoom(roomId, { spectator: true });
  const [host, setHost] = useState<HostCredentials | null | undefined>(undefined);

  // Credenciales del anfitrión: las guardó este navegador al crear la sala, o
  // se piden para una sala fija (en desarrollo se entregan; en el deploy, no).
  useEffect(() => {
    let cancelled = false;
    const stored = loadHostCredentials(roomId);
    if (stored || !FIXED_ROOMS.has(roomId)) {
      queueMicrotask(() => !cancelled && setHost(stored));
      return () => {
        cancelled = true;
      };
    }
    void claimHostCredentials(roomId).then((claimed) => !cancelled && setHost(claimed));
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  if (!room) {
    return (
      <>
        <RoomHeader subtitle={`Sala ${roomId}`}>
          <ConnectionBadge status={status} />
        </RoomHeader>
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 p-6">
          {unreachable ? (
            <>
              <h1 className="h-sub">No encontramos esta sala</h1>
              <p className="text-muted-foreground">Las salas viven en la memoria del servidor: si se reinició, la sala ya no existe.</p>
              <Link className="btn btn-primary mt-2 self-start" href="/">
                Volver a la portada
              </Link>
            </>
          ) : (
            <p className="text-muted-foreground">Conectando con la sala…</p>
          )}
          {problem && (
            <p role="alert" className="small rounded-xl bg-clash-soft px-3 py-2 text-clash">
              {problem}
            </p>
          )}
        </main>
      </>
    );
  }

  const cross = room.mode === "cross_org" && !!room.scarcity && !!room.allocation;
  const acta = { md: actaUrl(roomId, "md"), json: actaUrl(roomId, "json") };

  // Abre una sala nueva del mismo caso, con sus propios controles y QR del Comité.
  async function openOwnRoom() {
    try {
      // Desde una sala de demo se abre otra de demo: 3 personas y los roles administrativos automáticos.
      const options: CreateRoomOptions = { ...(room!.scenarioId ? { scenario: room!.scenarioId } : {}), ...(isDemoRoom(room!) ? { demo: true } : {}) };
      const created = cross
        ? await createRoom("cross_org", options)
        : await createRoom("single_org", { seed: room!.orgs[0]?.orgId });
      router.push(`/stage/${encodeURIComponent(created.roomId)}`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo abrir la sala.");
    }
  }

  return <CommandCenter room={room} status={status} host={host ?? null} acta={acta} onOpenOwnRoom={openOwnRoom} />;
}
