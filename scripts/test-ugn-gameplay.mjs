import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'

const root = path.resolve(process.argv[2])
const ts = createRequire(path.join(root, 'package.json'))('typescript')
const three = 'node_modules/minecraft-renderer/src/three/'
function run(file, globals, imports = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  const { outputText } = ts.transpileModule(source, {compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS
  }})
  const exports = {}
  vm.runInNewContext(outputText, {exports, require: name => imports[name] ?? {}, ...globals})
  return exports
}

const cameraAngles = []
const botAngles = []
const bot = {entity: {pitch: 0, yaw: 0}, mouse: {update() {}}, look(yaw, pitch) {
  botAngles.push([yaw, pitch])
  Object.assign(this.entity, {yaw, pitch})
}}
const camera = run('src/cameraRotationControls.ts', {
  appViewer: {playerState: {reactive: {}}, backend: {updateCamera(_, yaw, pitch) { cameraAngles.push([yaw, pitch]) }}},
  window: {addEventListener() {}}, document: {addEventListener() {}}, performance: {now: () => 25}, bot
}, {
  './globalState': {isGameActive: () => true},
  './optionsStorage': {options: {activeRenderer: 'ugn', mouseSensX: 100, mouseSensY: 100}},
  'minecraft-renderer/src': {getPlayerStateUtils: () => ({isSpectatingEntity: () => false})},
  './react/uiMotion': {updateMotion() {}}
})
for (const dy of [0, 0, 1000, -2000]) camera.onCameraMove({type: 'touchmove', movementX: 1, movementY: dy})
assert.equal(botAngles.length, 4)
assert.ok(Math.abs(bot.entity.yaw + 0.04) < 1e-8)
assert.deepEqual(cameraAngles, botAngles)
assert.equal(botAngles[2][1], -Math.PI / 2)
assert.equal(botAngles[3][1], Math.PI / 2)

const calls = []
const appViewer = {backend: {id: 'ugn', backendMethods: {
  changeHandSwingingState: (...args) => calls.push(args)
}}}
const methods = run(three + 'threeJsMethods.ts', {appViewer})
const listeners = new Map()
const mouse = run('src/mineflayer/plugins/mouse.ts', {
  document: {addEventListener() {}}, AbortController
}, {
  'mineflayer-mouse': {createMouse: () => () => {}},
  'minecraft-renderer/src/three/threeJsMethods': methods
})
mouse.default({on: (name, fn) => listeners.set(name, fn), mouse: {}, loadPlugin() {}, _client: {on() {}}})
for (const hand of ['right', 'left']) {
  listeners.get('botArmSwingStart')(hand)
  listeners.get('botArmSwingEnd')(hand)
}
assert.deepEqual(calls, [[true, false], [false, false], [true, true], [false, true]])
appViewer.backend.id = 'unsupported'
assert.equal(methods.getThreeJsRendererMethods(), undefined)
assert.equal(methods.getDecoratedThreeJsRendererMethods(appViewer)(), undefined)

class Vec3 {
  constructor(x,y,z) { Object.assign(this,{x,y,z}) }
  add(v) { this.x+=v.x; this.y+=v.y; this.z+=v.z }
}
const {CursorBlock} = run(three + 'world/cursorBlock.ts', {}, {'vec3': {Vec3}})
const overlay = Object.create(CursorBlock.prototype)
overlay.breakTextures = Array.from({length:10}, (_,i) => ({i}))
const points = []
overlay.blockBreakMesh = {material:{},scale:{set(){}},position:{set(...v){points.push(v)}}}
const block = {x:23, y:75, z:-19}
const slab = {position:{x:0.5,y:0.25,z:0.5},width:1,height:0.5,depth:1}
for(let i=0;i<10;i++) {
  overlay.updateBreakAnimation(block,i,slab)
  assert.equal(overlay.blockBreakMesh.material.map.i,i)
  assert.equal(overlay.blockBreakMesh.visible,true)
}
assert.deepEqual(points[0],[23.5,75.25,-18.5])
overlay.updateBreakAnimation(block,null,slab)
assert.equal(overlay.blockBreakMesh.visible,false)
console.log('UGN gameplay checks passed for rapid touch turns, pitch limits, both hand swings and all ten mining stages')

