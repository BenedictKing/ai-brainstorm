<template>
  <div class="container">
    <div class="header">
      <h1>🤖 AI 智能讨论平台</h1>
      <p>让多个AI模型围绕你的问题进行深度讨论</p>
    </div>

    <div class="main-content">
      <!-- 讨论表单 -->
      <DiscussionForm 
        v-if="!showDiscussion"
        @start-discussion="startDiscussion"
      />

      <!-- 讨论页面 -->
      <DiscussionView
        v-if="showDiscussion"
        :discussion-id="currentDiscussionId"
        :discussion-title="discussionTitle"
        @back-to-home="backToHome"
      />

      <!-- 知识面板 -->
      <KnowledgePanel v-if="showKnowledge" />
    </div>
  </div>
</template>

<script setup>
import { ref, provide } from 'vue'
import DiscussionForm from './components/DiscussionForm.vue'
import DiscussionView from './components/DiscussionView.vue'
import KnowledgePanel from './components/KnowledgePanel.vue'
import { useWebSocket } from './composables/useWebSocket'
import { useProviders } from './composables/useProviders'

// 状态管理
const showDiscussion = ref(false)
const showKnowledge = ref(false)
const currentDiscussionId = ref(null)
const discussionTitle = ref('')

// 组合式函数
const { ws, isConnected, connectWebSocket } = useWebSocket()
const { providers, loadProviders } = useProviders()

// 提供全局状态
provide('ws', ws)
provide('isConnected', isConnected)
provide('providers', providers)

// 初始化
loadProviders()
connectWebSocket()

// 事件处理
const startDiscussion = ({ discussionId, title }) => {
  currentDiscussionId.value = discussionId
  discussionTitle.value = title
  showDiscussion.value = true
  showKnowledge.value = false
}

const backToHome = () => {
  showDiscussion.value = false
  showKnowledge.value = false
  currentDiscussionId.value = null
  discussionTitle.value = ''
}
</script>