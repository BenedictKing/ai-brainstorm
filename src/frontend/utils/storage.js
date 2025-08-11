// localStorage工具函数
export const STORAGE_KEYS = {
  FORM_DATA: 'ai-brainstorm-form-data',
  SELECTED_PARTICIPANTS: 'ai-brainstorm-selected-participants',
  ROLE_MODEL_MAPPINGS: 'ai-brainstorm-role-model-mappings'
}

// 从localStorage加载数据
export const loadFromStorage = (key, defaultValue) => {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : defaultValue
  } catch (error) {
    console.warn(`Failed to load ${key} from localStorage:`, error)
    return defaultValue
  }
}

// 保存到localStorage
export const saveToStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn(`Failed to save ${key} to localStorage:`, error)
  }
}

// 清空所有应用相关的localStorage数据
export const clearAppStorage = () => {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key)
    })
    console.log('🗑️ 已清空所有缓存数据')
    return true
  } catch (error) {
    console.error('清空缓存失败:', error)
    return false
  }
}

// 获取存储的数据大小信息
export const getStorageInfo = () => {
  const info = {}
  Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
    const data = localStorage.getItem(key)
    info[name] = {
      exists: !!data,
      size: data ? new Blob([data]).size : 0
    }
  })
  return info
}