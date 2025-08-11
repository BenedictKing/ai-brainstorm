import dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

// 在生产环境中，优先使用Railway的环境变量，不需要.env文件
if (process.env.NODE_ENV !== 'production') {
  // 加载环境变量文件的优先级：.env.local > .env
  // 在 ESM 环境中使用 process.cwd() 作为项目根目录
  const rootDir = process.cwd()

  // 首先尝试加载 .env.local
  const envLocalPath = path.join(rootDir, '.env.local')
  if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath })
  }

  // 然后加载 .env (如果存在的话，不会覆盖已有的变量)
  const envPath = path.join(rootDir, '.env')
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false })
  }
} else {
  // 生产环境下，Railway的环境变量已经自动注入到process.env中
  console.log('Production mode: Using Railway environment variables')
}

export interface ProviderConfig {
  apiKey?: string
  baseUrl: string
  model: string
  format: 'openai' | 'claude' | 'gemini' | 'grok'
  enabled?: boolean
  maxTokens?: number
}

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',

  apis: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      model: process.env.OPENAI_MODEL || 'gpt-5',
      format: (process.env.OPENAI_FORMAT as 'openai' | 'claude' | 'gemini') || 'openai',
      enabled: !!process.env.OPENAI_API_KEY,
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '16384'),
    },
    claude: {
      apiKey: process.env.CLAUDE_API_KEY,
      baseUrl: process.env.CLAUDE_BASE_URL || 'https://api.anthropic.com/v1',
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      format: (process.env.CLAUDE_FORMAT as 'openai' | 'claude' | 'gemini') || 'claude',
      enabled: !!process.env.CLAUDE_API_KEY,
      maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '16384'),
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
      model: process.env.GEMINI_MODEL || 'gemini-2.5-pro',
      format: (process.env.GEMINI_FORMAT as 'openai' | 'claude' | 'gemini') || 'gemini',
      enabled: !!process.env.GEMINI_API_KEY,
      maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '32768'),
    },
    grok: {
      apiKey: process.env.GROK_API_KEY,
      baseUrl: process.env.GROK_BASE_URL || 'https://api.x.ai/v1',
      model: process.env.GROK_MODEL || 'grok-4', // 修正为实际模型名
      format: (process.env.GROK_FORMAT as 'openai' | 'claude' | 'gemini' | 'grok') || 'openai', // 修正 format
      enabled: !!process.env.GROK_API_KEY,
      maxTokens: parseInt(process.env.GROK_MAX_TOKENS || '16384'),
    },
    // 支持自定义提供商
    ...loadCustomProviders(),
  } as Record<string, ProviderConfig>,

  context: {
    maxLength: parseInt(process.env.MAX_CONTEXT_LENGTH || '8000'),
    compressionRatio: parseFloat(process.env.COMPRESSION_RATIO || '0.3'),
    compressionProvider: process.env.COMPRESSION_PROVIDER || 'gemini',
  },

  database: {
    url: process.env.DATABASE_URL || 'sqlite://./data/knowledge.db',
  },

  // 重试配置
  retry: {
    maxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS || '5'),
    baseDelay: parseInt(process.env.RETRY_BASE_DELAY || '2000'), // 固定2秒延迟
    maxDelay: parseInt(process.env.RETRY_MAX_DELAY || '2000'), // 固定2秒延迟
    backoffFactor: parseFloat(process.env.RETRY_BACKOFF_FACTOR || '1'), // 不使用指数退避
    retryableErrors: (
      process.env.RETRY_ERRORS ||
      'ECONNABORTED,ENOTFOUND,ECONNREFUSED,ECONNRESET,ETIMEDOUT,Network Error,500,502,503,504,429'
    )
      .split(',')
      .map((s) => s.trim()),
  },

  // AI请求配置
  aiRequest: {
    timeout: parseInt(process.env.AI_REQUEST_TIMEOUT || '300000'), // 5分钟
    enableStreamFallback: process.env.AI_STREAM_FALLBACK !== 'false',
  },
}

function loadCustomProviders(): Record<string, ProviderConfig> {
  const customProviders: Record<string, ProviderConfig> = {}

  // 从环境变量中加载自定义提供商配置
  // 格式: CUSTOM_PROVIDER_<NAME>_API_KEY, CUSTOM_PROVIDER_<NAME>_BASE_URL 等
  const envKeys = Object.keys(process.env)
  const customProviderKeys = envKeys.filter((key) => key.startsWith('CUSTOM_PROVIDER_'))

  const providerNames = new Set<string>()
  customProviderKeys.forEach((key) => {
    const match = key.match(/^CUSTOM_PROVIDER_([^_]+)_/)
    if (match) {
      providerNames.add(match[1].toLowerCase())
    }
  })

  providerNames.forEach((name) => {
    const upperName = name.toUpperCase()
    const apiKey = process.env[`CUSTOM_PROVIDER_${upperName}_API_KEY`]
    const baseUrl = process.env[`CUSTOM_PROVIDER_${upperName}_BASE_URL`]
    const model = process.env[`CUSTOM_PROVIDER_${upperName}_MODEL`]
    const format = process.env[`CUSTOM_PROVIDER_${upperName}_FORMAT`] as 'openai' | 'claude' | 'gemini' | 'grok'
    const maxTokens = parseInt(process.env[`CUSTOM_PROVIDER_${upperName}_MAX_TOKENS`] || '8192')

    if (apiKey && baseUrl && model && format) {
      customProviders[name] = {
        apiKey,
        baseUrl,
        model,
        format,
        enabled: true,
        maxTokens,
      }
    }
  })

  return customProviders
}

export const validateConfig = () => {
  console.log('🔍 Validating configuration...')
  console.log('Environment:', process.env.NODE_ENV || 'development')

  // 调试信息：显示所有相关的环境变量
  const relevantEnvVars = [
    'OPENAI_API_KEY',
    'CLAUDE_API_KEY',
    'GEMINI_API_KEY',
    'GROK_API_KEY',
    'OPENAI_MODEL',
    'CLAUDE_MODEL',
    'GEMINI_MODEL',
    'GROK_MODEL',
  ]

  console.log('📋 Checking environment variables:')
  relevantEnvVars.forEach((varName) => {
    const value = process.env[varName]
    console.log(`  ${varName}: ${value ? '✅ Set' : '❌ Not set'}`)
  })

  const enabledProviders = Object.entries(config.apis)
    .filter(([, providerConfig]) => providerConfig.enabled)
    .map(([name]) => name)

  if (enabledProviders.length === 0) {
    console.error('❌ Error: No AI providers are configured and enabled.')
    console.error('Please set at least one API key in your environment variables.')
    console.error('Required format: PROVIDER_API_KEY (e.g., OPENAI_API_KEY)')
    process.exit(1)
  }

  console.log(`✅ Enabled AI providers: ${enabledProviders.join(', ')}`)

  // 验证每个启用的提供商配置
  enabledProviders.forEach((name) => {
    const provider = config.apis[name]
    if (!provider.apiKey) {
      console.warn(`⚠️  Warning: ${name} is enabled but missing API key`)
    }
    if (!provider.baseUrl) {
      console.warn(`⚠️  Warning: ${name} is missing base URL`)
    }
    if (!provider.model) {
      console.warn(`⚠️  Warning: ${name} is missing model configuration`)
    }
  })
}
