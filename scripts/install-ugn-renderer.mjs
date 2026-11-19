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

// Keep an in-flight move when a head-look or metadata packet repeats its
// destination. Snapshot coordinates: Mineflayer may reuse position objects.
const entities = path.join(renderer, 'three/entities.ts')
replace(entities, '    const cameraSynced = usesCameraSyncedVehiclePosition(entity)\n    if (entity.position)', `    const cameraSynced = usesCameraSyncedVehiclePosition(entity)
    const ugnMotion = !!this.worldRenderer.initOptions.rendererSpecificSettings?.ugnPolicy
    const previous = e.userData._ugnMoveTarget
    if (entity.position)`)
replace(entities, '        e.userData._localVehicleY = entity.position.y', `        if (ugnMotion) {
          e.userData._ugnMoveTarget = undefined
          e.userData._tweenTarget = undefined
        }
        e.userData._localVehicleY = entity.position.y`)
replace(entities, '      } else {\n        const ANIMATION_DURATION = getEntityTweenDurationMs(entity, justAdded)', `      } else if (!ugnMotion || justAdded || !previous || previous.x !== entity.position.x ||
          previous.y !== entity.position.y || previous.z !== entity.position.z) {
        if (ugnMotion) {
          e.userData._ugnMoveTarget = { x: entity.position.x, y: entity.position.y, z: entity.position.z }
          if (e.userData._posTween?.isPlaying()) e.userData._posTween.update(performance.now(), false)
        }
        const ANIMATION_DURATION = getEntityTweenDurationMs(entity, justAdded)`)

// A physics update may arrive between display frames. Carry the interpolated
// position forward to that instant before retargeting local camera motion.
const camera = path.join(renderer, 'three/worldRendererThree.ts')
replace(camera, '        this.currentCameraMovementMode = movementMode\n        this.currentPosTween?.stop()', `        this.currentCameraMovementMode = movementMode
        if (this.initOptions.rendererSpecificSettings?.ugnPolicy && movementMode === 'local-player' &&
            !instant && this.currentPosTween?.isPlaying()) {
          this.currentPosTween.update(performance.now(), false)
        }
        this.currentPosTween?.stop()`)

// 1. Touch drags use incremental deltas. Dropping one loses part of the
// gesture permanently. Use the same pitch for the camera and simulated player.
const look = path.join(root, 'src/cameraRotationControls.ts')
replace(look, 'if (now - lastMouseMove < 4 && !options.preciseMouseInput) return',
  "if (options.activeRenderer !== 'ugn' && now - lastMouseMove < 4 && !options.preciseMouseInput) return")
replace(look, '  appViewer.backend?.updateCamera(null, clampedYaw, pitch)',
  "  appViewer.backend?.updateCamera(null, clampedYaw, options.activeRenderer === 'ugn' ? Math.max(minPitch, Math.min(maxPitch, pitch)) : pitch)")

// 2. The UGN backend implements the stable backendMethods API. Both accessors
// must recognize it so mining, placement and offhand events reach the mesh.
const methods = path.join(renderer, 'three/threeJsMethods.ts')
const methodsSource = fs.readFileSync(methods, 'utf8')
const guard = "renderer?.id !== 'threejs' || !renderer.backendMethods"
if (methodsSource.split(guard).length !== 3) throw new Error('Unexpected Three.js method guards')
write(methods, methodsSource.replaceAll(guard, "(renderer?.id !== 'threejs' && renderer?.id !== 'ugn') || !renderer.backendMethods"))

const cursor = path.join(renderer, 'three/world/cursorBlock.ts')
replace(cursor, "import { loadThreeJsTextureFromUrl } from '../threeJsUtils'", "import { loadThreeJsTextureFromUrlSync } from '../threeJsUtils'")
replace(cursor, 'void loadThreeJsTextureFromUrl(destroyStagesImages[i]).then(texture => {',
  'void loadThreeJsTextureFromUrlSync(destroyStagesImages[i]).promise.then(texture => {')
replace(cursor, '      })\n    }\n\n    const breakMaterial', "      }).catch(error => console.warn('Mining crack texture failed:', i, error))\n    }\n\n    const breakMaterial")
replace(cursor, '        this.breakTextures.push(texture)', `        this.breakTextures[i] = texture
        const digging = this.worldRenderer.playerStateReactive.diggingBlock
        if (digging?.stage === i) this.updateBreakAnimation(digging, i, digging.mergedShape)`)
replace(cursor, '    const { position: _position, width, height, depth } = mergedShape', `    const texture = this.breakTextures[stage]
    if (!texture) return
    const { position: _position, width, height, depth } = mergedShape`)
replace(cursor, 'this.breakTextures[stage] ?? this.breakTextures.at(-1)', 'texture')

// 3. Base a moving mob's display interval on successive distinct positions.
// Pauses and bursts must not turn the next ordinary movement into a long glide.
replace(entities, '        const ANIMATION_DURATION = getEntityTweenDurationMs(entity, justAdded)', `        let ANIMATION_DURATION = getEntityTweenDurationMs(entity, justAdded)
        if (ugnMotion) {
          const now = performance.now()
          const interval = now - (e.userData._ugnMoveAt ?? now)
          e.userData._ugnMoveAt = now
          const cadence = e.userData._ugnMoveMs ?? 100
          e.userData._ugnMoveMs = interval >= 25 && interval <= 250
            ? Math.max(50, Math.min(150, cadence * 0.5 + interval * 0.5))
            : interval > 250 ? 100 : cadence
          if (ANIMATION_DURATION) ANIMATION_DURATION = e.userData._ugnMoveMs
        }`)
replace(entities, "    if (typeof targetYaw === 'number' && Number.isFinite(targetYaw)) {", `    if (typeof targetYaw === 'number' && Number.isFinite(targetYaw) &&
        (!ugnMotion || cameraSynced || e.userData._ugnTargetYaw !== targetYaw)) {
      if (ugnMotion) {
        e.userData._ugnTargetYaw = cameraSynced ? undefined : targetYaw
        if (e.userData._rotTween?.isPlaying()) e.userData._rotTween.update(performance.now(), false)
      }`)

// Scene coordinates are camera-relative. Occlusion keys and player distance
// must use the mob's world coordinates, including far from the world origin.
replace(entities, '    const dt = Math.min(this.clock.getDelta(), 1 / 30)', `    const ugn = !!this.worldRenderer.initOptions.rendererSpecificSettings?.ugnPolicy
    const dt = Math.min(this.clock.getDelta(), ugn ? 0.1 : 1 / 30)`)
replace(entities, `        const dx = entity.position.x - botPos.x
        const dy = entity.position.y - botPos.y
        const dz = entity.position.z - botPos.z`, `        const origin = this.worldRenderer.sceneOrigin
        const pos = ugn ? origin.getWorldPosition(entity) ?? {
          x: origin.toWorldX(entity.position.x),
          y: origin.toWorldY(entity.position.y),
          z: origin.toWorldZ(entity.position.z)
        } : entity.position
        const dx = pos.x - botPos.x
        const dy = pos.y - botPos.y
        const dz = pos.z - botPos.z`)
replace(entities, 'const sectionKey = this.worldRenderer.entitySectionKey(entity.position.x, entity.position.y, entity.position.z)',
  'const sectionKey = this.worldRenderer.entitySectionKey(pos.x, pos.y, pos.z)')
