// Topes que comparten el servidor y la interfaz. Módulo sin dependencias: el
// celular lo importa para limitar el campo de la razón sin arrastrar zod ni el
// resto del contrato de acciones (src/lib/store/actions.ts) al navegador.

/** Largo máximo de la razón de una decisión. La interfaz debe limitar el campo a esto. */
export const REASON_MAX_LENGTH = 500;
