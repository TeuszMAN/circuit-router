// PRNG determinístico para o gerador procedural (MI-05, SDD §9.4).
// Um mesmo seed produz exatamente a mesma sequência em qualquer runtime —
// é o que garante "mesma seed => fase byte-idêntica".
// mulberry32 (seed 32 bits): pequeno, rápido e com distribuição decente
// para fins de geração de fases (não é criptográfico — não precisa ser).

export class Rng {
  private state: number

  constructor(seed: number) {
    // Normaliza para uint32 e evita estado zero (mulberry32 travaria).
    this.state = (seed >>> 0) || 0x9e3779b9
  }

  /** Próximo float em [0, 1). */
  next(): number {
    let t = (this.state += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Inteiro em [0, max) — max > 0. */
  int(max: number): number {
    return Math.floor(this.next() * max)
  }

  /** Inteiro em [min, max] inclusive. */
  intInclusive(min: number, max: number): number {
    return min + this.int(max - min + 1)
  }

  /** true com probabilidade p (default 0.5). */
  chance(p = 0.5): boolean {
    return this.next() < p
  }

  /** Escolhe um elemento do array (não vazio). */
  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)] as T
  }

  /** Embaralha uma cópia do array (Fisher–Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items]
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1)
      const tmp = out[i] as T
      out[i] = out[j] as T
      out[j] = tmp
    }
    return out
  }
}
