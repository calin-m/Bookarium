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

// Mock window.location for JSDOM
Object.defineProperty(window, 'location', {
  configurable: true,
  writable: true,
  value: {
    ...window.location,
    reload: vi.fn(),
    assign: vi.fn(),
    replace: vi.fn(),
    href: 'http://localhost:3000/',
    pathname: '/',
    search: '',
  },
});

// Intercept unhandled link navigation in JSDOM
window.addEventListener(
  'click',
  (e) => {
    const target = e.target as HTMLElement | null;
    const anchor = target?.closest('a');
    if (anchor && anchor.getAttribute('href')) {
      e.preventDefault();
    }
  },
  true
);

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

// Mock framer-motion for instantaneous synchronous test execution
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');

  const createMotionComponent = (tag: string) => {
    const Component = React.forwardRef(
      (
        {
          children,
          className,
          whileHover: _whileHover,
          whileTap: _whileTap,
          whileFocus: _whileFocus,
          whileInView: _whileInView,
          initial: _initial,
          animate: _animate,
          exit: _exit,
          transition: _transition,
          variants: _variants,
          layout: _layout,
          layoutId: _layoutId,
          onAnimationStart: _onAnimationStart,
          onAnimationComplete: _onAnimationComplete,
          ...props
        }: any,
        ref: any
      ) => {
        return React.createElement(tag, { ...props, ref, className }, children);
      }
    );
    Component.displayName = `motion.${tag}`;
    return Component;
  };

  const motionProxy = new Proxy(
    {},
    {
      get: (_target, prop: string) => {
        return createMotionComponent(prop);
      },
    }
  );

  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: motionProxy,
    useReducedMotion: () => true,
    useScroll: () => ({
      scrollY: { get: () => 0, onChange: () => () => {} },
      scrollYProgress: { get: () => 0, onChange: () => () => {} },
    }),
  };
});
