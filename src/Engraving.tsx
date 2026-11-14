import { useEffect, useMemo } from 'react'
import { createPortal } from '@react-three/fiber'
import { CanvasTexture, SRGBColorSpace, type Object3D } from 'three'

export function Engraving({ plate, text }: { plate: Object3D; text: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 160
    const context = canvas.getContext('2d')!
    context.font = '600 75px Georgia, serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = '#382411'
    context.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 72)
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    return texture
  }, [text])
  useEffect(() => () => texture.dispose(), [texture])
  return createPortal(<mesh position={[0, 0, 0.01]}>
    <planeGeometry args={[0.73, 0.106]} />
    <meshBasicMaterial map={texture} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
  </mesh>, plate)
}
