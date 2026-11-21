"use client";

import { useEffect, useRef } from "react";
import { ScrollText, X } from "lucide-react";
import type { ProjectedRoomState } from "@/lib/genome/schema";
import { AuditConsole } from "./audit-console";

/**
 * Botón discreto «Ver registro» de la pantalla grande. Abre la consola de
 * auditoría completa en un panel lateral, para el jurado. Usa <dialog> nativo:
 * cierra con Escape y devuelve el foco al botón.
 */
export function AuditDrawer({ room, acta }: { room: ProjectedRoomState; acta: { md: string; json: string } }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const close = (event: MouseEvent) => {
      if (event.target === el) el.close();
    };
    el.addEventListener("click", close);
    return () => el.removeEventListener("click", close);
  }, []);

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
        <ScrollText className="size-4" aria-hidden />
        Ver registro
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="registro-titulo"
        className="m-0 ml-auto h-dvh max-h-none w-full max-w-xl bg-transparent p-0 backdrop:bg-black/30 sm:p-3"
      >
        <div className="flex h-full flex-col overflow-hidden bg-white shadow-lift sm:rounded-[1.25rem]">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 id="registro-titulo" className="text-lg font-semibold">
              Registro de auditoría
            </h2>
            <button type="button" onClick={() => dialog.current?.close()} className="grid size-10 place-items-center rounded-full hover:bg-muted" aria-label="Cerrar el registro">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <AuditConsole room={room} acta={acta} />
          </div>
        </div>
      </dialog>
    </>
  );
}
