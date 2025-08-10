import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  apis: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4'
    },
    claude: {
      apiKey: process.env.CLAUDE_API_KEY,
      baseUrl: 'https://api.anthropic.com/v1',
      model: 'claude-3-sonnet-20240229'
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      model: 'gemini-pro'
    },
    grok: {
      apiKey: process.env.GROK_API_KEY,
      baseUrl: 'https://api.x.ai/v1',
      model: 'grok-beta'
    }
  },

  context: {
    maxLength: parseInt(process.env.MAX_CONTEXT_LENGTH || '8000'),
    compressionRatio: parseFloat(process.env.COMPRESSION_RATIO || '0.3')
  },

  database: {
    url: process.env.DATABASE_URL || 'sqlite://./data/knowledge.db'
  }
};

export const validateConfig = () => {
  const requiredKeys = [
    'OPENAI_API_KEY',
    'CLAUDE_API_KEY', 
    'GEMINI_API_KEY',
    'GROK_API_KEY'
  ];

  const missingKeys = requiredKeys.filter(key => !process.env[key]);
  
  if (missingKeys.length > 0) {
    console.warn(`Warning: Missing API keys: ${missingKeys.join(', ')}`);
    console.warn('Some AI models may not be available.');
  }
};