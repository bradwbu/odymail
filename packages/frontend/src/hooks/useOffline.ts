/**
 * Offline Hook - React hook for offline functionality
 * Provides easy access to offline status and sync operations
 */

import { useState, useEffect, useCallback } from 'react';
import offlineService, { OfflineStatus, SyncConflict } from '../services/offlineService';

export interface UseOfflineReturn {
  status: OfflineStatus;
  conflicts: SyncConflict[];
  storeData: (key: string, data: any) => Promise<void>;
  getData: (key: string) => Promise<any>;
  syncNow: () => Promise<void>;
  resolveConflict: (conflictId: string, resolution: 'local' | 'remote' | 'merge') => Promise<void>;
  clearOfflineData: () => Promise<void>;
  storageUsage: { used: number; available: number };
}

/**
 * Hook for offline functionality
 */
export const useOffline = (): UseOfflineReturn => {
  const [status, setStatus] = useState<OfflineStatus>(offlineService.getStatus());
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [storageUsage, setStorageUsage] = useState({ used: 0, available: 0 });

  useEffect(() => {
    // Subscribe to status changes
    const unsubscribe = offlineService.onStatusChange(setStatus);
    
    // Load initial conflicts
    setConflicts(offlineService.getConflicts());
    
    // Update storage usage
    setStorageUsage(offlineService.getStorageUsage());
    
    return unsubscribe;
  }, []);

  const storeData = useCallback(async (key: string, data: any) => {
    await offlineService.storeOfflineData(key, data);
    setStorageUsage(offlineService.getStorageUsage());
  }, []);

  const getData = useCallback(async (key: string) => {
    const offlineData = await offlineService.getOfflineData();
    return offlineData[key]?.data || null;
  }, []);

  const syncNow = useCallback(async () => {
    await offlineService.processSyncQueue();
    setConflicts(offlineService.getConflicts());
  }, []);

  const resolveConflict = useCallback(async (
    conflictId: string, 
    resolution: 'local' | 'remote' | 'merge'
  ) => {
    await offlineService.resolveConflict(conflictId, resolution);
    setConflicts(offlineService.getConflicts());
  }, []);

  const clearOfflineData = useCallback(async () => {
    await offlineService.clearOfflineData();
    setStorageUsage(offlineService.getStorageUsage());
  }, []);

  return {
    status,
    conflicts,
    storeData,
    getData,
    syncNow,
    resolveConflict,
    clearOfflineData,
    storageUsage
  };
};

/**
 * Hook for automatic offline storage of form data
 */
export const useOfflineForm = <T extends Record<string, any>>(
  formKey: string,
  initialData: T
) => {
  const { storeData, getData } = useOffline();
  const [formData, setFormData] = useState<T>(initialData);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved form data on mount
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const savedData = await getData(formKey);
        if (savedData) {
          setFormData({ ...initialData, ...savedData });
        }
      } catch (error) {
        console.error('Failed to load saved form data:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadSavedData();
  }, [formKey, getData]);

  // Auto-save form data when it changes
  useEffect(() => {
    if (isLoaded) {
      const timeoutId = setTimeout(() => {
        storeData(formKey, formData);
      }, 1000); // Debounce saves by 1 second

      return () => clearTimeout(timeoutId);
    }
  }, [formData, formKey, storeData, isLoaded]);

  const updateFormData = useCallback((updates: Partial<T>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const resetFormData = useCallback(() => {
    setFormData(initialData);
    storeData(formKey, initialData);
  }, [formKey, initialData, storeData]);

  return {
    formData,
    updateFormData,
    resetFormData,
    isLoaded
  };
};

/**
 * Hook for offline email drafts
 */
export const useOfflineDrafts = () => {
  const { storeData, getData } = useOffline();
  const [drafts, setDrafts] = useState<any[]>([]);

  useEffect(() => {
    const loadDrafts = async () => {
      try {
        const savedDrafts = await getData('email-drafts');
        if (savedDrafts) {
          setDrafts(savedDrafts);
        }
      } catch (error) {
        console.error('Failed to load drafts:', error);
      }
    };

    loadDrafts();
  }, [getData]);

  const saveDraft = useCallback(async (draft: any) => {
    const updatedDrafts = [...drafts];
    const existingIndex = updatedDrafts.findIndex(d => d.id === draft.id);
    
    if (existingIndex >= 0) {
      updatedDrafts[existingIndex] = draft;
    } else {
      updatedDrafts.push(draft);
    }
    
    setDrafts(updatedDrafts);
    await storeData('email-drafts', updatedDrafts);
  }, [drafts, storeData]);

  const deleteDraft = useCallback(async (draftId: string) => {
    const updatedDrafts = drafts.filter(d => d.id !== draftId);
    setDrafts(updatedDrafts);
    await storeData('email-drafts', updatedDrafts);
  }, [drafts, storeData]);

  return {
    drafts,
    saveDraft,
    deleteDraft
  };
};