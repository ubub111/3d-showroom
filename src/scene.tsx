import { Component, useEffect, useMemo, type ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei/core/Gltf'
import { Box3, Mesh, MeshStandardMaterial, PMREMGenerator, Vector3, type Texture } from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { asset, type OptionValue } from './catalog'

const noFinishes: OptionValue[] = []

export function Model({ url, finishes = noFinishes, centered = false }: {
  url: string; finishes?: OptionValue[]; centered?: boolean
}) {
  const { scene } = useGLTF(asset(url), false, false)
  const { object, size, center, materials } = useMemo(() => {
    const object = scene.clone(true)
    const materials = new Map<MeshStandardMaterial, MeshStandardMaterial>()
    object.traverse((child) => {
      if (!(child instanceof Mesh)) return
      child.castShadow = true
      child.receiveShadow = true
      const applyFinish = (original: MeshStandardMaterial) => {
        if (!original.isMeshStandardMaterial) return original
        const finish = finishes.find((value) => (value.material_name || 'Finish') === original.name)
        if (!finish) return original
        const cached = materials.get(original)
        if (cached) return cached
        const updated = original.clone()
        if (finish.color) updated.color.set(finish.color)
        updated.metalness = finish.metalness ?? updated.metalness
        updated.roughness = finish.roughness ?? updated.roughness
        materials.set(original, updated)
        return updated
      }
      child.material = Array.isArray(child.material) ? child.material.map(applyFinish) : applyFinish(child.material)
    })
    const box = new Box3().setFromObject(object)
    const dimensions = box.getSize(new Vector3())
    const size = 2.35 / (Math.max(dimensions.x, dimensions.y, dimensions.z) || 1)
    const center = box.getCenter(new Vector3())
    if (!centered) center.y = box.min.y
    return { object, size, center, materials }
  }, [scene, finishes, centered])
  useEffect(() => () => materials.forEach((material) => material.dispose()), [materials])
  return <group scale={size}><primitive object={object} position={center.clone().negate()} /></group>
}

export function StudioEnvironment({ onReady }: { onReady?: (texture: Texture) => void }) {
  const { gl, scene, invalidate } = useThree()
  useEffect(() => {
    const room = new RoomEnvironment()
    const generator = new PMREMGenerator(gl)
    const map = generator.fromScene(room, 0.04)
    generator.dispose()
    room.dispose()
    if (onReady) onReady(map.texture)
    else scene.environment = map.texture
    invalidate()
    return () => {
      scene.environment = null
      map.dispose()
    }
  }, [gl, scene, invalidate, onReady])
  return null
}

export class ViewerBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}
