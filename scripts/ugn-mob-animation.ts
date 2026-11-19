// Visual gait follows the interpolated model, including when packets arrive in bursts.
export class UgnGait {
  x = NaN
  z = NaN
  phase = 0
  amount = 0

  advance(x: number, z: number, seconds: number) {
    const distance = Math.hypot(x - this.x, z - this.z)
    this.x = x
    this.z = z
    if (!(seconds > 0) || !Number.isFinite(distance) || distance > 4) {
      this.amount = 0
      return
    }
    const target = Math.min(1, distance / seconds * 0.2)
    this.amount += (target - this.amount) * (1 - Math.exp(-10 * seconds))
    if (this.amount < 0.0001) this.amount = 0
    this.phase += this.amount * 20 * seconds
  }
}

export function deathRoll(elapsedMs: number) {
  return Math.PI * 0.5 * Math.min(1, Math.sqrt(Math.max(0, elapsedMs / 1000) * 1.6))
}
