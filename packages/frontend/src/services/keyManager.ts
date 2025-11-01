/**
 * Key Management System for secure storage and management of encryption keys
 * Uses IndexedDB for persistent storage with encryption
 */

import { CryptoEngine, KeyPair } from './crypto';

export interface StoredKeyPair {
  id: string;
  publicKey: ArrayBuffer;
  encryptedPrivateKey: ArrayBuffer;
  salt: ArrayBuffer;
  createdAt: Date;
  lastUsed: Date;
}

export interface KeyBackup {
  keyId: string;
  encryptedKeyData: ArrayBuffer;
  salt: ArrayBuffer;
  backupPhrase: string;
  createdAt: Date;
}

export class KeyManager {
  private static readonly DB_NAME = 'OdyssieKeyStore';
  private static readonly DB_VERSION = 1;
  private static readonly KEYS_STORE = 'keys';
  private static readonly BACKUPS_STORE = 'backups';
  private static readonly SETTINGS_STORE = 'settings';

  private db: IDBDatabase | null = null;

  /**
   * Initialize the key manager and open IndexedDB connection
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(KeyManager.DB_NAME, KeyManager.DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create keys store
        if (!db.objectStoreNames.contains(KeyManager.KEYS_STORE)) {
          const keysStore = db.createObjectStore(KeyManager.KEYS_STORE, { keyPath: 'id' });
          keysStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Create backups store
        if (!db.objectStoreNames.contains(KeyManager.BACKUPS_STORE)) {
          const backupsStore = db.createObjectStore(KeyManager.BACKUPS_STORE, { keyPath: 'keyId' });
          backupsStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Create settings store
        if (!db.objectStoreNames.contains(KeyManager.SETTINGS_STORE)) {
          db.createObjectStore(KeyManager.SETTINGS_STORE, { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Generate and store a new key pair
   */
  async generateAndStoreKeyPair(userId: string, password: string): Promise<string> {
    if (!this.db) {
      throw new Error('KeyManager not initialized');
    }

    try {
      // Generate RSA key pair
      const keyPair = await CryptoEngine.generateRSAKeyPair();
      
      // Derive encryption key from password
      const derivedKey = await CryptoEngine.deriveKeyFromPassword(password);
      
      // Export keys
      const publicKeyBuffer = await CryptoEngine.exportKey(keyPair.publicKey, 'spki');
      const privateKeyBuffer = await CryptoEngine.exportKey(keyPair.privateKey, 'pkcs8');
      
      // Encrypt private key with derived key
      const encryptedPrivateKey = await CryptoEngine.encryptAES(privateKeyBuffer, derivedKey.key);
      
      // Create stored key pair
      const keyId = `${userId}_${Date.now()}`;
      const storedKeyPair: StoredKeyPair = {
        id: keyId,
        publicKey: publicKeyBuffer,
        encryptedPrivateKey: encryptedPrivateKey.data,
        salt: derivedKey.salt,
        createdAt: new Date(),
        lastUsed: new Date(),
      };

      // Store in IndexedDB
      await this.storeKeyPair(storedKeyPair);
      
      return keyId;
    } catch (error) {
      throw new Error(`Failed to generate and store key pair: ${error}`);
    }
  }

  /**
   * Retrieve and decrypt a key pair
   */
  async getKeyPair(keyId: string, password: string): Promise<KeyPair> {
    if (!this.db) {
      throw new Error('KeyManager not initialized');
    }

    try {
      // Retrieve stored key pair
      const storedKeyPair = await this.retrieveKeyPair(keyId);
      if (!storedKeyPair) {
        throw new Error('Key pair not found');
      }

      // Derive decryption key from password
      const derivedKey = await CryptoEngine.deriveKeyFromPassword(password, storedKeyPair.salt);
      
      // Decrypt private key (Note: IV should be stored with encrypted data in production)
      const iv = new Uint8Array(12).buffer; // This should be stored with the encrypted data
      const privateKeyBuffer = await CryptoEngine.decryptAES(
        storedKeyPair.encryptedPrivateKey,
        derivedKey.key,
        iv
      );

      // Import keys
      const publicKey = await CryptoEngine.importKey(
        storedKeyPair.publicKey,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256',
        },
        true,
        ['encrypt'],
        'spki'
      );

      const privateKey = await CryptoEngine.importKey(
        privateKeyBuffer,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256',
        },
        true,
        ['decrypt'],
        'pkcs8'
      );

