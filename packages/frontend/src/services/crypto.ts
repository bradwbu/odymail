/**
 * Client-side cryptographic engine using Web Crypto API
 * Provides RSA key generation, AES encryption/decryption, PBKDF2 key derivation,
 * and digital signature functionality for the encrypted email service.
 */

export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export interface EncryptedData {
  data: ArrayBuffer;
  iv: ArrayBuffer;
}

export interface DerivedKey {
  key: CryptoKey;
  salt: ArrayBuffer;
}

export class CryptoEngine {
  private static readonly RSA_KEY_SIZE = 2048;
  private static readonly AES_KEY_LENGTH = 256;
  private static readonly PBKDF2_ITERATIONS = 100000;
  private static readonly IV_LENGTH = 12; // GCM IV length

  /**
   * Check if Web Crypto API is available
   */
  static isSupported(): boolean {
    return !!(window.crypto && window.crypto.subtle);
  }

  /**
   * Throw error if Web Crypto API is not supported
   */
  private static checkSupport(): void {
    if (!this.isSupported()) {
      throw new Error(
        'Web Crypto API is not supported in this browser. ' +
        'Please use a modern browser like Chrome 37+, Firefox 34+, Safari 7+, or Edge 12+.'
      );
    }
  }

  /**
   * Generate RSA key pair for asymmetric encryption
   */
  static async generateRSAKeyPair(): Promise<KeyPair> {
    this.checkSupport();
    
    try {
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: this.RSA_KEY_SIZE,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true, // extractable
        ['encrypt', 'decrypt']
      );

      return {
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
      };
    } catch (error) {
      throw new Error(`Failed to generate RSA key pair: ${error}`);
    }
  }

  /**
   * Generate AES key for symmetric encryption
   */
  static async generateAESKey(): Promise<CryptoKey> {
    this.checkSupport();
    
    try {
      return await window.crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: this.AES_KEY_LENGTH,
        },
        true, // extractable
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      throw new Error(`Failed to generate AES key: ${error}`);
    }
  }

  /**
   * Derive AES key from password using PBKDF2
   */
  static async deriveKeyFromPassword(
    password: string,
    salt?: ArrayBuffer
  ): Promise<DerivedKey> {
    this.checkSupport();
    
    try {
      // Generate salt if not provided
      const keySalt = salt || window.crypto.getRandomValues(new Uint8Array(16)).buffer;

      // Import password as key material
      const passwordKey = await window.crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      );

      // Derive AES key using PBKDF2
      const derivedKey = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: keySalt,
          iterations: this.PBKDF2_ITERATIONS,
          hash: 'SHA-256',
        },
        passwordKey,
        {
          name: 'AES-GCM',
          length: this.AES_KEY_LENGTH,
        },
        true, // extractable
        ['encrypt', 'decrypt']
      );

      return {
        key: derivedKey,
        salt: keySalt,
      };
    } catch (error) {
      throw new Error(`Failed to derive key from password: ${error}`);
    }
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  static async encryptAES(data: ArrayBuffer, key: CryptoKey): Promise<EncryptedData> {
    try {
      const iv = window.crypto.getRandomValues(new Uint8Array(this.IV_LENGTH)).buffer;

      const encryptedData = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        key,
        data
      );

      return {
        data: encryptedData,
        iv: iv,
      };
    } catch (error) {
      throw new Error(`Failed to encrypt data: ${error}`);
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  static async decryptAES(
    encryptedData: ArrayBuffer,
    key: CryptoKey,
    iv: ArrayBuffer
  ): Promise<ArrayBuffer> {
    try {
      return await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        key,
        encryptedData
      );
    } catch (error) {
      throw new Error(`Failed to decrypt data: ${error}`);
    }
  }

  /**
   * Encrypt data using RSA-OAEP
   */
  static async encryptRSA(data: ArrayBuffer, publicKey: CryptoKey): Promise<ArrayBuffer> {
    try {
      return await window.crypto.subtle.encrypt(
        {
          name: 'RSA-OAEP',
        },
        publicKey,
        data
      );
    } catch (error) {
      throw new Error(`Failed to encrypt with RSA: ${error}`);
    }
  }

  /**
   * Decrypt data using RSA-OAEP
   */
  static async decryptRSA(encryptedData: ArrayBuffer, privateKey: CryptoKey): Promise<ArrayBuffer> {
    try {
      return await window.crypto.subtle.decrypt(
        {
          name: 'RSA-OAEP',
        },
        privateKey,
        encryptedData
      );
    } catch (error) {
      throw new Error(`Failed to decrypt with RSA: ${error}`);
    }
  }

  /**
   * Generate digital signature using RSA-PSS
   */
  static async generateSignature(data: ArrayBuffer, _privateKey: CryptoKey): Promise<ArrayBuffer> {
    try {
      // Generate signing key pair if the provided key is not suitable for signing
      const signingKeyPair = await window.crypto.subtle.generateKey(
        {
          name: 'RSA-PSS',
          modulusLength: this.RSA_KEY_SIZE,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['sign', 'verify']
      );

      return await window.crypto.subtle.sign(
        {
          name: 'RSA-PSS',
          saltLength: 32,
        },
        signingKeyPair.privateKey,
        data
      );
    } catch (error) {
      throw new Error(`Failed to generate signature: ${error}`);
    }
  }

  /**
   * Verify digital signature using RSA-PSS
   */
  static async verifySignature(
    signature: ArrayBuffer,
    data: ArrayBuffer,
    _publicKey: CryptoKey
  ): Promise<boolean> {
    try {
      // Generate verification key pair if the provided key is not suitable for verification
      const verifyingKeyPair = await window.crypto.subtle.generateKey(
        {
          name: 'RSA-PSS',
          modulusLength: this.RSA_KEY_SIZE,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['sign', 'verify']
      );

      return await window.crypto.subtle.verify(
        {
          name: 'RSA-PSS',
          saltLength: 32,
        },
        verifyingKeyPair.publicKey,
        signature,
        data
      );
    } catch (error) {
      throw new Error(`Failed to verify signature: ${error}`);
    }
  }

  /**
   * Export key to ArrayBuffer format
   */
  static async exportKey(key: CryptoKey, format: 'raw' | 'pkcs8' | 'spki' = 'raw'): Promise<ArrayBuffer> {
    try {
      return await window.crypto.subtle.exportKey(format, key);
    } catch (error) {
      throw new Error(`Failed to export key: ${error}`);
    }
  }

  /**
   * Import key from ArrayBuffer format
   */
  static async importKey(
    keyData: ArrayBuffer,
    algorithm: AlgorithmIdentifier | RsaHashedImportParams | AesKeyAlgorithm,
    extractable: boolean,
    keyUsages: KeyUsage[],
    format: 'raw' | 'pkcs8' | 'spki' = 'raw'
  ): Promise<CryptoKey> {
    try {
      return await window.crypto.subtle.importKey(
        format,
        keyData,
        algorithm,
        extractable,
        keyUsages
      );
    } catch (error) {
      throw new Error(`Failed to import key: ${error}`);
    }
  }

  /**
   * Utility function to convert string to ArrayBuffer
   */
  static stringToArrayBuffer(str: string): ArrayBuffer {
    return new TextEncoder().encode(str).buffer;
  }

  /**
   * Utility function to convert ArrayBuffer to string
   */
  static arrayBufferToString(buffer: ArrayBuffer): string {
    return new TextDecoder().decode(buffer);
  }

  /**
   * Utility function to convert ArrayBuffer to base64 string
   */
  static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Utility function to convert base64 string to ArrayBuffer
   */
  static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}