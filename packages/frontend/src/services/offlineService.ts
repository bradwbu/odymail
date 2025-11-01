/**
 * Offline Service - Manages offline functionality and data synchronization
 * Provides offline access, local data caching, and sync conflict resolution
 */

import { EmailDraft } from '../types/email';

export interface OfflineData {
  emails: any[];
  drafts: EmailDraft[];
  contacts: any[];
  settings: any;
  lastSync: number;
}

export interface SyncConflict {
  id: string;
  type: 'email' | 'draft' | 'contact' | 'settings';
  localData: any;
  remoteData: any;
  timestamp: number;
}

export interface OfflineStatus {
  isOnline: boolean;
  isServiceWorkerReady: boolean;
  hasPendingSync: boolean;
  lastSyncTime: number | null;
  syncInProgress: boolean;
}

class OfflineService {
  private static instance: OfflineService;
  private isOnline: boolean = navigator.onLine;
  private syncQueue: Array<{ action: string; data: any; timestamp: number }> = [];
  private conflicts: SyncConflict[] = [];
  private listeners: Array<(status: OfflineStatus) => void> = [];
  private syncInProgress: boolean = false;
  private lastSyncTime: number | null = null;

  private constructor() {
    this.initializeOfflineHandlers();
    this.loadSyncQueue();
  }

  static getInstance(): OfflineService {
    if (!OfflineService.instance) {
      OfflineService.instance = new OfflineService();
    }
    return OfflineService.instance;
  }

