<template>
  <div class="discussion-form">
    <div class="form-group">
      <label for="question">讨论话题 *</label>
      <textarea
        id="question"
        v-model="form.question"
        placeholder="请输入你想讨论的问题或话题..."
        @input="updateStartButton"></textarea>
    </div>

    <div class="form-group">
      <label for="context">背景信息 (可选)</label>
      <textarea id="context" v-model="form.context" placeholder="提供相关背景信息，帮助AI更好地理解话题..."></textarea>
    </div>

    <div class="form-group">
      <label>初次发言人 (自动选择)</label>
      <div class="first-speaker-section">
        <ParticipantCard
          v-if="firstSpeakerRole"
          :key="firstSpeakerRole.id"
          :role="firstSpeakerRole"
          :selected="true"
          :providers="providers"
          :initial-provider="roleModelMappings[firstSpeakerRole.id]"
          :disabled="true"
          @update-model="updateRoleModel" />
      </div>
    </div>

    <div class="form-group">
      <label>选择其他参与讨论的AI角色 (至少选择1个)</label>
      <div class="participants-selector">
        <ParticipantCard
          v-for="role in otherRoles"
          :key="role.id"
          :role="role"
          :selected="selectedParticipants.includes(role.id)"
          :providers="providers"
          :initial-provider="roleModelMappings[role.id]"
          @toggle="toggleParticipant"
          @update-model="updateRoleModel" />
      </div>
    </div>

    <button class="start-btn" :disabled="!canStartDiscussion" @click="handleStartDiscussion">开始讨论</button>

    <div class="form-actions">
      <button type="button" class="reset-btn" @click="handleResetCache" title="清空保存的设置，恢复到默认状态">
        🗑️ 重置设置
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted, watch } from 'vue';
import ParticipantCard from './ParticipantCard.vue';
import { STORAGE_KEYS, loadFromStorage, saveToStorage, clearAppStorage } from '../utils/storage.js';

const emit = defineEmits(['start-discussion']);
const providers = inject('providers');

// 表单数据 - 从localStorage恢复
const form = ref(
  loadFromStorage(STORAGE_KEYS.FORM_DATA, {
    question: '',
    context: '',
  })
);

const selectedParticipants = ref(loadFromStorage(STORAGE_KEYS.SELECTED_PARTICIPANTS, []));
const roleModelMappings = ref(loadFromStorage(STORAGE_KEYS.ROLE_MODEL_MAPPINGS, {}));

// 角色定义
const roles = ref([
  {
    id: 'critic',
    name: '批判性思考者',
    description: '专门找出观点中的漏洞和不足，提出质疑和反驳',
    suggestedProvider: 'claude',
    tags: ['批判', '分析', '逻辑'],
  },
  {
    id: 'supporter',
    name: '支持者',
    description: '寻找观点中的亮点和价值，提供支持和扩展',
    suggestedProvider: 'gemini',
    tags: ['支持', '扩展', '建设性'],
  },
  {
    id: 'first_speaker',
    name: '初次发言人',
    description: '作为本次讨论的首位发言者，请提供一个结构化、全面的基础回答，作为后续讨论的起点',
    suggestedProvider: 'gemini',
    tags: ['首发', '引导', '总结'],
  },
  {
    id: 'synthesizer',
    name: '综合者',
    description: '整合不同观点，寻找共同点和平衡方案',
    suggestedProvider: 'openai',
    tags: ['综合', '平衡', '调和'],
  },
  {
    id: 'innovator',
    name: '创新者',
    description: '提出新颖的观点和创意解决方案',
    suggestedProvider: 'grok',
    tags: ['创新', '创意', '突破'],
  },
  {
    id: 'expert',
    name: '领域专家',
    description: '基于专业知识提供权威观点',
    suggestedProvider: 'claude',
    tags: ['专业', '权威', '准确'],
  },
  {
    id: 'devil_advocate',
    name: '魔鬼代言人',
    description: '故意提出反对意见，激发更深入的思考',
    suggestedProvider: 'grok',
    tags: ['反对', '质疑', '深入思考'],
  },
]);

// 计算属性
const firstSpeakerRole = computed(() => roles.value.find((r) => r.id === 'first_speaker'));
const otherRoles = computed(() => roles.value.filter((r) => r.id !== 'first_speaker'));

