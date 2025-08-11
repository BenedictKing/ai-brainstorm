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
    <div class="message-content" v-html="renderMarkdown(message.content)"></div>
  </div>
</template>

<script setup>
import { marked } from 'marked'

const props = defineProps({
  message: Object,
})

// 方法
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
</style>
