<template>
  <div class="container">
    <div class="header">
      <h1>🤖 AI 智能讨论平台</h1>
      <p>让多个AI模型围绕你的问题进行深度讨论</p>
      
      <!-- 调试按钮 -->
      <div v-if="showDiscussion && !currentDiscussionId" style="margin-top: 10px;">
        <el-button type="warning" size="small" @click="clearInvalidDiscussion">
          清理无效状态
        </el-button>
      </div>
    </div>

    <div class="main-content">
      <!-- 讨论表单 -->
      <DiscussionForm v-if="!showDiscussion" @start-discussion="startDiscussion" />

      <!-- 讨论页面 -->
      <DiscussionView
        v-if="showDiscussion"
        :discussion-id="currentDiscussionId"
        :discussion-title="discussionTitle"
        @back-to-home="backToHome" />

      <!-- 知识面板 -->
      <KnowledgePanel v-if="showKnowledge" />
    </div>
  </div>
</template>

<script setup>
import { ref, provide, onMounted, onBeforeUnmount } from 'vue'
import DiscussionForm from './components/DiscussionForm.vue'
import DiscussionView from './components/DiscussionView.vue'
import KnowledgePanel from './components/KnowledgePanel.vue'
import { useProviders } from './composables/useProviders'
import { STORAGE_KEYS, loadFromStorage, removeFromStorage, migrateLegacyStorage } from './utils/storage'

// 状态管理
const showDiscussion = ref(false)
const showKnowledge = ref(false)
const currentDiscussionId = ref(null)
const discussionTitle = ref('')

// 轮询状态
const isPolling = ref(false)
let pollingInterval = null

// 组合式函数
const { providers, loadProviders } = useProviders()

// 轮询函数
const startPolling = (pollingFunction, intervalMs = 2000) => {
  if (!pollingFunction || typeof pollingFunction !== 'function') {
    console.error('❌ startPolling: pollingFunction is not a function', pollingFunction)
    return
  }
  
  if (isPolling.value) {
    stopPolling()
  }
  
  console.log('🔄 Starting polling with interval:', intervalMs)
  isPolling.value = true
  
  // 立即执行一次
  try {
    pollingFunction()
  } catch (error) {
    console.error('❌ Error in polling function:', error)
    isPolling.value = false
    return
  }
  
  // 设置定时轮询
  pollingInterval = setInterval(() => {
    try {
      pollingFunction()
    } catch (error) {
      console.error('❌ Error in polling function:', error)
      stopPolling()
    }
  }, intervalMs)
}

const stopPolling = () => {
  if (pollingInterval) {
    console.log('⏹️ Stopping polling')
    clearInterval(pollingInterval)
    pollingInterval = null
    isPolling.value = false
  }
}

// 提供全局状态和函数
provide('providers', providers)
provide('startPolling', startPolling)
provide('stopPolling', stopPolling)
provide('isPolling', isPolling)

// 初始化
loadProviders()

// 事件处理
const startDiscussion = ({ discussionId, title }) => {
  currentDiscussionId.value = discussionId
  discussionTitle.value = title
  showDiscussion.value = true
  showKnowledge.value = false
}

const backToHome = () => {
  // 停止轮询
  stopPolling()
  
  showDiscussion.value = false
  showKnowledge.value = false
  currentDiscussionId.value = null
  discussionTitle.value = ''

  // 清除 localStorage 中的活跃讨论状态
  removeFromStorage(STORAGE_KEYS.ACTIVE_DISCUSSION_ID)
  removeFromStorage(STORAGE_KEYS.ACTIVE_DISCUSSION_TITLE)
}

// 清理无效的讨论状态
const clearInvalidDiscussion = () => {
  console.log('🧹 清理无效的讨论状态')
  showDiscussion.value = false
  showKnowledge.value = false
  currentDiscussionId.value = null
  discussionTitle.value = ''
  removeFromStorage(STORAGE_KEYS.ACTIVE_DISCUSSION_ID)
  removeFromStorage(STORAGE_KEYS.ACTIVE_DISCUSSION_TITLE)
}

// 在组件挂载时检查并恢复讨论状态
onMounted(() => {
  // 先迁移旧的localStorage格式
  migrateLegacyStorage()
  
  const activeId = loadFromStorage(STORAGE_KEYS.ACTIVE_DISCUSSION_ID)
  const activeTitle = loadFromStorage(STORAGE_KEYS.ACTIVE_DISCUSSION_TITLE)

  if (activeId && activeTitle) {
    console.log(`🔄 Resuming active discussion: ${activeId}`)
    startDiscussion({ discussionId: activeId, title: activeTitle })
  } else {
    // 如果没有活跃讨论，确保显示表单
    showDiscussion.value = false
    showKnowledge.value = false
  }
})

// 在组件卸载时清理轮询
onBeforeUnmount(() => {
  stopPolling()
})
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: linear-gradient(135deg, #faf9f7 0%, #f8f6f3 100%);
  padding: 0;
}

.header {
  background: linear-gradient(135deg, #ffffff 0%, #fdfcfb 100%);
  padding: 32px 24px;
  text-align: center;
  border-bottom: 1px solid #f0ebe5;
  box-shadow: 0 2px 12px rgba(184, 167, 143, 0.08);
}

.header h1 {
  margin: 0 0 12px 0;
  color: #8b5a3c;
  font-size: 2.5rem;
  font-weight: 700;
  letter-spacing: -0.5px;
  text-shadow: 0 2px 4px rgba(139, 90, 60, 0.1);
}

.header p {
  margin: 0;
  color: #5d4e37;
  font-size: 1.1rem;
  font-weight: 400;
  opacity: 0.8;
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}
</style>
