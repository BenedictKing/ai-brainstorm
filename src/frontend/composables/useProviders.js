import { ref } from 'vue'
import { getClientId } from '../utils/storage.js'

export function useProviders() {
  const providers = ref({})
  const isRetrying = ref(false)
  let retryTimer = null

  const loadProviders = async (isRetryAttempt = false) => {
    try {
      const clientId = getClientId()
      const response = await fetch('/api/providers', {
        headers: {
          'X-Client-ID': clientId,
        },
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()

      if (result.success) {
        // 转换为以name为key的对象
        const providerMap = {}
        result.data.forEach((provider) => {
          providerMap[provider.name] = provider
        })
        providers.value = providerMap
        
        // 连接成功，重置重试状态
        isRetrying.value = false
        if (retryTimer) {
          clearTimeout(retryTimer)
          retryTimer = null
        }
        
        if (isRetryAttempt) {
          console.log('✅ 重新连接 providers API 成功')
        }
      } else {
        throw new Error(result.error || 'Unknown API error')
      }
    } catch (error) {
      console.error('Error loading providers:', error)
      
      // 如果不是重试中，开始重试机制
      if (!isRetrying.value) {
        isRetrying.value = true
        console.log('🔄 providers API 连接失败，将在 5 秒后重试...')
        
        retryTimer = setTimeout(() => {
          loadProviders(true)
        }, 5000)
      }
    }
  }

  const stopRetrying = () => {
    isRetrying.value = false
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
  }

  return {
    providers,
    loadProviders,
    isRetrying,
    stopRetrying,
  }
}
