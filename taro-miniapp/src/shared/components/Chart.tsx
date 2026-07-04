/**
 * 图表组件 — 小程序原生兼容
 * 支持：饼图（环形）、条状图、折线图（基于 canvas）
 * 折线图使用 canvas 绘制，避免 CSS 旋转导致的线条混乱
 * 支持触摸交互：触摸图表时显示当前数据点的详细数值
 */
import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { View, Text, Canvas } from '@tarojs/components'
import Taro from '@tarojs/taro'

const COLORS = [
  '#f59e0b', '#d97706', '#b45309', '#fbbf24',
  '#fcd34d', '#eab308', '#84cc16', '#22c55e',
  '#14b8a6', '#6366f1', '#a855f7', '#ec4899'
]

interface ChartProps {
  option: any
  style?: React.CSSProperties
  className?: string
  height?: number
}

const Chart: React.FC<ChartProps> = ({ option, style, className, height = 300 }) => {
  const series = option?.series || []
  const s0 = series[0]
  const type = s0?.type

  /* ===== 饼图（环形，conic-gradient） + 触摸交互 ===== */
  if (type === 'pie') {
    const data: Array<{ name: string; value: number }> = s0?.data || []
    const total = data.reduce((s, d) => s + (d.value || 0), 0)
    const [touchIndex, setTouchIndex] = useState<number | null>(null)

    const slices = useMemo(() => {
      let angle = -90
      return data.map((d, i) => {
        const pct = total > 0 ? (d.value || 0) / total : 0
        const startAngle = angle
        angle += pct * 360
        return { ...d, pct: (pct * 100).toFixed(1), color: COLORS[i % COLORS.length], startAngle, endAngle: angle }
      })
    }, [data, total])

    const gradients = useMemo(() => {
      if (total === 0) return ''
      const stops: string[] = []
      let cumPct = 0
      slices.forEach(s => {
        stops.push(`${s.color} ${cumPct}% ${(cumPct + (s.value || 0) / total * 100).toFixed(1)}%`)
        cumPct += (s.value || 0) / total * 100
      })
      return stops.join(', ')
    }, [slices, total])

    // 触摸饼图 — 根据触摸角度判断落在哪个扇区
    const handlePieTouch = useCallback((e: any) => {
      if (slices.length === 0) return
      const touch = e.touches?.[0] || e.changedTouches?.[0]
      if (!touch) return
      const query = Taro.createSelectorQuery()
      query.select('#pie-chart-area').boundingClientRect()
      query.exec((res: any) => {
        if (!res?.[0]) return
        const rect = res[0]
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const dx = touch.clientX - cx
        const dy = touch.clientY - cy
        let angle = Math.atan2(dy, dx) * 180 / Math.PI
        // 归一化到 -90 起始（从顶部开始）
        angle = angle + 90
        if (angle < 0) angle += 360
        // 找到对应扇区
        for (let i = 0; i < slices.length; i++) {
          const s = slices[i]
          const start = ((s.startAngle + 360) % 360)
          const end = ((s.endAngle + 360) % 360)
          if (start < end) {
            if (angle >= start && angle < end) { setTouchIndex(i); return }
          } else {
            if (angle >= start || angle < end) { setTouchIndex(i); return }
          }
        }
      })
    }, [slices])

    const handlePieTouchEnd = useCallback(() => {
      setTouchIndex(null)
    }, [])

    const centerText = option?.graphic?.[0]?.style?.text || ''
    const centerSubText = option?.graphic?.[1]?.style?.text || ''

    return (
      <View style={{ ...style, height: `${height}rpx` }} className={className}>
        <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <View
            id="pie-chart-area"
            onTouchStart={handlePieTouch}
            onTouchEnd={handlePieTouchEnd}
            style={{
              width: '280rpx', height: '280rpx', borderRadius: '50%',
              background: `conic-gradient(${gradients})`,
              position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center',
            }}
          >
            <View style={{
              width: '140rpx', height: '140rpx', borderRadius: '50%', backgroundColor: '#ffffff',
              display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
            }}>
              {touchIndex !== null && slices[touchIndex]
                ? (
                  <>
                    <Text style={{ fontSize: '22rpx', color: '#8b7355' }}>{slices[touchIndex].name}</Text>
                    <Text style={{ fontSize: '32rpx', color: '#2d241c', fontWeight: 'bold' }}>¥{slices[touchIndex].value.toFixed(0)}</Text>
                    <Text style={{ fontSize: '20rpx', color: '#a89580' }}>{slices[touchIndex].pct}%</Text>
                  </>
                )
                : (
                  <>
                    {centerText && <Text style={{ fontSize: '24rpx', color: '#8b7355' }}>{centerText}</Text>}
                    {centerSubText && <Text style={{ fontSize: '36rpx', color: '#2d241c', fontWeight: 'bold' }}>{centerSubText}</Text>}
                  </>
                )
              }
            </View>
          </View>
          <View style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12rpx 20rpx', marginTop: '20rpx' }}>
            {slices.map((s, i) => (
              <View key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '6rpx', padding: '4rpx 8rpx', borderRadius: '8rpx', backgroundColor: touchIndex === i ? '#fef3c7' : 'transparent' }}>
                <View style={{ width: '18rpx', height: '18rpx', borderRadius: '4rpx', backgroundColor: s.color, flexShrink: 0 }} />
                <Text style={{ fontSize: '22rpx', color: touchIndex === i ? '#92400e' : '#8b7355', fontWeight: touchIndex === i ? '500' : 'normal' }}>{s.name}</Text>
                <Text style={{ fontSize: '20rpx', color: touchIndex === i ? '#92400e' : '#a89580' }}>{s.pct}%</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    )
  }

  /* ===== 条状图 ===== */
  if (type === 'bar') {
    const xData: string[] = option?.xAxis?.data || []
    const barData: number[] = s0?.data?.map((d: any) => typeof d === 'object' ? d.value : d) || []
    const maxVal = Math.max(...barData, 1)
    const [touchBarIndex, setTouchBarIndex] = useState<number | null>(null)

    return (
      <View style={{ ...style, height: `${height}rpx`, display: 'flex', flexDirection: 'column', justifyContent: 'center' }} className={className}>
        <View style={{ display: 'flex', alignItems: 'flex-end', gap: '12rpx', height: '240rpx', paddingBottom: '40rpx' }}>
          {xData.map((name, i) => {
            const val = barData[i] || 0
            const barH = maxVal > 0 ? (val / maxVal) * 200 : 0
            const isTouched = touchBarIndex === i
            return (
              <View
                key={name}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}
                onTouchStart={() => setTouchBarIndex(i)}
                onTouchEnd={() => setTouchBarIndex(null)}
              >
                <Text style={{ fontSize: isTouched ? '22rpx' : '20rpx', color: isTouched ? '#92400e' : '#2d241c', marginBottom: '4rpx', fontWeight: isTouched ? '600' : 'normal' }}>
                  {isTouched ? `¥${val.toFixed(2)}` : `¥${val.toFixed(0)}`}
                </Text>
                <View style={{
                  width: '100%', height: `${barH}rpx`, backgroundColor: isTouched ? COLORS[i % COLORS.length] + 'dd' : COLORS[i % COLORS.length],
                  borderRadius: '8rpx 8rpx 0 0', minHeight: '4rpx',
                  opacity: touchBarIndex !== null && !isTouched ? 0.5 : 1,
                }} />
                <Text style={{ fontSize: '20rpx', color: isTouched ? '#92400e' : '#8b7355', marginTop: '8rpx', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', fontWeight: isTouched ? '500' : 'normal' }}>
                  {name.length > 4 ? name.slice(0, 4) + '..' : name}
                </Text>
              </View>
            )
          })}
        </View>
      </View>
    )
  }

  /* ===== 折线图（canvas 绘制 + 触摸交互） ===== */
  if (type === 'line') {
    return <LineChartCanvas option={option} style={style} className={className} height={height} />
  }

  /* ===== 兜底 ===== */
  return (
    <View style={{ ...style, height: `${height}rpx`, display: 'flex', justifyContent: 'center', alignItems: 'center' }} className={className}>
      <Text style={{ fontSize: '24rpx', color: '#a89580' }}>暂不支持此图表</Text>
    </View>
  )
}

/**
 * 折线图 — 使用 canvas 绘制 + 触摸交互
 * 触摸时显示最近数据点的数值
 */
const LineChartCanvas: React.FC<{ option: any; style?: React.CSSProperties; className?: string; height?: number }> = ({
  option, style, className, height = 300
}) => {
  const canvasRef = useRef<any>(null)
  const containerRef = useRef<any>(null)
  const xData: string[] = option?.xAxis?.data || []
  const seriesData = option?.series?.map((s: any) => ({
    name: s.name || '',
    data: s.data || [],
    color: s.lineStyle?.color || '#ef4444',
  })) || []

  const allVals = seriesData.flatMap((s: any) => s.data)
  const maxVal = Math.max(...allVals, 1)
  const minVal = Math.min(...allVals, 0)
  const range = maxVal - minVal || 1
  const [touchInfo, setTouchInfo] = useState<{ index: number; x: number; y: number } | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => { drawCanvas() }, 100)
    return () => clearTimeout(timer)
  }, [option, touchInfo])

  const drawCanvas = () => {
    if (!canvasRef.current) return

    Taro.createSelectorQuery()
      .select('#line-chart-canvas')
      .fields({ node: true, size: true })
      .exec((res: any) => {
        if (!res || !res[0] || !res[0].node) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = Taro.getSystemInfoSync().pixelRatio || 2

        const width = res[0].width
        const chartHeight = height - 40

        canvas.width = width * dpr
        canvas.height = chartHeight * dpr
        ctx.scale(dpr, dpr)

        const padding = { top: 20, right: 10, bottom: 5, left: 10 }
        const chartW = width - padding.left - padding.right
        const chartH = chartHeight - padding.top - padding.bottom

        ctx.clearRect(0, 0, width, chartHeight)

        // 网格线
        ctx.strokeStyle = '#f0ebe5'
        ctx.lineWidth = 0.5
        for (let i = 0; i <= 4; i++) {
          const y = padding.top + (chartH / 4) * i
          ctx.beginPath()
          ctx.moveTo(padding.left, y)
          ctx.lineTo(width - padding.right, y)
          ctx.stroke()
        }

        if (xData.length < 2) return

        // 计算所有点坐标
        const allPoints: Array<Array<{ x: number; y: number }>> = []
        seriesData.forEach((s: any) => {
          const points = s.data.map((val: number, i: number) => ({
            x: padding.left + (i / (xData.length - 1)) * chartW,
            y: padding.top + chartH - ((val - minVal) / range) * chartH,
          }))
          allPoints.push(points)
        })

        // 绘制折线
        seriesData.forEach((s: any, si: number) => {
          const points = allPoints[si]
          ctx.strokeStyle = s.color
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(points[0].x, points[0].y)
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y)
          }
          ctx.stroke()

          // 数据点
          ctx.fillStyle = s.color
          points.forEach((p: { x: number; y: number }) => {
            ctx.beginPath()
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
            ctx.fill()
          })
        })

        // 触摸指示线和高亮
        if (touchInfo && allPoints.length > 0) {
          const idx = touchInfo.index
          const points0 = allPoints[0]
          if (points0[idx]) {
            const px = points0[idx].x
            const py = points0[idx].y

            // 垂直指示线
            ctx.strokeStyle = 'rgba(139, 115, 85, 0.3)'
            ctx.lineWidth = 1
            ctx.setLineDash([4, 4])
            ctx.beginPath()
            ctx.moveTo(px, padding.top)
            ctx.lineTo(px, padding.top + chartH)
            ctx.stroke()
            ctx.setLineDash([])

            // 高亮所有系列在该索引的点
            allPoints.forEach((points, si) => {
              if (points[idx]) {
                const p = points[idx]
                // 外圈
                ctx.fillStyle = '#ffffff'
                ctx.beginPath()
                ctx.arc(p.x, p.y, 8, 0, Math.PI * 2)
                ctx.fill()
                // 内圈
                ctx.fillStyle = seriesData[si].color
                ctx.beginPath()
                ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
                ctx.fill()
              }
            })
          }
        }
      })
  }

  // 触摸事件 — 找到最近的数据点
  const handleTouch = useCallback((e: any) => {
    if (xData.length < 2) return
    const touch = e.touches?.[0] || e.changedTouches?.[0]
    if (!touch) return

    Taro.createSelectorQuery()
      .select('#line-chart-container')
      .boundingClientRect()
      .exec((res: any) => {
        if (!res?.[0]) return
        const rect = res[0]
        const localX = touch.clientX - rect.left
        const padding = 10
        const chartW = rect.width - padding * 2
        // 计算最近的数据点索引
        let minDist = Infinity
        let closestIdx = 0
        for (let i = 0; i < xData.length; i++) {
          const px = padding + (i / (xData.length - 1)) * chartW
          const dist = Math.abs(localX - px)
          if (dist < minDist) { minDist = dist; closestIdx = i }
        }
        setTouchInfo({ index: closestIdx, x: 0, y: 0 })
      })
  }, [xData.length])

  const handleTouchEnd = useCallback(() => {
    setTouchInfo(null)
  }, [])

  return (
    <View
      id="line-chart-container"
      ref={containerRef}
      onTouchStart={handleTouch}
      onTouchMove={handleTouch}
      onTouchEnd={handleTouchEnd}
      style={{ ...style, height: `${height}rpx`, display: 'flex', flexDirection: 'column' }}
      className={className}
    >
      {/* 图例 */}
      <View style={{ display: 'flex', gap: '20rpx', marginBottom: '12rpx' }}>
        {seriesData.map((s: any) => (
          <View key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '6rpx' }}>
            <View style={{ width: '16rpx', height: '8rpx', backgroundColor: s.color, borderRadius: '2rpx' }} />
            <Text style={{ fontSize: '22rpx', color: '#8b7355' }}>{s.name}</Text>
          </View>
        ))}
      </View>

      {/* 触摸数据提示 */}
      {touchInfo && (
        <View style={{ backgroundColor: '#2d241c', borderRadius: '12rpx', padding: '12rpx 16rpx', marginBottom: '8rpx', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: '22rpx', color: '#fbbf24', fontWeight: '500' }}>{xData[touchInfo.index]}</Text>
          <View style={{ display: 'flex', gap: '16rpx' }}>
            {seriesData.map((s: any) => (
              <Text key={s.name} style={{ fontSize: '22rpx', color: s.color }}>
                {s.name}: ¥{s.data[touchInfo.index]?.toFixed(0)}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* Canvas 区域 */}
      <View style={{ flex: 1, position: 'relative', minHeight: `${height - 80}rpx` }}>
        <Canvas
          ref={canvasRef}
          type="2d"
          id="line-chart-canvas"
          style={{ width: '100%', height: `${height - 80}rpx`, position: 'absolute', top: 0, left: 0 }}
        />
      </View>

      {/* X 轴标签 */}
      <View style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8rpx' }}>
        {xData.map((label, i) => {
          const interval = Math.ceil(xData.length / 6)
          if (i % interval !== 0 && i !== xData.length - 1) return <View key={i} style={{ flex: 1 }} />
          return (
            <Text key={i} style={{ fontSize: '18rpx', color: touchInfo?.index === i ? '#f59e0b' : '#a89580', flex: 1, textAlign: i === 0 ? 'left' : i === xData.length - 1 ? 'right' : 'center', fontWeight: touchInfo?.index === i ? '500' : 'normal' }}>
              {label.slice(5)}
            </Text>
          )
        })}
      </View>
    </View>
  )
}

export default Chart
