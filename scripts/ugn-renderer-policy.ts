// Owned by one UGN backend instance. Hardware hints seed quality once.
// Frame measurements then tune only the 3D framebuffer, never the HUD.
export class UgnRendererPolicy {
  readonly meshBudgetMs: number
  readonly maxRatio: number
  ratio: number
  private lastFrame = 0
  private elapsed = 0
  private frames = 0
  private smoothWindows = 0

  constructor(cores: number, memory: number, nativeRatio: number, pixels: number) {
    const modest = cores <= 4 || memory <= 4
    this.meshBudgetMs = modest ? 3 : 5
    this.maxRatio = Math.max(0.5, Math.min(nativeRatio, modest ? 1.25 : 2,
      Math.sqrt((modest ? 1500000 : 3600000) / Math.max(1, pixels))))
    this.ratio = Math.min(this.maxRatio, modest ? 0.9 : 1.25)
  }

  sample(now: number, fpsLimit: number): boolean {
    const delta = now - this.lastFrame
    const first = this.lastFrame === 0
    this.lastFrame = now
    if (first || delta <= 0 || delta > 500) {
      this.elapsed = this.frames = this.smoothWindows = 0
      return false
    }
    this.elapsed += delta
    this.frames++
    if (this.elapsed < 1500) return false
    const mean = this.elapsed / this.frames
    this.elapsed = this.frames = 0
    const budget = 1000 / Math.min(60, fpsLimit > 0 ? fpsLimit : 60)
    const old = this.ratio
    if (mean > budget * 1.35) {
      this.smoothWindows = 0
      this.ratio = Math.max(Math.min(0.65, this.maxRatio), old - 0.125)
    } else if (mean < budget * 1.10) {
      if (++this.smoothWindows >= 3) {
        this.ratio = Math.min(this.maxRatio, old + 0.125)
        this.smoothWindows = 0
      }
    } else {
      this.smoothWindows = 0
    }
    return this.ratio !== old
  }
}

export function* sectionOrder(min: number, end: number, step: number, feet?: number) {
  if (feet === undefined || !Number.isFinite(feet)) {
    for (let y = min; y < end; y += step) yield y
    return
  }
  if (min >= end) return
  const last = min + Math.floor((end - min - 1) / step) * step
  const center = Math.min(last, Math.max(min, min + Math.floor((feet - 1 - min) / step) * step))
  yield center
  for (let offset = step; center + offset <= last || center - offset >= min; offset += step) {
    if (center + offset <= last) yield center + offset
    if (center - offset >= min) yield center - offset
  }
}
