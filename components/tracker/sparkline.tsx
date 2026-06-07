"use client"

type SparklineProps = {
  data: number[]
  color?: string
  className?: string
  fill?: boolean
}

export function Sparkline({
  data,
  color = "var(--primary)",
  className,
  fill = true,
}: SparklineProps) {
  if (data.length < 2) return null
  const w = 100
  const h = 32
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const step = w / (data.length - 1)

  const points = data.map((d, i) => {
    const x = i * step
    const y = h - ((d - min) / range) * (h - 4) - 2
    return [x, y] as const
  })

  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ")
  const area = `${line} L${w},${h} L0,${h} Z`
  const gid = `spark-${Math.round(min)}-${Math.round(max)}-${data.length}`

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gid})`} />}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
