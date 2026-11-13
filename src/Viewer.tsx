import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei/core/OrbitControls'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { useGLTF } from '@react-three/drei/core/Gltf'
import { Box3, Mesh, MeshStandardMaterial, PMREMGenerator, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import { Box, Minus, Plus, RotateCcw, Rotate3D } from 'lucide-react'
import { asset, type OptionValue } from './catalog'

function Model({ url, finishes }: { url: string; finishes: OptionValue[] }) {
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
    center.y = box.min.y
    return { object, size, center, materials }
  }, [scene, finishes])
  useEffect(() => () => materials.forEach((material) => material.dispose()), [materials])
  return <group scale={size}><primitive object={object} position={center.clone().negate()} /></group>
}

function Studio() {
  const { gl, scene, invalidate } = useThree()
  useEffect(() => {
    const room = new RoomEnvironment()
    const generator = new PMREMGenerator(gl)
    const map = generator.fromScene(room, 0.04)
    scene.environment = map.texture
    scene.environmentIntensity = 0.8
    invalidate()
    return () => {
      scene.environment = null
      room.dispose()
      generator.dispose()
      map.dispose()
    }
  }, [gl, scene, invalidate])
  return <>
    <ambientLight intensity={0.7} />
    <directionalLight position={[3, 6, 4]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0003} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.018, 0]} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <shadowMaterial opacity={0.16} />
    </mesh>
  </>
}

class ViewerBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function Fallback({ image, message }: { image?: string; message: string }) {
  return <div className="viewer-fallback">
    {image ? <img src={asset(image)} alt="" /> : <Box size={48} strokeWidth={1} />}
    <span>{message}</span>
  </div>
}

export default function Viewer({ url, image, finishes, label, preview = false }: {
  url?: string; image?: string; finishes: OptionValue[]; label: string; preview?: boolean
}) {
  const controls = useRef<OrbitControlsType>(null)
  const [zoom, setZoom] = useState(1)
  const [spin, setSpin] = useState(() => preview && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const changeZoom = (step: number) => setZoom((value) => Math.max(0.75, Math.min(1.75, value + step)))
  const reset = () => {
    controls.current?.reset()
    setZoom(1)
    setSpin(false)
  }
  if (!url) return <Fallback image={image} message="3D-модель пока недоступна" />
  const unavailable = <Fallback image={image} message="Не удалось открыть 3D-модель" />
  return <ViewerBoundary key={url} fallback={unavailable}>
    <div className="viewer" aria-label={label}>
      <Canvas
        frameloop={spin ? 'always' : 'demand'} shadows dpr={[1, 1.5]} fallback={unavailable}
        camera={{ position: [3.35, 2.4, 4.7], fov: 38, zoom }}
        onCreated={({ gl }) => { gl.domElement.setAttribute('aria-label', label) }}
      >
        <Studio />
        <Suspense fallback={null}><Model url={url} finishes={finishes} /></Suspense>
        <OrbitControls ref={controls} target={[0, 1.02, 0]} enablePan={false} autoRotate={spin}
          autoRotateSpeed={1.3} minDistance={2.7} maxDistance={9} maxPolarAngle={Math.PI * 0.49} />
      </Canvas>
      {!preview && <div className="viewer-toolbar" aria-label="Управление 3D">
        <button type="button" aria-label="Вращать автоматически" title="Автовращение" aria-pressed={spin} onClick={() => setSpin(!spin)}><Rotate3D size={18} /></button>
        <button type="button" aria-label="Приблизить" title="Приблизить" onClick={() => changeZoom(0.25)}><Plus size={18} /></button>
        <button type="button" aria-label="Отдалить" title="Отдалить" onClick={() => changeZoom(-0.25)}><Minus size={18} /></button>
        <button type="button" aria-label="Сбросить ракурс" title="Сбросить ракурс" onClick={reset}><RotateCcw size={17} /></button>
      </div>}
      {!preview && <p className="viewer-hint">Перетаскивайте для вращения · прокручивайте для масштаба</p>}
    </div>
  </ViewerBoundary>
}