const canStartDiscussion = computed(() => {
  // 需要至少1个其他参与者
  return form.value.question.trim() && selectedParticipants.value.length >= 1;
});

// 监听数据变化并保存到localStorage
watch(
  form,
  (newForm) => {
    saveToStorage(STORAGE_KEYS.FORM_DATA, newForm);
  },
  { deep: true }
);

watch(
  selectedParticipants,
  (newParticipants) => {
    saveToStorage(STORAGE_KEYS.SELECTED_PARTICIPANTS, newParticipants);
  },
  { deep: true }
);

watch(
  roleModelMappings,
  (newMappings) => {
    saveToStorage(STORAGE_KEYS.ROLE_MODEL_MAPPINGS, newMappings);
  },
  { deep: true }
);

// 方法
const toggleParticipant = (roleId) => {
  const index = selectedParticipants.value.indexOf(roleId);
  if (index > -1) {
    selectedParticipants.value.splice(index, 1);
  } else {
    selectedParticipants.value.push(roleId);
  }
};

const updateRoleModel = (roleId, providerName) => {
  roleModelMappings.value[roleId] = providerName;
};

const updateStartButton = () => {
  // 触发响应式更新
};

const handleStartDiscussion = async () => {
  if (!canStartDiscussion.value) return;

  // 确保 first_speaker 包含在内
  const allParticipants = [firstSpeakerRole.value.id, ...selectedParticipants.value];

  try {
    const response = await fetch('/api/discussions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: form.value.question,
        context: form.value.context || undefined,
        participants: allParticipants,
      }),
    });

    const result = await response.json();

    if (result.success) {
      emit('start-discussion', {
        discussionId: result.data.conversationId,
        title: form.value.question,
      });
    } else {
      alert('启动讨论失败: ' + result.error);
    }
  } catch (error) {
    alert('启动讨论失败: ' + error.message);
  }
};

// 重置缓存功能
const handleResetCache = () => {
  if (confirm('确定要清空所有保存的设置吗？这将恢复到默认状态。')) {
    const success = clearAppStorage();
    if (success) {
      // 重置为默认值
      form.value = { question: '', context: '' };
      // 默认选择其他角色中的 critic 和 supporter
      selectedParticipants.value = ['critic', 'supporter'];
      roleModelMappings.value = {};

      // 重新初始化角色模型映射
      roles.value.forEach((role) => {
        roleModelMappings.value[role.id] = role.suggestedProvider;
      });

      alert('✅ 设置已重置为默认状态');
    } else {
      alert('❌ 重置失败，请刷新页面重试');
    }
  }
};

// 初始化默认值（仅在localStorage中没有数据时）
onMounted(() => {
  // 如果localStorage中没有选中的参与者，设置默认值
  if (selectedParticipants.value.length === 0) {
    const defaultRoles = ['critic', 'supporter', 'synthesizer'];
    selectedParticipants.value = defaultRoles.filter((id) => id !== 'first_speaker');
  } else {
    // 确保 'first_speaker' 不在用户可选的参与者列表中
    selectedParticipants.value = selectedParticipants.value.filter((id) => id !== 'first_speaker');
  }

  // 初始化角色模型映射（仅为未设置的角色）
  roles.value.forEach((role) => {
    if (!roleModelMappings.value[role.id]) {
      roleModelMappings.value[role.id] = role.suggestedProvider;
    }
  });

  console.log('📦 从localStorage恢复了以下设置:');
  console.log('- 表单数据:', form.value);
  console.log('- 选中的参与者:', selectedParticipants.value);
  console.log('- 角色模型映射:', roleModelMappings.value);
});
</script>

<style scoped>
.form-actions {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.reset-btn {
  background: linear-gradient(135deg, #faf9f7 0%, #f0ebe5 100%);
  border: 1px solid #e6ddd4;
  color: #8b5a3c;
  padding: 10px 16px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(139, 90, 60, 0.1);
}

.reset-btn:hover {
  background: linear-gradient(135deg, #f0ebe5 0%, #e6ddd4 100%);
  border-color: #d4a574;
  color: #5d4e37;
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(139, 90, 60, 0.15);
}

.reset-btn:active {
  background: linear-gradient(135deg, #e6ddd4 0%, #dac5b3 100%);
  transform: translateY(0);
}
</style>
