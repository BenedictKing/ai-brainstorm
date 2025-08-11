<template>
  <div class="knowledge-panel">
    <h3>📚 知识库统计</h3>
    <div class="knowledge-stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.totalTopics || 0 }}</div>
        <div class="stat-label">话题数量</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.totalEntries || 0 }}</div>
        <div class="stat-label">知识条目</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ averageEntries }}</div>
        <div class="stat-label">平均条目/话题</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const stats = ref({
  totalTopics: 0,
  totalEntries: 0,
  averageEntriesPerTopic: 0
})

const averageEntries = computed(() => {
  return stats.value.averageEntriesPerTopic?.toFixed(1) || '0.0'
})

const loadKnowledgeStats = async () => {
  try {
    const response = await fetch('/api/knowledge/stats')
    const result = await response.json()
    
    if (result.success) {
      stats.value = result.data
    }
  } catch (error) {
    console.error('Failed to load knowledge stats:', error)
  }
}

onMounted(() => {
  loadKnowledgeStats()
})
</script>