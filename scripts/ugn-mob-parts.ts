// Secondary poses for built-in models with named parts. Each joint is bound
// once, leaving authored custom animation clips and horse rigs in control.
import * as THREE from 'three'

type Motion = { axis: 'x' | 'y' | 'z'; speed: number; amplitude: number; phase: number; walking?: boolean; airborneOnly?: boolean; strike?: boolean }
type Joint = { pivot: THREE.Object3D; rest: number; motion: Motion; bone?: { inverse: THREE.Matrix4; parent: THREE.Matrix4; rest: THREE.Matrix4; at: THREE.Matrix4; back: THREE.Matrix4 } }

function movement(species: string, part: string, side: number): Motion | undefined {
  if (['zombie','husk','drowned','zombie_villager','skeleton','stray','wither_skeleton','piglin','piglin_brute','zombified_piglin','enderman','warden','iron_golem'].includes(species) && /^(right|left)_?arm$/.test(part)) {
    return {axis:'x', speed:0.6662, amplitude:0.75, phase:side > 0 ? 0 : Math.PI, walking:true, strike:part.startsWith('right')}
  }
  if ((species === 'spider' || species === 'cave_spider') && /^leg[0-7]$/.test(part)) {
    const index = Number(part.slice(3))
    return {axis:'y', speed:0.6662, amplitude:0.55, phase:Math.floor(index / 2) * Math.PI / 2 + (side < 0 ? Math.PI : 0), walking:true}
  }
  if (['parrot','allay','vex','bee','bat','chicken'].includes(species) && /wing/.test(part) && !/tip/.test(part)) {
    return {axis:species === 'bat' ? 'y' : 'z', speed:species === 'bee' ? 32 : 11, amplitude:side * 0.52, phase:0, airborneOnly:species === 'chicken' || species === 'parrot'}
  }
  if (['cod','salmon','tropical_fish','dolphin'].includes(species) && /^(tailfin|tail|body_back)$/.test(part)) {
    if (species === 'salmon' && part === 'tailfin') return
    return {axis:species === 'dolphin' ? 'x' : 'y', speed:6, amplitude:0.28, phase:0}
  }
  if ((species === 'ghast' || species === 'squid' || species === 'glow_squid') && /^tentacle/.test(part)) {
    return {axis:'x', speed:2.4, amplitude:0.28, phase:Number(part.match(/\d+/)?.[0] ?? 0) * 0.65}
  }
}

export function bindMobParts(root: THREE.Object3D, species: string): Joint[] {
  const joints: Joint[] = []
  const parts: THREE.Mesh[] = []
  root.traverse(node => { if (node instanceof THREE.Mesh && !(node instanceof THREE.SkinnedMesh)) parts.push(node) })
  for (const mesh of parts) {
    if (!mesh.parent || !mesh.geometry) continue
    const name = mesh.name.toLowerCase()
    if (!movement(species, name, 1)) continue
    mesh.geometry.computeBoundingBox()
    const box = mesh.geometry.boundingBox
    if (!box) continue
    const center = box.getCenter(new THREE.Vector3())
    const side = center.x < 0 ? -1 : 1
    const motion = movement(species, name, side)!
    // Hinge wings and legs at the body-facing edge; tails at the front.
    if (/wing|leg/.test(name)) center.x = side > 0 ? box.min.x : box.max.x
    if (/tail/.test(name)) center.z = box.min.z
    if (/arm|leg|tentacle/.test(name)) center.y = box.max.y
    mesh.updateMatrix()
    center.applyMatrix4(mesh.matrix)
    const pivot = new THREE.Group()
    pivot.position.copy(center)
    mesh.parent.add(pivot)
    pivot.add(mesh)
    mesh.position.sub(center)
    joints.push({pivot, rest:0, motion})
  }
  // Vertices in this renderer's Bedrock meshes are in model space, even for
  // nested bones. Match its skinning transform around the authored pivot.
  root.traverse(child => {
    if (!(child instanceof THREE.SkinnedMesh)) return
    child.updateWorldMatrix(true,true)
    const meshInverse = child.matrixWorld.clone().invert()
    for (const node of child.skeleton.bones) {
      const name = node.name.replace(/^bone_/, '').toLowerCase()
      const motion = movement(species, name, name.includes('left') ? 1 : -1)
      if (!motion) continue
      const parent = node.parent instanceof THREE.Bone ? meshInverse.clone().multiply(node.parent.matrixWorld) : new THREE.Matrix4()
      const {x,y,z} = node.position
      joints.push({pivot:node, rest:0, motion, bone:{
        parent, inverse:parent.clone().invert(), rest:node.matrix.clone(),
        at:new THREE.Matrix4().makeTranslation(x,y,z), back:new THREE.Matrix4().makeTranslation(-x,-y,-z)
      }})
    }
  })
  return joints
}

const transform = new THREE.Matrix4()
const rotation = new THREE.Matrix4()

