/**
 * Quantização e correção de diagonais do traço de arrasto (SDD §7.4). Puro,
 * sem DOM: dado o último ponto quantizado do traço e o novo ponto amostrado
 * do ponteiro, produz os passos ortogonais intermediários que preenchem
 * qualquer salto diagonal — um arrasto rápido nunca deixa buracos no fio.
 */

import type { Coord } from '@circuit/core/model'

export function coordsEqual(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y
}

/**
 * Caminho ortogonal contíguo de `from` até `to`, exclusive `from`. Cada passo
 * muda exatamente uma coordenada em 1 (nunca diagonal); a distância percorrida
 * em cada eixo é reduzida proporcionalmente ao restante, produzindo uma
 * escada mesmo quando `from`/`to` distam várias células em ambos os eixos.
 */
export function orthogonalBridge(from: Coord, to: Coord): Coord[] {
  const steps: Coord[] = []
  let x = from.x
  let y = from.y
  const stepX = Math.sign(to.x - x)
  const stepY = Math.sign(to.y - y)
  let remX = Math.abs(to.x - x)
  let remY = Math.abs(to.y - y)

  while (remX > 0 || remY > 0) {
    if (remX >= remY && remX > 0) {
      x += stepX
      remX -= 1
    } else {
      y += stepY
      remY -= 1
    }
    steps.push({ x, y })
  }
  return steps
}
