export const GAMEPLAY_HELP = {
  wire: 'Arraste da fonte até o destino, passando pelos lados conectores. Você pode continuar um fio em outro gesto. Depois, toque em Simular.',
  AND: 'Toque numa célula livre para colocar AND. Toque novamente na porta selecionada para girar. Alimente as duas entradas.',
  OR: 'Toque numa célula livre para colocar OR. Toque novamente na porta selecionada para girar. Alimente as duas entradas.',
  NOT: 'Toque numa célula livre para colocar NOT. Toque novamente na porta selecionada para girar. A seta indica a saída.',
  erase: 'Toque na peça que deseja apagar. Fontes, destinos, paredes e portas fixas permanecem no tabuleiro.',
} as const

export function inverterPreviewHint(input: 0 | 1, output: 0 | 1): string {
  return `Toque na entrada. O NOT transforma ${input} em ${output}.`
}
