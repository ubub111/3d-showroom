import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, createPortal, useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera, Scene, type Group, type Texture } from 'three'
import { Model, StudioEnvironment, ViewerBoundary } from './scene'

export type PreviewEntry = { id: string; url: string; turn: number; element: HTMLElement }

function RefreshOnInteraction() {
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => {
    const events = ['scroll', 'click', 'keydown', 'pointerup']
    const refresh = () => invalidate(2)
    for (const event of events) window.addEventListener(event, refresh, { capture: true, passive: true })
    return () => {
      for (const event of events) window.removeEventListener(event, refresh, true)
    }
  }, [invalidate])
  return null
}

function ClearFrame() {
  useFrame(({ gl }) => {
    gl.setScissorTest(false)
    gl.clear()
  }, 0.5)
  return null
}

// The full-screen renderer draws each model only inside its own visible DOM slot.
function ModelView({ entry, texture, animate }: { entry: PreviewEntry; texture?: Texture; animate: boolean }) {
  const { element, turn, url } = entry
  const scene = useMemo(() => new Scene(), [])
  const camera = useMemo(() => {
    const camera = new PerspectiveCamera(36, 1, 0.1, 30)
    camera.position.z = 5.65
    return camera
  }, [])
  const group = useRef<Group>(null)
  const clip = element.closest('[data-model-clip]')
  useFrame(({ gl, clock, size }) => {
    const bounds = element.getBoundingClientRect()
    const limit = clip?.getBoundingClientRect()
    const left = Math.max(bounds.left, limit?.left ?? 0, 0)
    const right = Math.min(bounds.right, limit?.right ?? size.width, size.width)
    const top = Math.max(bounds.top, limit?.top ?? 0, 0)
    const bottom = Math.min(bounds.bottom, limit?.bottom ?? size.height, size.height)
    if (right <= left || bottom <= top || !group.current) return

    const aspect = bounds.width / bounds.height
    if (camera.aspect !== aspect) {
      camera.aspect = aspect
      camera.updateProjectionMatrix()
    }
    const time = animate ? clock.elapsedTime : 0
    group.current.rotation.y = turn + time * 0.43
    group.current.position.y = 0.06 * Math.sin(time * 1.6 + turn)
    gl.setViewport(bounds.left, size.height - bounds.bottom, bounds.width, bounds.height)
    gl.setScissor(left, size.height - bottom, right - left, bottom - top)
    gl.setScissorTest(true)
    const autoClear = gl.autoClear
    gl.autoClear = false
    gl.render(scene, camera)
    gl.autoClear = autoClear
    gl.setScissorTest(false)
  }, 1)
  return createPortal(<>
    {texture && <primitive attach="environment" object={texture} dispose={null} />}
    <ambientLight intensity={0.65} />
    <directionalLight position={[3, 5, 4]} intensity={1.75} />
    <directionalLight position={[-5, 1, 2]} intensity={0.75} />
    <group ref={group} rotation={[-0.17, turn, -0.065]}>
      <ViewerBoundary key={url} fallback={null}>
        <Suspense fallback={null}><Model url={url} centered /></Suspense>
      </ViewerBoundary>
    </group>
  </>, scene)
}

function VisibleModel({ entry, texture, animate }: { entry: PreviewEntry; texture?: Texture; animate: boolean }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(([item]) => setVisible(item.isIntersecting))
    observer.observe(entry.element)
    return () => observer.disconnect()
  }, [entry.element])
  return visible ? <ModelView entry={entry} texture={texture} animate={animate} /> : null
}

export default function CatalogModels({ entries }: { entries: PreviewEntry[] }) {
  const [texture, setTexture] = useState<Texture>()
  const [animate, setAnimate] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setAnimate(!media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return <ViewerBoundary fallback={<span className="scene-status">3D недоступно</span>}>
    <div className="catalog-canvas" aria-hidden="true">
      <Canvas frameloop={animate ? 'always' : 'demand'} dpr={[1, 1.5]} gl={{ alpha: true, antialias: true }}
        fallback={<span className="scene-status">3D недоступно</span>}>
        <ClearFrame />
        {!animate && <RefreshOnInteraction />}
        <StudioEnvironment onReady={setTexture} />
        {entries.map((entry) => <VisibleModel key={entry.id} entry={entry} texture={texture} animate={animate} />)}
      </Canvas>
    </div>
  </ViewerBoundary>
}
