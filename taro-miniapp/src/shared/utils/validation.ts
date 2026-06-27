/**
 * 表单校验工具
 * 提供金额、备注等校验规则
 */

export interface ValidationResult {
  valid: boolean
  message: string
}

/**
 * 校验金额
 */
export function validateAmount(value: number | string): ValidationResult {
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (numValue === undefined || numValue === null || isNaN(numValue)) {
    return { valid: false, message: '请输入有效金额' }
  }
  if (numValue <= 0) {
    return { valid: false, message: '金额必须大于0' }
  }
  if (numValue > 999999.99) {
    return { valid: false, message: '金额不能超过999999.99' }
  }
  const strValue = numValue.toString()
  const decimalIndex = strValue.indexOf('.')
  if (decimalIndex !== -1 && strValue.length - decimalIndex - 1 > 2) {
    return { valid: false, message: '金额最多保留两位小数' }
  }
  return { valid: true, message: '' }
}

/**
 * 校验备注
 */
export function validateNote(value: string, maxLength = 100): ValidationResult {
  if (!value || value.trim() === '') {
    return { valid: true, message: '' }
  }
  if (value.length > maxLength) {
    return { valid: false, message: `备注不能超过${maxLength}个字符` }
  }
  return { valid: true, message: '' }
}

/**
 * 校验分类
 */
export function validateCategory(categoryId: number | undefined): ValidationResult {
  if (!categoryId || categoryId <= 0) {
    return { valid: false, message: '请选择分类' }
  }
  return { valid: true, message: '' }
}

/**
 * 校验日期
 */
export function validateDate(date: string): ValidationResult {
  if (!date || date.trim() === '') {
    return { valid: false, message: '请选择日期' }
  }
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(date)) {
    return { valid: false, message: '日期格式不正确' }
  }
  const dateObj = new Date(date)
  if (isNaN(dateObj.getTime())) {
    return { valid: false, message: '日期无效' }
  }
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  if (dateObj > today) {
    return { valid: false, message: '日期不能超过今天' }
  }
  return { valid: true, message: '' }
}

/**
 * 校验用户名
 */
export function validateUsername(username: string): ValidationResult {
  if (!username || username.trim() === '') {
    return { valid: false, message: '请输入用户名' }
  }
  if (username.length < 3) {
    return { valid: false, message: '用户名至少3个字符' }
  }
  if (username.length > 20) {
    return { valid: false, message: '用户名不能超过20个字符' }
  }
  return { valid: true, message: '' }
}

/**
 * 校验密码
 */
export function validatePassword(password: string): ValidationResult {
  if (!password || password.trim() === '') {
    return { valid: false, message: '请输入密码' }
  }
  if (password.length < 6) {
    return { valid: false, message: '密码至少6个字符' }
  }
  if (password.length > 32) {
    return { valid: false, message: '密码不能超过32个字符' }
  }
  return { valid: true, message: '' }
}

export default {
  validateAmount,
  validateNote,
  validateCategory,
  validateDate,
  validateUsername,
  validatePassword
}
