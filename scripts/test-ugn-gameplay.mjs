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
const mobMotion = run('node_modules/minecraft-renderer/src/ugnMobAnimation.ts', {})
const {Entities} = run(three + 'entities.ts', {performance: {now: () => now}}, {
  '../ugnMobAnimation': mobMotion,
  '@tweenjs/tween.js': tween,
  './entity/interpolationPolicy': policy,
  './threeJsUtils': {loadThreeJsTextureFromUrl() {}}
})
const mob = {originalEntity:{}, rotation: {y:0}, userData:{}, position: {set(x,y,z){Object.assign(this,{x,y,z})}}}
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

// Drive the actual packaged model geometry, not a dummy moving position.
const threeDir = path.dirname(path.dirname(rendererRequire.resolve('three')))
const THREE = await import(path.join(threeDir,'build/three.module.js'))
const {OBJLoader} = await import(path.join(threeDir,'examples/jsm/loaders/OBJLoader.js'))
const parts = run('node_modules/minecraft-renderer/src/ugnMobParts.ts', {}, {three:THREE})
const geometry = run(three+'entity/EntityMesh.ts', {}, {three:THREE,vec3:{Vec3},'../threeJsUtils':{loadTexture(){}}})
const legs = run(three+'entity/legWalkAnimation.ts', {}, {three:THREE})
const definitions = JSON.parse(fs.readFileSync(path.join(root,three,'entity/entities.json'),'utf8'))
for (const name of ['cow','zombie','skeleton','pig','sheep']) {
  const model = geometry.getMesh(undefined,'unused.png',definitions[name].geometry.default)
  const rig = legs.createLegRig(model,name)
  assert.ok(rig?.legs.length >= 2, name)
  const index = model.skeleton.bones.findIndex(b => /leg/i.test(b.name))
  const skin = model.geometry.getAttribute('skinIndex')
  let vertex = 0
  while (vertex < skin.count && skin.getX(vertex)!==index) vertex++
  assert.ok(vertex < skin.count)
  model.updateMatrixWorld(true)
  const before = model.getVertexPosition(vertex,new THREE.Vector3())
  const gait = new mobMotion.UgnGait()
  for(let tick=0;tick<20;tick++) gait.advance(tick*0.12,0,0.05)
  legs.applyLegRig(rig,gait.phase,gait.amount)
  model.updateMatrixWorld(true)
  assert.ok(before.distanceTo(model.getVertexPosition(vertex,new THREE.Vector3()))>0.001,name+' foot vertex should move')
}
for (const [modelName,count] of [['spider',8],['cod',1],['ghast',9],['allay',2]]) {
  const model = new OBJLoader().parse(fs.readFileSync(path.join(root,three,'entity/models/'+modelName+'.obj'),'utf8'))
  const joints = parts.bindMobParts(model,modelName)
  assert.equal(joints.length,count,modelName)
  parts.poseMobParts(joints,0.28,1.5,0.7,true)
  assert.ok(joints.some(j=>Math.abs(j.pivot.rotation[j.motion.axis]-j.rest)>0.01))
}

// Check that a death event keeps the original model long enough to actually
// see the roll and schedules exactly one normal removal, without a stale timer.
const original = scene.entities[1]
scene.update({id:1,ugnDeath:true},{})
const started = original.userData._ugnDeathStarted
assert.ok(Number.isFinite(started))
now += 250
scene.update({id:1,ugnDeath:true},{})
scene.render()
assert.ok(original.rotation.z>0 && original.rotation.z<Math.PI/2)
assert.equal(original.userData._ugnDeathStarted,started)
const removals=[]
scene.update = ({id,delete:remove})=>{assert.ok(remove);removals.push(id);delete scene.entities[id]}
now += 760
scene.render()
scene.render()
assert.deepEqual(removals,['1'])
console.log('Packaged mob vertex, named-joint and death lifecycle checks passed')