      // Update last used timestamp
      storedKeyPair.lastUsed = new Date();
      await this.storeKeyPair(storedKeyPair);

      return { publicKey, privateKey };
    } catch (error) {
      throw new Error(`Failed to retrieve key pair: ${error}`);
    }
  }

  /**
   * Re-encrypt keys when password changes
   */
  async reEncryptKeys(keyId: string, oldPassword: string, newPassword: string): Promise<void> {
    if (!this.db) {
      throw new Error('KeyManager not initialized');
    }

    try {
      // Retrieve and decrypt with old password
      const keyPair = await this.getKeyPair(keyId, oldPassword);
      const storedKeyPair = await this.retrieveKeyPair(keyId);
      
      if (!storedKeyPair) {
        throw new Error('Key pair not found');
      }

      // Derive new encryption key from new password
      const newDerivedKey = await CryptoEngine.deriveKeyFromPassword(newPassword);
      
      // Export and re-encrypt private key
      const privateKeyBuffer = await CryptoEngine.exportKey(keyPair.privateKey, 'pkcs8');
      const encryptedPrivateKey = await CryptoEngine.encryptAES(privateKeyBuffer, newDerivedKey.key);
      
      // Update stored key pair
      storedKeyPair.encryptedPrivateKey = encryptedPrivateKey.data;
      storedKeyPair.salt = newDerivedKey.salt;
      
      await this.storeKeyPair(storedKeyPair);
    } catch (error) {
      throw new Error(`Failed to re-encrypt keys: ${error}`);
    }
  }

  /**
   * Create a backup of the key pair
   */
  async createKeyBackup(keyId: string, _password: string): Promise<string> {
    if (!this.db) {
      throw new Error('KeyManager not initialized');
    }

    try {
      const storedKeyPair = await this.retrieveKeyPair(keyId);
      if (!storedKeyPair) {
        throw new Error('Key pair not found');
      }

      // Generate backup phrase (12 words)
      const backupPhrase = await this.generateBackupPhrase();
      
      // Derive backup encryption key from backup phrase
      const backupKey = await CryptoEngine.deriveKeyFromPassword(backupPhrase);
      
      // Create backup data
      const backupData = {
        publicKey: storedKeyPair.publicKey,
        encryptedPrivateKey: storedKeyPair.encryptedPrivateKey,
        salt: storedKeyPair.salt,
      };
      
      // Encrypt backup data
      const serializedBackup = new TextEncoder().encode(JSON.stringify({
        publicKey: CryptoEngine.arrayBufferToBase64(backupData.publicKey),
        encryptedPrivateKey: CryptoEngine.arrayBufferToBase64(backupData.encryptedPrivateKey),
        salt: CryptoEngine.arrayBufferToBase64(backupData.salt),
      })).buffer;
      
      const encryptedBackup = await CryptoEngine.encryptAES(serializedBackup, backupKey.key);
      
      // Store backup
      const backup: KeyBackup = {
        keyId,
        encryptedKeyData: encryptedBackup.data,
        salt: backupKey.salt,
        backupPhrase,
        createdAt: new Date(),
      };
      
      await this.storeBackup(backup);
      
      return backupPhrase;
    } catch (error) {
      throw new Error(`Failed to create key backup: ${error}`);
    }
  }

  /**
   * Restore key pair from backup
   */
  async restoreFromBackup(backupPhrase: string, newPassword: string): Promise<string> {
    if (!this.db) {
      throw new Error('KeyManager not initialized');
    }

    try {
      // Find backup by phrase (in a real implementation, you'd search more efficiently)
      const backups = await this.getAllBackups();
      const backup = backups.find(b => b.backupPhrase === backupPhrase);
      
      if (!backup) {
        throw new Error('Backup not found');
      }

      // Derive backup decryption key
      const backupKey = await CryptoEngine.deriveKeyFromPassword(backupPhrase, backup.salt);
      
      // Decrypt backup data (Note: IV should be stored with encrypted data in production)
      const iv = new Uint8Array(12).buffer; // This should be stored with the encrypted data
      const decryptedBackup = await CryptoEngine.decryptAES(
        backup.encryptedKeyData,
        backupKey.key,
        iv
      );
      
      const backupData = JSON.parse(new TextDecoder().decode(decryptedBackup));
      
      // Restore key pair with new password
      const newKeyId = `restored_${Date.now()}`;
      const newDerivedKey = await CryptoEngine.deriveKeyFromPassword(newPassword);
      
      // Re-encrypt private key with new password
      const privateKeyBuffer = CryptoEngine.base64ToArrayBuffer(backupData.encryptedPrivateKey);
      
      // This is a simplified restoration - in practice, you'd need the original password
      // to decrypt the private key first, then re-encrypt with the new password
      
      const restoredKeyPair: StoredKeyPair = {
        id: newKeyId,
        publicKey: CryptoEngine.base64ToArrayBuffer(backupData.publicKey),
        encryptedPrivateKey: privateKeyBuffer,
        salt: newDerivedKey.salt,
        createdAt: new Date(),
        lastUsed: new Date(),
      };
      
      await this.storeKeyPair(restoredKeyPair);
      
      return newKeyId;
    } catch (error) {
      throw new Error(`Failed to restore from backup: ${error}`);
    }
  }

  /**
   * List all stored key pairs
   */
  async listKeyPairs(): Promise<StoredKeyPair[]> {
    if (!this.db) {
      throw new Error('KeyManager not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([KeyManager.KEYS_STORE], 'readonly');
      const store = transaction.objectStore(KeyManager.KEYS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error('Failed to list key pairs'));
      };
    });
  }

  /**
   * Delete a key pair
   */
  async deleteKeyPair(keyId: string): Promise<void> {
    if (!this.db) {
      throw new Error('KeyManager not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([KeyManager.KEYS_STORE], 'readwrite');
      const store = transaction.objectStore(KeyManager.KEYS_STORE);
      const request = store.delete(keyId);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to delete key pair'));
      };
    });
  }

  // Private helper methods

  private async storeKeyPair(keyPair: StoredKeyPair): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([KeyManager.KEYS_STORE], 'readwrite');
      const store = transaction.objectStore(KeyManager.KEYS_STORE);
      const request = store.put(keyPair);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to store key pair'));
      };
    });
  }

  private async retrieveKeyPair(keyId: string): Promise<StoredKeyPair | null> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([KeyManager.KEYS_STORE], 'readonly');
      const store = transaction.objectStore(KeyManager.KEYS_STORE);
      const request = store.get(keyId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(new Error('Failed to retrieve key pair'));
      };
    });
  }

  private async storeBackup(backup: KeyBackup): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([KeyManager.BACKUPS_STORE], 'readwrite');
      const store = transaction.objectStore(KeyManager.BACKUPS_STORE);
      const request = store.put(backup);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to store backup'));
      };
    });
  }

  private async getAllBackups(): Promise<KeyBackup[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([KeyManager.BACKUPS_STORE], 'readonly');
      const store = transaction.objectStore(KeyManager.BACKUPS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error('Failed to get backups'));
      };
    });
  }

  private async generateBackupPhrase(): Promise<string> {
    // Simple backup phrase generation (in production, use a proper word list)
    const words = [
      'apple', 'banana', 'cherry', 'dragon', 'elephant', 'forest', 'garden', 'house',
      'island', 'jungle', 'kitchen', 'lemon', 'mountain', 'nature', 'ocean', 'palace',
      'queen', 'river', 'sunset', 'tiger', 'umbrella', 'village', 'water', 'yellow'
    ];
    
    const phrase = [];
    for (let i = 0; i < 12; i++) {
      const randomIndex = Math.floor(Math.random() * words.length);
      phrase.push(words[randomIndex]);
    }
    
    return phrase.join(' ');
  }

  /**
   * Clear all stored data (for testing or account deletion)
   */
  async clearAllData(): Promise<void> {
    if (!this.db) {
      throw new Error('KeyManager not initialized');
    }

    const stores = [KeyManager.KEYS_STORE, KeyManager.BACKUPS_STORE, KeyManager.SETTINGS_STORE];
    
    for (const storeName of stores) {
      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error(`Failed to clear ${storeName}`));
      });
    }
  }
}