/**
 * Simple Compatibility Test
 * Basic test to verify our compatibility features work
 */

import { describe, it, expect } from 'vitest';
import { detectBrowser, checkFeatureSupport } from '../utils/browserCompat';

describe('Simple Compatibility Tests', () => {
  it('should detect browser information', () => {
    const browser = detectBrowser();
    
    expect(browser).toHaveProperty('name');
    expect(browser).toHaveProperty('version');
    expect(browser).toHaveProperty('isSupported');
    expect(browser).toHaveProperty('missingFeatures');
    
    expect(typeof browser.name).toBe('string');
    expect(typeof browser.version).toBe('string');
    expect(typeof browser.isSupported).toBe('boolean');
    expect(Array.isArray(browser.missingFeatures)).toBe(true);
  });

  it('should check feature support', () => {
    const features = checkFeatureSupport();
    
    expect(features).toHaveProperty('webCrypto');
    expect(features).toHaveProperty('indexedDB');
    expect(features).toHaveProperty('webSocket');
    expect(features).toHaveProperty('fetch');
    expect(features).toHaveProperty('localStorage');
    expect(features).toHaveProperty('sessionStorage');
    
    expect(typeof features.webCrypto).toBe('boolean');
    expect(typeof features.indexedDB).toBe('boolean');
    expect(typeof features.webSocket).toBe('boolean');
    expect(typeof features.fetch).toBe('boolean');
    expect(typeof features.localStorage).toBe('boolean');
    expect(typeof features.sessionStorage).toBe('boolean');
  });

  it('should have offline service available', async () => {
    const { default: offlineService } = await import('../services/offlineService');
    
    expect(offlineService).toBeDefined();
    expect(typeof offlineService.getStatus).toBe('function');
    expect(typeof offlineService.storeOfflineData).toBe('function');
    expect(typeof offlineService.getOfflineData).toBe('function');
    
    const status = offlineService.getStatus();
    expect(status).toHaveProperty('isOnline');
    expect(status).toHaveProperty('isServiceWorkerReady');
    expect(status).toHaveProperty('hasPendingSync');
  });
});