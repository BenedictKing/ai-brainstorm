<template>
  <div class="discussion-container">
    <div class="discussion-header">
      <div class="discussion-question">
        <h3>讨论问题</h3>
        <p>{{ discussionTitle }}</p>
      </div>
      <div style="display: flex; align-items: center; gap: 15px">
        <button class="back-home-btn" @click="$emit('back-to-home')">
          ← 返回首页
        </button>
        <div class="discussion-status" :class="statusClass">
          {{ statusText }}
        </div>
      </div>
    </div>

    <div class="messages-container" ref="messagesContainer">
      <MessageItem
        v-for="message in messages"
        :key="message.id"
        :message="message"
      />

      <LoadingIndicator v-if="isLoading" :next-speaker="nextSpeaker" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted, onUnmounted, nextTick, watch } from 'vue'
import MessageItem from './MessageItem.vue'
import LoadingIndicator from './LoadingIndicator.vue'

const props = defineProps({
  discussionId: String,
  discussionTitle: String
})

const emit = defineEmits(['back-to-home'])

const ws = inject('ws')
const isConnected = inject('isConnected')
const messages = ref([])
const isLoading = ref(false)
const nextSpeaker = ref(null)
const discussionStatus = ref('active')
const messagesContainer = ref(null)

// 计算属性
const statusClass = computed(() => {
  return discussionStatus.value === 'completed' ? 'status-completed' : 'status-active'
})

const statusText = computed(() => {
  return discussionStatus.value === 'completed' ? '已完成' : '进行中'
})

// WebSocket 消息处理
const handleWebSocketMessage = (event) => {
  console.log('📨 Received WebSocket message in DiscussionView:', event.data)

  try {
    const message = JSON.parse(event.data)

    switch (message.type) {
      case 'discussion_started':
        console.log('🚀 Discussion started:', message.data)
        isLoading.value = true
        if (message.data.participants?.length > 0) {
          nextSpeaker.value = message.data.participants[0]
        }
        break

      case 'message_received':
        console.log('💬 Message received:', message.data)
        addMessage(message.data.message)

        // 检查是否还有下一个参与者
        const { participantIndex, totalParticipants } = message.data
        if (participantIndex < totalParticipants - 1) {
          nextSpeaker.value = getNextSpeakerName(participantIndex + 1)
        } else {
          isLoading.value = false
          nextSpeaker.value = null
        }
        break

      case 'round_started':
        console.log('🔄 Round started:', message.data)
        addRoundIndicator(message.data.round, message.data.maxRounds)
        if (message.data.participants?.length > 0) {
          addDiscussionOrder(message.data.participants)
        }
        break

      case 'discussion_completed':
        console.log('✅ Discussion completed:', message.data)
        discussionStatus.value = 'completed'
        isLoading.value = false
        nextSpeaker.value = null
        break

      case 'discussion_error':
        console.error('❌ Discussion error:', message.data.error)
        isLoading.value = false
        nextSpeaker.value = null
        alert('讨论过程中出现错误: ' + message.data.error)
        break

      case 'first_speaker_retry':
        console.log('🔄 First speaker retry:', message.data)
        addRetryIndicator(message.data)
        break

      default:
        console.log('Unknown message type:', message.type)
    }
  } catch (error) {
    console.error('Failed to parse WebSocket message:', error)
  }
}

// 监听WebSocket连接状态变化
watch([ws, isConnected], () => {
  if (ws.value && isConnected.value) {
    setupWebSocketListeners()
  }
}, { immediate: true })

// 设置WebSocket监听器
const setupWebSocketListeners = () => {
  if (!ws.value || !isConnected.value) return

  console.log('🔗 Setting up WebSocket listeners for discussion:', props.discussionId)

  // 移除之前的监听器（避免重复）
  ws.value.removeEventListener('message', handleWebSocketMessage)

  // 添加新的监听器
  ws.value.addEventListener('message', handleWebSocketMessage)

  // 订阅讨论更新
  ws.value.send(JSON.stringify({
    type: 'subscribe_discussion',
    conversationId: props.discussionId
  }))

  console.log('✅ WebSocket listeners set up successfully')
}

// 方法
const addMessage = (message) => {
  messages.value.push(message)
  scrollToBottom()
}

