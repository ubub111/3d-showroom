import { writeFile } from 'node:fs/promises'
import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'

globalThis.FileReader = class {
  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer()
    this.onloadend?.()
  }
}

const material = (color, metalness = 0.3, roughness = 0.32, name = '') =>
  new THREE.MeshStandardMaterial({ name, color, metalness, roughness })

function mesh(group, geometry, finish, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, finish)
  object.position.set(x, y, z)
  group.add(object)
  return object
}

function silhouette(points, depth, bevel) {
  const shape = new THREE.Shape()
  points.forEach(([x, y], index) => index ? shape.lineTo(x, y) : shape.moveTo(x, y))
  shape.closePath()
  return new THREE.ExtrudeGeometry(shape, {
    depth, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 28, steps: 1,
  }).translate(0, 0, -depth / 2)
}

function star(tips, outer, inner) {
  return Array.from({ length: tips * 2 }, (_, index) => {
    const angle = Math.PI / 2 + index * Math.PI / tips
    const radius = index % 2 === 0 ? outer : inner
    return [Math.cos(angle) * radius, Math.sin(angle) * radius]
  })
}

function facet(baseHeight) {
  const group = new THREE.Group()
  const body = material('#b47435', 0.56, 0.25, 'Finish')
  const dark = material('#272520', 0.27)
  const brass = material('#c89954', 0.75)
  mesh(group, new THREE.BoxGeometry(2.08, baseHeight, 0.91), dark, 0, baseHeight / 2)
  mesh(group, new THREE.BoxGeometry(1.91, 0.1, 0.78), dark, 0, baseHeight + 0.045)
  mesh(group, new THREE.BoxGeometry(0.92, 0.13, 0.014), brass, 0, baseHeight / 2, 0.463)
  const outline = [[-0.6, 0], [0.6, 0], [1.04, 0.75], [0.7, 1.61], [0, 1.92], [-0.7, 1.61], [-1.04, 0.75]]
  mesh(group, silhouette(outline, 0.17, 0.15), body, 0, baseHeight + 0.18)
  return group
}

function compass() {
  const group = new THREE.Group()
  const finish = material('#b78b4a', 0.75, 0.25, 'Finish')
  const relief = material('#7f5b2c', 0.65)
  mesh(group, new THREE.CylinderGeometry(0.91, 0.91, 0.16, 96), finish, 0, 0.92).rotation.x = Math.PI / 2
  for (const z of [-0.085, 0.085]) {
    for (const radius of [0.83, 0.68]) {
      mesh(group, new THREE.TorusGeometry(radius, 0.018, 12, 96), relief, 0, 0.92, z)
    }
    mesh(group, silhouette(star(8, 0.52, 0.16), 0.02, 0.01), relief, 0, 0.92, z * 1.15)
  }
  for (let i = 0; i < 64; i++) {
    const angle = i * Math.PI / 32
    mesh(group, new THREE.BoxGeometry(0.02, 0.028, 0.14), relief,
      Math.cos(angle) * 0.905, 0.92 + Math.sin(angle) * 0.905).rotation.z = angle
  }
  return group
}

function lapelPin(outline, inset, color, relief) {
  const group = new THREE.Group()
  const gold = material('#c89954', 0.74)
  const enamel = material(color, 0.15, 0.23, 'Finish')
  const clasp = material('#824d21', 0.72)
  mesh(group, silhouette(outline, 0.09, 0.024), gold)
  mesh(group, silhouette(inset, 0.022, 0.012), enamel, 0, 0, 0.061)
  mesh(group, silhouette(relief, 0.013, 0.008), gold, 0, 0, 0.083)
  mesh(group, new THREE.CylinderGeometry(0.064, 0.064, 0.19, 24), clasp, 0, 0.06, -0.132).rotation.x = Math.PI / 2
  mesh(group, new THREE.CylinderGeometry(0.22, 0.27, 0.083, 40), clasp, 0, 0.06, -0.251).rotation.x = Math.PI / 2
  const tab = new THREE.BoxGeometry(0.12, 0.19, 0.06)
  for (const x of [-0.14, 0.14]) mesh(group, tab, clasp, x, 0.06, -0.295)
  return group
}