let now = performance.now()
const policy = run(three + 'entity/interpolationPolicy.ts', {})
const rendererRequire = createRequire(fs.realpathSync(path.join(root, 'node_modules/minecraft-renderer/package.json')))
const tweenEntry = rendererRequire.resolve('@tweenjs/tween.js')
const tween = await import(path.join(path.dirname(tweenEntry), 'tween.esm.js'))
const {Entities} = run(three + 'entities.ts', {performance: {now: () => now}}, {
  '@tweenjs/tween.js': tween,
  './entity/interpolationPolicy': policy,
  './threeJsUtils': {loadThreeJsTextureFromUrl() {}}
})
const mob = {rotation: {y:0}, userData:{}, position: {set(x,y,z){Object.assign(this,{x,y,z})}}}
const scene = Object.assign(Object.create(Entities.prototype), {
  worldRenderer: {initOptions: {rendererSpecificSettings: {ugnPolicy:{}}}, sceneOrigin: {getWorldPosition: () => ({x:0,y:0,z:0})}},
  entities: {1:mob}, applyEntityRenderHints() {}
})
const entity = {id:1, name:'zombie', position:{x:0,y:72,z:0}, yaw:0}
scene.updateEntityPosition(entity,true,{})
for(let i=1;i<=8;i++) {
  now += 50
  entity.position.x = i
  entity.yaw = Math.PI / 2
  scene.updateEntityPosition(entity,false,{})
  const { _posTween, _rotTween } = mob.userData
  scene.updateEntityPosition(entity,false,{},true)
  assert.equal(mob.userData._posTween,_posTween)
  assert.equal(mob.userData._rotTween,_rotTween)
}
assert.ok(mob.userData._ugnMoveMs >= 50 && mob.userData._ugnMoveMs < 51)
mob.userData._posTween.update(now+500,false)
mob.userData._rotTween.update(now+500,false)
assert.equal(mob.position.x,8)
assert.ok(Math.abs(mob.rotation.y-Math.PI/2)<1e-8)
now += 2000
entity.position.x++
scene.updateEntityPosition(entity,false,{})
assert.equal(mob.userData._ugnMoveMs,100)
console.log('UGN mob checks passed for walking, turning, duplicate updates and pause recovery')

const farSpawn = {x: -2304, y: 72, z: 8128}
const actual = {x:farSpawn.x+2,y:farSpawn.y,z:farSpawn.z-1}
const sections = []
let animationDelta = 0
Object.assign(mob, {position:{x:2,y:0,z:-1}, traverse() {}})
Object.assign(scene, {
  clock: {update(){}, getDelta:()=>0.05}, syncSceneAttachment(){}, isRenderingAllowed:()=>true,
  maybeRenderPlayerSkin(){}, syncArmorPositions(){}, updateVehiclePassengerPositions(){},
  applyRemoteBoatPassengerRotations(){}, applyLocalThirdPersonPlayerRotation(){},
  updateBoatPaddleAnimations(dt){animationDelta=dt}, applyEntityLights(){}
})
Object.assign(scene.worldRenderer, {
  viewerChunkPosition:farSpawn, sceneOrigin:{getWorldPosition:()=>actual},
  entitySectionKey(x,y,z){ sections.push([x,y,z]); return 'mob section' },
  isSectionOcclusionVisible:()=>true, shouldObjectVisible:()=>false
})
scene.render()
assert.equal(mob.visible,true)
assert.deepEqual(sections,[[actual.x,actual.y,actual.z]])
assert.equal(animationDelta,0.05)
console.log('UGN visibility and low-frame-rate animation checks passed')
