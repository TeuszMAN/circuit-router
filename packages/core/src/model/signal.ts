/**
 * Valor lógico transportado por uma net. `undefined` representa "sem driver"
 * (flutuante) — nunca é normalizado para 0, conforme SDD §4.4/§9.A (P1).
 */
export type Signal = 0 | 1 | undefined