// Confirm the normal per-frame entity path actually poses the model, even
// when the server does not send another move between these display frames.
const rendererModules = {
  three:THREE, '@tweenjs/tween.js':tween,
  './threeJsUtils':{loadThreeJsTextureFromUrl(){}},
  './entity/legWalkAnimation':legs, '../ugnMobAnimation':mobMotion,
  './entity/interpolationPolicy':policy, '../ugnMobParts':parts,
  './entity/horseHeadAnimation':run(three+'entity/horseHeadAnimation.ts', {}, {three:THREE}),
  './entity/EntityMesh':{EntityMesh:class {}}
}
const Integrated = run(three+'entities.ts',{performance:{now:()=>now}},rendererModules).Entities
const zombie = geometry.getMesh(undefined,'test.png',definitions.zombie.geometry.default)
const group = new THREE.Group()
group.add(zombie)
group.originalEntity={name:'zombie',onGround:true}
group.userData[legs.LEG_RIG_USER_DATA_KEY]=legs.createLegRig(zombie,'zombie')
group.userData[legs.LEG_ANIMATION_USER_DATA_KEY]={}
group.userData._ugnParts=parts.bindMobParts(zombie,'zombie')
const actor=Object.assign(Object.create(Integrated.prototype),scene,{
  entities:{7:group},
  update:Integrated.prototype.update,
  worldRenderer:{...scene.worldRenderer,sceneOrigin:{getWorldPosition:obj=>obj.position}}
})
const packet={id:7,name:'zombie',position:{x:0,y:72,z:0},yaw:0}
actor.updateEntityPosition(packet,true,{})
for(let tick=0;tick<10;tick++) {
  packet.position.x+=0.15
  actor.updateEntityPosition(packet,false,{})
  for(let frame=0;frame<3;frame++) {
    group.userData._posTween.update(performance.now()+frame*20,false)
    actor.render()
  }
}
assert.ok(group.userData._ugnGait.amount>0)
assert.ok(group.userData[legs.LEG_RIG_USER_DATA_KEY].legs.some(l=>Math.abs(l.bone.rotation.x)>0.01))
actor.playAnimation(7,'oneSwing')
const arm=group.userData._ugnParts.find(j=>j.motion.strike)
assert.ok(arm)
now+=90
actor.render()
assert.ok(arm.pivot.rotation.x < -0.4,'attack must rotate the zombie arm')
console.log('Interpolated zombie model walks and attacks through the entity render loop')

const crowded = new THREE.Scene()
const targets = Object.fromEntries(Array.from({length:120},(_,id)=>[id,new THREE.Group()]))
const attachment = Object.assign(Object.create(Integrated.prototype),{entities:targets,worldRenderer:{scene:crowded}})
attachment.setSceneAttached(true)
attachment.setSceneAttached(true)
assert.equal(crowded.children.length,120)
attachment.setSceneAttached(false)
assert.equal(crowded.children.length,0)
console.log('Crowded scene attach/detach checks passed')

// Head-only movement packets must rotate the face without moving the feet.
group.userData._ugnLook = parts.bindMobLook(zombie,'zombie')
assert.ok(group.userData._ugnLook)
function worldVertex(mesh, boneName) {
  const id = mesh.skeleton.bones.findIndex(b => b.name === boneName)
  const weights = mesh.geometry.getAttribute('skinIndex')
  let i=0
  while(i<weights.count && weights.getX(i)!==id) i++
  assert.ok(i<weights.count,boneName)
  mesh.updateWorldMatrix(true,true)
  return mesh.getVertexPosition(i,new THREE.Vector3())
}
const faceBefore = worldVertex(zombie,'bone_head')
const waistBefore = worldVertex(zombie,'bone_body')
actor.updateEntityPosition({...packet,headYaw:0.7,pitch:0.25},false,{},true)
actor.render()
const head = group.userData._ugnLook
assert.ok(head.yaw>0 && head.yaw<0.7 && head.pitch>0 && head.pitch<0.25)
assert.ok(worldVertex(zombie,'bone_head').distanceTo(faceBefore)>0.01)
assert.ok(worldVertex(zombie,'bone_body').distanceTo(waistBefore)<1e-6)
const village = new OBJLoader().parse(fs.readFileSync(path.join(root,three,'entity/models/villager.obj'),'utf8'))
const villager = parts.bindMobLook(village,'villager')
const nose = village.getObjectByName('nose')
assert.ok(villager && nose && nose.parent===villager.hinge)
const noseBefore=nose.matrixWorld.clone()
villager.targetYaw=-Math.PI+0.05
parts.poseMobLook(villager,Math.PI-0.05,0.05)
village.updateMatrixWorld(true)
assert.ok(villager.yaw>0 && villager.yaw<0.1)
assert.ok(!nose.matrixWorld.equals(noseBefore))
assert.equal(parts.bindMobLook(village,'horse'),undefined)
console.log('Head-only packet, head/body vertex separation, villager facial parts and wrapped yaw passed')

