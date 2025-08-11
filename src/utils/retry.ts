// 重试配置接口
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryableErrors: string[];
}

// 默认重试配置
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  baseDelay: 2000, // 固定2秒
  maxDelay: 2000, // 固定2秒，不使用指数退避
  backoffFactor: 1, // 不使用指数退避
  retryableErrors: [
    'ECONNABORTED', // 超时
    'ENOTFOUND', // DNS错误
    'ECONNREFUSED', // 连接被拒绝
    'ECONNRESET', // 连接重置
    'ETIMEDOUT', // 连接超时
    'Network Error', // 通用网络错误
    '500', // 服务器内部错误
    '502', // 网关错误
    '503', // 服务不可用
    '504', // 网关超时
    '429', // 请求过于频繁
  ]
}

// 判断是否应该重试的函数
export const shouldRetry = (error: any, config: RetryConfig): boolean => {
  // 检查错误代码
  if (error.code && config.retryableErrors.includes(error.code)) {
    return true
  }
  
  // 检查HTTP状态码
  if (error.response?.status) {
    const status = error.response.status.toString()
    if (config.retryableErrors.includes(status)) {
      return true
    }
  }
  
  // 检查错误信息
  if (error.message) {
    for (const retryableError of config.retryableErrors) {
      if (error.message.includes(retryableError)) {
        return true
      }
    }
  }
  
  return false
}

// 计算延迟时间（固定延迟）
export const calculateDelay = (attempt: number, config: RetryConfig): number => {
  // 使用固定延迟，忽略指数退避
  return config.baseDelay;
}

// 通用重试函数
export const withRetry = async <T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context: string = 'Unknown'
): Promise<T> => {
  let lastError: any
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      console.log(`🔄 [${context}] Attempt ${attempt}/${config.maxAttempts}`)
      return await operation()
    } catch (error) {
      lastError = error
      
      // 如果这是最后一次尝试，或者错误不可重试，直接抛出
      if (attempt === config.maxAttempts || !shouldRetry(error, config)) {
        console.error(`❌ [${context}] Final attempt failed:`, (error as Error).message)
        throw error
      }
      
      // 计算延迟时间并等待
      const delay = calculateDelay(attempt, config)
      console.warn(`⚠️  [${context}] Attempt ${attempt} failed: ${(error as Error).message}, retrying in ${delay}ms...`)
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}

// 睡眠函数
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}