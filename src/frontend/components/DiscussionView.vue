<template>
  <div class="discussion-container">
    <div class="discussion-header">
      <div class="discussion-question">
        <h3>讨论问题</h3>
        <p>{{ discussionTitle }}</p>
      </div>
      <div style="display: flex; align-items: center; gap: 15px">
        <button class="back-home-btn" @click="$emit('back-to-home')">← 返回首页</button>
        <div class="discussion-status" :class="statusClass">
          {{ statusText }}
        </div>
      </div>
    </div>

    <div class="messages-container" ref="messagesContainer">
      <!-- 讨论不存在时的重试界面 -->
      <div v-if="showDiscussionNotFound" class="discussion-not-found">
        <div class="not-found-content">
          <h3>🔍 找不到讨论</h3>
          <p>该讨论可能已过期或服务器已重启。</p>
          <div class="not-found-actions">
            <el-button type="primary" @click="retryLoadDiscussion">
              重试加载
            </el-button>
            <el-button @click="$emit('back-to-home')">
              返回首页
            </el-button>
          </div>
        </div>
      </div>

      <!-- 正常的消息列表 -->
      <template v-else>
        <MessageItem v-for="message in messages" :key="message.id" :message="message" />
        
        <!-- 讨论进行中时显示转圈 -->
        <div v-if="discussionStatus === 'active' && !showDiscussionNotFound" class="discussion-loading">
          <div class="loading-spinner"></div>
          <div class="loading-text">AI正在思考中...</div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { ElMessage } from 'element-plus'
import MessageItem from './MessageItem.vue'
import LoadingIndicator from './LoadingIndicator.vue'
import { getClientId } from '../utils/storage.js'

const props = defineProps({
  discussionId: String,
  discussionTitle: String,
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
const showDiscussionNotFound = ref(false)

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
    const clientId = getClientId()
    const response = await fetch(`/api/discussions/${props.discussionId}/status`, {
      headers: {
        'X-Client-ID': clientId,
      },
    })
    if (!response.ok) {
      if (response.status === 404) {
        // 讨论不存在，显示重试界面而不是自动跳转
        console.warn('⚠️ Discussion not found, showing retry interface')
        showDiscussionNotFound.value = true
        isLoading.value = false
        if (stopPolling) {
          stopPolling()
        }
        return
      }
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    if (result.success) {
      // 如果成功获取到数据，隐藏404界面
      showDiscussionNotFound.value = false
      
      const conversation = result.data
      const isFirstLoad = messages.value.length === 0

      // 1. 更新消息列表
      if (conversation.messages && conversation.messages.length > lastMessageCount.value) {
        if (isFirstLoad && conversation.messages.length > 0) {
          // 只有在实际开始讨论时才显示轮次指示器，并且还没有显示过
          if (conversation.currentRound > 0 && !messages.value.some(m => m.type === 'round-indicator')) {
            addRoundIndicator(conversation.currentRound, conversation.maxRounds)
          }
          // 只有还没有显示过讨论顺序时才添加
          if (!messages.value.some(m => m.type === 'discussion-order')) {
            addDiscussionOrder(conversation.participants.map((p) => p.name))
          }
        }

        const newMessages = conversation.messages.slice(lastMessageCount.value)
        newMessages.forEach((message) => {
          addMessage(message)
        })
        lastMessageCount.value = conversation.messages.length
      }

      // 2. 更新参与者信息
      if (conversation.participants) {
        orderedParticipants.value = conversation.participants
      }

      // 3. 更新加载状态
      // 如果讨论未完成，loading状态取决于是否有下一个发言者
      // 这个逻辑可以保持，或者在讨论完成时强制设为 false
      if (conversation.status === 'active') {
        isLoading.value = false
      }

      // 4. 最后，检查讨论是否已完成
      if (conversation.status !== discussionStatus.value) {
        discussionStatus.value = conversation.status
        if (conversation.status === 'completed' || conversation.status === 'error') {
          console.log(`✅ Discussion ${conversation.status}. Stopping polling.`)
          isLoading.value = false // 确保完成时移除加载指示器
          nextSpeaker.value = null
          orderedParticipants.value = []
          if (stopPolling) {
            stopPolling()
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Failed to poll discussion status:', error)
    isLoading.value = false // 出错时停止加载
    if (stopPolling) {
      stopPolling()
    }
  }
}

// 设置轮询
const setupPolling = () => {
  console.log('🔄 Setting up polling for discussion:', props.discussionId)

  // 确保startPolling函数可用
  if (!startPolling || typeof startPolling !== 'function') {
    console.error('❌ startPolling function is not available')
    return
  }

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
    timestamp: new Date(),
  }
  messages.value.push(indicator)
  scrollToBottom()
}

const addDiscussionOrder = (participantNames) => {
  const order = {
    id: `order-${Date.now()}`,
    type: 'discussion-order',
    content: participantNames.map((name, index) => `${index + 1}. ${name}`).join(' → '),
    timestamp: new Date(),
  }
  messages.value.push(order)
  scrollToBottom()
}

const addRetryIndicator = (retryData) => {
  const indicator = {
    id: `retry-${Date.now()}`,
    type: 'retry-indicator',
    content: `${retryData.participantName} 正在重试中... (${retryData.attempt}/${retryData.maxAttempts}) - ${retryData.reason}`,
    timestamp: new Date(),
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

// 重试加载讨论
const retryLoadDiscussion = () => {
  console.log('🔄 Retrying to load discussion...')
  showDiscussionNotFound.value = false
  isLoading.value = true
  lastMessageCount.value = 0
  messages.value = []
  
  // 重新开始轮询
  if (startPolling && typeof startPolling === 'function' && props.discussionId) {
    setupPolling()
  } else {
    console.error('❌ Cannot retry: startPolling function is not available')
  }
}

// 生命周期
onMounted(() => {
  console.log('📱 DiscussionView mounted, discussionId:', props.discussionId)

  // 初始化时，立即进入加载状态
  isLoading.value = true
  lastMessageCount.value = 0

  // 等待下一个tick，确保所有inject都已完成
  nextTick(() => {
    if (startPolling && typeof startPolling === 'function' && props.discussionId) {
      setupPolling()
    } else {
      console.error('❌ startPolling function not available:', { startPolling, discussionId: props.discussionId })
    }
  })
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

.discussion-not-found {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
}

.not-found-content h3 {
  color: #8b5a3c;
  font-size: 24px;
  margin-bottom: 16px;
}

.not-found-content p {
  color: #5d4e37;
  font-size: 16px;
  margin-bottom: 24px;
  opacity: 0.8;
}

.not-found-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
</style>
