import { Suspense, useLayoutEffect, useRef, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { MathUtils, type Group } from 'three'
import type { Product } from './catalog'
import { Model, StudioEnvironment, ViewerBoundary } from './scene'

const positions = [[0, 0.48, 0.42], [-2.08, -0.5, -0.28], [2.08, -0.44, -0.2]] as const

function Arrangement({ products, turn, drag, motion, onOpen }: {
  products: Product[]
  turn: RefObject<number>
  drag: RefObject<{ x: number; y: number; start: number } | null>
  motion: RefObject<boolean>
  onOpen: (product: Product) => void
}) {
  const group = useRef<Group>(null)
  const reducedMotion = useRef(matchMedia('(prefers-reduced-motion: reduce)'))
  const { camera, size } = useThree()
  useLayoutEffect(() => {
    camera.position.z = Math.max(12.4, 17.5 * size.height / size.width)
    camera.lookAt(0, 0.15, 0)
  }, [camera, size])
  useFrame(({ clock }, delta) => {
    if (!group.current) return
    const sway = reducedMotion.current.matches ? 0 : Math.sin(clock.elapsedTime * 0.65) * 0.22
    group.current.rotation.y = MathUtils.damp(group.current.rotation.y, turn.current + sway, 10, delta)
  })
  return <group ref={group}>
    {products.map((product, index) => <group key={product.id}
      position={positions[index]} scale={index === 0 ? 1.13 : 0.72}
      rotation={[-0.12, index === 1 ? 0.43 : -0.27, index === 1 ? 0.18 : -0.15]}
      onClick={(event) => {
        event.stopPropagation()
        if (!motion.current && !drag.current) onOpen(product)
      }}>
      <ViewerBoundary fallback={null}>
        <Suspense fallback={null}><Model url={product.model_url!} centered /></Suspense>
      </ViewerBoundary>
    </group>)}
  </group>
}

export default function PinShowcase({ products, onOpen }: { products: Product[]; onOpen: (product: Product) => void }) {
  const stage = useRef<HTMLDivElement>(null)
  const turn = useRef(0)
  const drag = useRef<{ x: number; y: number; start: number } | null>(null)
  const motion = useRef(false)
  return <div className="pin-showcase" ref={stage}
    onPointerDown={(event) => {
      if (event.button !== 0) return
      motion.current = false
      drag.current = { x: event.clientX, y: event.clientY, start: turn.current }
    }}
    onPointerMove={(event) => {
      const start = drag.current
      if (!start) return
      const dx = event.clientX - start.x
      if (!motion.current && (Math.abs(dx) < 7 || Math.abs(event.clientY - start.y) > Math.abs(dx))) return
      motion.current = true
      turn.current = start.start + dx * 0.012
    }}
    onPointerUp={() => { drag.current = null }}
    onPointerLeave={() => { drag.current = null }}
    onPointerCancel={() => { drag.current = null }}>
    <ViewerBoundary fallback={<p className="pin-scene-caption">3D недоступно</p>}>
      <Canvas fallback={<p className="pin-scene-caption">3D недоступно</p>} eventSource={stage} dpr={[1, 1.75]} camera={{ position: [0, 1.55, 12.4], fov: 31 }}
        style={{ touchAction: 'pan-y' }} onCreated={({ gl }) => {
          gl.domElement.setAttribute('aria-label', 'Значки в общей 3D-сцене')
        }}>
        <StudioEnvironment />
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 5, 4]} intensity={1.9} />
        <directionalLight position={[-5, 2, 2]} intensity={0.85} />
        <Arrangement products={products} turn={turn} drag={drag} motion={motion} onOpen={onOpen} />
      </Canvas>
    </ViewerBoundary>
    <p className="pin-scene-caption">Перетащите сцену, чтобы повернуть её</p>
  </div>
}
