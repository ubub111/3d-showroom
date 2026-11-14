import { writeFile } from 'node:fs/promises'
import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'

globalThis.FileReader = class {
  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer()
    this.onloadend?.()
  }
}

const material = (color, metalness = 0.3, roughness = 0.32, name = '') =>
  new THREE.MeshStandardMaterial({ name, color, metalness, roughness })

function glazed(color, metalness, roughness, clearcoat) {
  return new THREE.MeshPhysicalMaterial({
    name: 'Finish', color, metalness, roughness, clearcoat, clearcoatRoughness: 0.15,
  })
}

function beveledBlock(width, height, depth, bevel) {
  const x = width / 2 - bevel
  const y = height / 2 - bevel
  return silhouette([[-x, -y], [x, -y], [x, y], [-x, y]], depth - 2 * bevel, bevel)
}

function radialDetail(group, count, geometry, placement, finish) {
  const pieces = Array.from({ length: count }, (_, index) =>
    placement(geometry.clone(), index * Math.PI * 2 / count, index))
  const combined = mergeGeometries(pieces)
  pieces.forEach((piece) => piece.dispose())
  geometry.dispose()
  return mesh(group, combined, finish)
}

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

// Stamp the compass rose as a low relief with a raised ridge on every point.
function compassRelief(group, z, light, dark) {
  const outline = star(8, 0.51, 0.155)
  const front = Math.sign(z)
  const faces = [[], []]
  for (let index = 0; index < outline.length; index += 2) {
    const tip = outline[index]
    const valleys = [outline.at(index - 1), outline[index + 1]]
    const ridge = [tip[0] * 0.42, tip[1] * 0.42, 0.037]
    for (let side = 0; side < 2; side++) {
      const valley = [...valleys[side], 0.004]
      const point = [...tip, 0.005]
      const center = [0, 0, 0.021]
      const triangles = side === 0
        ? [center, valley, ridge, ridge, valley, point]
        : [center, ridge, valley, ridge, point, valley]
      for (const [x, y, height] of triangles) faces[side].push(x * front, y + 0.92, z + height * front)
    }
  }
  for (const [index, positions] of faces.entries()) {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.computeVertexNormals()
    mesh(group, geometry, index === 0 ? light : dark)
  }
}

function facet(baseHeight) {
  const group = new THREE.Group()
  const body = glazed('#b47435', 0.56, 0.25, 0.48)
  const dark = material('#272520', 0.27)
  const brass = material('#c89954', 0.75)
  mesh(group, beveledBlock(2.08, baseHeight, 0.91, 0.025), dark, 0, baseHeight / 2)
  mesh(group, beveledBlock(1.94, 0.12, 0.8, 0.016), dark, 0, baseHeight + 0.045)
  mesh(group, beveledBlock(0.92, 0.135, 0.018, 0.006), brass, 0, baseHeight / 2, 0.463).name = 'EngravingPlate'
  const outline = [[-0.6, 0], [0.6, 0], [1.04, 0.75], [0.7, 1.61], [0, 1.92], [-0.7, 1.61], [-1.04, 0.75]]
  mesh(group, silhouette(outline, 0.17, 0.15), body, 0, baseHeight + 0.18)
  const etching = material('#edc086', 0.72, 0.35)
  mesh(group, silhouette(star(4, 0.14, 0.045), 0.005, 0.004), etching, 0, baseHeight + 1.47, 0.237)
  for (const x of [-0.39, 0.39]) {
    mesh(group, new THREE.SphereGeometry(0.015, 12, 8), dark, x, baseHeight / 2, 0.473)
  }
  return group
}

function compass() {
  const group = new THREE.Group()
  const finish = material('#b78b4a', 0.75, 0.25, 'Finish')
  const relief = material('#7f5b2c', 0.72, 0.32, 'Finish_recess')
  const polished = material('#cc9e56', 0.87, 0.18, 'Finish_polished')
  const blank = new THREE.LatheGeometry([[0, -0.08], [0.877, -0.08], [0.906, -0.066], [0.91, -0.053], [0.91, 0.053], [0.906, 0.066], [0.877, 0.08], [0, 0.08]].map(([x, y]) => new THREE.Vector2(x, y)), 144)
  const vertices = blank.attributes.position
  const colors = []
  for (let index = 0; index < vertices.count; index++) {
    const x = vertices.getX(index)
    const z = vertices.getZ(index)
    const grain = 0.965 + 0.035 * Math.sin(Math.hypot(x, z) * 263) * Math.sin(x * 137 + z * 71)
    colors.push(grain, grain, grain)
  }
  blank.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  finish.vertexColors = true
  mesh(group, blank, finish, 0, 0.92).rotation.x = Math.PI / 2
  for (const z of [-0.085, 0.085]) {
    for (const radius of [0.83, 0.68]) {
      mesh(group, new THREE.TorusGeometry(radius, 0.018, 12, 120), polished, 0, 0.92, z)
    }
    compassRelief(group, z, polished, relief)
  }
  radialDetail(group, 96, new THREE.BoxGeometry(0.011, 0.018, 0.105),
    (geometry, angle) => geometry.rotateZ(angle).translate(Math.cos(angle) * 0.906, 0.92 + Math.sin(angle) * 0.906, 0), relief)
  for (const z of [-0.084, 0.084]) {
    radialDetail(group, 48, new THREE.BoxGeometry(0.014, 0.05, 0.012), (geometry, angle, index) => {
      if (index % 6 === 0) geometry.scale(1.3, 1.45, 1)
      return geometry.rotateZ(angle).translate(-Math.sin(angle) * 0.755, 0.92 + Math.cos(angle) * 0.755, z)
    }, relief)
  }
  return group
}