export function poseMobParts(joints: Joint[], seconds: number, phase: number, amount: number, airborne: boolean, attackAge = Infinity) {
  for (const {pivot,rest,motion,bone} of joints) {
    const clock = motion.walking ? phase : seconds
    const weight = motion.walking ? amount : motion.airborneOnly && !airborne ? 0 : 1
    let angle = Math.sin(clock * motion.speed + motion.phase) * motion.amplitude * weight
    if (motion.strike && attackAge >= 0 && attackAge < 0.3) angle -= 1.7 * Math.sin(Math.PI * Math.sqrt(attackAge / 0.3))
    if (!bone) { pivot.rotation[motion.axis] = rest + angle; continue }
    if (motion.axis === 'x') rotation.makeRotationX(angle)
    else if (motion.axis === 'y') rotation.makeRotationY(angle)
    else rotation.makeRotationZ(angle)
    transform.copy(bone.inverse).multiply(bone.at).multiply(rotation).multiply(bone.back).multiply(bone.parent).multiply(bone.rest)
    transform.decompose(pivot.position, pivot.quaternion, pivot.scale)
  }
}

// Flat OBJ models store a villager's nose and a chicken's beak beside the
// head mesh. Rotate those pieces together around the base of the head.
const objFaces: Record<string, string[]> = {
  villager: ['head','nose','helmet','brim'],
  zombie_villager: ['head','head layer','brim'],
  chicken: ['head','beak','comb'],
  creeper: ['head']
}
const trackedHeads = new Set(['zombie','husk','drowned','skeleton','stray','wither_skeleton','cow','mooshroom','pig','sheep', ...Object.keys(objFaces)])

export function hasMobLook(name: string) {
  return trackedHeads.has(name)
}

export function bindMobLook(root: THREE.Object3D, species: string) {
  if (!hasMobLook(species)) return
  const bones: Array<{node:THREE.Bone; before:THREE.Matrix4; after:THREE.Matrix4}> = []
  root.updateWorldMatrix(true,true)
  root.traverse(node => {
    if (!(node instanceof THREE.SkinnedMesh)) return
    for (const head of node.skeleton.bones) {
      if (head.name.toLowerCase() !== 'bone_head') continue
      const parent = head.parent instanceof THREE.Bone
        ? node.matrixWorld.clone().invert().multiply(head.parent.matrixWorld) : new THREE.Matrix4()
      const pivot = new THREE.Matrix4().makeTranslation(head.position.x, head.position.y, head.position.z)
      bones.push({node:head,before:parent.clone().invert().multiply(pivot),
        after:pivot.clone().invert().multiply(parent).multiply(head.matrix)})
    }
  })
  let hinge: THREE.Group | undefined
  const names = objFaces[species]
  if (!bones.length && names) {
    const head = root.children.find(n=>n.name.toLowerCase()==='head')
    if (head instanceof THREE.Mesh) {
      head.geometry.computeBoundingBox()
      const box = head.geometry.boundingBox
      if (box) {
        hinge = new THREE.Group()
        box.getCenter(hinge.position)
        hinge.position.y = box.min.y
        hinge.position.applyMatrix4(head.matrix)
        root.add(hinge)
        for (const node of [...root.children]) {
          if (names.includes(node.name.toLowerCase())) hinge.attach(node)
        }
      }
    }
  }
  if (hinge || bones.length) return {hinge,bones,yaw:0,pitch:0,targetYaw:NaN,targetPitch:0,posed:false}
}

const lookEuler = new THREE.Euler(0,0,0,'YXZ')
export function poseMobLook(look: NonNullable<ReturnType<typeof bindMobLook>>, bodyYaw: number, dt: number) {
  const delta = Number.isFinite(look.targetYaw) ? look.targetYaw - bodyYaw : 0
  const target = THREE.MathUtils.clamp(Math.atan2(Math.sin(delta),Math.cos(delta)), -Math.PI/3, Math.PI/3)
  const pitch = THREE.MathUtils.clamp(look.targetPitch,-Math.PI/2,Math.PI/2)
  if (look.posed && look.yaw===target && look.pitch===pitch) return
  const blend = -Math.expm1(-16 * dt)
  look.yaw = Math.abs(target-look.yaw)<0.001 ? target : look.yaw+(target-look.yaw)*blend
  look.pitch = Math.abs(pitch-look.pitch)<0.001 ? pitch : look.pitch+(pitch-look.pitch)*blend
  look.posed = true
  lookEuler.set(look.pitch,look.yaw,0,'YXZ')
  look.hinge?.rotation.copy(lookEuler)
  rotation.makeRotationFromEuler(lookEuler)
  for (const joint of look.bones) {
    transform.copy(joint.before).multiply(rotation).multiply(joint.after)
    transform.decompose(joint.node.position,joint.node.quaternion,joint.node.scale)
  }
}
