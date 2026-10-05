import React, { useCallback, useEffect, useMemo, useRef } from "react"
import { motion, useAnimationControls } from "framer-motion"
import { v4 as uuidv4 } from "uuid"

import { cn } from "@/lib/utils"
import { useDimensions } from "@/components/hooks/use-debounced-dimensions"

/**
 * A grid of cells, one per background dot, that light up where the pointer passes and then fade. Adapted from the
 * 21st.dev pixel trail: it listens on the window instead of its own box, so it can sit behind the page with
 * pointer-events off and never steal a click, and it fills in every cell between two pointer samples so a fast
 * stroke still draws an unbroken line.
 */
interface PixelTrailProps {
  pixelSize: number // px, the pitch of the dot grid
  dotSize?: number // px, the lit dot drawn in the middle of each cell
  fadeDuration?: number // ms
  delay?: number // ms
  className?: string
  pixelClassName?: string
}

type Lightable = HTMLDivElement & { __animatePixel?: () => void }

const PixelTrail: React.FC<PixelTrailProps> = ({
  pixelSize = 20,
  dotSize,
  fadeDuration = 500,
  delay = 0,
  className,
  pixelClassName,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const dimensions = useDimensions(containerRef)
  const trailId = useRef(uuidv4())
  const last = useRef<{ x: number; y: number } | null>(null)

  const light = useCallback((x: number, y: number) => {
    const pixelElement = document.getElementById(
      `${trailId.current}-pixel-${x}-${y}`
    ) as Lightable | null
    pixelElement?.__animatePixel?.()
  }, [])

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = Math.floor((e.clientX - rect.left) / pixelSize)
      const y = Math.floor((e.clientY - rect.top) / pixelSize)
      const from = last.current ?? { x, y }
      const steps = Math.max(Math.abs(x - from.x), Math.abs(y - from.y))
      if (steps > 12) {
        light(x, y)
      } else {
        for (let i = 1; i <= Math.max(1, steps); i++) {
          const t = steps === 0 ? 1 : i / steps
          light(Math.round(from.x + (x - from.x) * t), Math.round(from.y + (y - from.y) * t))
        }
      }
      last.current = { x, y }
    }
    const forget = () => {
      last.current = null
    }
    window.addEventListener("pointermove", handlePointerMove, { passive: true })
    document.documentElement.addEventListener("pointerleave", forget)
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      document.documentElement.removeEventListener("pointerleave", forget)
    }
  }, [pixelSize, light])

  const columns = useMemo(
    () => Math.ceil(dimensions.width / pixelSize),
    [dimensions.width, pixelSize]
  )
  const rows = useMemo(
    () => Math.ceil(dimensions.height / pixelSize),
    [dimensions.height, pixelSize]
  )

  return (
    <div
      ref={containerRef}
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full overflow-hidden",
        className
      )}
      aria-hidden="true"
    >
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <PixelDot
              key={`${colIndex}-${rowIndex}`}
              id={`${trailId.current}-pixel-${colIndex}-${rowIndex}`}
              size={pixelSize}
              dotSize={dotSize ?? pixelSize}
              fadeDuration={fadeDuration}
              delay={delay}
              className={pixelClassName}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

interface PixelDotProps {
  id: string
  size: number
  dotSize: number
  fadeDuration: number
  delay: number
  className?: string
}

const PixelDot: React.FC<PixelDotProps> = React.memo(
  ({ id, size, dotSize, fadeDuration, delay, className }) => {
    const controls = useAnimationControls()

    const animatePixel = useCallback(() => {
      controls.start({
        opacity: [1, 0],
        transition: { duration: fadeDuration / 1000, delay: delay / 1000, ease: "easeIn" },
      })
    }, [controls, fadeDuration, delay])

    // Attach the animatePixel function to the DOM element
    const ref = useCallback(
      (node: HTMLDivElement | null) => {
        if (node) {
          ;(node as Lightable).__animatePixel = animatePixel
        }
      },
      [animatePixel]
    )

    return (
      <div
        id={id}
        ref={ref}
        className="flex shrink-0 items-center justify-center"
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        <motion.div
          className={cn("rounded-full", className)}
          style={{ width: `${dotSize}px`, height: `${dotSize}px` }}
          initial={{ opacity: 0 }}
          animate={controls}
        />
      </div>
    )
  }
)

PixelDot.displayName = "PixelDot"
export { PixelTrail }
