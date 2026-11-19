// Owned by one UGN backend instance. Hardware hints seed quality once.
// Frame measurements then tune only the 3D framebuffer, never the HUD.
export class UgnRendererPolicy {
  meshBudgetMs: number
  private readonly maxMeshBudget: number
  private readonly modest: boolean
  private pacingTime = 0
  private lateTime = 0
  private steadyPeriods = 0
  maxRatio = 1
  ratio: number
  private lastFrame = 0
  private elapsed = 0
  private frames = 0
  private smoothWindows = 0

  constructor(cores: number, memory: number, nativeRatio: number, pixels: number) {
    const modest = this.modest = cores <= 4 || memory <= 4
    this.meshBudgetMs = this.maxMeshBudget = modest ? 3 : 5
    this.maxRatio = this.viewportLimit(nativeRatio, pixels)
    this.ratio = Math.min(this.maxRatio, modest ? 0.9 : 1.25)
  }

  private viewportLimit(nativeRatio: number, pixels: number) {
    return Math.max(0.5, Math.min(nativeRatio, this.modest ? 1.25 : 2,
      Math.sqrt((this.modest ? 1500000 : 3600000) / Math.max(1, pixels))))
  }

  resize(nativeRatio: number, pixels: number): boolean {
    if (!(pixels > 0) || !(nativeRatio > 0)) return false
    this.maxRatio = this.viewportLimit(nativeRatio, pixels)
    const previous = this.ratio
    this.ratio = Math.min(previous, this.maxRatio)
    return this.ratio !== previous
  }

  sample(now: number, fpsLimit: number): boolean {
    const delta = now - this.lastFrame
    const first = this.lastFrame === 0
    this.lastFrame = now
    if (first || delta <= 0 || delta > 500) {
      this.elapsed = this.frames = this.smoothWindows = 0
      this.pacingTime = this.lateTime = this.steadyPeriods = 0
      return false
    }
    const budget = 1000 / Math.min(60, fpsLimit > 0 ? fpsLimit : 60)
    this.pacingTime += delta
    this.lateTime += Math.max(0, delta - budget * 1.15)
    if (this.pacingTime >= 350) {
      if (this.lateTime / this.pacingTime > 0.14) {
        this.meshBudgetMs = Math.max(1, this.meshBudgetMs - 1)
        this.steadyPeriods = 0
      } else if (this.lateTime / this.pacingTime < 0.035) {
        if (++this.steadyPeriods >= 3) {
          this.meshBudgetMs = Math.min(this.maxMeshBudget, this.meshBudgetMs + 1)
          this.steadyPeriods = 0
        }
      } else {
        this.steadyPeriods = 0
      }
      this.pacingTime = this.lateTime = 0
    }
    this.elapsed += delta
    this.frames++
    if (this.elapsed < 1500) return false
    const mean = this.elapsed / this.frames
    this.elapsed = this.frames = 0
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
