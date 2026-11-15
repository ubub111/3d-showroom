import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei/core/OrbitControls'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import { Box, Maximize2, Minimize2, Minus, Plus, RotateCcw, Rotate3D } from 'lucide-react'
import { asset, type OptionValue } from './catalog'
import { Model, StudioEnvironment, ViewerBoundary } from './scene'

const pinAngles = [
  { label: 'Спереди', position: [0, 1.24, 5.32], zoom: 1.05 },
  { label: 'С ребра', position: [5.18, 1.46, 0.15], zoom: 1.12 },
  { label: 'Крепление', position: [1.86, 2.06, -4.66], zoom: 1.4 },
  { label: 'Эмаль крупно', position: [1.23, 1.58, 4.96], zoom: 1.63 },
] as const

const compassAngles = [
  { label: 'Лицевая сторона', position: [0, 1.36, 5.45], zoom: 1.14 },
  { label: 'Оборот', position: [-0.22, 1.48, -5.3], zoom: 1.15 },
  { label: 'Кромка', position: [4.8, 1.57, 1.05], zoom: 1.48 },
] as const

function Studio() {
  return <>
    <StudioEnvironment />
    <ambientLight intensity={0.42} />
    <directionalLight position={[3, 6, 4]} intensity={1.82} castShadow shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-3} shadow-camera-right={3} shadow-camera-top={3} shadow-camera-bottom={-3}
      shadow-normalBias={0.018} shadow-bias={-0.00015} />
    <directionalLight position={[-4, 2, -2]} intensity={0.85} />
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

export default function Viewer({ url, image, finishes, label, productId, engraving }: {
  url?: string; image?: string; finishes: OptionValue[]; label: string; productId?: string; engraving?: string
}) {
  const viewer = useRef<HTMLDivElement>(null)
  const expandButton = useRef<HTMLButtonElement>(null)
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    if (!expanded) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    expandButton.current?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false)
      if (event.key !== 'Tab') return
      const buttons = viewer.current?.querySelectorAll('button:not([disabled])')
      if (!buttons?.length) return
      const first = buttons[0] as HTMLButtonElement
      const last = buttons[buttons.length - 1] as HTMLButtonElement
      const target = document.activeElement
      if (event.shiftKey ? target === first : target === last) {
        event.preventDefault()
        const next = event.shiftKey ? last : first
        next.focus()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', handleKey)
      expandButton.current?.focus({ preventScroll: true })
    }
  }, [expanded])
  const controls = useRef<OrbitControlsType>(null)
  const [zoom, setZoom] = useState(1)
  const [spin, setSpin] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [angle, setAngle] = useState<string>()
  const angles = productId === 'polar' ? pinAngles : productId === 'compass' ? compassAngles : []
  const chooseAngle = ({ position, label, zoom }: typeof pinAngles[number] | typeof compassAngles[number]) => {
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
  return <ViewerBoundary resetKey={url} fallback={unavailable}>
    <div ref={viewer} className={expanded ? 'viewer viewer-expanded' : 'viewer'} aria-label={label}
      role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined}>
      {expanded && <div className="viewer-expanded-title">{label.replace('3D-модель: ', '')}</div>}
      <div className="viewer-stage">
        <Canvas
          frameloop={spin ? 'always' : 'demand'} shadows dpr={[1.5, 2.5]} gl={{ antialias: true }} fallback={unavailable}
          camera={{ position: [3.35, 2.4, 4.7], fov: 38, zoom }}
          onCreated={({ gl }) => { gl.domElement.setAttribute('aria-label', label) }}
        >
          <Studio />
          <Suspense fallback={null}><Model url={url} finishes={finishes} engraving={engraving} /></Suspense>
          <OrbitControls ref={controls} target={[0, 1.02, 0]} enablePan={false} autoRotate={spin}
            onStart={() => setAngle(undefined)} autoRotateSpeed={0.85} minDistance={2.7} maxDistance={9} maxPolarAngle={Math.PI * 0.49} />
        </Canvas>
      </div>
      <div className="viewer-controls">
        <div className="viewer-toolbar" role="group" aria-label="Управление 3D">
          <button ref={expandButton} type="button" aria-label={expanded ? 'Закрыть полноэкранный просмотр' : 'На весь экран'}
            title={expanded ? 'Закрыть полноэкранный просмотр' : 'На весь экран'}
            onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
          <button type="button" aria-label="Вращать автоматически" title="Автовращение" aria-pressed={spin} onClick={() => { setSpin(!spin); setAngle(undefined) }}><Rotate3D size={18} /></button>
          <button type="button" aria-label="Приблизить" title="Приблизить" onClick={() => changeZoom(0.25)}><Plus size={18} /></button>
          <button type="button" aria-label="Отдалить" title="Отдалить" onClick={() => changeZoom(-0.25)}><Minus size={18} /></button>
          <button type="button" aria-label="Сбросить ракурс" title="Сбросить ракурс" onClick={reset}><RotateCcw size={17} /></button>
        </div>
        {angles.length > 0 ? <div className="pin-angles" role="group" aria-label="Ракурсы модели">
          {angles.map((view) => <button key={view.label} type="button" aria-pressed={angle === view.label}
            onClick={() => chooseAngle(view)}>{view.label}</button>)}
        </div> : <p className="viewer-hint">Перетаскивайте для вращения · прокручивайте для масштаба</p>}
      </div>
    </div>
  </ViewerBoundary>
}
