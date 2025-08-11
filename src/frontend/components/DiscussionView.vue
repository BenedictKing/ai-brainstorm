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
import { getClientId } from '../utils/storage.js'

const props = defineProps({
  discussionId: String,
  discussionTitle: String
})

const emit = defineEmits(['back-to-home'])

const startPolling = inject('startPolling')
const stopPolling = inject('stopPolling')
const isPolling = inject('isPolling')
const messages = ref([])
const isLoading = ref(false)
const nextSpeaker = ref(null)
const discussionStatus = ref('active')
const messagesContainer = ref(null)
const orderedParticipants = ref([])
const lastMessageCount = ref(0)

// 计算属性
const statusClass = computed(() => {
  return discussionStatus.value === 'completed' ? 'status-completed' : 'status-active'
})

const statusText = computed(() => {
  return discussionStatus.value === 'completed' ? '已完成' : '进行中'
})

// HTTP轮询函数
const pollDiscussionStatus = async () => {
  try {
    const clientId = getClientId();
    const response = await fetch(`/api/discussions/${props.discussionId}/status`, {
      headers: {
        'X-Client-ID': clientId,
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const result = await response.json()
    if (result.success) {
      const conversation = result.data
      
      // 检查状态变化
      if (conversation.status !== discussionStatus.value) {
        discussionStatus.value = conversation.status
        
        if (conversation.status === 'completed') {
          isLoading.value = false
          nextSpeaker.value = null
          orderedParticipants.value = []
          stopPolling()
        }
      }
      
      // 检查新消息
      if (conversation.messages && conversation.messages.length > lastMessageCount.value) {
        const newMessages = conversation.messages.slice(lastMessageCount.value)
        newMessages.forEach(message => {
          addMessage(message)
        })
        lastMessageCount.value = conversation.messages.length
      }
      
      // 更新参与者信息
      if (conversation.participants) {
        orderedParticipants.value = conversation.participants
      }
    }
  } catch (error) {
    console.error('❌ Failed to poll discussion status:', error)
  }
}

// 监听轮询状态变化
watch([startPolling, isPolling], () => {
  if (startPolling && props.discussionId) {
    setupPolling()
  }
}, { immediate: true })

// 设置轮询
const setupPolling = () => {
  console.log('🔄 Setting up polling for discussion:', props.discussionId)
  
  // 开始轮询，每2秒一次
  startPolling(pollDiscussionStatus, 2000)
  
  console.log('✅ Polling set up successfully')
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
  
  // 初始化消息计数
  lastMessageCount.value = 0
  
  // 开始轮询
  if (startPolling && props.discussionId) {
    setupPolling()
  }
})

onUnmounted(() => {
  console.log('📱 DiscussionView unmounted')
  
  // 停止轮询
  if (stopPolling) {
    stopPolling()
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