const addRoundIndicator = (round, maxRounds) => {
  const indicator = {
    id: `round-${round}`,
    type: 'round-indicator',
    content: `第 ${round} 轮讨论 (共 ${maxRounds} 轮)`,
    timestamp: new Date()
  }
  messages.value.push(indicator)
  scrollToBottom()
}

const addDiscussionOrder = (participantNames) => {
  const order = {
    id: `order-${Date.now()}`,
    type: 'discussion-order',
    content: participantNames.map((name, index) => `${index + 1}. ${name}`).join(' → '),
    timestamp: new Date()
  }
  messages.value.push(order)
  scrollToBottom()
}

const addRetryIndicator = (retryData) => {
  const indicator = {
    id: `retry-${Date.now()}`,
    type: 'retry-indicator',
    content: `${retryData.participantName} 正在重试中... (${retryData.attempt}/${retryData.maxAttempts}) - ${retryData.reason}`,
    timestamp: new Date()
  }
  messages.value.push(indicator)
  scrollToBottom()
}

const getNextSpeakerName = (index) => {
  // 这里需要根据实际的参与者列表来获取
  // 临时实现
  return `参与者 ${index + 1}`
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// 生命周期
onMounted(() => {
  console.log('📱 DiscussionView mounted, discussionId:', props.discussionId)

  // 如果WebSocket已连接，立即设置监听器
  if (ws.value && isConnected.value) {
    setupWebSocketListeners()
  }
  // 否则等待watch回调处理
})

onUnmounted(() => {
  console.log('📱 DiscussionView unmounted')

  if (ws.value) {
    // 移除消息监听器
    ws.value.removeEventListener('message', handleWebSocketMessage)

    // 取消订阅（如果连接仍然活跃）
    if (props.discussionId && ws.value.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify({
        type: 'unsubscribe_discussion',
        conversationId: props.discussionId
      }))
    }
  }
})
</script>

<style scoped>
.discussion-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
  background: linear-gradient(135deg, #faf9f7 0%, #f8f6f3 100%);
  min-height: 100vh;
}

.discussion-header {
  background: linear-gradient(135deg, #ffffff 0%, #fdfcfb 100%);
  border: 1px solid #f0ebe5;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  box-shadow: 0 4px 12px rgba(184, 167, 143, 0.1);
  backdrop-filter: blur(10px);
}

.discussion-question {
  flex: 1;
}

.discussion-question h3 {
  margin: 0 0 10px 0;
  color: #8b5a3c;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.discussion-question p {
  margin: 0;
  color: #5d4e37;
  font-size: 18px;
  line-height: 1.6;
  font-weight: 500;
}

.back-home-btn {
  background: linear-gradient(135deg, #d4a574 0%, #c19552 100%);
  color: white;
  border: none;
  padding: 10px 18px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(196, 149, 82, 0.3);
}

.back-home-btn:hover {
  background: linear-gradient(135deg, #c19552 0%, #b8864a 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(196, 149, 82, 0.4);
}

.discussion-status {
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.status-active {
  background: linear-gradient(135deg, #e8f5e8 0%, #d4f4d4 100%);
  color: #2d5016;
  border: 1px solid #c3e6c3;
  box-shadow: 0 2px 4px rgba(45, 80, 22, 0.1);
}

.status-completed {
  background: linear-gradient(135deg, #e1f0ff 0%, #cce7ff 100%);
  color: #1e3a8a;
  border: 1px solid #93c5fd;
  box-shadow: 0 2px 4px rgba(30, 58, 138, 0.1);
}

.messages-container {
  max-height: 70vh;
  overflow-y: auto;
  padding: 24px;
  background: linear-gradient(135deg, #ffffff 0%, #fefefe 100%);
  border: 1px solid #f0ebe5;
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(184, 167, 143, 0.08);
  backdrop-filter: blur(10px);
}

.messages-container::-webkit-scrollbar {
  width: 8px;
}

.messages-container::-webkit-scrollbar-track {
  background: #f8f6f3;
  border-radius: 4px;
}

.messages-container::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #d4a574 0%, #c19552 100%);
  border-radius: 4px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, #c19552 0%, #b8864a 100%);
}
</style>
