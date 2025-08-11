<template>
  <div 
    class="participant-card"
    :class="{ selected }"
    @click="handleCardClick"
  >
    <div class="badge">{{ role.tags[0] }}</div>
    <h4>{{ role.name }}</h4>
    <p>{{ role.description }}</p>
    
    <div class="ai-model-info" @click.stop>
      <span class="ai-model-label">AI模型:</span>
      <span 
        class="ai-model-name" 
        @click="toggleModelSelector"
      >
        {{ currentModelDisplay }}
      </span>
      
      <div 
        class="model-selector"
        :class="{ show: showSelector }"
        :id="`selector-${role.id}`"
      >
        <div
          v-for="provider in enabledProviders"
          :key="provider.name"
          class="model-option"
          :class="{ selected: provider.name === currentProvider }"
          @click="selectModel(provider.name)"
        >
          <div class="provider-name">
            {{ provider.name.charAt(0).toUpperCase() + provider.name.slice(1) }}
          </div>
          <div class="model-name">{{ provider.model }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  role: Object,
  selected: Boolean,
  providers: Object,
  initialProvider: String // 新增：从localStorage恢复的provider
})

const emit = defineEmits(['toggle', 'update-model'])

const providers = inject('providers')
const showSelector = ref(false)
const currentProvider = ref(props.initialProvider || props.role.suggestedProvider)

// 计算属性
const enabledProviders = computed(() => {
  if (!providers.value) return []
  return Object.values(providers.value).filter(p => p.enabled)
})

const currentModelDisplay = computed(() => {
  const provider = providers.value?.[currentProvider.value]
  if (provider && provider.enabled) {
    return `${provider.name.charAt(0).toUpperCase() + provider.name.slice(1)} - ${provider.model}`
  }
  
  // 如果当前提供商不可用，使用第一个可用的
  const firstEnabled = enabledProviders.value[0]
  if (firstEnabled) {
    return `${firstEnabled.name.charAt(0).toUpperCase() + firstEnabled.name.slice(1)} - ${firstEnabled.model}`
  }
  
  return '未配置'
})

// 方法
const handleCardClick = () => {
  if (props.disabled) return
  emit('toggle', props.role.id)
}

const toggleModelSelector = () => {
  showSelector.value = !showSelector.value
  // 关闭其他选择器
  document.querySelectorAll('.model-selector').forEach(selector => {
    if (selector.id !== `selector-${props.role.id}`) {
      selector.classList.remove('show')
    }
  })
}

const selectModel = (providerName) => {
  currentProvider.value = providerName
  showSelector.value = false
  emit('update-model', props.role.id, providerName)
}

const handleClickOutside = (event) => {
  const selector = document.getElementById(`selector-${props.role.id}`)
  if (selector && !selector.contains(event.target) && !event.target.classList.contains('ai-model-name')) {
    showSelector.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  // 发出初始模型选择
  emit('update-model', props.role.id, currentProvider.value)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
/* At the end of the file, add styles for the disabled state */
.participant-card.disabled {
  cursor: not-allowed;
  opacity: 0.8;
}

.participant-card.disabled:hover {
  transform: none;
  border-color: #e6ddd4; /* Use default border color from assets/style.css */
  box-shadow: none;
}
</style>
