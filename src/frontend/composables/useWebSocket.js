import { ref } from 'vue'

export function useWebSocket() {
  const ws = ref(null)
  const isConnected = ref(false)
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 5

  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    // 修复：使用正确的WebSocket路径，包括/ws路径
    const wsUrl = `${protocol}//${window.location.host}/ws`
    
    console.log(`🔌 Connecting to WebSocket: ${wsUrl}`)
    
    ws.value = new WebSocket(wsUrl)
    
    ws.value.onopen = () => {
      console.log('✅ WebSocket connected successfully')
      isConnected.value = true
      reconnectAttempts.value = 0
    }
    
    ws.value.onclose = (event) => {
      console.log(`❌ WebSocket disconnected (code: ${event.code})`)
      isConnected.value = false
      
      // 重连逻辑
      if (reconnectAttempts.value < maxReconnectAttempts) {
        reconnectAttempts.value++
        console.log(`🔄 Attempting to reconnect (${reconnectAttempts.value}/${maxReconnectAttempts})...`)
        setTimeout(connectWebSocket, 3000)
      } else {
        console.error('⛔ Max reconnection attempts reached')
      }
    }
    
    ws.value.onerror = (error) => {
      console.error('❌ WebSocket error:', error)
      isConnected.value = false
    }

    ws.value.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        console.log('📨 WebSocket message received:', message)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }
  }

  return {
    ws,
    isConnected,
    connectWebSocket
  }
}