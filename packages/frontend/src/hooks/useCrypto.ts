/**
 * Custom hook for cryptographic operations
 */

import { useCallback } from 'react';
import { CryptoEngine } from '../services/crypto';
import { KeyManager } from '../services/keyManager';

export const useCrypto = () => {
  const keyManager = new KeyManager();

  // Initialize crypto services
  const initialize = useCallback(async () => {
    await keyManager.initialize();
  }, [keyManager]);

  // Get user's private key
  const getUserPrivateKey = useCallback(async (password: string) => {
    // In a real app, this would get the user's encrypted private key from storage
    // and decrypt it with their password
    const userKeyId = localStorage.getItem('userKeyId');
    if (!userKeyId) {
      throw new Error('No user key found');
    }
    
    const keyPair = await keyManager.getKeyPair(userKeyId, password);
    return keyPair.privateKey;
  }, [keyManager]);

  // Import AES key from buffer
  const importAESKey = useCallback(async (keyBuffer: ArrayBuffer) => {
    return await CryptoEngine.importKey(
      keyBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt'],
      'raw'
    );
  }, []);

  // Decrypt RSA encrypted data
  const decryptRSA = useCallback(async (encryptedData: ArrayBuffer, privateKey: CryptoKey) => {
    return await CryptoEngine.decryptRSA(encryptedData, privateKey);
  }, []);

  // Decrypt AES encrypted data
  const decryptAES = useCallback(async (encryptedData: ArrayBuffer, key: CryptoKey) => {
    // Extract IV and encrypted data
    const iv = encryptedData.slice(0, 12); // First 12 bytes are IV
    const data = encryptedData.slice(12);
    
    return await CryptoEngine.decryptAES(data, key, iv);
  }, []);

  // Utility functions
  const base64ToArrayBuffer = useCallback((base64: string) => {
    return CryptoEngine.base64ToArrayBuffer(base64);
  }, []);

  const arrayBufferToString = useCallback((buffer: ArrayBuffer) => {
    return CryptoEngine.arrayBufferToString(buffer);
  }, []);

  const arrayBufferToBase64 = useCallback((buffer: ArrayBuffer) => {
    return CryptoEngine.arrayBufferToBase64(buffer);
  }, []);

  const stringToArrayBuffer = useCallback((str: string) => {
    return CryptoEngine.stringToArrayBuffer(str);
  }, []);

  return {
    initialize,
    getUserPrivateKey,
    importAESKey,
    decryptRSA,
    decryptAES,
    base64ToArrayBuffer,
    arrayBufferToString,
    arrayBufferToBase64,
    stringToArrayBuffer
  };
};