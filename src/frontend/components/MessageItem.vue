<template>
  <div v-if="message.type === 'round-indicator'" class="round-indicator">
    {{ message.content }}
  </div>

  <div v-else-if="message.type === 'discussion-order'" class="discussion-order">
    <div style="margin-bottom: 8px">🎤 讨论顺序</div>
    <div style="font-size: 14px; color: #64748b">
      {{ message.content }}
    </div>
  </div>

  <div v-else-if="message.type === 'retry-indicator'" class="retry-indicator">
    <div class="retry-content">
      <div class="retry-spinner"></div>
      <div class="retry-text">{{ message.content }}</div>
    </div>
  </div>

  <div v-else class="message" :class="message.role">
    <div class="message-header">
      <span class="message-author">
        {{ getAuthorName(message) }}
      </span>
      <span class="message-time">
        {{ formatTime(message.timestamp) }}
      </span>
    </div>
    <div 
      class="message-content" 
      :class="{ 'collapsed': !isExpanded && shouldCollapse }"
      v-html="renderMarkdown(message.content)">
    </div>
    <div v-if="shouldCollapse" class="expand-button">
      <el-button 
        text 
        type="primary" 
        size="small" 
        @click="toggleExpanded">
        {{ isExpanded ? '收起' : '展开全文' }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { marked } from 'marked'

const props = defineProps({
  message: Object,
})

// 状态管理
const isExpanded = ref(false)

// 计算属性
const shouldCollapse = computed(() => {
  // 判断内容是否需要折叠：超过一定长度或行数
  const content = props.message.content
  return content && (content.length > 600 || content.split('\n').length > 6)
})

// 方法
const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
}

const getAuthorName = (message) => {
  return message.metadata?.participantName || message.model || 'AI'
}

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString()
}

const renderMarkdown = (content) => {
  if (typeof marked !== 'undefined') {
    return marked.parse(content)
  }
  return content.replace(/\n/g, '<br>')
}
</script>

<style scoped>
.retry-indicator {
  text-align: center;
  margin: 16px 0;
  padding: 16px 20px;
  background: linear-gradient(135deg, #fff3cd 0%, #fef3c7 100%);
  border-radius: 12px;
  border: 1px solid #f59e0b;
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.1);
}

.retry-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.retry-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #f59e0b;
  border-top: 2px solid transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.retry-text {
  color: #92400e;
  font-weight: 500;
  font-size: 14px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 消息折叠样式 */
.message-content {
  transition: all 0.3s ease;
}

.message-content.collapsed {
  max-height: 17em; /* 约10行的高度，根据line-height 1.7计算 (1.7 * 10 = 17em) */
  overflow: hidden;
  position: relative;
}

.message-content.collapsed::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3em;
  background: linear-gradient(transparent, #fdfcfb); /* 匹配assistant消息的背景色 */
  pointer-events: none;
}

.expand-button {
  margin-top: 8px;
  text-align: center;
}

.expand-button .el-button {
  font-size: 12px;
  padding: 4px 8px;
}
</style>
