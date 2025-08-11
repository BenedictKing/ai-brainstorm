import { withRetry, DEFAULT_RETRY_CONFIG } from '../src/utils/retry.js';

// 模拟可能失败的AI请求
const mockAIRequest = async (successRate: number = 0.3): Promise<string> => {
  if (Math.random() > successRate) {
    const errors = ['ECONNABORTED', 'ENOTFOUND', '500', '502', '503', '504', '429'];
    const randomError = errors[Math.floor(Math.random() * errors.length)];
    const error = new Error(`Mock AI request failed: ${randomError}`);
    error.code = randomError;
    throw error;
  }
  
  return `Mock AI response generated at ${new Date().toISOString()}`;
};

// 测试重试功能
const testRetryMechanism = async () => {
  console.log('🧪 Testing AI Request Retry Mechanism\n');
  
  console.log('📋 Retry Configuration:');
  console.log(`- Max attempts: ${DEFAULT_RETRY_CONFIG.maxAttempts}`);
  console.log(`- Base delay: ${DEFAULT_RETRY_CONFIG.baseDelay}ms`);
  console.log(`- Max delay: ${DEFAULT_RETRY_CONFIG.maxDelay}ms`);
  console.log(`- Backoff factor: ${DEFAULT_RETRY_CONFIG.backoffFactor}`);
  console.log(`- Retryable errors: ${DEFAULT_RETRY_CONFIG.retryableErrors.join(', ')}\n`);
  
  // 测试1: 高成功率 (应该很快成功)
  console.log('🎯 Test 1: High success rate (70%)');
  try {
    const start1 = Date.now();
    const result1 = await withRetry(
      () => mockAIRequest(0.7),
      DEFAULT_RETRY_CONFIG,
      'High-Success-Test'
    );
    const duration1 = Date.now() - start1;
    console.log(`✅ Success in ${duration1}ms:`, result1.substring(0, 50), '...\n');
  } catch (error) {
    console.error(`❌ Failed:`, error.message, '\n');
  }
  
  // 测试2: 中等成功率 (可能需要几次重试)
  console.log('🎯 Test 2: Medium success rate (30%)');
  try {
    const start2 = Date.now();
    const result2 = await withRetry(
      () => mockAIRequest(0.3),
      DEFAULT_RETRY_CONFIG,
      'Medium-Success-Test'
    );
    const duration2 = Date.now() - start2;
    console.log(`✅ Success in ${duration2}ms:`, result2.substring(0, 50), '...\n');
  } catch (error) {
    console.error(`❌ Failed:`, error.message, '\n');
  }
  
  // 测试3: 低成功率 (可能会失败)
  console.log('🎯 Test 3: Low success rate (10%)');
  try {
    const start3 = Date.now();
    const result3 = await withRetry(
      () => mockAIRequest(0.1),
      DEFAULT_RETRY_CONFIG,
      'Low-Success-Test'
    );
    const duration3 = Date.now() - start3;
    console.log(`✅ Success in ${duration3}ms:`, result3.substring(0, 50), '...\n');
  } catch (error) {
    console.error(`❌ Failed after all retries:`, error.message, '\n');
  }
  
  // 测试4: 自定义重试配置 (更快的重试)
  console.log('🎯 Test 4: Custom retry configuration (faster retries)');
  const customConfig = {
    ...DEFAULT_RETRY_CONFIG,
    maxAttempts: 3,
    baseDelay: 500,
    backoffFactor: 1.5
  };
  
  try {
    const start4 = Date.now();
    const result4 = await withRetry(
      () => mockAIRequest(0.4),
      customConfig,
      'Custom-Config-Test'
    );
    const duration4 = Date.now() - start4;
    console.log(`✅ Success in ${duration4}ms:`, result4.substring(0, 50), '...\n');
  } catch (error) {
    console.error(`❌ Failed after all retries:`, error.message, '\n');
  }
  
  console.log('🏁 Retry mechanism tests completed!');
};

// 运行测试
testRetryMechanism().catch(console.error);