import { ref } from 'vue'

export function useWebSocket() {
  const ws = ref(null)

  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}`
    
    ws.value = new WebSocket(wsUrl)
    
    ws.value.onopen = () => {
      console.log('WebSocket connected')
    }
    
    ws.value.onclose = () => {
      console.log('WebSocket disconnected')
      // 重连逻辑
      setTimeout(connectWebSocket, 3000)
    }
    
    ws.value.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }

  return {
    ws,
    connectWebSocket
  }
}