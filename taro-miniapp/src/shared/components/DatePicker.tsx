import React, { useState, useMemo, useCallback } from 'react'
import { View, Text, Picker } from '@tarojs/components'
import './DatePicker.css'

interface DatePickerProps {
  value?: string
  onChange?: (date: string) => void
  start?: string
  end?: string
  placeholder?: string
}

/**
 * 日期选择组件
 * 支持年月日选择
 */
const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  start = '2020-01-01',
  end,
  placeholder = '请选择日期'
}) => {
  const today = useMemo(() => {
    const now = new Date()
    return now.toISOString().split('T')[0]
  }, [])

  const endValue = end || today
  const selectedDate = value || today

  const [year, month, day] = selectedDate.split('-').map(Number)

  const years = useMemo(() => {
    const startYear = parseInt(start.split('-')[0])
    const endYear = parseInt(endValue.split('-')[0])
    const result: number[] = []
    for (let y = startYear; y <= endYear; y++) {
      result.push(y)
    }
    return result
  }, [start, endValue])

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => i + 1)
  }, [])

  const days = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate()
    return Array.from({ length: daysInMonth }, (_, i) => i + 1)
  }, [year, month])

  const handleChange = useCallback((e: any) => {
    const [yearIndex, monthIndex, dayIndex] = e.detail.value
    const y = years[yearIndex]
    const m = months[monthIndex]
    const d = days[dayIndex]
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (onChange) {
      onChange(dateStr)
    }
  }, [years, months, days, onChange])

  const valueIndex = useMemo(() => {
    const yearIndex = years.indexOf(year)
    const monthIndex = months.indexOf(month)
    const dayIndex = days.indexOf(day)
    return [
      yearIndex >= 0 ? yearIndex : years.length - 1,
      monthIndex >= 0 ? monthIndex : 0,
      dayIndex >= 0 ? dayIndex : 0
    ]
  }, [year, month, day, years, months, days])

  const displayValue = useMemo(() => {
    if (!value) return placeholder
    const [y, m, d] = value.split('-')
    return `${y}年${parseInt(m)}月${parseInt(d)}日`
  }, [value, placeholder])

  const textClass = 'date-text' + (value ? '' : ' placeholder')

  return (
    <View className='date-picker-container'>
      <Picker
        mode='date'
        start={start}
        end={endValue}
        value={selectedDate}
        onChange={handleChange}
      >
        <View className='date-picker-display'>
          <Text className={textClass}>{displayValue}</Text>
          <Text className='date-arrow'>▼</Text>
        </View>
      </Picker>
    </View>
  )
}

export default DatePicker
