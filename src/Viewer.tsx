import { Suspense, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei/core/OrbitControls'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import { Box, Minus, Plus, RotateCcw, Rotate3D } from 'lucide-react'
import { asset, type OptionValue } from './catalog'
import { Model, StudioEnvironment, ViewerBoundary } from './scene'

const pinAngles = [
  { label: 'Спереди', position: [0, 1.24, 5.32], zoom: 1.05 },
  { label: 'С ребра', position: [5.18, 1.46, 0.15], zoom: 1.12 },
  { label: 'Крепление', position: [1.86, 2.06, -4.66], zoom: 1.4 },
  { label: 'Эмаль крупно', position: [1.23, 1.58, 4.96], zoom: 1.63 },
] as const

function Studio() {
  return <>
    <StudioEnvironment />
    <ambientLight intensity={0.7} />
    <directionalLight position={[3, 6, 4]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0003} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.018, 0]} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <shadowMaterial opacity={0.16} />
    </mesh>
  </>
}

function Fallback({ image, message }: { image?: string; message: string }) {
  return <div className="viewer-fallback">
    {image ? <img src={asset(image)} alt="" /> : <Box size={48} strokeWidth={1} />}
    <span>{message}</span>
  </div>
}

export default function Viewer({ url, image, finishes, label, pinViews = false }: {
  url?: string; image?: string; finishes: OptionValue[]; label: string; pinViews?: boolean
}) {
  const controls = useRef<OrbitControlsType>(null)
  const [zoom, setZoom] = useState(1)
  const [spin, setSpin] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [angle, setAngle] = useState<string>()
  const chooseAngle = ({ position, label, zoom }: typeof pinAngles[number]) => {
    const orbit = controls.current
    if (!orbit) return
    orbit.object.position.set(position[0], position[1], position[2])
    orbit.autoRotate = false
    orbit.update()
    setSpin(false)
    setZoom(zoom)
    setAngle(label)
  }
  const changeZoom = (step: number) => setZoom((value) => Math.max(0.75, Math.min(1.75, value + step)))
  const reset = () => {
    controls.current?.reset()
    setZoom(1)
    setAngle(undefined)
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
          onStart={() => setAngle(undefined)} autoRotateSpeed={0.85} minDistance={2.7} maxDistance={9} maxPolarAngle={Math.PI * 0.49} />
      </Canvas>
      <div className="viewer-toolbar" aria-label="Управление 3D">
        <button type="button" aria-label="Вращать автоматически" title="Автовращение" aria-pressed={spin} onClick={() => { setSpin(!spin); setAngle(undefined) }}><Rotate3D size={18} /></button>
        <button type="button" aria-label="Приблизить" title="Приблизить" onClick={() => changeZoom(0.25)}><Plus size={18} /></button>
        <button type="button" aria-label="Отдалить" title="Отдалить" onClick={() => changeZoom(-0.25)}><Minus size={18} /></button>
        <button type="button" aria-label="Сбросить ракурс" title="Сбросить ракурс" onClick={reset}><RotateCcw size={17} /></button>
      </div>
      {pinViews ? <div className="pin-angles" role="group" aria-label="Ракурсы значка">
        {pinAngles.map((view) => <button key={view.label} type="button" aria-pressed={angle === view.label}
          onClick={() => chooseAngle(view)}>{view.label}</button>)}
      </div> : <p className="viewer-hint">Перетаскивайте для вращения · прокручивайте для масштаба</p>}
    </div>
  </ViewerBoundary>
}
