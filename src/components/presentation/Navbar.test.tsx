import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Navbar } from './Navbar';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { mockBooks } from '@/mocks/handlers';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('Navbar component', () => {
  beforeEach(() => {
    useBookshelfStore.getState().clearBookshelf();
    useThemeStore.setState({ theme: 'light' });
    document.documentElement.className = '';
  });

  it('should render brand and navigation items with responsive title classes', () => {
    render(<Navbar activeView="catalog" />);
    const brandText = screen.getByText(/Bookarium/i);
    expect(brandText).toBeInTheDocument();
    expect(brandText).toHaveClass('min-[375px]:inline', 'text-xs');
    expect(screen.getByRole('button', { name: 'Catalog' })).toBeInTheDocument();
    expect(screen.getByLabelText('Bookshelf')).toBeInTheDocument();
    expect(screen.getByLabelText('Favorites')).toBeInTheDocument();
    expect(screen.getByLabelText('Notebook')).toBeInTheDocument();
    expect(screen.getByLabelText('Bookmarks')).toBeInTheDocument();
  });

  it('should fill highlighter icon when annotations are saved in notebook', async () => {
    const { useAnnotationStore } = await import('@/stores/useAnnotationStore');
    await act(async () => {
      await useAnnotationStore.getState().addAnnotation({
        bookId: 1342,
        chapterIndex: 0,
        chapterPage: 1,
        selectedText: 'Test quote',
        color: 'yellow',
      });
    });

    const { container } = render(<Navbar activeView="catalog" />);
    const highlighterSvg = container.querySelector('svg.lucide-highlighter');
    expect(highlighterSvg).toHaveClass('fill-amber-500');
    expect(highlighterSvg).toHaveClass('text-amber-500');
    expect(screen.queryByTestId('navbar-notebook-badge')).not.toBeInTheDocument();

    act(() => {
      useAnnotationStore.getState().clearAllAnnotations();
    });
  });

  it('triggers onViewChange with notebook when Notebook tab is clicked', () => {
    const handleViewChange = vi.fn();
    render(<Navbar activeView="catalog" onViewChange={handleViewChange} />);

    const notebookBtn = screen.getByLabelText('Notebook');
    fireEvent.click(notebookBtn);
    expect(handleViewChange).toHaveBeenCalledWith('notebook');
  });

  it('falls back to router.push when onViewChange is not provided', () => {
    mockPush.mockClear();
    render(<Navbar activeView="catalog" />);

    const bookshelfBtn = screen.getByLabelText('Bookshelf');
    fireEvent.click(bookshelfBtn);
    expect(mockPush).toHaveBeenCalledWith('/bookshelf');
  });

  it('applies active styling when activeView is notebook', () => {
    render(<Navbar activeView="notebook" />);
    const notebookBtn = screen.getByLabelText('Notebook');
    expect(notebookBtn).toHaveClass('font-medium');
    expect(notebookBtn).not.toHaveClass('font-bold');
    expect(notebookBtn).toHaveClass('border-amber-500');
  });

  it('triggers onViewChange with bookmarks when Bookmarks tab is clicked', () => {
    const handleViewChange = vi.fn();
    render(<Navbar activeView="catalog" onViewChange={handleViewChange} />);

    const bookmarksBtn = screen.getByLabelText('Bookmarks');
    fireEvent.click(bookmarksBtn);
    expect(handleViewChange).toHaveBeenCalledWith('bookmarks');
  });

  it('applies active styling when activeView is bookmarks', () => {
    render(<Navbar activeView="bookmarks" />);
    const bookmarksBtn = screen.getByLabelText('Bookmarks');
    expect(bookmarksBtn).toHaveClass('font-medium');
    expect(bookmarksBtn).not.toHaveClass('font-bold');
    expect(bookmarksBtn).toHaveClass('border-indigo-500');
  });

  it('should fill library icon when books are saved to bookshelf', () => {
    useBookshelfStore.getState().toggleSaveBook(mockBooks[0]);
    const { container } = render(<Navbar activeView="catalog" />);
    const librarySvg = container.querySelector('svg.lucide-library');
    expect(librarySvg).toHaveClass('fill-primary');
  });

  it('should fill heart icon when books are favorited', () => {
    useBookshelfStore.getState().toggleFavoriteBook(mockBooks[0]);
    const { container } = render(<Navbar activeView="catalog" />);
    const heartSvg = container.querySelector('svg.lucide-heart');
    expect(heartSvg).toHaveClass('fill-destructive');
  });

  it('should trigger onViewChange callback when clicking tabs', () => {
    const handleViewChange = vi.fn();
    render(<Navbar activeView="catalog" onViewChange={handleViewChange} />);

    const bookshelfBtn = screen.getByLabelText('Bookshelf');
    fireEvent.click(bookshelfBtn);
    expect(handleViewChange).toHaveBeenCalledWith('bookshelf');

    const favoritesBtn = screen.getByLabelText('Favorites');
    fireEvent.click(favoritesBtn);
    expect(handleViewChange).toHaveBeenCalledWith('favorites');

    const brand = screen.getByText(/Bookarium/i);
    fireEvent.click(brand);
    expect(handleViewChange).toHaveBeenCalledWith('catalog');
  });

  it('applies active styling when activeView is favorites', () => {
    render(<Navbar activeView="favorites" />);
    const favoritesBtn = screen.getByLabelText('Favorites');
    expect(favoritesBtn).toHaveClass('font-medium');
    expect(favoritesBtn).not.toHaveClass('font-bold');
    expect(favoritesBtn).toHaveClass('border-destructive');
  });

  it('should cycle through themes when clicking theme button', () => {
    render(<Navbar activeView="catalog" />);
    const themeBtn = screen.getByRole('button', { name: /Current theme:/i });

    // Light -> Sepia
    fireEvent.click(themeBtn);
    expect(useThemeStore.getState().theme).toBe('sepia');
    expect(document.documentElement.classList.contains('sepia')).toBe(true);

    // Sepia -> Dark
    fireEvent.click(themeBtn);
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Dark -> Light
    fireEvent.click(themeBtn);
    expect(useThemeStore.getState().theme).toBe('light');
  });

  it('renders Sign In button for guests and triggers openAuthModal', () => {
    render(<Navbar activeView="catalog" />);
    const signInBtn = screen.getByRole('button', { name: /Sign In/i });
    expect(signInBtn).toBeInTheDocument();
  });

  it('renders direct Account Link when user is authenticated', async () => {
    const { useAuthStore } = await import('@/stores/useAuthStore');
    useAuthStore.setState({
      user: { id: 'u1', email: 'reader@bookarium.test' } as any,
      profile: { display_name: 'Test Reader' } as any,
    });

    render(<Navbar activeView="catalog" />);
    const userLink = screen.getByLabelText('User Account');
    expect(userLink).toBeInTheDocument();
    expect(userLink).toHaveAttribute('href', '/account');
    expect(screen.getByText('Account')).toBeInTheDocument();
  });

  it('handles keyboard Enter and Space on brand logo to navigate back to catalog', () => {
    const handleViewChange = vi.fn();
    const handleBrandReset = vi.fn();
    render(<Navbar activeView="bookshelf" onViewChange={handleViewChange} onBrandReset={handleBrandReset} />);

    const brand = screen.getByLabelText('Bookarium logo, click to refresh catalog');
    fireEvent.keyDown(brand, { key: 'Enter' });
    expect(handleViewChange).toHaveBeenCalledWith('catalog');
    expect(handleBrandReset).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(brand, { key: ' ' });
    expect(handleViewChange).toHaveBeenCalledWith('catalog');
    expect(handleBrandReset).toHaveBeenCalledTimes(2);
  });

  it('applies -translate-y-full when isVisible is false', () => {
    const { container } = render(<Navbar activeView="catalog" isVisible={false} />);
    const header = container.querySelector('header');
    expect(header).toHaveClass('-translate-y-full');
    expect(header).toHaveClass('pointer-events-none');
  });

  it('applies translate-y-0 when isVisible is true', () => {
    const { container } = render(<Navbar activeView="catalog" isVisible={true} />);
    const header = container.querySelector('header');
    expect(header).toHaveClass('translate-y-0');
  });

  it('renders active account button styling when activeView is account', async () => {
    const { useAuthStore } = await import('@/stores/useAuthStore');
    useAuthStore.setState({
      user: { id: 'u1', email: 'reader@bookarium.test' } as any,
      profile: { display_name: 'Test Reader' } as any,
    });

    render(<Navbar activeView="account" />);
    const userLink = screen.getByLabelText('User Account');
    expect(userLink).toHaveClass('border-primary');
    expect(userLink).toHaveClass('text-primary');
  });

  it('renders active Sign In button styling for guests when activeView is account', async () => {
    const { useAuthStore } = await import('@/stores/useAuthStore');
    useAuthStore.setState({
      user: null,
      profile: null,
    });

    render(<Navbar activeView="account" />);
    const signInBtn = screen.getByRole('button', { name: /Sign In/i });
    expect(signInBtn).toHaveClass('bg-primary');
  });

  it('renders GitHub repository link with target _blank on the header', () => {
    render(<Navbar activeView="catalog" />);
    const githubLink = screen.getByRole('link', { name: /View Bookarium repository on GitHub/i });
    expect(githubLink).toBeInTheDocument();
    expect(githubLink).toHaveAttribute('href', 'https://github.com/calin-m/Bookarium');
    expect(githubLink).toHaveAttribute('target', '_blank');
    expect(githubLink).toHaveClass('hidden', 'min-[320px]:inline-flex');
  });

  it('renders dynamic active view masthead subtitle with section theme color and responsive classes', () => {
    const { rerender } = render(<Navbar activeView="catalog" />);
    let subtitle = screen.getByTestId('navbar-active-view-subtitle');
    expect(subtitle).toBeInTheDocument();
    expect(subtitle).toHaveTextContent('Catalog');
    expect(subtitle).toHaveClass('text-primary', 'lg:hidden', 'min-[375px]:inline');

    rerender(<Navbar activeView="favorites" />);
    subtitle = screen.getByTestId('navbar-active-view-subtitle');
    expect(subtitle).toHaveTextContent('Favorites');
    expect(subtitle).toHaveClass('text-destructive');

    rerender(<Navbar activeView="notebook" />);
    subtitle = screen.getByTestId('navbar-active-view-subtitle');
    expect(subtitle).toHaveTextContent('Notebook');
    expect(subtitle).toHaveClass('text-amber-600');

    rerender(<Navbar activeView="bookmarks" />);
    subtitle = screen.getByTestId('navbar-active-view-subtitle');
    expect(subtitle).toHaveTextContent('Bookmarks');
    expect(subtitle).toHaveClass('text-indigo-600');

    rerender(<Navbar activeView="account" />);
    subtitle = screen.getByTestId('navbar-active-view-subtitle');
    expect(subtitle).toHaveTextContent('Account');
    expect(subtitle).toHaveClass('text-primary');
  });

  it('applies hidden and lg:inline responsive classes to navigation and action text labels', () => {
    render(<Navbar activeView="catalog" />);
    const catalogBtn = screen.getByRole('button', { name: 'Catalog' });
    expect(catalogBtn.querySelector('span')).toHaveClass('hidden', 'lg:inline');

    const bookshelfBtn = screen.getByRole('button', { name: 'Bookshelf' });
    expect(bookshelfBtn.querySelector('span')).toHaveClass('hidden', 'lg:inline');

    const favoritesBtn = screen.getByRole('button', { name: 'Favorites' });
    expect(favoritesBtn.querySelector('span')).toHaveClass('hidden', 'lg:inline');

    const notebookBtn = screen.getByRole('button', { name: 'Notebook' });
    expect(notebookBtn.querySelector('span')).toHaveClass('hidden', 'lg:inline');

    const bookmarksBtn = screen.getByRole('button', { name: 'Bookmarks' });
    expect(bookmarksBtn.querySelector('span')).toHaveClass('hidden', 'lg:inline');

    const signInBtn = screen.getByRole('button', { name: /Sign In/i });
    expect(signInBtn.querySelector('span')).toHaveClass('hidden', 'lg:inline');
  });

  it('renders 0px-width fellowship notification dot on Account link when pending invitations exist', async () => {
    const { useAuthStore } = await import('@/stores/useAuthStore');
    const { useFellowshipStore } = await import('@/stores/useFellowshipStore');
    useAuthStore.setState({
      user: { id: 'u1', email: 'reader@bookarium.test' } as any,
      profile: { display_name: 'Test Reader' } as any,
    });
    useFellowshipStore.setState({
      circles: [
        {
          id: 'circle-pending-1',
          requester_id: 'u2',
          requester_username: 'marcus_aurelius',
          requester_display_name: 'Marcus Aurelius',
          recipient_id: 'u1',
          recipient_username: 'reader',
          recipient_display_name: 'Test Reader',
          status: 'pending',
          created_at: '2026-10-15T10:00:00Z',
          updated_at: '2026-10-15T10:00:00Z',
        },
      ],
      symposiums: [],
    });

    render(<Navbar activeView="catalog" />);
    expect(screen.getByTestId('navbar-fellowship-dot')).toBeInTheDocument();

    useFellowshipStore.getState().clearFellowshipState();
  });

  describe('Tier-Adaptive Gliding Active Underline Bar', () => {
    let originalOffsetWidth: PropertyDescriptor | undefined;
    let originalOffsetLeft: PropertyDescriptor | undefined;

    beforeEach(() => {
      originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
      originalOffsetLeft = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetLeft');
    });

    afterEach(() => {
      if (originalOffsetWidth) {
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
      }
      if (originalOffsetLeft) {
        Object.defineProperty(HTMLElement.prototype, 'offsetLeft', originalOffsetLeft);
      }
      vi.restoreAllMocks();
    });

    it('falls back to button border when dimensions are 0 (e.g. unmeasured or SSR)', () => {
      render(<Navbar activeView="favorites" />);
      expect(screen.queryByTestId('navbar-active-indicator')).not.toBeInTheDocument();
      const favoritesBtn = screen.getByLabelText('Favorites');
      expect(favoritesBtn).toHaveClass('border-destructive');
    });

    it('renders gliding indicator with position, width, and theme bottom border when measurable', () => {
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        get() {
          return 80;
        },
      });
      Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
        configurable: true,
        get() {
          return 120;
        },
      });

      render(<Navbar activeView="favorites" />);
      const indicator = screen.getByTestId('navbar-active-indicator');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveClass('h-8', 'rounded', 'border-b-2', 'border-destructive');
      expect(indicator).not.toHaveClass('bg-destructive');
      expect(indicator.className).not.toMatch(/shadow-/);
      expect(indicator.style.transform).toBe('translate3d(120px, 0, 0)');
      expect(indicator.style.width).toBe('80px');

      // Active button should now have transparent border to avoid duplicate lines
      const favoritesBtn = screen.getByLabelText('Favorites');
      expect(favoritesBtn).toHaveClass('border-transparent');
      expect(favoritesBtn).not.toHaveClass('border-destructive');
    });

    it('updates indicator styling for different views', () => {
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        get() {
          return 90;
        },
      });
      Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
        configurable: true,
        get() {
          return 210;
        },
      });

      const { rerender } = render(<Navbar activeView="notebook" />);
      let indicator = screen.getByTestId('navbar-active-indicator');
      expect(indicator).toHaveClass('border-amber-500');

      rerender(<Navbar activeView="bookmarks" />);
      indicator = screen.getByTestId('navbar-active-indicator');
      expect(indicator).toHaveClass('border-indigo-500');
    });

    it('activates two-phase directional elastic bridge and corner-tip curl on high tier when moving right', () => {
      vi.useFakeTimers();
      let currentLeft = 10;
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        get() {
          return 80;
        },
      });
      Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
        configurable: true,
        get() {
          return currentLeft;
        },
      });

      const { rerender } = render(<Navbar activeView="catalog" />);
      const indicator = screen.getByTestId('navbar-active-indicator');
      expect(indicator.style.transform).toBe('translate3d(10px, 0, 0)');
      expect(indicator.style.width).toBe('80px');
      expect(indicator).toHaveClass('rounded');

      // Switch tab to favorites at left = 120
      currentLeft = 120;
      rerender(<Navbar activeView="favorites" />);

      // Phase 1 (0ms): Leading edge reaches right to 200px, trailing edge lags at 52px
      expect(indicator.style.transform).toBe('translate3d(52px, 0, 0)');
      expect(indicator.style.width).toBe('148px');
      expect(indicator).toHaveClass('rounded-b-lg');
      expect(indicator).toHaveClass('border-destructive');

      // Phase 2 (110ms timer advance): Trailing edge snaps into place, relaxing back to rounded
      act(() => {
        vi.advanceTimersByTime(115);
      });

      expect(indicator.style.transform).toBe('translate3d(120px, 0, 0)');
      expect(indicator.style.width).toBe('80px');
      expect(indicator).toHaveClass('rounded');

      vi.useRealTimers();
    });

    it('activates two-phase directional elastic bridge and corner-tip curl on high tier when moving left', () => {
      vi.useFakeTimers();
      let currentLeft = 120;
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        get() {
          return 80;
        },
      });
      Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
        configurable: true,
        get() {
          return currentLeft;
        },
      });

      const { rerender } = render(<Navbar activeView="favorites" />);
      const indicator = screen.getByTestId('navbar-active-indicator');

      // Switch tab to catalog at left = 10
      currentLeft = 10;
      rerender(<Navbar activeView="catalog" />);

      // Phase 1 (0ms): Leading edge reaches left to 10px, trailing edge lags at 158px
      expect(indicator.style.transform).toBe('translate3d(10px, 0, 0)');
      expect(indicator.style.width).toBe('148px');
      expect(indicator).toHaveClass('rounded-b-lg');

      // Phase 2 (110ms timer advance): Snaps to target
      act(() => {
        vi.advanceTimersByTime(115);
      });

      expect(indicator.style.transform).toBe('translate3d(10px, 0, 0)');
      expect(indicator.style.width).toBe('80px');
      expect(indicator).toHaveClass('rounded');

      vi.useRealTimers();
    });

    it('applies direct target rect without bridge phase on medium tier', async () => {
      const perfModule = await import('@/hooks/usePerformanceTier');
      vi.spyOn(perfModule, 'usePerformanceTier').mockReturnValue({
        tier: 'medium',
        allowHeavyMotion: true,
        enablePrefetching: false,
        cores: 4,
      });

      let currentLeft = 10;
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        get() {
          return 80;
        },
      });
      Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
        configurable: true,
        get() {
          return currentLeft;
        },
      });

      const { rerender } = render(<Navbar activeView="catalog" />);
      const indicator = screen.getByTestId('navbar-active-indicator');

      currentLeft = 120;
      rerender(<Navbar activeView="favorites" />);

      // On medium tier, it immediately sets targetRect without bridging width
      expect(indicator.style.transform).toBe('translate3d(120px, 0, 0)');
      expect(indicator.style.width).toBe('80px');
      expect(indicator).toHaveClass('rounded');
    });

    it('fades out with opacity-0 and scale-x-50 when activeView is account', () => {
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        get() {
          return 80;
        },
      });
      Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
        configurable: true,
        get() {
          return 50;
        },
      });

      const { rerender } = render(<Navbar activeView="catalog" />);
      expect(screen.getByTestId('navbar-active-indicator')).toHaveClass('opacity-100');

      rerender(<Navbar activeView="account" />);
      const indicator = screen.getByTestId('navbar-active-indicator');
      expect(indicator).toHaveClass('opacity-0', 'scale-x-50');
    });

    it('re-measures on window resize event', () => {
      let currentOffsetLeft = 50;
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        get() {
          return 80;
        },
      });
      Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
        configurable: true,
        get() {
          return currentOffsetLeft;
        },
      });

      render(<Navbar activeView="catalog" />);
      const indicator = screen.getByTestId('navbar-active-indicator');
      expect(indicator.style.transform).toBe('translate3d(50px, 0, 0)');

      currentOffsetLeft = 75;
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      expect(indicator.style.transform).toBe('translate3d(75px, 0, 0)');
    });

    it('disables gliding indicator and stays on fallback border when prefers-reduced-motion is active', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        get() {
          return 80;
        },
      });

      render(<Navbar activeView="favorites" />);
      expect(screen.queryByTestId('navbar-active-indicator')).not.toBeInTheDocument();
      const favoritesBtn = screen.getByLabelText('Favorites');
      expect(favoritesBtn).toHaveClass('border-destructive');
    });
  });
});

