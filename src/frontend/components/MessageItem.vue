<template>
  <div 
    v-if="message.type === 'round-indicator'"
    class="round-indicator"
  >
    {{ message.content }}
  </div>
  
  <div 
    v-else-if="message.type === 'discussion-order'"
    class="discussion-order"
  >
    <div style="margin-bottom: 8px;">🎤 讨论顺序</div>
    <div style="font-size: 14px; color: #64748b;">
      {{ message.content }}
    </div>
  </div>
  
  <div 
    v-else
    class="message"
    :class="message.role"
  >
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
      v-html="renderMarkdown(message.content)"
    >
    </div>
  </div>
</template>

<script setup>
import { marked } from 'marked'

const props = defineProps({
  message: Object
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