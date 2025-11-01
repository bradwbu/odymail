/**
 * Test setup and configuration for infrastructure tests
 */

// Global test configuration
global.testConfig = {
  baseURL: process.env.TEST_BASE_URL || 'http://localhost',
  timeout: 300000, // 5 minutes default timeout
  retries: 3,
  verbose: process.env.TEST_VERBOSE === 'true'
};

// Setup test environment
beforeAll(async () => {
  console.log('🚀 Starting infrastructure tests...');
  console.log(`Base URL: ${global.testConfig.baseURL}`);
  console.log(`Timeout: ${global.testConfig.timeout}ms`);
  
  // Check if services are available
  const axios = require('axios');
  
  try {
    await axios.get(`${global.testConfig.baseURL}/health`, { timeout: 5000 });
    console.log('✅ Frontend service is available');
  } catch (error) {
    console.warn('⚠️  Frontend service not available - some tests may be skipped');
  }
  
  try {
    await axios.get(`${global.testConfig.baseURL}/api/health`, { timeout: 5000 });
    console.log('✅ Backend service is available');
  } catch (error) {
    console.warn('⚠️  Backend service not available - some tests may be skipped');
  }
});

// Cleanup after all tests
afterAll(async () => {
  console.log('🧹 Cleaning up after infrastructure tests...');
  
  // Cleanup any test resources
  // This could include removing test containers, cleaning up test data, etc.
  
  console.log('✅ Infrastructure tests completed');
});

// Global error handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Extend Jest matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
  
  toHaveResponseTime(received, maxTime) {
    const pass = received <= maxTime;
    if (pass) {
      return {
        message: () => `expected response time ${received}ms not to be less than ${maxTime}ms`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected response time ${received}ms to be less than ${maxTime}ms`,
        pass: false,
      };
    }
  }
});

// Helper functions for tests
global.testHelpers = {
  /**
   * Wait for a condition to be true with timeout
   */
  waitFor: async (condition, timeout = 30000, interval = 1000) => {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  },
  
  /**
   * Retry a function with exponential backoff
   */
  retry: async (fn, maxRetries = 3, baseDelay = 1000) => {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (i < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, i);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  },
  
  /**
   * Generate test data
   */
  generateTestData: {
    email: () => `test-${Date.now()}@example.com`,
    password: () => `TestPass${Date.now()}!`,
    randomString: (length = 10) => Math.random().toString(36).substring(2, length + 2),
    randomNumber: (min = 1, max = 100) => Math.floor(Math.random() * (max - min + 1)) + min
  },
  
  /**
   * Performance measurement helpers
   */
  measurePerformance: async (fn, iterations = 1) => {
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      await fn();
      const end = process.hrtime.bigint();
      
      results.push(Number(end - start) / 1000000); // Convert to milliseconds
    }
    
    return {
      min: Math.min(...results),
      max: Math.max(...results),
      avg: results.reduce((sum, time) => sum + time, 0) / results.length,
      p95: results.sort((a, b) => a - b)[Math.floor(results.length * 0.95)],
      results
    };
  }
};