const worldFile=path.join(root,'node_modules/minecraft-renderer/src/lib/worldrendererCommon.ts')
const worldSource=ts.createSourceFile(worldFile,fs.readFileSync(worldFile,'utf8'),ts.ScriptTarget.Latest,true)
const worldClass=worldSource.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text==='WorldRendererCommon')
const pump=worldClass.members.find(member=>member.name?.getText()==='scheduleUgnMeshResults')
const harnessJS=ts.transpileModule('class TerrainPump { '+pump.getText()+' }\nexports.Pump=TerrainPump', {
  compilerOptions:{target:ts.ScriptTarget.ES2022}
}).outputText
const terrainExports={}, callbacks=[]
let frameClock=0
vm.runInNewContext(harnessJS,{exports:terrainExports,performance:{now:()=>frameClock},requestAnimationFrame:cb=>callbacks.push(cb)})
const ids=Array.from({length:150},(_,i)=>i)
const received=[]
const terrainPolicy={meshBudgetMs:5}
const terrain=Object.assign(new terrainExports.Pump(),{
  messageQueue:[...ids],active:true,abortController:new AbortController(),
  initOptions:{rendererSpecificSettings:{ugnPolicy:terrainPolicy}},
  handleMessage(id){received.push(id);frameClock++}
})
terrain.scheduleUgnMeshResults()
terrain.scheduleUgnMeshResults()
assert.equal(callbacks.length,1)
callbacks.shift()()
assert.equal(received.length,5)
terrainPolicy.meshBudgetMs=1
callbacks.shift()()
assert.equal(received.length,6)
terrain.stopMesherMessagesProcessing=true
callbacks.shift()()
assert.equal(received.length,6)
terrain.stopMesherMessagesProcessing=false
while(callbacks.length) callbacks.shift()()
assert.deepEqual(received,ids)
terrain.messageQueue.push(999)
terrain.scheduleUgnMeshResults()
terrain.abortController.abort()
callbacks.shift()()
assert.deepEqual(received,ids)
console.log('Chunk burst preserved all 150 results in order across changing budgets, pause and shutdown')

function loadMethod(file, className, methodName) {
  const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const cls = ast.statements.find(n => ts.isClassDeclaration(n) && n.name?.text === className)
  const method = cls.members.find(n => n.name?.getText() === methodName)
  return vm.runInNewContext(ts.transpileModule( '(class { ' + method.getText() + ' })', {
    compilerOptions: {target: ts.ScriptTarget.ES2022}
  }).outputText).prototype[methodName]
}
const updateVisibility = loadMethod(path.join(root, three, 'chunkMeshManager.ts'), 'ChunkMeshManager', 'updateSectionsVisibility')
const testSections = {}
for (let x = -16; x <= 16; x++) {
  for (let z = -16; z <= 16; z++) {
    testSections[[16*x, 0, 16*z]] = {worldX:16*x+8, worldZ:16*z+8, _waitingForChunkDisplay:x===z}
  }
}
const settings = {}
const manager = {sectionObjects: testSections, worldRenderer: {cameraSectionPos:{x:-2,z:3},initOptions:{rendererSpecificSettings:settings}}}
for (const limit of [0, 1, 4, 7.5, 12, 0]) {
  manager.performanceOverrideDistance = limit
  settings.ugnPolicy = undefined
  updateVisibility.call(manager)
  const expected = Object.values(testSections).map(s => s.visible)
  for (const section of Object.values(testSections)) section.visible = !section.visible
  settings.ugnPolicy = {}
  updateVisibility.call(manager)
  assert.deepEqual(Object.values(testSections).map(s => s.visible), expected)
}
const updateViewer = loadMethod(worldFile, 'WorldRendererCommon', 'updateViewerPosition')
const positions = []
const viewer = {
  initOptions: {rendererSpecificSettings:settings},
  loadedChunks: new Proxy({}, {ownKeys(){throw Error('scanned columns')}}),
  sendWorkers(msg){positions.push([msg.x,msg.z])},
  onViewerChunkPositionChanged(){}
}
for (const x of [0, 1, 16, -1]) updateViewer.call(viewer, {x,y:64,z:0})
assert.deepEqual(positions, [[0,0],[1,0],[-1,0]])
assert.equal(viewer.viewerChunkPosition.x, -1)
console.log('Terrain visibility matched across 1,089 sections and six distance settings. Worker notifications preserved.')
