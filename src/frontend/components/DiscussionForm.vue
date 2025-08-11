<template>
  <div class="discussion-form">
    <div class="form-group">
      <label for="question">讨论话题 *</label>
      <textarea
        id="question"
        v-model="form.question"
        placeholder="请输入你想讨论的问题或话题..."
        @input="updateStartButton"
      ></textarea>
    </div>

    <div class="form-group">
      <label for="context">背景信息 (可选)</label>
      <textarea
        id="context"
        v-model="form.context"
        placeholder="提供相关背景信息，帮助AI更好地理解话题..."
      ></textarea>
    </div>

    <div class="form-group">
      <label>选择参与讨论的AI角色 (至少选择2个)</label>
      <div class="participants-selector">
        <ParticipantCard
          v-for="role in roles"
          :key="role.id"
          :role="role"
          :selected="selectedParticipants.includes(role.id)"
          :providers="providers"
          @toggle="toggleParticipant"
          @update-model="updateRoleModel"
        />
      </div>
    </div>

    <button
      class="start-btn"
      :disabled="!canStartDiscussion"
      @click="handleStartDiscussion"
    >
      开始讨论
    </button>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import ParticipantCard from './ParticipantCard.vue'

const emit = defineEmits(['start-discussion'])
const providers = inject('providers')

// 表单数据
const form = ref({
  question: '',
  context: ''
})

const selectedParticipants = ref([])
const roleModelMappings = ref({})

// 角色定义
const roles = ref([
  {
    id: 'critic',
    name: '批判性思考者',
    description: '专门找出观点中的漏洞和不足，提出质疑和反驳',
    suggestedProvider: 'claude',
    tags: ['批判', '分析', '逻辑']
  },
  {
    id: 'supporter',
    name: '支持者',
    description: '寻找观点中的亮点和价值，提供支持和扩展',
    suggestedProvider: 'gemini',
    tags: ['支持', '扩展', '建设性']
  },
  {
    id: 'synthesizer',
    name: '综合者',
    description: '整合不同观点，寻找共同点和平衡方案',
    suggestedProvider: 'openai',
    tags: ['综合', '平衡', '调和']
  },
  {
    id: 'innovator',
    name: '创新者',
    description: '提出新颖的观点和创意解决方案',
    suggestedProvider: 'grok',
    tags: ['创新', '创意', '突破']
  },
  {
    id: 'expert',
    name: '领域专家',
    description: '基于专业知识提供权威观点',
    suggestedProvider: 'claude',
    tags: ['专业', '权威', '准确']
  },
  {
    id: 'devil_advocate',
    name: '魔鬼代言人',
    description: '故意提出反对意见，激发更深入的思考',
    suggestedProvider: 'grok',
    tags: ['反对', '质疑', '深入思考']
  }
])

// 计算属性
const canStartDiscussion = computed(() => {
  return form.value.question.trim() && selectedParticipants.value.length >= 2
})

// 方法
const toggleParticipant = (roleId) => {
  const index = selectedParticipants.value.indexOf(roleId)
  if (index > -1) {
    selectedParticipants.value.splice(index, 1)
  } else {
    selectedParticipants.value.push(roleId)
  }
}

const updateRoleModel = (roleId, providerName) => {
  roleModelMappings.value[roleId] = providerName
}

const updateStartButton = () => {
  // 触发响应式更新
}

const handleStartDiscussion = async () => {
  if (!canStartDiscussion.value) return

  try {
    const response = await fetch('/api/discussions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: form.value.question,
        context: form.value.context || undefined,
        participants: selectedParticipants.value
      })
    })

    const result = await response.json()

    if (result.success) {
      emit('start-discussion', {
        discussionId: result.data.conversationId,
        title: form.value.question
      })
    } else {
      alert('启动讨论失败: ' + result.error)
    }
  } catch (error) {
    alert('启动讨论失败: ' + error.message)
  }
}

// 初始化默认选择
onMounted(() => {
  const defaultRoles = ['critic', 'supporter', 'synthesizer']
  selectedParticipants.value = [...defaultRoles]
  
  // 初始化角色模型映射
  roles.value.forEach(role => {
    roleModelMappings.value[role.id] = role.suggestedProvider
  })
})
</script>