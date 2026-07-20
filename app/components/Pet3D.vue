<script setup lang="ts">
type Species = 'bunny' | 'cat' | 'puppy' | 'bear' | 'fox' | 'panda' | 'penguin' | 'hamster'

const props = withDefaults(defineProps<{
  species?: Species
  skin?: string
  accessories?: string[]
  mood?: number
  level?: number
  action?: string
}>(), { species: 'bunny', skin: 'lavender', accessories: () => [], mood: 80, level: 1, action: '' })

const canvas = ref<HTMLCanvasElement | null>(null)
const failed = ref(false)
const fallbackArt = computed(() => ({ bunny: '🐰', cat: '🐱', puppy: '🐶', bear: '🐻', fox: '🦊', panda: '🐼', penguin: '🐧', hamster: '🐹' }[props.species]))
let THREE: any
let GLTFLoader: any
let SkeletonUtils: any
let foxSource: any
let foxLoadPromise: Promise<any> | null = null
let foxModel: any
let foxMixer: any
let foxActions: Record<string, any> = {}
let renderer: any
let scene: any
let camera: any
let root: any
let model: any
let head: any
let eyeL: any
let eyeR: any
let ears: any[] = []
let paws: any[] = []
let tail: any
let accessoryGroup: any
let particleGroup: any
let roomGroup: any
let plantLeaves: any[] = []
let roomLight: any
let frame = 0
let startedAt = 0
let resizeObserver: ResizeObserver | null = null
let pointerX = 0
let pointerY = 0
let interactionPulse = 0
let interactionTurn = 0
let interactionMode = 'pet'
let lastAnimationTime = 0

const colors: Record<string, number> = { lavender: 0xe2c6f4, pink: 0xf5bfd2, mint: 0xbce8db, night: 0x7b82c8 }
const speciesBody: Record<Species, number> = { bunny: 0, cat: 0, puppy: 0, bear: 0, fox: 0xe9a06e, panda: 0xf0eff5, penguin: 0x596a9e, hamster: 0xd7a787 }
const speciesCream: Record<Species, number> = { bunny: 0xfff5fa, cat: 0xfff5fa, puppy: 0xfff5fa, bear: 0xfff5fa, fox: 0xfff6e9, panda: 0xffffff, penguin: 0xf4f7ff, hamster: 0xfff1df }

