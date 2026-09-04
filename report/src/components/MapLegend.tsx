export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex)
  const r = m?.[1]
  const g = m?.[2]
  const b = m?.[3]
  if (r === undefined || g === undefined || b === undefined) return `rgba(0,0,0,${alpha})`
  return `rgba(${parseInt(r, 16)},${parseInt(g, 16)},${parseInt(b, 16)},${alpha})`
}
