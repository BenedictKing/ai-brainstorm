import { ref } from 'vue'

export function usePolling() {
  const isPolling = ref(false)
  const pollingInterval = ref(null)

  const startPolling = (callback, interval = 2000) => {
    if (isPolling.value) {
      stopPolling()
    }
    
    console.log(`🔄 Starting polling with ${interval}ms interval`)
    isPolling.value = true
    
    // Immediate first call
    callback()
    
    pollingInterval.value = setInterval(callback, interval)
  }

  const stopPolling = () => {
    if (pollingInterval.value) {
      clearInterval(pollingInterval.value)
      pollingInterval.value = null
    }
    isPolling.value = false
    console.log('⏹️ Stopped polling')
  }

  return {
    isPolling,
    startPolling,
    stopPolling
  }
}