function polar() {
  return lapelPin(star(8, 0.93, 0.53), star(8, 0.85, 0.48), '#263e73', star(4, 0.21, 0.063))
}

function horizon() {
  const shield = [[-0.74, 0.69], [0.74, 0.69], [0.66, -0.26], [0.43, -0.59], [0, -0.91], [-0.43, -0.59], [-0.66, -0.26]]
  return lapelPin(shield, shield.map(([x, y]) => [x * 0.9, y * 0.9]), '#26534a',
    [[-0.49, -0.2], [-0.1, 0.35], [0.14, 0.02], [0.27, 0.2], [0.51, -0.2], [0.25, -0.2], [-0.1, 0.12], [-0.32, -0.2]])
}

function orbit() {
  const circle = Array.from({ length: 64 }, (_, i) => {
    const angle = i * Math.PI / 32
    return [0.82 * Math.cos(angle), 0.82 * Math.sin(angle)]
  })
  const group = lapelPin(circle, circle.map(([x, y]) => [x * 0.91, y * 0.91]), '#963e50', star(4, 0.22, 0.065))
  const gold = material('#c89954', 0.74)
  const ring = mesh(group, new THREE.TorusGeometry(0.48, 0.024, 10, 56), gold, 0, 0, 0.092)
  ring.scale.set(1.15, 0.58, 1)
  ring.rotation.z = 0.55
  return group
}

function dune() {
  const group = new THREE.Group()
  const glaze = material('#f2e4cb', 0.04, 0.24, 'Finish')
  const profile = [[0, 0.04], [0.57, 0.04], [0.64, 0.09], [0.68, 0.2], [0.7, 1.48],
    [0.69, 1.55], [0.65, 1.56], [0.61, 1.52], [0.60, 0.28], [0.54, 0.17], [0, 0.17]]
  mesh(group, new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 72), glaze, -0.19)
  const handle = new THREE.CatmullRomCurve3([
    [0.46, 1.27], [0.90, 1.28], [1.06, 0.91], [0.92, 0.53], [0.46, 0.48],
  ].map(([x, y]) => new THREE.Vector3(x, y, 0)))
  mesh(group, new THREE.TubeGeometry(handle, 42, 0.105, 16, false), glaze)
  return group
}

function medal() {
  const group = new THREE.Group()
  const silver = material('#9aafc0', 0.68, 0.29, 'Finish')
  const relief = material('#4d6782', 0.54, 0.31)
  const ribbon = material('#294571', 0.02, 0.7)
  const stripe = material('#829bbc', 0.02, 0.63)
  const face = new THREE.CylinderGeometry(0.72, 0.72, 0.13, 80)
  mesh(group, face, silver, 0, 0.74).rotation.x = Math.PI / 2
  for (const z of [-0.068, 0.068]) {
    mesh(group, new THREE.TorusGeometry(0.64, 0.024, 10, 80), relief, 0, 0.74, z)
    mesh(group, new THREE.TorusGeometry(0.54, 0.012, 8, 80), relief, 0, 0.74, z)
    mesh(group, silhouette(star(6, 0.39, 0.17), 0.016, 0.012), relief, 0, 0.74, z * 1.12)
  }
  mesh(group, new THREE.TorusGeometry(0.14, 0.038, 12, 40), silver, 0, 1.53)
  mesh(group, silhouette([[-0.11, 1.63], [0.12, 1.63], [0.49, 2.35], [-0.49, 2.35]], 0.048, 0.017), ribbon)
  for (const z of [-0.025, 0.025]) {
    for (const x of [-1, 1]) {
      mesh(group, silhouette([[0.055 * x, 1.66], [0.095 * x, 1.66], [0.43 * x, 2.35],
        [0.38 * x, 2.35]], 0.006, 0), stripe, 0, 0, z)
    }
  }
  return group
}

const exporter = new GLTFExporter()
const models = { facet: facet(0.28), 'facet-tall': facet(0.55), compass: compass(), polar: polar(), horizon: horizon(), orbit: orbit(), dune: dune(), medal: medal() }
for (const [name, group] of Object.entries(models)) {
  const binary = await exporter.parseAsync(group, { binary: true })
  await writeFile(new URL(`../public/models/${name}.glb`, import.meta.url), Buffer.from(binary))
}