function material(color: number, roughness = .72, metalness = .02) { return new THREE.MeshStandardMaterial({ color, roughness, metalness }) }
function tintColor(base: number, tint: number, amount = .32) { const color = new THREE.Color(base); color.lerp(new THREE.Color(tint), amount); return color.getHex() }
function mesh(geometry: any, mat: any) { const item = new THREE.Mesh(geometry, mat); model.add(item); return item }
function roomMesh(geometry: any, mat: any, position: [number, number, number], scale?: [number, number, number]) {
  const item = new THREE.Mesh(geometry, mat); item.position.set(...position); if (scale) item.scale.set(...scale); roomGroup.add(item); return item
}
function addEar(x: number, style: Species, bodyColor: number) {
  let geometry: any
  if (style === 'bunny') geometry = new THREE.CapsuleGeometry(.19, .66, 8, 18)
  else if (style === 'cat' || style === 'fox') geometry = new THREE.ConeGeometry(.25, .72, 20)
  else if (style === 'puppy') geometry = new THREE.CapsuleGeometry(.2, .5, 8, 16)
  else geometry = new THREE.SphereGeometry(style === 'hamster' ? .16 : .22, 20, 14)
  const ear = new THREE.Mesh(geometry, material(style === 'panda' ? 0x282733 : bodyColor))
  // Keep ears in front of the head so the silhouette remains visible in the 3D view.
  ear.position.set(x, style === 'puppy' ? .87 : 1.02, .34)
  ear.rotation.z = style === 'puppy' ? x * 1.8 : style === 'bunny' ? x * .22 : x * .35
  if (style === 'puppy') ear.scale.set(.82, 1.08, .58)
  model.add(ear); ears.push(ear)
  if (['bunny', 'cat', 'fox'].includes(style)) {
    const inner = new THREE.Mesh(new THREE.CapsuleGeometry(.075, .33, 8, 12), material(style === 'fox' ? 0xffd4ad : 0xf4adc8))
    inner.position.set(x, 1.02, .52); inner.rotation.z = ear.rotation.z; model.add(inner)
  }
}
function addWhiskers() {
  const whiskerMat = material(0x6f526f, .55)
  for (const side of [-1, 1]) {
    for (let index = 0; index < 3; index += 1) {
      const whisker = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .34, 8), whiskerMat)
      whisker.position.set(side * (.48 + index * .015), .6 - index * .08, .67)
      whisker.rotation.z = side * (Math.PI / 2 + (index - 1) * .16)
      model.add(whisker)
    }
  }
}
function addTailTip(bodyColor: number) {
  const tip = new THREE.Mesh(new THREE.SphereGeometry(.18, 18, 12), material(0xfff5e8))
  tip.position.set(.7, -.08, -.69); tip.scale.set(1, 1, .72); model.add(tip)
}
function loadFoxAsset() {
  if (foxSource) return Promise.resolve(foxSource)
  if (foxLoadPromise) return foxLoadPromise
  foxLoadPromise = new Promise((resolve, reject) => {
    const loader = new GLTFLoader()
    loader.load('/models/Fox.glb', (gltf: any) => { foxSource = gltf; resolve(gltf) }, undefined, reject)
  })
  return foxLoadPromise
}
function buildFoxModel() {
  if (!foxSource?.scene || !SkeletonUtils) return false
  foxModel = SkeletonUtils.clone(foxSource.scene)
  const skinTint = new THREE.Color(colors[props.skin] || colors.lavender)
  foxModel.traverse((node: any) => {
    if (!node.isMesh) return
    node.geometry = node.geometry?.clone?.() || node.geometry
    if (Array.isArray(node.material)) node.material = node.material.map((item: any) => item.clone?.() || item)
    else node.material = node.material?.clone?.() || node.material
    const materials = Array.isArray(node.material) ? node.material : [node.material]
    materials.forEach((item: any) => { if (item?.color) item.color.lerp(skinTint, props.skin === 'night' ? .08 : .12) })
    node.castShadow = true
    node.receiveShadow = true
  })
  const bounds = new THREE.Box3().setFromObject(foxModel)
  const size = bounds.getSize(new THREE.Vector3())
  const targetHeight = 2.18
  const scale = targetHeight / Math.max(size.y, .001)
  foxModel.scale.setScalar(scale)
  const scaledBounds = new THREE.Box3().setFromObject(foxModel)
  const scaledCenter = scaledBounds.getCenter(new THREE.Vector3())
  foxModel.position.set(-scaledCenter.x, -1.02 - scaledBounds.min.y, -.08 - scaledCenter.z)
  model.add(foxModel)
  foxMixer = new THREE.AnimationMixer(foxModel)
  foxActions = {}
  for (const clip of foxSource.animations || []) foxActions[String(clip.name).toLowerCase()] = foxMixer.clipAction(clip)
  playFoxAnimation('survey')
  return true
}
function playFoxAnimation(name: string) {
  if (!foxActions || !Object.keys(foxActions).length) return
  const next = foxActions[name] || foxActions.survey || foxActions.walk
  if (!next) return
  Object.values(foxActions).forEach((action: any) => { if (action !== next) action.fadeOut(.18) })
  next.reset().fadeIn(.18).play()
}
function buildRoom() {
  roomGroup?.traverse((node: any) => { node.geometry?.dispose?.(); node.material?.dispose?.() })
  if (roomGroup) root.remove(roomGroup)
  roomGroup = new THREE.Group(); root.add(roomGroup); plantLeaves = []
  const accent = colors[props.skin] || colors.lavender
  const floorMat = material(0xf8eef8, .95)
  const woodMat = material(props.skin === 'night' ? 0x3b3d68 : 0xc89eb9, .82)
  const goldMat = material(0xf3cc82, .38, .18)
  roomMesh(new THREE.CylinderGeometry(1.75, 1.85, .08, 64), floorMat, [0, -1.04, -.12])
  roomMesh(new THREE.TorusGeometry(1.13, .025, 10, 48), material(accent, .88), [0, -1, -.15], [1, .63, 1])
  roomMesh(new THREE.BoxGeometry(.48, .12, .42), woodMat, [-1.38, -.63, -.2], [1, 1, 1])
  roomMesh(new THREE.CylinderGeometry(.13, .16, .28, 20), material(0xd89cae), [-1.38, -.43, -.2])
  const leaves = [[-1.5, -.24, -.17], [-1.28, -.2, -.17], [-1.4, -.09, -.17]] as const
  leaves.forEach(([x, y, z], index) => {
    const leaf = roomMesh(new THREE.SphereGeometry(.13, 14, 10), material(index === 1 ? 0x91cdb4 : 0x74b89f), [x, y, z], [1.5, .48, .55])
    plantLeaves.push(leaf)
  })
  roomMesh(new THREE.BoxGeometry(.16, .88, .1), woodMat, [1.42, -.47, -.27])
  roomMesh(new THREE.BoxGeometry(.75, .1, .18), woodMat, [1.42, -.06, -.27])
  roomMesh(new THREE.BoxGeometry(.62, .08, .16), woodMat, [1.42, -.36, -.27])
  roomMesh(new THREE.CylinderGeometry(.09, .1, .32, 16), goldMat, [1.12, -.67, -.18])
  roomMesh(new THREE.ConeGeometry(.23, .2, 24), material(props.skin === 'night' ? 0xf4bfdb : 0xffb9d2, .6), [1.12, -.47, -.18])
  roomLight = new THREE.PointLight(props.skin === 'night' ? 0xffd58b : 0xffb4d2, 1.1, 3.4); roomLight.position.set(1.12, -.35, .1); roomGroup.add(roomLight)
  if ((props.level || 1) >= 10) roomMesh(new THREE.TorusGeometry(.92, .012, 8, 48), material(0xffd77f, .4, .2), [0, .08, -.28], [1, .72, 1])
}
function buildModel() {
  foxMixer?.stopAllAction?.(); foxMixer = null; foxModel = null; foxActions = {}
  model?.traverse((node: any) => { node.geometry?.dispose?.(); node.material?.dispose?.() })
  if (model) root.remove(model)
  particleGroup?.traverse((node: any) => { node.geometry?.dispose?.(); node.material?.dispose?.() })
  if (particleGroup) root.remove(particleGroup)
  model = new THREE.Group(); root.add(model); ears = []; paws = []
  particleGroup = new THREE.Group(); root.add(particleGroup)
  const species = props.species
  const stage = (props.level || 1) >= 10 ? 3 : (props.level || 1) >= 5 ? 2 : 1
  const skinColor = colors[props.skin] || colors.lavender
  const bodyColor = speciesBody[species] ? tintColor(speciesBody[species], skinColor) : skinColor
  const dark = species === 'panda' ? 0x282733 : props.skin === 'night' ? 0x25294d : 0x493153
  const cream = speciesCream[species] || 0xfff5fa
  model.scale.setScalar(stage === 1 ? .88 : stage === 2 ? 1 : 1.1)
  if (species === 'fox' && foxSource && buildFoxModel()) {
    accessoryGroup = new THREE.Group(); model.add(accessoryGroup); buildAccessories(); return
  }
  if (species === 'fox' && !foxSource && GLTFLoader) {
    void loadFoxAsset().then(() => { if (props.species === 'fox' && model) buildModel() }).catch(() => undefined)
  }
  const body = mesh(new THREE.SphereGeometry(.72, 32, 24), material(bodyColor))
  body.scale.set(species === 'hamster' ? 1.08 : species === 'penguin' ? .92 : 1, species === 'penguin' ? 1.18 : species === 'fox' ? 1.12 : 1.08, .88)
  head = mesh(new THREE.SphereGeometry(.73, 32, 24), material(bodyColor)); head.position.y = .72; head.scale.set(1.03, .91, .95)
  if (species === 'cat') head.scale.set(1, .88, .91)
  if (species === 'puppy') head.scale.set(1.12, .96, 1.02)
  if (species === 'fox') head.scale.set(.98, 1.02, .94)
  if (species === 'hamster') head.scale.set(1.08, .98, 1.02)
  const belly = mesh(new THREE.SphereGeometry(.45, 24, 18), material(cream)); belly.position.set(0, -.12, .55); belly.scale.set(species === 'penguin' ? 1.08 : 1, 1.1, .42)
  if (['puppy', 'bear', 'fox'].includes(species)) { const muzzle = mesh(new THREE.SphereGeometry(.22, 20, 14), material(cream)); muzzle.position.set(0, .57, .77); muzzle.scale.set(1.25, .72, .5) }
  if (species === 'penguin') { const bib = mesh(new THREE.SphereGeometry(.39, 20, 14), material(cream)); bib.position.set(0, .37, .61); bib.scale.set(1, 1.25, .35) }
  if (species === 'cat') addWhiskers()
  if (species === 'panda') {
    for (const x of [-.25, .25]) { const patch = mesh(new THREE.SphereGeometry(.16, 16, 12), material(dark)); patch.position.set(x, .79, .67); patch.scale.set(1.15, 1.35, .35); patch.rotation.z = x * -.55 }
  }
  const eyeMat = material(dark, .34)
  eyeL = mesh(new THREE.SphereGeometry(.075, 16, 12), eyeMat); eyeL.position.set(-.25, .79, .69); eyeL.scale.set(1, 1.24, .5)
  eyeR = mesh(new THREE.SphereGeometry(.075, 16, 12), eyeMat); eyeR.position.set(.25, .79, .69); eyeR.scale.set(1, 1.24, .5)
  const shineMat = material(0xffffff, .2); const shineL = mesh(new THREE.SphereGeometry(.024, 10, 8), shineMat); shineL.position.set(-.275, .82, .73); const shineR = mesh(new THREE.SphereGeometry(.024, 10, 8), shineMat); shineR.position.set(.225, .82, .73)
  const nose = mesh(new THREE.SphereGeometry(.085, 16, 12), material(species === 'penguin' ? 0xe9a66e : 0xe37ca4, .5)); nose.position.set(0, .62, .74); nose.scale.set(1.1, .8, .7)
  const cheekMat = material(species === 'panda' ? 0xd9a8bd : 0xf1a7bd, .8); const cheekL = mesh(new THREE.SphereGeometry(species === 'hamster' ? .16 : .12, 16, 10), cheekMat); cheekL.position.set(-.45, .59, .64); cheekL.scale.set(1.3, .65, .35); const cheekR = mesh(new THREE.SphereGeometry(species === 'hamster' ? .16 : .12, 16, 10), cheekMat); cheekR.position.set(.45, .59, .64); cheekR.scale.set(1.3, .65, .35)
  const pawMat = material(species === 'penguin' ? 0x53668f : bodyColor)
  const pawL = mesh(new THREE.SphereGeometry(.22, 20, 14), pawMat); pawL.position.set(-.48, -.52, .25); pawL.scale.set(.72, 1.15, .75); paws.push(pawL)
  const pawR = mesh(new THREE.SphereGeometry(.22, 20, 14), pawMat); pawR.position.set(.48, -.52, .25); pawR.scale.set(.72, 1.15, .75); paws.push(pawR)
  tail = mesh(new THREE.SphereGeometry(species === 'hamster' ? .2 : .3, 20, 14), material(bodyColor)); tail.position.set(.7, -.08, -.48); tail.scale.set(1, 1, .75)
  if (species === 'fox') addTailTip(bodyColor)
  if (species !== 'penguin') { addEar(-.38, species, bodyColor); addEar(.38, species, bodyColor) }
  if (species === 'penguin') {
    for (const x of [-.62, .62]) { const wing = mesh(new THREE.SphereGeometry(.25, 18, 12), material(0x465986)); wing.position.set(x, -.03, .12); wing.scale.set(.55, 1.35, .45); wing.rotation.z = x * -.35 }
  }
  if (props.level >= 10) {
    const halo = mesh(new THREE.TorusGeometry(.33, .025, 8, 32), material(0xffd77f, .3, .25)); halo.position.set(0, 1.47, .04); halo.rotation.x = Math.PI / 2
  }
  accessoryGroup = new THREE.Group(); model.add(accessoryGroup); buildAccessories()
}
function triggerInteraction(nextAction = props.action || 'pet') {
  if (!THREE || !particleGroup) return
  interactionMode = String(nextAction).split('-')[0] || 'pet'
  if (props.species === 'fox' && foxModel) playFoxAnimation(interactionMode === 'play' ? 'run' : interactionMode === 'feed' ? 'walk' : 'survey')
  interactionPulse = 1
  interactionTurn = interactionTurn > 0 ? -.16 : .16
  const palette = interactionMode === 'feed' ? [0xffd77f, 0xffb96d, 0xffffff] : interactionMode === 'play' ? [0xffa7c4, 0xd8b5f2, 0xffd77f] : [0xffa7c4, 0xf4adc8, 0xffffff]
  for (let index = 0; index < 11; index += 1) {
    const particle = new THREE.Mesh(new THREE.SphereGeometry(index % 3 === 0 ? .055 : .035, 10, 8), new THREE.MeshBasicMaterial({ color: palette[index % palette.length], transparent: true, opacity: .95 }))
    const angle = (index / 11) * Math.PI * 2
    particle.position.set(Math.cos(angle) * .25, .55 + Math.sin(angle) * .14, .58)
    particle.userData = { life: 1, vx: Math.cos(angle) * (.002 + Math.random() * .002), vy: .012 + Math.random() * .008, vz: Math.sin(angle) * .002 }
    particleGroup.add(particle)
  }
}
function buildAccessories() {
  if (!accessoryGroup) return
  accessoryGroup.clear()
  const mat = material(props.skin === 'night' ? 0xffd78e : 0xd769a0, .42, .06)
  const fox = Boolean(foxModel)
  for (const item of props.accessories || []) {
    if (item === 'crown') {
      const crown = new THREE.Mesh(new THREE.ConeGeometry(.22, .24, 5), material(0xf2c965, .3, .15))
      crown.position.set(0, fox ? 1.22 : 1.47, .48); crown.rotation.y = Math.PI / 5; accessoryGroup.add(crown)
      const band = new THREE.Mesh(new THREE.TorusGeometry(.23, .035, 10, 28), material(0xf7d98c, .3, .15))
      band.position.set(0, fox ? 1.1 : 1.35, .45); band.rotation.x = Math.PI / 2; accessoryGroup.add(band)
    }
    if (item === 'scarf') {
      const scarf = new THREE.Mesh(new THREE.TorusGeometry(.47, .075, 12, 32), material(0xe77da5))
      scarf.position.set(0, .18, .38); scarf.rotation.x = Math.PI / 2; accessoryGroup.add(scarf)
      const tail = new THREE.Mesh(new THREE.BoxGeometry(.12, .32, .08), material(0xd85c91))
      tail.position.set(.32, .02, .45); tail.rotation.z = -.22; accessoryGroup.add(tail)
    }
    if (item === 'bow') {
      for (const side of [-1, 1]) { const bow = new THREE.Mesh(new THREE.SphereGeometry(.15, 16, 12), mat); bow.position.set(side * .23, .45, .75); bow.scale.set(1.35, .7, .38); bow.rotation.z = side * .35; accessoryGroup.add(bow) }
      const knot = new THREE.Mesh(new THREE.SphereGeometry(.075, 12, 10), material(0xffd36f, .42)); knot.position.set(0, .45, .79); accessoryGroup.add(knot)
    }
    if (item === 'flower') {
      const flowerY = fox ? 1.08 : 1.39
      for (let index = 0; index < 5; index++) { const petal = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 8), material(0xffb96d)); const angle = index / 5 * Math.PI * 2; petal.position.set(Math.cos(angle) * .13, flowerY + Math.sin(angle) * .13, .5); accessoryGroup.add(petal) }
      const center = new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 8), material(0xffe59a)); center.position.set(0, flowerY, .55); accessoryGroup.add(center)
    }
  }
}
function resize() { if (!canvas.value || !renderer || !camera) return; const width = canvas.value.clientWidth || 360; const height = canvas.value.clientHeight || 330; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix() }
function animate(now: number) {
  frame = requestAnimationFrame(animate); if (!root) return; if (!startedAt) startedAt = now; const time = (now - startedAt) / 1000
  const delta = lastAnimationTime ? Math.min(.05, (now - lastAnimationTime) / 1000) : .016; lastAnimationTime = now; foxMixer?.update(delta)
  interactionPulse = Math.max(0, interactionPulse - .024); interactionTurn *= .94
  root.rotation.y += ((pointerX * .18 + interactionTurn) - root.rotation.y) * .04; root.rotation.x += ((pointerY * .08) - root.rotation.x) * .04
  const actionLift = Math.sin((1 - interactionPulse) * Math.PI) * (interactionMode === 'play' ? .38 : .24)
  model.position.y = Math.sin(time * 1.8) * .035 + actionLift
  model.rotation.z = Math.sin(time * .9) * .018 + interactionTurn * .65
  if (head) { head.rotation.x = interactionMode === 'feed' ? Math.sin((1 - interactionPulse) * Math.PI) * -.22 : 0; head.rotation.z = interactionMode === 'pet' ? Math.sin((1 - interactionPulse) * Math.PI) * .1 : 0 }
  ears.forEach((ear, index) => { ear.rotation.x = Math.sin(time * 2 + index) * .035; if (interactionMode === 'play') ear.rotation.z += Math.sin(time * 8 + index) * .002 })
  paws.forEach((paw, index) => { paw.rotation.z = interactionMode === 'play' ? Math.sin((1 - interactionPulse) * Math.PI) * (index ? -.32 : .32) : 0 })
  if (tail) tail.rotation.y = Math.sin(time * 3.2) * .22 + (interactionMode === 'play' ? Math.sin(time * 9) * .08 : 0)
  plantLeaves.forEach((leaf, index) => { leaf.rotation.z = Math.sin(time * .8 + index) * .06 })
  if (roomLight) roomLight.intensity = 1.05 + Math.sin(time * 1.6) * .12
  const blink = Math.sin(time * .45) > .985 ? .12 : 1; if (eyeL) eyeL.scale.y = blink * 1.24; if (eyeR) eyeR.scale.y = blink * 1.24
  particleGroup?.children.forEach((particle: any) => { const data = particle.userData; data.life -= .018; particle.position.x += data.vx; particle.position.y += data.vy; particle.position.z += data.vz; data.vy -= .00035; particle.scale.setScalar(Math.max(.1, data.life)); particle.material.opacity = Math.max(0, data.life) })
  particleGroup?.children.filter((particle: any) => particle.userData.life <= 0).forEach((particle: any) => { particle.geometry.dispose(); particle.material.dispose(); particleGroup.remove(particle) })
  renderer.render(scene, camera)
}
function pointerMove(event: PointerEvent) { if (!canvas.value) return; const rect = canvas.value.getBoundingClientRect(); pointerX = ((event.clientX - rect.left) / rect.width - .5) * 2; pointerY = ((event.clientY - rect.top) / rect.height - .5) * -2 }
async function init() {
  try {
    THREE = await import('three'); const loaderModule = await import('three/examples/jsm/loaders/GLTFLoader.js'); const skeletonModule = await import('three/examples/jsm/utils/SkeletonUtils.js'); GLTFLoader = loaderModule.GLTFLoader; SkeletonUtils = skeletonModule; if (!canvas.value) return
    renderer = new THREE.WebGLRenderer({ canvas: canvas.value, alpha: true, antialias: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace
    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(28, 1, .1, 100); camera.position.set(0, .16, 5.25)
    scene.add(new THREE.HemisphereLight(0xfff4ff, 0x7b5b8f, 2.2)); const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(2, 4, 4); scene.add(key); const rim = new THREE.PointLight(0xe7b6ff, 1.6, 8); rim.position.set(-3, 1, 2); scene.add(rim)
    root = new THREE.Group(); scene.add(root); buildRoom(); buildModel(); resize(); canvas.value.addEventListener('pointermove', pointerMove); canvas.value.addEventListener('pointerdown', () => triggerInteraction('pet')); resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas.value); frame = requestAnimationFrame(animate)
  } catch { failed.value = true }
}
watch(() => [props.skin, props.species, props.level, JSON.stringify(props.accessories)], () => { if (model) { buildRoom(); buildModel(); resize() } })
watch(() => props.action, value => { if (value) triggerInteraction(value) })
onMounted(() => { void init() })
onBeforeUnmount(() => { cancelAnimationFrame(frame); foxMixer?.stopAllAction?.(); foxMixer = null; resizeObserver?.disconnect(); canvas.value?.removeEventListener('pointermove', pointerMove); model?.traverse((node: any) => { node.geometry?.dispose?.(); node.material?.dispose?.() }); roomGroup?.traverse((node: any) => { node.geometry?.dispose?.(); node.material?.dispose?.() }); particleGroup?.traverse((node: any) => { node.geometry?.dispose?.(); node.material?.dispose?.() }); renderer?.dispose?.() })
</script>

<template>
  <div class="pet3d-shell"><canvas ref="canvas" aria-label="3D 共同宠物"/><div v-if="failed" class="pet3d-fallback">{{ fallbackArt }}</div><span class="pet3d-shadow"/></div>
</template>

<style scoped>
.pet3d-shell{position:relative;width:100%;height:100%;min-height:250px;touch-action:pan-y;cursor:pointer}.pet3d-shell canvas{display:block;width:100%;height:100%;min-height:250px;outline:0}.pet3d-fallback{position:absolute;inset:0;display:grid;place-items:center;font-size:132px;filter:drop-shadow(0 18px 18px rgba(89,49,106,.22))}.pet3d-shadow{position:absolute;right:20%;bottom:3%;left:20%;height:24px;border-radius:50%;background:rgba(86,48,105,.18);filter:blur(10px);pointer-events:none}
</style>
