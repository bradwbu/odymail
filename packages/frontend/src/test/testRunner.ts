/**
 * Test Runner for UI and Compatibility Tests
 * Comprehensive test suite runner for cross-browser and accessibility testing
 */

import { describe, it, expect } from 'vitest';

export interface TestResult {
  suite: string;
  test: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  error?: string;
}

export interface TestSuite {
  name: string;
  tests: TestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number;
}

export class UITestRunner {
  private results: TestSuite[] = [];
  private currentSuite: TestSuite | null = null;

  /**
   * Start a new test suite
   */
  startSuite(name: string): void {
    this.currentSuite = {
      name,
      tests: [],
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      duration: 0
    };
  }

  /**
   * Add test result to current suite
   */
  addTestResult(result: TestResult): void {
    if (!this.currentSuite) {
      throw new Error('No active test suite. Call startSuite() first.');
    }

    this.currentSuite.tests.push(result);
    this.currentSuite.totalTests++;
    
    switch (result.status) {
      case 'pass':
        this.currentSuite.passedTests++;
        break;
      case 'fail':
        this.currentSuite.failedTests++;
        break;
      case 'skip':
        this.currentSuite.skippedTests++;
        break;
    }
    
    this.currentSuite.duration += result.duration;
  }

  /**
   * Finish current test suite
   */
  finishSuite(): void {
    if (!this.currentSuite) {
      throw new Error('No active test suite to finish.');
    }

    this.results.push(this.currentSuite);
    this.currentSuite = null;
  }

  /**
   * Get all test results
   */
  getResults(): TestSuite[] {
    return [...this.results];
  }

  /**
   * Get summary of all test results
   */
  getSummary(): {
    totalSuites: number;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    totalDuration: number;
    successRate: number;
  } {
    const summary = this.results.reduce(
      (acc, suite) => ({
        totalSuites: acc.totalSuites + 1,
        totalTests: acc.totalTests + suite.totalTests,
        passedTests: acc.passedTests + suite.passedTests,
        failedTests: acc.failedTests + suite.failedTests,
        skippedTests: acc.skippedTests + suite.skippedTests,
        totalDuration: acc.totalDuration + suite.duration,
        successRate: 0
      }),
      {
        totalSuites: 0,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        totalDuration: 0,
        successRate: 0
      }
    );

    summary.successRate = summary.totalTests > 0 
      ? (summary.passedTests / summary.totalTests) * 100 
      : 0;

    return summary;
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport(): string {
    const summary = this.getSummary();
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UI and Compatibility Test Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #f8f9fa;
        }
        .summary-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            color: #333;
        }
        .summary-card .value {
            font-size: 2em;
            font-weight: bold;
            margin: 10px 0;
        }
        .pass { color: #28a745; }
        .fail { color: #dc3545; }
        .skip { color: #ffc107; }
        .suite {
            margin: 20px;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            overflow: hidden;
        }
        .suite-header {
            background: #e9ecef;
            padding: 15px 20px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .suite-stats {
            font-size: 0.9em;
            color: #6c757d;
        }
        .test {
            padding: 10px 20px;
            border-bottom: 1px solid #f1f3f4;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .test:last-child {
            border-bottom: none;
        }
        .test-name {
            flex: 1;
        }
        .test-status {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: bold;
            text-transform: uppercase;
        }
        .test-status.pass {
            background: #d4edda;
            color: #155724;
        }
        .test-status.fail {
            background: #f8d7da;
            color: #721c24;
        }
        .test-status.skip {
            background: #fff3cd;
            color: #856404;
        }
        .test-duration {
            margin-left: 10px;
            color: #6c757d;
            font-size: 0.9em;
        }
        .error {
            background: #f8d7da;
            color: #721c24;
            padding: 10px;
            margin: 5px 0;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.9em;
        }
        .progress-bar {
            width: 100%;
            height: 20px;
            background: #e9ecef;
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #28a745, #20c997);
            transition: width 0.3s ease;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>UI and Compatibility Test Report</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <h3>Total Tests</h3>
                <div class="value">${summary.totalTests}</div>
            </div>
            <div class="summary-card">
                <h3>Passed</h3>
                <div class="value pass">${summary.passedTests}</div>
            </div>
            <div class="summary-card">
                <h3>Failed</h3>
                <div class="value fail">${summary.failedTests}</div>
            </div>
            <div class="summary-card">
                <h3>Success Rate</h3>
                <div class="value">${summary.successRate.toFixed(1)}%</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${summary.successRate}%"></div>
                </div>
            </div>
        </div>
        
        ${this.results.map(suite => `
            <div class="suite">
                <div class="suite-header">
                    <span>${suite.name}</span>
                    <span class="suite-stats">
                        ${suite.passedTests}/${suite.totalTests} passed 
                        (${((suite.passedTests / suite.totalTests) * 100).toFixed(1)}%)
                        - ${suite.duration.toFixed(0)}ms
                    </span>
                </div>
                ${suite.tests.map(test => `
                    <div class="test">
                        <div class="test-name">${test.test}</div>
                        <div>
                            <span class="test-status ${test.status}">${test.status}</span>
                            <span class="test-duration">${test.duration.toFixed(0)}ms</span>
                        </div>
                    </div>
                    ${test.error ? `<div class="error">${test.error}</div>` : ''}
                `).join('')}
            </div>
        `).join('')}
    </div>
</body>
</html>`;

    return html;
  }

  /**
   * Generate JSON report
   */
  generateJSONReport(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: this.getSummary(),
      suites: this.results
    }, null, 2);
  }

  /**
   * Clear all results
   */
  clear(): void {
    this.results = [];
    this.currentSuite = null;
  }
}

/**
 * Browser compatibility test configurations
 */
export const BROWSER_CONFIGS = {
  chrome: {
    name: 'Chrome',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    features: {
      webCrypto: true,
      indexedDB: true,
      webSocket: true,
      fetch: true,
      serviceWorker: true
    }
  },
  firefox: {
    name: 'Firefox',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    features: {
      webCrypto: true,
      indexedDB: true,
      webSocket: true,
      fetch: true,
      serviceWorker: true
    }
  },
  safari: {
    name: 'Safari',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    features: {
      webCrypto: true,
      indexedDB: true,
      webSocket: true,
      fetch: true,
      serviceWorker: true
    }
  },
  edge: {
    name: 'Edge',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
    features: {
      webCrypto: true,
      indexedDB: true,
      webSocket: true,
      fetch: true,
      serviceWorker: true
    }
  }
};

/**
 * Device configurations for responsive testing
 */
export const DEVICE_CONFIGS = {
  desktop: {
    name: 'Desktop',
    width: 1920,
    height: 1080,
    userAgent: BROWSER_CONFIGS.chrome.userAgent
  },
  tablet: {
    name: 'Tablet',
    width: 768,
    height: 1024,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
  },
  mobile: {
    name: 'Mobile',
    width: 375,
    height: 667,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
  }
};

/**
 * Accessibility test configurations
 */
export const ACCESSIBILITY_CONFIGS = {
  wcag2aa: {
    name: 'WCAG 2.1 AA',
    rules: {
      colorContrast: true,
      keyboardNavigation: true,
      screenReaderSupport: true,
      focusManagement: true,
      semanticHTML: true
    }
  },
  wcag2aaa: {
    name: 'WCAG 2.1 AAA',
    rules: {
      colorContrast: true,
      keyboardNavigation: true,
      screenReaderSupport: true,
      focusManagement: true,
      semanticHTML: true,
      enhancedContrast: true
    }
  }
};

export default UITestRunner;