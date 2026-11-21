"use client";

import { useState } from "react";
import { ArrowRight, Dices, LoaderCircle, Lock, LockOpen } from "lucide-react";
import { findOrg, isArbiter, roleLabel, type RoleViewer } from "@/components/organs/format";
import type { ProjectedRoomState } from "@/lib/genome/schema";
import { mission as missionFor, revealChips } from "./screen";
import { SeatActions, SeatMain } from "./seat-shell";

type Props = {
  room: ProjectedRoomState;
  me: RoleViewer;
  onEnter: () => void;
  /** Cambiar de silla. Con sorteo: «Sortear otro rol»; sin él, vuelve a la lista. */
  onChange?: () => Promise<unknown> | void;
  changeLabel?: string;
};

/**
 * Lo primero que ve quien entra: «Te tocó <rol>», su organización, la misión
 * en una frase y dos chips (un dato que ve y cuántos no). Un solo botón grande.
 */
export function RevealCard({ room, me, onEnter, onChange, changeLabel = "Elegir otra silla" }: Props) {
  const [busy, setBusy] = useState(false);
  const org = findOrg(room, me.orgId);
  const role = org?.roles.find((entry) => entry.id === me.roleId);
  const arbiter = isArbiter(room);
  const chips = revealChips(room, me);
  const tag = role?.shortTag ?? room.scarcity?.arbiter.shortTag ?? "";
  // Una frase sin jerga: en la demo, presentar el caso o elegir; si no, la del genoma.
  const mission = missionFor(room, me);

  async function change() {
    if (!onChange) return;
    setBusy(true);
    await onChange();
    setBusy(false);
  }

  return (
    <>
      <SeatMain>
        <section className="st-card" aria-live="polite">
          {tag && (
            <span className="st-status" data-tone="accent">
              {tag}
            </span>
          )}
          <h1 className="st-title">
            <span className="st-kicker" style={{ display: "block", marginBlockStart: 4, letterSpacing: 0 }}>
              Te tocó
            </span>
            {roleLabel(room, me.orgId, me.roleId)}
          </h1>
          <p className="st-support">{arbiter ? `Árbitro entre ${room.orgs.length} organizaciones` : org?.orgName}</p>
          <p className="st-clamp" style={{ marginBlockStart: 14, paddingBlockStart: 14, borderBlockStart: "1px solid var(--st-line)", fontSize: 17, fontWeight: 650 }}>
            {mission}
          </p>
          <div className="st-pills">
            <span className="st-pill" data-kind="sees">
              <LockOpen aria-hidden />
              <span>{chips.sees}</span>
            </span>
            <span className="st-pill" data-kind="hidden">
              <Lock aria-hidden />
              <span>{chips.hidden}</span>
            </span>
          </div>
        </section>
      </SeatMain>
      <SeatActions stack>
        <button type="button" className="st-btn" onClick={onEnter}>
          Entrar a mi silla
          <ArrowRight aria-hidden />
        </button>
        {onChange && (
          <button type="button" className="st-btn" data-kind="quiet" disabled={busy} onClick={change}>
            {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <Dices aria-hidden />}
            {changeLabel}
          </button>
        )}
      </SeatActions>
    </>
  );
}
