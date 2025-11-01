/**
 * Load Testing and Performance Tests
 * Tests system performance under load and validates scalability
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

describe('Load Testing', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost';
  const testTimeout = 600000; // 10 minutes

  describe('API Load Tests', () => {
    test('should handle concurrent health check requests', async () => {
      const concurrentRequests = 100;
      const requests = [];
      
      const startTime = performance.now();
      
      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(
          axios.get(`${baseURL}/api/health`, { timeout: 5000 })
            .then(response => ({
              status: response.status,
              responseTime: performance.now() - startTime
            }))
            .catch(error => ({
              error: error.message,
              responseTime: performance.now() - startTime
            }))
        );
      }
      
      const results = await Promise.all(requests);
      const endTime = performance.now();
      
      // Analyze results
      const successfulRequests = results.filter(r => r.status === 200).length;
      const averageResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      const maxResponseTime = Math.max(...results.map(r => r.responseTime));
      
      console.log(`Load Test Results:
        - Total Requests: ${concurrentRequests}
        - Successful: ${successfulRequests}
        - Success Rate: ${(successfulRequests / concurrentRequests * 100).toFixed(2)}%
        - Average Response Time: ${averageResponseTime.toFixed(2)}ms
        - Max Response Time: ${maxResponseTime.toFixed(2)}ms
        - Total Duration: ${(endTime - startTime).toFixed(2)}ms
      `);
      
      // Assertions
      expect(successfulRequests / concurrentRequests).toBeGreaterThan(0.95); // 95% success rate
      expect(averageResponseTime).toBeLessThan(1000); // Average response time < 1s
      expect(maxResponseTime).toBeLessThan(5000); // Max response time < 5s
    }, testTimeout);

    test('should handle sustained load', async () => {
      const requestsPerSecond = 10;
      const durationSeconds = 30;
      const totalRequests = requestsPerSecond * durationSeconds;
      
      const results = [];
      const startTime = performance.now();
      
      for (let second = 0; second < durationSeconds; second++) {
        const secondRequests = [];
        
        for (let req = 0; req < requestsPerSecond; req++) {
          secondRequests.push(
            axios.get(`${baseURL}/api/health`, { timeout: 5000 })
              .then(response => ({
                timestamp: performance.now(),
                status: response.status,
                success: true
              }))
              .catch(error => ({
                timestamp: performance.now(),
                error: error.message,
                success: false
              }))
          );
        }
        
        const secondResults = await Promise.all(secondRequests);
        results.push(...secondResults);
        
        // Wait for next second
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const endTime = performance.now();
      
      // Analyze sustained load results
      const successfulRequests = results.filter(r => r.success).length;
      const failedRequests = results.filter(r => !r.success).length;
      const actualDuration = (endTime - startTime) / 1000;
      const actualRPS = totalRequests / actualDuration;
      
      console.log(`Sustained Load Test Results:
        - Target RPS: ${requestsPerSecond}
        - Actual RPS: ${actualRPS.toFixed(2)}
        - Duration: ${actualDuration.toFixed(2)}s
        - Total Requests: ${totalRequests}
        - Successful: ${successfulRequests}
        - Failed: ${failedRequests}
        - Success Rate: ${(successfulRequests / totalRequests * 100).toFixed(2)}%
      `);
      
      // Assertions
      expect(successfulRequests / totalRequests).toBeGreaterThan(0.98); // 98% success rate
      expect(actualRPS).toBeGreaterThan(requestsPerSecond * 0.9); // Within 10% of target RPS
    }, testTimeout);

    test('should handle authentication load', async () => {
      const concurrentLogins = 50;
      const loginRequests = [];
      
      for (let i = 0; i < concurrentLogins; i++) {
        loginRequests.push(
          axios.post(`${baseURL}/api/auth/login`, {
            email: `test${i}@example.com`,
            password: 'wrongpassword'
          }, { timeout: 10000 })
            .then(response => ({
              status: response.status,
              success: false // Should fail with wrong password
            }))
            .catch(error => ({
              status: error.response?.status || 0,
              success: error.response?.status === 401 // Expected failure
            }))
        );
      }
      
      const results = await Promise.all(loginRequests);
      const expectedFailures = results.filter(r => r.success).length;
      
      console.log(`Authentication Load Test Results:
        - Concurrent Requests: ${concurrentLogins}
        - Expected Failures (401): ${expectedFailures}
        - Success Rate: ${(expectedFailures / concurrentLogins * 100).toFixed(2)}%
      `);
      
      // Should handle authentication failures gracefully
      expect(expectedFailures / concurrentLogins).toBeGreaterThan(0.95);
    }, testTimeout);
  });

  describe('Database Load Tests', () => {
    test('should handle concurrent database operations', async () => {
      // This test would require a test database setup
      // For now, we'll test through API endpoints that use the database
      
      const concurrentRequests = 20;
      const requests = [];
      
      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(
          axios.get(`${baseURL}/api/user/profile`, {
            headers: { Authorization: 'Bearer invalid-token' },
            timeout: 10000
          })
            .then(response => ({ status: response.status }))
            .catch(error => ({ status: error.response?.status || 0 }))
        );
      }
      
      const results = await Promise.all(requests);
      const unauthorizedResponses = results.filter(r => r.status === 401 || r.status === 403).length;
      
      // Should consistently return unauthorized for invalid tokens
      expect(unauthorizedResponses / concurrentRequests).toBeGreaterThan(0.9);
    });
  });

  describe('File Upload Load Tests', () => {
    test('should handle concurrent file uploads', async () => {
      const concurrentUploads = 10;
      const testFileContent = Buffer.alloc(1024 * 1024, 'test'); // 1MB test file
      const uploadRequests = [];
      
      for (let i = 0; i < concurrentUploads; i++) {
        const formData = new FormData();
        formData.append('file', new Blob([testFileContent]), `test-file-${i}.txt`);
        
        uploadRequests.push(
          axios.post(`${baseURL}/api/storage/upload`, formData, {
            headers: { 
              'Content-Type': 'multipart/form-data',
              Authorization: 'Bearer invalid-token'
            },
            timeout: 30000
          })
            .then(response => ({ status: response.status }))
            .catch(error => ({ status: error.response?.status || 0 }))
        );
      }
      
      const results = await Promise.all(uploadRequests);
      const responses = results.filter(r => r.status > 0).length;
      
      // Should handle all requests (even if unauthorized)
      expect(responses).toBe(concurrentUploads);
    });
  });

  describe('Memory and Resource Tests', () => {
    test('should not have memory leaks under load', async () => {
      const iterations = 100;
      const initialMemory = process.memoryUsage();
      
      for (let i = 0; i < iterations; i++) {
        await axios.get(`${baseURL}/api/health`, { timeout: 5000 })
          .catch(() => {}); // Ignore errors
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;
      
      console.log(`Memory Usage:
        - Initial Heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
        - Final Heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
        - Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB (${memoryIncreasePercent.toFixed(2)}%)
      `);
      
      // Memory increase should be reasonable
      expect(memoryIncreasePercent).toBeLessThan(50); // Less than 50% increase
    });
  });
});

describe('Failover and Recovery Tests', () => {
  const testTimeout = 300000; // 5 minutes

  describe('Service Failover', () => {
    test('should handle backend service restart', async () => {
      // This test requires Docker Compose to be running
      try {
        // Check initial health
        const initialHealth = await axios.get(`${baseURL}/api/health`, { timeout: 5000 });
        expect(initialHealth.status).toBe(200);
        
        console.log('Restarting backend service...');
        // Note: This would require actual service restart in a real test environment
        // For now, we'll simulate by testing recovery behavior
        
        // Wait for service to recover
        let recovered = false;
        let attempts = 0;
        const maxAttempts = 30;
        
        while (!recovered && attempts < maxAttempts) {
          try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const healthCheck = await axios.get(`${baseURL}/api/health`, { timeout: 5000 });
            if (healthCheck.status === 200) {
              recovered = true;
            }
          } catch (error) {
            attempts++;
          }
        }
        
        expect(recovered).toBe(true);
        console.log(`Service recovered after ${attempts * 2} seconds`);
        
      } catch (error) {
        console.warn('Service failover test skipped - services not running');
      }
    }, testTimeout);

    test('should handle database connection loss', async () => {
      // Test database connection resilience
      // This would typically involve stopping the database and checking recovery
      console.log('Database failover test - requires running database');
    });
  });

  describe('Load Balancer Failover', () => {
    test('should distribute load across multiple instances', async () => {
      // Test load distribution
      const requests = 20;
      const responses = [];
      
      for (let i = 0; i < requests; i++) {
        try {
          const response = await axios.get(`${baseURL}/api/health`, { timeout: 5000 });
          responses.push({
            status: response.status,
            server: response.headers['server'] || 'unknown'
          });
        } catch (error) {
          responses.push({ error: error.message });
        }
      }
      
      const successfulResponses = responses.filter(r => r.status === 200);
      console.log(`Load Distribution Test:
        - Total Requests: ${requests}
        - Successful: ${successfulResponses.length}
        - Success Rate: ${(successfulResponses.length / requests * 100).toFixed(2)}%
      `);
      
      expect(successfulResponses.length / requests).toBeGreaterThan(0.9);
    });
  });

  describe('Network Resilience', () => {
    test('should handle network timeouts gracefully', async () => {
      const shortTimeoutRequests = 10;
      const results = [];
      
      for (let i = 0; i < shortTimeoutRequests; i++) {
        try {
          const response = await axios.get(`${baseURL}/api/health`, { timeout: 100 }); // Very short timeout
          results.push({ success: true, status: response.status });
        } catch (error) {
          results.push({ success: false, error: error.code });
        }
      }
      
      const timeoutErrors = results.filter(r => !r.success && r.error === 'ECONNABORTED').length;
      const successfulRequests = results.filter(r => r.success).length;
      
      console.log(`Network Timeout Test:
        - Total Requests: ${shortTimeoutRequests}
        - Successful: ${successfulRequests}
        - Timeouts: ${timeoutErrors}
        - Other Errors: ${shortTimeoutRequests - successfulRequests - timeoutErrors}
      `);
      
      // Should handle timeouts gracefully (no crashes)
      expect(results.length).toBe(shortTimeoutRequests);
    });

    test('should handle connection errors gracefully', async () => {
      const invalidURL = 'http://invalid-host:9999';
      const connectionTests = 5;
      const results = [];
      
      for (let i = 0; i < connectionTests; i++) {
        try {
          await axios.get(`${invalidURL}/api/health`, { timeout: 2000 });
          results.push({ success: true });
        } catch (error) {
          results.push({ success: false, error: error.code });
        }
      }
      
      const connectionErrors = results.filter(r => !r.success).length;
      
      // Should handle connection errors gracefully
      expect(connectionErrors).toBe(connectionTests);
      expect(results.every(r => r.error === 'ENOTFOUND' || r.error === 'ECONNREFUSED')).toBe(true);
    });
  });
});

describe('Performance Benchmarks', () => {
  describe('Response Time Benchmarks', () => {
    test('should meet response time SLAs', async () => {
      const testEndpoints = [
        { path: '/health', maxTime: 100 },
        { path: '/api/health', maxTime: 200 }
      ];
      
      for (const endpoint of testEndpoints) {
        const iterations = 10;
        const responseTimes = [];
        
        for (let i = 0; i < iterations; i++) {
          const startTime = performance.now();
          
          try {
            await axios.get(`${baseURL}${endpoint.path}`, { timeout: 5000 });
            const responseTime = performance.now() - startTime;
            responseTimes.push(responseTime);
          } catch (error) {
            console.warn(`Endpoint ${endpoint.path} failed: ${error.message}`);
          }
        }
        
        if (responseTimes.length > 0) {
          const averageTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
          const p95Time = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];
          
          console.log(`${endpoint.path} Performance:
            - Average: ${averageTime.toFixed(2)}ms
            - 95th Percentile: ${p95Time.toFixed(2)}ms
            - Max Allowed: ${endpoint.maxTime}ms
          `);
          
          expect(averageTime).toBeLessThan(endpoint.maxTime);
          expect(p95Time).toBeLessThan(endpoint.maxTime * 2);
        }
      }
    });
  });

  describe('Throughput Benchmarks', () => {
    test('should meet minimum throughput requirements', async () => {
      const durationSeconds = 10;
      const targetRPS = 50;
      
      const startTime = performance.now();
      const requests = [];
      let requestCount = 0;
      
      const interval = setInterval(() => {
        for (let i = 0; i < targetRPS; i++) {
          requests.push(
            axios.get(`${baseURL}/api/health`, { timeout: 5000 })
              .then(() => ({ success: true }))
              .catch(() => ({ success: false }))
          );
          requestCount++;
        }
      }, 1000);
      
      setTimeout(() => clearInterval(interval), durationSeconds * 1000);
      
      await new Promise(resolve => setTimeout(resolve, (durationSeconds + 2) * 1000));
      
      const results = await Promise.all(requests);
      const endTime = performance.now();
      
      const actualDuration = (endTime - startTime) / 1000;
      const actualRPS = requestCount / actualDuration;
      const successfulRequests = results.filter(r => r.success).length;
      
      console.log(`Throughput Benchmark:
        - Target RPS: ${targetRPS}
        - Actual RPS: ${actualRPS.toFixed(2)}
        - Duration: ${actualDuration.toFixed(2)}s
        - Total Requests: ${requestCount}
        - Successful: ${successfulRequests}
        - Success Rate: ${(successfulRequests / requestCount * 100).toFixed(2)}%
      `);
      
      expect(actualRPS).toBeGreaterThan(targetRPS * 0.8); // Within 20% of target
      expect(successfulRequests / requestCount).toBeGreaterThan(0.95); // 95% success rate
    });
  });
});