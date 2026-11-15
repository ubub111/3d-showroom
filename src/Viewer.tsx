import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { MathUtils, PerspectiveCamera, Spherical, Vector3 } from 'three'
import { OrbitControls } from '@react-three/drei/core/OrbitControls'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import { Box, Maximize2, Minimize2, Minus, Plus, RotateCcw, Rotate3D } from 'lucide-react'
import { asset, type OptionValue } from './catalog'
import { ViewerPoster } from './StorePanels'
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

type CameraPosition = readonly [number, number, number]

const initialPosition: CameraPosition = [3.35, 2.4, 4.7]
const orbitTarget: CameraPosition = [0, 1.02, 0]
const minZoom = 0.75
const maxZoom = 1.75

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
  const invalidateScene = useRef<() => void>(null)
  const motion = useRef<{ frame: number; zoom: number; position?: CameraPosition } | null>(null)
  const cancelMotion = useCallback(() => {
    if (motion.current) cancelAnimationFrame(motion.current.frame)
    motion.current = null
  }, [])
  useEffect(() => cancelMotion, [cancelMotion])
  const [spin, setSpin] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [angle, setAngle] = useState<string>()
  const [readyUrl, setReadyUrl] = useState<string>()
  const markReady = useCallback(() => setReadyUrl(url), [url])
  const angles = productId === 'polar' ? pinAngles : productId === 'compass' ? compassAngles : []
  const moveCamera = (zoom: number, position?: CameraPosition) => {
    const orbit = controls.current
    const camera = orbit?.object
    if (!orbit || !(camera instanceof PerspectiveCamera)) return
    cancelMotion()

    const startZoom = camera.zoom
    const from = new Spherical().setFromVector3(camera.position.clone().sub(orbit.target))
    const to = position ? new Spherical().setFromVector3(new Vector3(...position).sub(orbit.target)) : from
    const azimuth = MathUtils.euclideanModulo(to.theta - from.theta + Math.PI, 2 * Math.PI) - Math.PI
    const stepPosition = new Spherical()
    const started = performance.now()
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : position ? 460 : 220

    const step = (now: number) => {
      const progress = duration ? MathUtils.clamp((now - started) / duration, 0, 1) : 1
      const eased = progress * progress * (3 - 2 * progress)
      if (position) {
        stepPosition.set(MathUtils.lerp(from.radius, to.radius, eased), MathUtils.lerp(from.phi, to.phi, eased), from.theta + azimuth * eased)
        camera.position.setFromSpherical(stepPosition).add(orbit.target)
        orbit.update()
      }
      camera.zoom = MathUtils.lerp(startZoom, zoom, eased)
      camera.updateProjectionMatrix()
      invalidateScene.current?.()
      motion.current = progress < 1 ? { frame: requestAnimationFrame(step), zoom, position } : null
    }
    if (duration) motion.current = { frame: requestAnimationFrame(step), zoom, position }
    else step(started)
  }
  const stopSpin = () => {
    if (controls.current) controls.current.autoRotate = false
    setSpin(false)
  }
  const chooseAngle = ({ position, label, zoom }: typeof pinAngles[number] | typeof compassAngles[number]) => {
    stopSpin()
    moveCamera(zoom, position)
    setAngle(label)
  }
  const changeZoom = (step: number) => {
    const camera = controls.current?.object
    if (!(camera instanceof PerspectiveCamera)) return
    const current = motion.current?.zoom ?? camera.zoom
    const zoom = MathUtils.clamp(current + step, minZoom, maxZoom)
    if (zoom !== current) moveCamera(zoom, motion.current?.position)
  }
  const reset = () => {
    stopSpin()
    moveCamera(1, initialPosition)
    setAngle(undefined)
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
          camera={{ position: [...initialPosition], fov: 38 }}
          onCreated={({ gl, invalidate }) => {
            invalidateScene.current = invalidate
            gl.domElement.setAttribute('aria-label', label)
          }}
        >
          <Studio />
          <Suspense fallback={null}><Model url={url} finishes={finishes} engraving={engraving} onReady={markReady} /></Suspense>
          <OrbitControls ref={controls} target={[...orbitTarget]} enablePan={false} autoRotate={spin}
            onStart={() => { cancelMotion(); setAngle(undefined) }} autoRotateSpeed={0.85} minDistance={2.7} maxDistance={9} maxPolarAngle={Math.PI * 0.49} />
        </Canvas>
        <ViewerPoster image={image} ready={readyUrl === url} />
      </div>
      <div className="viewer-controls">
        <div className="viewer-toolbar" role="group" aria-label="Управление 3D">
          <button ref={expandButton} type="button" aria-label={expanded ? 'Закрыть полноэкранный просмотр' : 'На весь экран'}
            title={expanded ? 'Закрыть полноэкранный просмотр' : 'На весь экран'}
            onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
          <button type="button" aria-label="Вращать автоматически" title="Автовращение" aria-pressed={spin} onClick={() => { cancelMotion(); setSpin(!spin); setAngle(undefined) }}><Rotate3D size={18} /></button>
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
