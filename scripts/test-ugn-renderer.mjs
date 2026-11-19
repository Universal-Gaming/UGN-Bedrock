import assert from 'node:assert/strict'
import { UgnRendererPolicy, sectionOrder } from './ugn-renderer-policy.ts'

for (const feet of [-128, 0, 64, 71, 322, undefined]) {
  const heights = [...sectionOrder(-64, 320, 16, feet)]
  assert.deepEqual([...heights].sort((a, b) => a - b), Array.from({length: 24}, (_, i) => -64 + i * 16))
}
assert.deepEqual([...sectionOrder(-64, 320, 16, 64)].slice(0, 3), [48, 64, 32])
const policy = new UgnRendererPolicy(4, 4, 3, 1080 * 720)
assert.equal(policy.meshBudgetMs, 3)
let now = 0
function frames(count, delta, limit = 60) {
  for (let i = 0; i < count; i++) policy.sample(now += delta, limit)
}
const initial = policy.ratio
frames(100, 38)
assert.ok(policy.ratio < initial)
frames(2400, 16.67)
assert.equal(policy.ratio, policy.maxRatio)
frames(500, 33.33, 30)
assert.equal(policy.ratio, policy.maxRatio)
frames(5, 60000)
assert.equal(policy.ratio, policy.maxRatio)
const hugeDisplay = new UgnRendererPolicy(16, 16, 3, 8000000)
assert.ok(hugeDisplay.maxRatio < 1)
console.log('UGN renderer policy checks passed')

const pacing = new UgnRendererPolicy(8,8,3,800*600)
let clock = 100
function advance(count, interval, target) {
  for(let i=0;i<count;i++) pacing.sample(clock+=interval,target)
}
advance(45,40,60)
assert.equal(pacing.meshBudgetMs,1)
advance(360,1000/30,30)
assert.equal(pacing.meshBudgetMs,5)
advance(1,4000,30)
assert.equal(pacing.meshBudgetMs,5)
assert.equal(pacing.resize(3,3840*2160),true)
assert.ok(pacing.ratio*pacing.ratio*3840*2160 <= 3600001)
const wideRatio = pacing.ratio
assert.equal(pacing.resize(2,800*600),false)
assert.equal(pacing.ratio,wideRatio)
advance(1500,1000/60,60)
assert.ok(pacing.ratio>wideRatio)
console.log('Adaptive terrain pacing, 30 FPS cap, tab resume and viewport changes passed')
