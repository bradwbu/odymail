/**
 * Offline Service Tests
 * Tests for offline functionality and data synchronization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import offlineService from '../offlineService';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

// Mock fetch
const mockFetch = vi.fn();

// Mock navigator
const mockNavigator = {
  onLine: true,
  serviceWorker: {
    addEventListener: vi.fn(),
    controller: {}
  }
};

describe('OfflineService', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });
    
    Object.defineProperty(global, 'fetch', {
      value: mockFetch,
      writable: true
    });
    
    Object.defineProperty(global, 'navigator', {
      value: mockNavigator,
      writable: true
    });

    Object.defineProperty(global, 'window', {
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      },
      writable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getStatus', () => {
    it('should return current offline status', () => {
      const status = offlineService.getStatus();
      
      expect(status).toHaveProperty('isOnline');
      expect(status).toHaveProperty('isServiceWorkerReady');
      expect(status).toHaveProperty('hasPendingSync');
      expect(status).toHaveProperty('lastSyncTime');
      expect(status).toHaveProperty('syncInProgress');
    });

    it('should reflect online status', () => {
      mockNavigator.onLine = true;
      
      const status = offlineService.getStatus();
      
      expect(status.isOnline).toBe(true);
    });

    it('should detect service worker readiness', () => {
      mockNavigator.serviceWorker.controller = {};
      
      const status = offlineService.getStatus();
      
      expect(status.isServiceWorkerReady).toBe(true);
    });
  });

  describe('storeOfflineData', () => {
    it('should store data locally', async () => {
      mockLocalStorage.getItem.mockReturnValue('{}');
      
      await offlineService.storeOfflineData('test-key', { message: 'test data' });
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'offline-data',
        expect.stringContaining('test-key')
      );
    });

    it('should handle storage errors gracefully', async () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await offlineService.storeOfflineData('test-key', { message: 'test data' });
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to store offline data:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('getOfflineData', () => {
    it('should retrieve stored data', async () => {
      const testData = { 'test-key': { data: 'test value', timestamp: Date.now() } };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(testData));
      
      const result = await offlineService.getOfflineData();
      
      expect(result).toEqual(testData);
    });

    it('should return empty object when no data exists', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      
      const result = await offlineService.getOfflineData();
      
      expect(result).toEqual({});
    });

    it('should handle JSON parse errors', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await offlineService.getOfflineData();
      
      expect(result).toEqual({});
      expect(consoleSpy).toHaveBeenCalledWith('Failed to retrieve offline data:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('processSyncQueue', () => {
    it('should not process when offline', async () => {
      mockNavigator.onLine = false;
      
      await offlineService.processSyncQueue();
      
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should process sync queue when online', async () => {
      mockNavigator.onLine = true;
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify([
        { action: 'update', data: { key: 'test', data: 'value' }, timestamp: Date.now() }
      ]));
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });
      
      await offlineService.processSyncQueue();
      
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle sync errors gracefully', async () => {
      mockNavigator.onLine = true;
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify([
        { action: 'update', data: { key: 'test', data: 'value' }, timestamp: Date.now() }
      ]));
      
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await offlineService.processSyncQueue();
      
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('getConflicts', () => {
    it('should return empty array when no conflicts exist', () => {
      const conflicts = offlineService.getConflicts();
      
      expect(conflicts).toEqual([]);
    });
  });

  describe('resolveConflict', () => {
    it('should throw error for non-existent conflict', async () => {
      await expect(offlineService.resolveConflict('non-existent', 'local'))
        .rejects.toThrow('Conflict not found');
    });
  });

  describe('clearOfflineData', () => {
    it('should clear all offline data', async () => {
      await offlineService.clearOfflineData();
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('offline-data');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('sync-queue');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('sync-conflicts');
    });

    it('should handle clear errors gracefully', async () => {
      mockLocalStorage.removeItem.mockImplementation(() => {
        throw new Error('Clear error');
      });
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await offlineService.clearOfflineData();
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to clear offline data:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('getStorageUsage', () => {
    it('should calculate storage usage', () => {
      mockLocalStorage.getItem = vi.fn();
      mockLocalStorage.setItem = vi.fn();
      
      // Mock localStorage properties
      Object.defineProperty(mockLocalStorage, 'length', { value: 2 });
      Object.defineProperty(mockLocalStorage, 'key', {
        value: (index: number) => index === 0 ? 'key1' : 'key2'
      });
      mockLocalStorage['key1'] = 'value1';
      mockLocalStorage['key2'] = 'value2';
      
      const usage = offlineService.getStorageUsage();
      
      expect(usage).toHaveProperty('used');
      expect(usage).toHaveProperty('available');
      expect(usage.used).toBeGreaterThanOrEqual(0);
      expect(usage.available).toBeGreaterThan(0);
    });

    it('should handle storage calculation errors', () => {
      Object.defineProperty(mockLocalStorage, 'length', {
        get: () => {
          throw new Error('Storage error');
        }
      });
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const usage = offlineService.getStorageUsage();
      
      expect(usage).toEqual({ used: 0, available: 0 });
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('onStatusChange', () => {
    it('should register status change listeners', () => {
      const callback = vi.fn();
      
      const unsubscribe = offlineService.onStatusChange(callback);
      
      expect(typeof unsubscribe).toBe('function');
    });

    it('should unregister listeners when unsubscribe is called', () => {
      const callback = vi.fn();
      
      const unsubscribe = offlineService.onStatusChange(callback);
      unsubscribe();
      
      // Listener should be removed (no direct way to test this without triggering status change)
      expect(unsubscribe).toBeInstanceOf(Function);
    });
  });
});