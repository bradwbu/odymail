/**
 * Test setup configuration
 */

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Web Crypto API
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: (arr: any) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
    subtle: {
      generateKey: vi.fn().mockResolvedValue({
        publicKey: 'mock-public-key',
        privateKey: 'mock-private-key',
      }),
      encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      sign: vi.fn().mockResolvedValue(new ArrayBuffer(64)),
      verify: vi.fn().mockResolvedValue(true),
      exportKey: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      importKey: vi.fn().mockResolvedValue('mock-key'),
      deriveKey: vi.fn().mockResolvedValue('mock-derived-key'),
    },
  },
});

// Mock TextEncoder/TextDecoder
global.TextEncoder = class TextEncoder {
  encode(input: string) {
    return new Uint8Array(Array.from(input).map(char => char.charCodeAt(0)));
  }
};

global.TextDecoder = class TextDecoder {
  decode(input: Uint8Array) {
    return String.fromCharCode(...Array.from(input));
  }
};

// Mock window.prompt
Object.defineProperty(window, 'prompt', {
  value: vi.fn().mockReturnValue('test-password'),
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: vi.fn().mockResolvedValue({}),
  text: vi.fn().mockResolvedValue(''),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};