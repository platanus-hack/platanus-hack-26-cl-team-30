"use client";

import { useEffect, useState } from "react";

export type IntegrationsStatus = { whatsapp: boolean; voice: boolean; canCall: boolean };

const NONE: IntegrationsStatus = { whatsapp: false, voice: false, canCall: false };

/**
 * Canales externos configurados en el servidor (GET /api/integrations/status).
 * Si la ruta no responde, se asume que no hay ninguno: los botones no aparecen.
 */
export function useIntegrations(): IntegrationsStatus | null {
  const [status, setStatus] = useState<IntegrationsStatus | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/integrations/status", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (cancelled) return;
        setStatus({
          whatsapp: data?.whatsapp?.configured === true,
          voice: data?.voice?.configured === true,
          canCall: data?.voice?.canCall === true,
        });
      })
      .catch(() => {
        if (!cancelled) setStatus(NONE);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return status;
}