function lapelPin(outline, inset, color, relief) {
  const group = new THREE.Group()
  const gold = material('#c89954', 0.74)
  const enamel = glazed(color, 0.15, 0.23, 0.75)
  const clasp = material('#824d21', 0.72)
  mesh(group, silhouette(outline, 0.09, 0.024), gold)
  mesh(group, silhouette(inset, 0.022, 0.012), enamel, 0, 0, 0.061)
  mesh(group, silhouette(relief, 0.013, 0.008), gold, 0, 0, 0.083)
  mesh(group, new THREE.CylinderGeometry(0.064, 0.064, 0.19, 24), clasp, 0, 0.06, -0.132).rotation.x = Math.PI / 2
  mesh(group, new THREE.CylinderGeometry(0.22, 0.27, 0.083, 40), clasp, 0, 0.06, -0.251).rotation.x = Math.PI / 2
  mesh(group, new THREE.TorusGeometry(0.178, 0.02, 8, 40), gold, 0, 0.06, -0.294)
  const tab = beveledBlock(0.12, 0.19, 0.061, 0.025)
  for (const x of [-0.14, 0.14]) mesh(group, tab, clasp, x, 0.06, -0.31).rotation.z = x * -3
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
  const glaze = glazed('#f2e4cb', 0.04, 0.24, 0.65)
  const clay = material('#ba9978', 0.02, 0.71)
  const profile = [
    [0.56, 0.035], [0.59, 0.042], [0.622, 0.061], [0.65, 0.103],
    [0.668, 0.17], [0.679, 0.24], [0.701, 1.45], [0.703, 1.48],
    [0.701, 1.512], [0.692, 1.535], [0.676, 1.548], [0.653, 1.552],
    [0.633, 1.541], [0.618, 1.522], [0.614, 1.494], [0.604, 0.31],
    [0.594, 0.25], [0.57, 0.211], [0.53, 0.191], [0, 0.191],
  ]
  const lathe = (points) => new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), 128)
  mesh(group, lathe(profile), glaze, -0.19)
  mesh(group, lathe([[0, 0.06], [0.475, 0.06], [0.49, 0.012], [0.53, 0], [0.575, 0], [0.591, 0.018], [0.59, 0.042]]), clay, -0.19)
  const handle = new THREE.CatmullRomCurve3([
    [0.38, 1.235], [0.69, 1.32], [0.9, 1.24], [1.04, 1.05], [1.07, 0.85],
    [0.98, 0.66], [0.79, 0.51], [0.38, 0.46],
  ].map(([x, y]) => new THREE.Vector3(x, y, 0)))
  const grip = new THREE.TubeGeometry(handle, 64, 0.105, 24, false)
  const vertices = grip.attributes.position
  for (let segment = 0; segment <= 64; segment++) {
    const fraction = segment / 64
    const crossSection = 1 - 0.2 * Math.pow(Math.abs(2 * fraction - 1), 5)
    const center = handle.getPointAt(fraction)
    for (let index = 0; index <= 24; index++) {
      const vertex = segment * 25 + index
      vertices.setXYZ(vertex,
        center.x + (vertices.getX(vertex) - center.x) * crossSection,
        center.y + (vertices.getY(vertex) - center.y) * crossSection,
        vertices.getZ(vertex) * crossSection * 0.82)
    }
  }
  grip.computeVertexNormals()
  mesh(group, grip, glaze)
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
  for (const z of [-0.075, 0.075]) {
    radialDetail(group, 36, new THREE.SphereGeometry(0.013, 8, 6), (geometry, angle) =>
      geometry.translate(Math.cos(angle) * 0.59, 0.74 + Math.sin(angle) * 0.59, z), relief)
  }
  mesh(group, new THREE.TorusGeometry(0.14, 0.038, 12, 40), silver, 0, 1.53)
  mesh(group, silhouette([[-0.11, 1.63], [0.12, 1.63], [0.49, 2.35], [-0.49, 2.35]], 0.048, 0.017), ribbon)
  for (const z of [-0.043, 0.043]) {
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
  group.traverse((object) => {
    if (!object.isMesh) return
    // With no textures, UV seams can be welded together while retaining hard normals.
    const geometry = object.geometry.clone()
    geometry.deleteAttribute('uv')
    geometry.normalizeNormals()
    object.geometry = mergeVertices(geometry)
    geometry.dispose()
  })
  const binary = await exporter.parseAsync(group, { binary: true })
  await writeFile(new URL(`../public/models/${name}.glb`, import.meta.url), Buffer.from(binary))
}
