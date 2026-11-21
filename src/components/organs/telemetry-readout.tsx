import type { Telemetry } from "@/lib/genome/schema";
import { cn } from "@/lib/utils";
import { formatBytes } from "./format";

/**
 * Telemetría del modelo tal como la informa el servidor. Dice dónde corre de
 * verdad: local (ningún dato sale de la red) o nube (cuántos bytes salieron).
 */
export function TelemetryReadout({ telemetry, className }: { telemetry: Telemetry; className?: string }) {
  const local = telemetry.provider === "local";
  return (
    <div className={cn("border-t border-border pt-3 text-sm", className)}>
      <p>
        <span className={cn("mr-1.5 inline-block size-2 rounded-full", local ? "bg-calm" : "bg-clash")} aria-hidden />
        {local ? (
          <>
            <strong className="font-semibold">Modelo local.</strong> Ningún dato sale de la red.
          </>
        ) : telemetry.bytesSentToCloud === 0 ? (
          <>
            <strong className="font-semibold">Modelo en la nube.</strong> Aún no hay llamadas desde que arrancó el servidor. Cada vez que responda un agente, los datos que reciba
            saldrán de la red y se contarán aquí.
          </>
        ) : (
          <>
            <strong className="font-semibold">Modelo en la nube.</strong> Desde que arrancó el servidor se han enviado {formatBytes(telemetry.bytesSentToCloud)} fuera de la red.
          </>
        )}
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
        <Datum label="Modelo" value={telemetry.modelName} />
        <Datum label="Servidor" value={telemetry.endpointHost} />
        <Datum label="A la nube, desde el arranque" value={local && telemetry.bytesSentToCloud === 0 ? "nada" : formatBytes(telemetry.bytesSentToCloud)} />
        <Datum label="Última respuesta" value={telemetry.lastLatencyMs ? `${Math.round(telemetry.lastLatencyMs)} ms` : "sin llamadas"} />
        <Datum label="Velocidad" value={telemetry.tokensPerSec ? `${Math.round(telemetry.tokensPerSec)} tokens/s` : "sin llamadas"} />
        <Datum label="En cola" value={String(telemetry.queueDepth)} />
      </dl>
    </div>
  );
}

function Datum({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-semibold tabular-nums" title={value}>
        {value}
      </dd>
    </div>
  );
}
