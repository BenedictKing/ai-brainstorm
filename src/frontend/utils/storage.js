import { v4 as uuidv4 } from 'uuid'

// localStorage工具函数
export const STORAGE_KEYS = {
  FORM_DATA: 'ai-brainstorm-form-data',
  SELECTED_PARTICIPANTS: 'ai-brainstorm-selected-participants',
  ROLE_MODEL_MAPPINGS: 'ai-brainstorm-role-model-mappings',
  CLIENT_ID: 'brainstorm_client_id',
  ACTIVE_DISCUSSION_ID: 'brainstorm_active_discussion_id',
  ACTIVE_DISCUSSION_TITLE: 'brainstorm_active_discussion_title',
}

// 从localStorage加载数据
export const loadFromStorage = (key, defaultValue) => {
  try {
    const stored = localStorage.getItem(key)
    if (!stored) return defaultValue
    
    // 对于简单字符串，直接返回
    if (key === STORAGE_KEYS.CLIENT_ID || 
        key === STORAGE_KEYS.ACTIVE_DISCUSSION_ID || 
        key === STORAGE_KEYS.ACTIVE_DISCUSSION_TITLE) {
      return stored
    }
    
    // 对于复杂对象，使用JSON.parse
    return JSON.parse(stored)
  } catch (error) {
    console.warn(`Failed to load ${key} from localStorage:`, error)
    return defaultValue
  }
}

// 保存到localStorage
export const saveToStorage = (key, value) => {
  try {
    // 对于简单字符串，直接存储
    if (key === STORAGE_KEYS.CLIENT_ID || 
        key === STORAGE_KEYS.ACTIVE_DISCUSSION_ID || 
        key === STORAGE_KEYS.ACTIVE_DISCUSSION_TITLE) {
      localStorage.setItem(key, value)
    } else {
      // 对于复杂对象，使用JSON.stringify
      localStorage.setItem(key, JSON.stringify(value))
    }
  } catch (error) {
    console.warn(`Failed to save ${key} to localStorage:`, error)
  }
}

// 从localStorage移除数据
export const removeFromStorage = (key) => {
  try {
    localStorage.removeItem(key)
  } catch (error) {
    console.warn(`Failed to remove ${key} from localStorage:`, error)
  }
}

// 清空所有应用相关的localStorage数据
export const clearAppStorage = () => {
  try {
    Object.values(STORAGE_KEYS).forEach((key) => {
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
      size: data ? new Blob([data]).size : 0,
    }
  })
  return info
}

// 获取或创建客户端ID
export const getClientId = () => {
  let clientId = localStorage.getItem(STORAGE_KEYS.CLIENT_ID)
  if (!clientId) {
    clientId = uuidv4()
    localStorage.setItem(STORAGE_KEYS.CLIENT_ID, clientId)
  }
  return clientId
}

// 迁移旧的带引号的localStorage数据
export const migrateLegacyStorage = () => {
  const keysToMigrate = [
    STORAGE_KEYS.ACTIVE_DISCUSSION_ID,
    STORAGE_KEYS.ACTIVE_DISCUSSION_TITLE
  ]
  
  keysToMigrate.forEach(key => {
    const stored = localStorage.getItem(key)
    if (stored && stored.startsWith('"') && stored.endsWith('"')) {
      // 是带引号的JSON字符串，需要迁移
      try {
        const unquoted = JSON.parse(stored)
        localStorage.setItem(key, unquoted)
        console.log(`✅ Migrated ${key} from quoted to unquoted format`)
      } catch (error) {
        console.warn(`Failed to migrate ${key}:`, error)
      }
    }
  })
}
