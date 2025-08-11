import { ref } from 'vue'

export function useProviders() {
  const providers = ref({})

  const loadProviders = async () => {
    try {
      const response = await fetch('/api/providers')
      const result = await response.json()
      
      if (result.success) {
        // 转换为以name为key的对象
        const providerMap = {}
        result.data.forEach(provider => {
          providerMap[provider.name] = provider
        })
        providers.value = providerMap
      } else {
        console.error('Failed to load providers:', result.error)
      }
    } catch (error) {
      console.error('Error loading providers:', error)
    }
  }

  return {
    providers,
    loadProviders
  }
}