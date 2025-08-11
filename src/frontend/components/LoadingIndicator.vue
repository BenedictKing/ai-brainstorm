<template>
  <div class="loading">
    <div class="loading-content">
      <div class="loading-spinner"></div>
      <span class="loading-text">{{ loadingText }}</span>
    </div>
    <div v-if="roleDescription" class="loading-role">
      角色: {{ roleDescription }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  nextSpeaker: String
})

// 角色定义映射
const roleMap = {
  'critic': { name: '批判性思考者', description: '专门找出观点中的漏洞和不足，提出质疑和反驳' },
  'supporter': { name: '支持者', description: '寻找观点中的亮点和价值，提供支持和扩展' },
  'synthesizer': { name: '综合者', description: '整合不同观点，寻找共同点和平衡方案' },
  'first_speaker': { name: '初次发言人', description: '作为本次讨论的首位发言者，请提供一个结构化、全面的基础回答，作为后续讨论的起点' },
  'innovator': { name: '创新者', description: '提出新颖的观点和创意解决方案' },
  'expert': { name: '领域专家', description: '基于专业知识提供权威观点' },
  'devil_advocate': { name: '魔鬼代言人', description: '故意提出反对意见，激发更深入的思考' }
}

const loadingText = computed(() => {
  if (props.nextSpeaker) {
    const role = roleMap[props.nextSpeaker]
    return `正在等待 ${role?.name || props.nextSpeaker} 回复...`
  }
  return '正在等待AI回复...'
})

const roleDescription = computed(() => {
  if (props.nextSpeaker) {
    const role = roleMap[props.nextSpeaker]
    return role?.description || ''
  }
  return ''
})
</script>
