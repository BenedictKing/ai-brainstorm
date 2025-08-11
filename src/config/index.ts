import dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// 在生产环境中，优先使用Railway的环境变量，不需要.env文件
if (process.env.NODE_ENV !== 'production') {
  // 加载环境变量文件的优先级：.env.local > .env
  const rootDir = path.resolve(__dirname, "../..");

  // 首先尝试加载 .env.local
  const envLocalPath = path.join(rootDir, ".env.local");
  if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
  }

  // 然后加载 .env (如果存在的话，不会覆盖已有的变量)
  const envPath = path.join(rootDir, ".env");
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
} else {
  // 生产环境下，Railway的环境变量已经自动注入到process.env中
  console.log('Production mode: Using Railway environment variables');
}

export interface ProviderConfig {
  apiKey?: string;
  baseUrl: string;
  model: string;
  format: "openai" | "claude" | "gemini";
  enabled?: boolean;
}

export const config = {
  port: parseInt(process.env.PORT || "3000"),
  nodeEnv: process.env.NODE_ENV || "development",

  apis: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      model: process.env.OPENAI_MODEL || "gpt-5",
      format:
        (process.env.OPENAI_FORMAT as "openai" | "claude" | "gemini") ||
        "openai",
      enabled: !!process.env.OPENAI_API_KEY,
    },
    claude: {
      apiKey: process.env.CLAUDE_API_KEY,
      baseUrl: process.env.CLAUDE_BASE_URL || "https://api.anthropic.com/v1",
      model: process.env.CLAUDE_MODEL || "claude-4-sonnet",
      format:
        (process.env.CLAUDE_FORMAT as "openai" | "claude" | "gemini") ||
        "claude",
      enabled: !!process.env.CLAUDE_API_KEY,
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      baseUrl:
        process.env.GEMINI_BASE_URL ||
        "https://generativelanguage.googleapis.com/v1beta",
      model: process.env.GEMINI_MODEL || "gemini-2.5-pro",
      format:
        (process.env.GEMINI_FORMAT as "openai" | "claude" | "gemini") ||
        "gemini",
      enabled: !!process.env.GEMINI_API_KEY,
    },
    grok: {
      apiKey: process.env.GROK_API_KEY,
      baseUrl: process.env.GROK_BASE_URL || "https://api.x.ai/v1",
      model: process.env.GROK_MODEL || "grok-beta",
      format:
        (process.env.GROK_FORMAT as "openai" | "claude" | "gemini") || "openai",
      enabled: !!process.env.GROK_API_KEY,
    },
    // 支持自定义提供商
    ...loadCustomProviders(),
  } as Record<string, ProviderConfig>,

  context: {
    maxLength: parseInt(process.env.MAX_CONTEXT_LENGTH || "8000"),
    compressionRatio: parseFloat(process.env.COMPRESSION_RATIO || "0.3"),
    compressionProvider: process.env.COMPRESSION_PROVIDER || "gemini",
  },

  database: {
    url: process.env.DATABASE_URL || "sqlite://./data/knowledge.db",
  },
};

function loadCustomProviders(): Record<string, ProviderConfig> {
  const customProviders: Record<string, ProviderConfig> = {};

  // 从环境变量中加载自定义提供商配置
  // 格式: CUSTOM_PROVIDER_<NAME>_API_KEY, CUSTOM_PROVIDER_<NAME>_BASE_URL 等
  const envKeys = Object.keys(process.env);
  const customProviderKeys = envKeys.filter((key) =>
    key.startsWith("CUSTOM_PROVIDER_")
  );

  const providerNames = new Set<string>();
  customProviderKeys.forEach((key) => {
    const match = key.match(/^CUSTOM_PROVIDER_([^_]+)_/);
    if (match) {
      providerNames.add(match[1].toLowerCase());
    }
  });

  providerNames.forEach((name) => {
    const upperName = name.toUpperCase();
    const apiKey = process.env[`CUSTOM_PROVIDER_${upperName}_API_KEY`];
    const baseUrl = process.env[`CUSTOM_PROVIDER_${upperName}_BASE_URL`];
    const model = process.env[`CUSTOM_PROVIDER_${upperName}_MODEL`];
    const format = process.env[`CUSTOM_PROVIDER_${upperName}_FORMAT`] as
      | "openai"
      | "claude"
      | "gemini";

    if (apiKey && baseUrl && model && format) {
      customProviders[name] = {
        apiKey,
        baseUrl,
        model,
        format,
        enabled: true,
      };
    }
  });

  return customProviders;
}

export const validateConfig = () => {
  console.log('🔍 Validating configuration...');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  
  // 调试信息：显示所有相关的环境变量
  const relevantEnvVars = [
    'OPENAI_API_KEY', 'CLAUDE_API_KEY', 'GEMINI_API_KEY', 'GROK_API_KEY',
    'OPENAI_MODEL', 'CLAUDE_MODEL', 'GEMINI_MODEL', 'GROK_MODEL'
  ];
  
  console.log('📋 Checking environment variables:');
  relevantEnvVars.forEach(varName => {
    const value = process.env[varName];
    console.log(`  ${varName}: ${value ? '✅ Set' : '❌ Not set'}`);
  });
  
  const enabledProviders = Object.entries(config.apis)
    .filter(([, providerConfig]) => providerConfig.enabled)
    .map(([name]) => name);
  
  if (enabledProviders.length === 0) {
    console.error('❌ Error: No AI providers are configured and enabled.');
    console.error('Please set at least one API key in your environment variables.');
    console.error('Required format: PROVIDER_API_KEY (e.g., OPENAI_API_KEY)');
    process.exit(1);
  }

  console.log(`✅ Enabled AI providers: ${enabledProviders.join(", ")}`);
  
  // 验证每个启用的提供商配置
  enabledProviders.forEach((name) => {
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
