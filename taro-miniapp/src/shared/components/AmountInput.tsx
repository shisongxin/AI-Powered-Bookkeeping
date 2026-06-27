import React, { useState, useCallback } from 'react'
import { View, Text, Input } from '@tarojs/components'
import './AmountInput.css'

interface AmountInputProps {
  value?: number
  onChange?: (value: number) => void
  placeholder?: string
  maxLength?: number
  disabled?: boolean
}

/**
 * 金额输入组件
 * 支持数字键盘输入，小数点后两位
 */
const AmountInput: React.FC<AmountInputProps> = ({
  value = 0,
  onChange,
  placeholder = '请输入金额',
  maxLength = 10,
  disabled = false
}) => {
  const [displayValue, setDisplayValue] = useState(value.toString())
  const [isFocused, setIsFocused] = useState(false)

  const handleInput = useCallback((e: any) => {
    const inputValue = e.detail.value
    if (!/^\d*\.?\d*$/.test(inputValue) && inputValue !== '') {
      return
    }
    const parts = inputValue.split('.')
    if (parts.length > 1 && parts[1].length > 2) {
      return
    }
    setDisplayValue(inputValue)
    const numValue = parseFloat(inputValue) || 0
    if (onChange) {
      onChange(numValue)
    }
  }, [onChange])

  const handleBlur = useCallback(() => {
    setIsFocused(false)
    const numValue = parseFloat(displayValue) || 0
    setDisplayValue(numValue.toString())
    if (onChange) {
      onChange(numValue)
    }
  }, [displayValue, onChange])

  const handleFocus = useCallback(() => {
    setIsFocused(true)
  }, [])

  const handleClear = useCallback(() => {
    setDisplayValue('0')
    if (onChange) {
      onChange(0)
    }
  }, [onChange])

  const containerClass = 'amount-input-container' +
    (isFocused ? ' focused' : '') +
    (disabled ? ' disabled' : '')

  return (
    <View className={containerClass}>
      <View className='amount-symbol'>
        <Text className='symbol-text'>¥</Text>
      </View>
      <Input
        className='amount-input'
        type='digit'
        value={displayValue}
        onInput={handleInput}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        maxlength={maxLength}
        disabled={disabled}
      />
      {displayValue && !disabled ? (
        <View className='clear-btn' onClick={handleClear}>
          <Text className='clear-icon'>×</Text>
        </View>
      ) : null}
    </View>
  )
}

export default AmountInput
