<template>
  <div class="discussion-container">
    <div class="discussion-header">
      <h2 class="discussion-title">{{ discussionTitle }}</h2>
      <div style="display: flex; align-items: center; gap: 15px;">
        <button class="back-home-btn" @click="$emit('back-to-home')">
          ← 返回首页
        </button>
        <div 
          class="discussion-status"
          :class="statusClass"
        >
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
      
      <LoadingIndicator
        v-if="isLoading"
        :next-speaker="nextSpeaker"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted, onUnmounted, nextTick } from 'vue'
import MessageItem from './MessageItem.vue'
import LoadingIndicator from './LoadingIndicator.vue'

const props = defineProps({
  discussionId: String,
  discussionTitle: String
})

const emit = defineEmits(['back-to-home'])

const ws = inject('ws')
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
  const message = JSON.parse(event.data)
  
  switch (message.type) {
    case 'discussion_started':
      isLoading.value = true
      if (message.data.participants?.length > 0) {
        nextSpeaker.value = message.data.participants[0]
      }
      break
      
    case 'message_received':
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
      addRoundIndicator(message.data.round, message.data.maxRounds)
      if (message.data.participants?.length > 0) {
        addDiscussionOrder(message.data.participants)
      }
      break
      
    case 'discussion_completed':
      discussionStatus.value = 'completed'
      isLoading.value = false
      nextSpeaker.value = null
      break
      
    case 'discussion_error':
      console.error('Discussion error:', message.data.error)
      isLoading.value = false
      nextSpeaker.value = null
      alert('讨论过程中出现错误: ' + message.data.error)
      break
  }
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
  if (ws.value && ws.value.readyState === WebSocket.OPEN) {
    ws.value.addEventListener('message', handleWebSocketMessage)
    
    // 订阅讨论更新
    ws.value.send(JSON.stringify({
      type: 'subscribe_discussion',
      conversationId: props.discussionId
    }))
  }
})

onUnmounted(() => {
  if (ws.value) {
    ws.value.removeEventListener('message', handleWebSocketMessage)
    
    // 取消订阅
    if (props.discussionId) {
      ws.value.send(JSON.stringify({
        type: 'unsubscribe_discussion',
        conversationId: props.discussionId
      }))
    }
  }
})
</script>