import '@testing-library/jest-dom/vitest';
import React from 'react';
import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { server } from '../mocks/server';

// Start MSW server before tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
});

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  localStorage.clear();
});

// Close MSW server after all tests
afterAll(() => {
  server.close();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
} as any;

// Mock window.scrollTo
window.scrollTo = vi.fn();
Element.prototype.scrollTo = vi.fn();

// Mock window.location.reload for JSDOM
Object.defineProperty(window, 'location', {
  configurable: true,
  value: {
    ...window.location,
    reload: vi.fn(),
    href: 'http://localhost:3000/',
    pathname: '/',
    search: '',
  },
});

// Mock next/font/google
vi.mock('next/font/google', () => ({
  Playfair_Display: () => ({ variable: '--font-serif', className: 'font-serif' }),
  Inter: () => ({ variable: '--font-sans', className: 'font-sans' }),
  JetBrains_Mono: () => ({ variable: '--font-mono', className: 'font-mono' }),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  useParams: () => ({ id: '1342' }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

// Mock framer-motion for instantaneous test execution
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: {
      div: ({ children, className, ...props }: any) =>
        React.createElement('div', { className, ...props }, children),
      section: ({ children, className, ...props }: any) =>
        React.createElement('section', { className, ...props }, children),
      article: ({ children, className, ...props }: any) =>
        React.createElement('article', { className, ...props }, children),
      span: ({ children, className, ...props }: any) =>
        React.createElement('span', { className, ...props }, children),
      button: ({ children, className, ...props }: any) =>
        React.createElement('button', { className, ...props }, children),
    },
  };
});



