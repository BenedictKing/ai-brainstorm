import dotenv from 'dotenv';

dotenv.config();

export interface ProviderConfig {
  apiKey?: string;
  baseUrl: string;
  model: string;
  format: 'openai' | 'claude' | 'gemini';
  enabled?: boolean;
}

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  apis: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      model: process.env.OPENAI_MODEL || 'gpt-4',
      format: 'openai' as const,
      enabled: !!process.env.OPENAI_API_KEY
    },
    claude: {
      apiKey: process.env.CLAUDE_API_KEY,
      baseUrl: process.env.CLAUDE_BASE_URL || 'https://api.anthropic.com/v1',
      model: process.env.CLAUDE_MODEL || 'claude-3-sonnet-20240229',
      format: 'claude' as const,
      enabled: !!process.env.CLAUDE_API_KEY
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
      model: process.env.GEMINI_MODEL || 'gemini-pro',
      format: 'gemini' as const,
      enabled: !!process.env.GEMINI_API_KEY
    },
    grok: {
      apiKey: process.env.GROK_API_KEY,
      baseUrl: process.env.GROK_BASE_URL || 'https://api.x.ai/v1',
      model: process.env.GROK_MODEL || 'grok-beta',
      format: process.env.GROK_FORMAT as 'openai' | 'claude' | 'gemini' || 'openai',
      enabled: !!process.env.GROK_API_KEY
    },
    // 支持自定义提供商
    ...loadCustomProviders()
  } as Record<string, ProviderConfig>,

  context: {
    maxLength: parseInt(process.env.MAX_CONTEXT_LENGTH || '8000'),
    compressionRatio: parseFloat(process.env.COMPRESSION_RATIO || '0.3')
  },

  database: {
    url: process.env.DATABASE_URL || 'sqlite://./data/knowledge.db'
  }
};

function loadCustomProviders(): Record<string, ProviderConfig> {
  const customProviders: Record<string, ProviderConfig> = {};
  
  // 从环境变量中加载自定义提供商配置
  // 格式: CUSTOM_PROVIDER_<NAME>_API_KEY, CUSTOM_PROVIDER_<NAME>_BASE_URL 等
  const envKeys = Object.keys(process.env);
  const customProviderKeys = envKeys.filter(key => key.startsWith('CUSTOM_PROVIDER_'));
  
  const providerNames = new Set<string>();
  customProviderKeys.forEach(key => {
    const match = key.match(/^CUSTOM_PROVIDER_([^_]+)_/);
    if (match) {
      providerNames.add(match[1].toLowerCase());
    }
  });

  providerNames.forEach(name => {
    const upperName = name.toUpperCase();
    const apiKey = process.env[`CUSTOM_PROVIDER_${upperName}_API_KEY`];
    const baseUrl = process.env[`CUSTOM_PROVIDER_${upperName}_BASE_URL`];
    const model = process.env[`CUSTOM_PROVIDER_${upperName}_MODEL`];
    const format = process.env[`CUSTOM_PROVIDER_${upperName}_FORMAT`] as 'openai' | 'claude' | 'gemini';

    if (apiKey && baseUrl && model && format) {
      customProviders[name] = {
        apiKey,
        baseUrl,
        model,
        format,
        enabled: true
      };
    }
  });

  return customProviders;
}

export const validateConfig = () => {
  const enabledProviders = Object.entries(config.apis)
    .filter(([, providerConfig]) => providerConfig.enabled)
    .map(([name]) => name);
  
  if (enabledProviders.length === 0) {
    console.error('Error: No AI providers are configured and enabled.');
    console.error('Please set at least one API key in your .env file.');
    process.exit(1);
  }

  console.log(`✅ Enabled AI providers: ${enabledProviders.join(', ')}`);
  
  // 验证每个启用的提供商配置
  enabledProviders.forEach(name => {
    const provider = config.apis[name];
    if (!provider.apiKey) {
      console.warn(`⚠️  Warning: ${name} is enabled but missing API key`);
    }
    if (!provider.baseUrl) {
      console.warn(`⚠️  Warning: ${name} is missing base URL`);
    }
    if (!provider.model) {
      console.warn(`⚠️  Warning: ${name} is missing model configuration`);
    }
  });
};