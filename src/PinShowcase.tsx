import { Suspense, useLayoutEffect, useRef, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Shadow } from '@react-three/drei/core/Shadow'
import { MathUtils, type Group } from 'three'
import { MoveHorizontal } from 'lucide-react'
import type { Product } from './catalog'
import { Model, StudioEnvironment, ViewerBoundary } from './scene'

const positions = [[0, 0.4, 0.45], [-2.43, -0.26, -0.32], [2.43, -0.29, -0.18]] as const

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
    camera.position.z = Math.max(10.35, 15.2 * size.height / size.width)
    camera.lookAt(0, 0.08, 0)
  }, [camera, size])
  useFrame(({ clock }, delta) => {
    if (!group.current) return
    const sway = reducedMotion.current.matches ? 0 : Math.sin(clock.elapsedTime * 0.65) * 0.22
    group.current.rotation.y = MathUtils.damp(group.current.rotation.y, turn.current + sway, 10, delta)
  })
  return <group ref={group}>
    {products.map((product, index) => <Shadow key={product.id} position={[positions[index][0], -1.41, positions[index][2]]}
      scale={index === 0 ? [3.9, 2.15, 1] : [2.85, 1.75, 1]} color="#091018" opacity={0.67} colorStop={0.12} />)}
    {products.map((product, index) => <group key={product.id}
      position={positions[index]} scale={index === 0 ? 1.27 : 0.85}
      rotation={[-0.17, [0.26, -0.48, -0.42][index], [-0.07, 0.23, -0.17][index]]}
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
      <Canvas fallback={<p className="pin-scene-caption">3D недоступно</p>} eventSource={stage} dpr={[1, 2]} camera={{ position: [0, 1.55, 10.35], fov: 31 }}
        style={{ touchAction: 'pan-y' }} onCreated={({ gl, scene }) => {
          scene.environmentIntensity = 0.74
          gl.domElement.setAttribute('aria-label', 'Значки в общей 3D-сцене')
        }}>
        <StudioEnvironment />
        <ambientLight intensity={0.45} />
        <directionalLight position={[-3, 6, 5]} color="#fff0db" intensity={1.6} />
        <directionalLight position={[4, 1, 4]} color="#c9dfff" intensity={0.52} />
        <directionalLight position={[1, 3, -5]} color="#dbe8ff" intensity={1.35} />
        <Arrangement products={products} turn={turn} drag={drag} motion={motion} onOpen={onOpen} />
      </Canvas>
    </ViewerBoundary>
    <p className="pin-scene-caption"><MoveHorizontal size={16} aria-hidden="true" /> Перетащите для вращения</p>
  </div>
}
