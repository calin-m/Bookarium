import '@testing-library/jest-dom/vitest';
import React from 'react';
import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { server } from '../mocks/server';

// Track top-level next/dynamic loader promises so they resolve before tests execute
const pendingDynamicImports: Promise<unknown>[] = [];

// Start MSW server and resolve dynamic imports before tests
beforeAll(async () => {
  server.listen({ onUnhandledRequest: 'bypass' });
  await Promise.all(pendingDynamicImports);
});

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
});

// Close MSW server after all tests
afterAll(() => {
  server.close();
});

// Browser-specific mocks for JSDOM environments
if (typeof window !== 'undefined') {
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
  } as unknown as typeof IntersectionObserver;

  // Mock window.scrollTo & Element.prototype.scrollIntoView
  window.scrollTo = vi.fn();
  if (typeof Element !== 'undefined') {
    Element.prototype.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
  }

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
}

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

// Mock next/dynamic for deterministic synchronous resolution in Vitest JSDOM
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<unknown>) => {
    let ResolvedComponent: React.ComponentType<Record<string, unknown>> | null = null;
    const promise = loader().then((mod: unknown) => {
      if (typeof mod === 'function') {
        ResolvedComponent = mod as React.ComponentType<Record<string, unknown>>;
      } else if (
        mod &&
        typeof mod === 'object' &&
        'default' in mod &&
        typeof (mod as { default: unknown }).default === 'function'
      ) {
        ResolvedComponent = (mod as { default: React.ComponentType<Record<string, unknown>> }).default;
      }
    });
    pendingDynamicImports.push(promise);

    const DynamicWrapper: React.FC<Record<string, unknown>> = (props) => {
      const [, setLoaded] = React.useState(Boolean(ResolvedComponent));
      React.useEffect(() => {
        let active = true;
        if (!ResolvedComponent) {
          promise.then(() => {
            if (active) setLoaded(true);
          });
        }
        return () => {
          active = false;
        };
      }, []);
      return ResolvedComponent ? React.createElement(ResolvedComponent, props) : null;
    };
    DynamicWrapper.displayName = 'NextDynamicWrapper';
    return DynamicWrapper;
  },
}));

// Mock framer-motion for instantaneous synchronous test execution
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');

  const motionComponentCache = new Map<
    string,
    React.ForwardRefExoticComponent<
      React.PropsWithoutRef<Record<string, unknown>> & React.RefAttributes<HTMLElement>
    >
  >();
  const createMotionComponent = (tag: string) => {
    const cached = motionComponentCache.get(tag);
    if (cached) return cached;
    const Component = React.forwardRef<HTMLElement, Record<string, unknown>>(
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
          drag: _drag,
          dragConstraints: _dragConstraints,
          dragElastic: _dragElastic,
          dragMomentum: _dragMomentum,
          onDrag: _onDrag,
          onDragEnd: _onDragEnd,
          ...props
        },
        ref
      ) => {
        return React.createElement(
          tag,
          { ...props, ref, className },
          children as React.ReactNode
        );
      }
    );
    Component.displayName = `motion.${tag}`;
    motionComponentCache.set(tag, Component);
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
