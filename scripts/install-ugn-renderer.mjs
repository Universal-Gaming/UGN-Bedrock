import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.argv[2])
const renderer = path.join(root, 'node_modules/minecraft-renderer/src')
const policy = fs.readFileSync(new URL('./ugn-renderer-policy.ts', import.meta.url), 'utf8')
// Replacing via rename also avoids modifying other pnpm hard links.
function write(file, contents) {
  fs.writeFileSync(file + '.ugn-tmp', contents)
  fs.renameSync(file + '.ugn-tmp', file)
}
function replace(file, before, after) {
  const contents = fs.readFileSync(file, 'utf8')
  if (contents.split(before).length !== 2) throw new Error('Renderer source mismatch: ' + file + ' at ' + before)
  write(file, contents.replace(before, () => after))
}

write(path.join(renderer, 'ugnRendererPolicy.ts'), policy)
const loader = path.join(root, 'src/appViewerLoad.ts')
replace(loader, 'export const appGraphicBackends = [', `import { UgnRendererPolicy } from 'minecraft-renderer/src/ugnRendererPolicy'

const createUgnBackend: typeof createGraphicsBackendSingleThread = async init => {
  const policy = new UgnRendererPolicy(
    navigator.hardwareConcurrency || 4,
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4,
    window.devicePixelRatio || 1,
    window.innerWidth * window.innerHeight
  )
  const backend = await createGraphicsBackendSingleThread({
    ...init,
    rendererSpecificSettings: { ...init.rendererSpecificSettings, ugnPolicy: policy }
  })
  return Object.assign(backend, { id: 'ugn', displayName: 'UGN Renderer' })
}
createUgnBackend.id = 'ugn'
createUgnBackend.displayName = 'UGN Renderer'
createUgnBackend.description = 'Adaptive 3D resolution and terrain scheduling. Uses the stable entity and animation renderer.'

export const appGraphicBackends = [`)
replace(loader, '  createGraphicsBackendOffThread,\n]', '  createGraphicsBackendOffThread,\n  createUgnBackend,\n]')
replace(loader, "    if (appViewer.currentDisplay === 'world' && bot) {", `    if (appViewer.currentDisplay !== 'world' && (options.activeRenderer === 'ugn' || appViewer.backendLoader?.id === 'ugn')) {
      await loadBackend()
      return
    }
    if (appViewer.currentDisplay === 'world' && bot) {`)

const documentRenderer = path.join(renderer, 'three/documentRenderer.ts')
replace(documentRenderer, '    this.renderer.setPixelRatio(pixelRatio)\n  }', '    this.renderer.setPixelRatio(this.initOptions.rendererSpecificSettings?.ugnPolicy?.ratio ?? pixelRatio)\n  }')
replace(documentRenderer, '      this.frameRender(sizeChanged)', `      const policy = this.initOptions.rendererSpecificSettings?.ugnPolicy
      if (policy && this.inWorldRenderingConfig && !document.hidden && !this.renderer.xr.isPresenting &&
          policy.sample(performance.now(), this.config.fpsLimit || 0)) {
        this.renderer.setPixelRatio(policy.ratio)
        sizeChanged = true
      }
      this.frameRender(sizeChanged)`)

const world = path.join(renderer, 'lib/worldrendererCommon.ts')
replace(world, '  async processMessageQueue(source: string) {', `  private ugnFramePending = false

  private scheduleUgnMeshResults(budget: number) {
    if (this.ugnFramePending || !this.active || !this.messageQueue.length) return
    this.ugnFramePending = true
    requestAnimationFrame(() => {
      this.ugnFramePending = false
      if (!this.active || this.abortController.signal.aborted) return
      const deadline = performance.now() + budget
      while (!this.stopMesherMessagesProcessing && this.messageQueue.length) {
        this.handleMessage(this.messageQueue.shift()!)
        if (performance.now() >= deadline) break
      }
      if (this.messageQueue.length) this.scheduleUgnMeshResults(budget)
    })
  }

  async processMessageQueue(source: string) {
    const policy = this.initOptions.rendererSpecificSettings?.ugnPolicy
    if (policy) return this.scheduleUgnMeshResults(policy.meshBudgetMs)`)
replace(world, '    for (let y = this.worldMinYRender; y < this.worldSizeParams.worldHeight; y += sectionHeight) {\n      const loc = new Vec3(x, y, z)', `    const feet = this.initOptions.rendererSpecificSettings?.ugnPolicy ? this.viewerChunkPosition?.y : undefined
    for (const y of sectionOrder(this.worldMinYRender, this.worldSizeParams.worldHeight, sectionHeight, feet)) {
      const loc = new Vec3(x, y, z)`)
replace(world, "import { Vec3 } from 'vec3'", "import { Vec3 } from 'vec3'\nimport { sectionOrder } from '../ugnRendererPolicy'")