  /**
   * Initialize offline event handlers
   */
  private initializeOfflineHandlers(): void {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyStatusChange();
      this.processSyncQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyStatusChange();
    });

    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_BACKGROUND') {
          this.handleBackgroundSync(event.data.payload);
        }
      });
    }
  }

  /**
   * Get current offline status
   */
  getStatus(): OfflineStatus {
    return {
      isOnline: this.isOnline,
      isServiceWorkerReady: 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null,
      hasPendingSync: this.syncQueue.length > 0,
      lastSyncTime: this.lastSyncTime,
      syncInProgress: this.syncInProgress
    };
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(callback: (status: OfflineStatus) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of status changes
   */
  private notifyStatusChange(): void {
    const status = this.getStatus();
    this.listeners.forEach(callback => callback(status));
  }

  /**
   * Store data locally for offline access
   */
  async storeOfflineData(key: string, data: any): Promise<void> {
    try {
      const offlineData = await this.getOfflineData();
      offlineData[key] = {
        data,
        timestamp: Date.now(),
        synced: this.isOnline
      };
      
      localStorage.setItem('offline-data', JSON.stringify(offlineData));
      
      // If online, add to sync queue
      if (this.isOnline) {
        this.addToSyncQueue('update', { key, data });
      }
    } catch (error) {
      console.error('Failed to store offline data:', error);
    }
  }

  /**
   * Retrieve data from local storage
   */
  async getOfflineData(): Promise<any> {
    try {
      const stored = localStorage.getItem('offline-data');
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to retrieve offline data:', error);
      return {};
    }
  }

  /**
   * Add action to sync queue
   */
  private addToSyncQueue(action: string, data: any): void {
    this.syncQueue.push({
      action,
      data,
      timestamp: Date.now()
    });
    this.saveSyncQueue();
    this.notifyStatusChange();
  }

  /**
   * Save sync queue to localStorage
   */
  private saveSyncQueue(): void {
    try {
      localStorage.setItem('sync-queue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  /**
   * Load sync queue from localStorage
   */
  private loadSyncQueue(): void {
    try {
      const stored = localStorage.getItem('sync-queue');
      this.syncQueue = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load sync queue:', error);
      this.syncQueue = [];
    }
  }

  /**
   * Process sync queue when online
   */
  async processSyncQueue(): Promise<void> {
    if (!this.isOnline || this.syncInProgress || this.syncQueue.length === 0) {
      return;
    }

    this.syncInProgress = true;
    this.notifyStatusChange();

    try {
      const queue = [...this.syncQueue];
      this.syncQueue = [];

      for (const item of queue) {
        try {
          await this.syncItem(item);
        } catch (error) {
          console.error('Failed to sync item:', error);
          // Re-add failed items to queue
          this.syncQueue.push(item);
        }
      }

      this.lastSyncTime = Date.now();
      this.saveSyncQueue();
    } catch (error) {
      console.error('Sync process failed:', error);
    } finally {
      this.syncInProgress = false;
      this.notifyStatusChange();
    }
  }

  /**
   * Sync individual item
   */
  private async syncItem(item: { action: string; data: any; timestamp: number }): Promise<void> {
    const { action, data } = item;

    switch (action) {
      case 'update':
        await this.syncUpdate(data);
        break;
      case 'delete':
        await this.syncDelete(data);
        break;
      case 'create':
        await this.syncCreate(data);
        break;
      default:
        console.warn('Unknown sync action:', action);
    }
  }

  /**
   * Sync update operation
   */
  private async syncUpdate(data: any): Promise<void> {
    // Check for conflicts
    const remoteData = await this.fetchRemoteData(data.key);
    const localData = await this.getOfflineData();
    
    if (remoteData && localData[data.key]) {
      const localTimestamp = localData[data.key].timestamp;
      const remoteTimestamp = remoteData.timestamp;
      
      if (remoteTimestamp > localTimestamp) {
        // Remote is newer - potential conflict
        this.addConflict({
          id: `${data.key}-${Date.now()}`,
          type: this.getDataType(data.key),
          localData: localData[data.key].data,
          remoteData: remoteData.data,
          timestamp: Date.now()
        });
        return;
      }
    }

    // No conflict, proceed with sync
    await this.uploadData(data.key, data.data);
  }

  /**
   * Sync delete operation
   */
  private async syncDelete(data: any): Promise<void> {
    await this.deleteRemoteData(data.key);
  }

  /**
   * Sync create operation
   */
  private async syncCreate(data: any): Promise<void> {
    await this.uploadData(data.key, data.data);
  }

  /**
   * Fetch remote data for conflict detection
   */
  private async fetchRemoteData(key: string): Promise<any> {
    try {
      const response = await fetch(`/api/sync/${key}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch remote data:', error);
      return null;
    }
  }

  /**
   * Upload data to server
   */
  private async uploadData(key: string, data: any): Promise<void> {
    const response = await fetch(`/api/sync/${key}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      },
      body: JSON.stringify({ data, timestamp: Date.now() })
    });

    if (!response.ok) {
      throw new Error(`Failed to upload data: ${response.statusText}`);
    }
  }

  /**
   * Delete remote data
   */
  private async deleteRemoteData(key: string): Promise<void> {
    const response = await fetch(`/api/sync/${key}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to delete remote data: ${response.statusText}`);
    }
  }

  /**
   * Add conflict for resolution
   */
  private addConflict(conflict: SyncConflict): void {
    this.conflicts.push(conflict);
    this.saveConflicts();
  }

  /**
   * Get pending conflicts
   */
  getConflicts(): SyncConflict[] {
    return [...this.conflicts];
  }

  /**
   * Resolve conflict
   */
  async resolveConflict(conflictId: string, resolution: 'local' | 'remote' | 'merge'): Promise<void> {
    const conflictIndex = this.conflicts.findIndex(c => c.id === conflictId);
    if (conflictIndex === -1) {
      throw new Error('Conflict not found');
    }

    const conflict = this.conflicts[conflictIndex];
    let resolvedData: any;

    switch (resolution) {
      case 'local':
        resolvedData = conflict.localData;
        break;
      case 'remote':
        resolvedData = conflict.remoteData;
        break;
      case 'merge':
        resolvedData = this.mergeData(conflict.localData, conflict.remoteData);
        break;
    }

    // Upload resolved data
    await this.uploadData(conflict.id.split('-')[0], resolvedData);
    
    // Update local data
    await this.storeOfflineData(conflict.id.split('-')[0], resolvedData);
    
    // Remove conflict
    this.conflicts.splice(conflictIndex, 1);
    this.saveConflicts();
  }

  /**
   * Merge conflicting data (simple merge strategy)
   */
  private mergeData(localData: any, remoteData: any): any {
    if (typeof localData === 'object' && typeof remoteData === 'object') {
      return { ...remoteData, ...localData };
    }
    return localData; // Prefer local for non-objects
  }

  /**
   * Save conflicts to localStorage
   */
  private saveConflicts(): void {
    try {
      localStorage.setItem('sync-conflicts', JSON.stringify(this.conflicts));
    } catch (error) {
      console.error('Failed to save conflicts:', error);
    }
  }

  /**
   * Load conflicts from localStorage
   */
  private loadConflicts(): void {
    try {
      const stored = localStorage.getItem('sync-conflicts');
      this.conflicts = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load conflicts:', error);
      this.conflicts = [];
    }
  }

  /**
   * Get data type from key
   */
  private getDataType(key: string): 'email' | 'draft' | 'contact' | 'settings' {
    if (key.startsWith('email-')) return 'email';
    if (key.startsWith('draft-')) return 'draft';
    if (key.startsWith('contact-')) return 'contact';
    return 'settings';
  }

  /**
   * Handle background sync from service worker
   */
  private async handleBackgroundSync(payload: any): Promise<void> {
    console.log('Background sync triggered:', payload);
    await this.processSyncQueue();
  }

  /**
   * Clear all offline data
   */
  async clearOfflineData(): Promise<void> {
    try {
      localStorage.removeItem('offline-data');
      localStorage.removeItem('sync-queue');
      localStorage.removeItem('sync-conflicts');
      this.syncQueue = [];
      this.conflicts = [];
      this.notifyStatusChange();
    } catch (error) {
      console.error('Failed to clear offline data:', error);
    }
  }

  /**
   * Get offline storage usage
   */
  getStorageUsage(): { used: number; available: number } {
    try {
      let used = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage[key].length;
        }
      }
      
      // Estimate available space (browsers typically allow 5-10MB for localStorage)
      const available = 5 * 1024 * 1024; // 5MB estimate
      
      return { used, available };
    } catch (error) {
      console.error('Failed to calculate storage usage:', error);
      return { used: 0, available: 0 };
    }
  }
}

export default OfflineService.getInstance();