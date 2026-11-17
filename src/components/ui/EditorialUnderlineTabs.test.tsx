import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { EditorialUnderlineTabs } from './EditorialUnderlineTabs';

describe('EditorialUnderlineTabs', () => {
  const sampleTabs = [
    {
      id: 'all' as const,
      label: 'All Items',
      icon: <span data-testid="icon-all" />,
      count: 12,
      testId: 'tab-all',
    },
    {
      id: 'active' as const,
      label: 'Active Items',
      icon: <span data-testid="icon-active" />,
      count: 4,
      countVariant: 'highlight' as const,
      testId: 'tab-active',
    },
    {
      id: 'empty' as const,
      label: 'Empty Tab',
      icon: <span data-testid="icon-empty" />,
      count: 0,
      hideZeroCount: true,
      testId: 'tab-empty',
    },
  ];

  it('renders tabs with active underline, responsive label visibility, count badges, and handles selection', () => {
    const onSelectTab = vi.fn();
    render(
      <EditorialUnderlineTabs
        tabs={sampleTabs}
        activeTab="all"
        onSelectTab={onSelectTab}
        ariaLabel="Sample sections"
        inactiveLabelClass="hidden xl:inline"
        hideInactiveCountOnMobile
        compactPadding
      />
    );

    const nav = screen.getByRole('tablist', { name: 'Sample sections' });
    expect(nav).toHaveClass('touch-pan-y', 'w-full', 'justify-between', 'p-px');

    const allTab = screen.getByTestId('tab-all');
    const activeTab = screen.getByTestId('tab-active');
    const emptyTab = screen.getByTestId('tab-empty');

    expect(allTab).toHaveAttribute('aria-selected', 'true');
    expect(allTab).toHaveAttribute('data-tab-distance', '0');
    expect(allTab).toHaveClass('transition-colors', 'duration-150', 'flex-[1.8]', 'xl:flex-1', 'justify-center');
    expect(allTab.querySelector('[data-scrub-chevron="left"]')).toBeNull();
    expect(allTab.querySelector('[data-scrub-chevron="right"]')).toHaveClass('-right-[6px]');
    expect(activeTab).toHaveAttribute('aria-selected', 'false');
    expect(activeTab).toHaveAttribute('data-tab-distance', '1');
    expect(activeTab.querySelector('[data-scrub-chevron="left"]')).toBeNull();
    expect(activeTab.querySelector('[data-scrub-chevron="right"]')).toBeNull();
    expect(emptyTab).toHaveAttribute('data-tab-distance', '2');
    expect(within(allTab).getByText('All Items')).toHaveClass('inline-block', 'max-w-[220px]', 'opacity-100');
    expect(within(activeTab).getByText('Active Items')).toHaveClass('inline-block', 'max-w-[88px]', 'opacity-85', 'xl:inline');
    expect(within(emptyTab).getByText('Empty Tab')).toHaveClass('inline-block', 'max-w-[44px]', 'opacity-65', 'xl:inline');

    // Count badge visibility and highlight variant
    expect(within(allTab).getByText('12')).toHaveClass('inline-flex');
    expect(within(activeTab).getByText('4')).toHaveClass('hidden', 'sm:inline-flex', 'bg-primary');
    // Zero count with hideZeroCount=true is omitted
    expect(within(emptyTab).queryByText('0')).not.toBeInTheDocument();

    fireEvent.click(activeTab);
    expect(onSelectTab).toHaveBeenCalledWith('active');
    expect(document.querySelectorAll('[data-scrub-chevron]').length).toBe(1);
    expect(document.getElementById('bookarium-tab-scrub-indicator')).toBeNull();
  });

  it('supports aria-pressed selection mode when selectionAttr is aria-pressed', () => {
    const onSelectTab = vi.fn();
    render(
      <EditorialUnderlineTabs
        tabs={sampleTabs}
        activeTab="active"
        onSelectTab={onSelectTab}
        ariaLabel="Pressed filter tabs"
        selectionAttr="aria-pressed"
      />
    );

    expect(screen.getByTestId('tab-active')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('tab-active').querySelector('[data-scrub-chevron="left"]')).toHaveClass('-left-[6px]');
    expect(screen.getByTestId('tab-active').querySelector('[data-scrub-chevron="right"]')).toHaveClass('-right-[6px]');
    expect(screen.getByTestId('tab-all')).toHaveAttribute('aria-pressed', 'false');
    expect(within(screen.getByTestId('tab-all')).getByText('All Items')).toHaveClass('inline-block', 'max-w-[88px]', 'sm:inline');
  });

  it('displays all tab labels inline by default when tabs.length <= 2', () => {
    const onSelectTab = vi.fn();
    render(
      <EditorialUnderlineTabs
        tabs={sampleTabs.slice(0, 2)}
        activeTab="all"
        onSelectTab={onSelectTab}
        ariaLabel="Two-tab section"
      />
    );

    expect(within(screen.getByTestId('tab-all')).getByText('All Items')).toHaveClass('inline');
    expect(within(screen.getByTestId('tab-active')).getByText('Active Items')).toHaveClass('inline');
  });

  describe('recessed-capsule variant', () => {
    it('renders zero-shift fixed grid columns, uniform active/inactive padding, compact mobile labels, and roving keyboard navigation', () => {
      const onSelectTab = vi.fn();
      const capsuleTabs = [
        {
          id: 'profile' as const,
          label: 'Scholar Profile',
          mobileLabel: 'Profile',
          icon: <span data-testid="icon-profile" />,
          buttonId: 'cap-tab-profile',
          ariaControls: 'panel-profile',
          count: 2,
          countVariant: 'amber' as const,
          countTestId: 'badge-profile',
          testId: 'cap-profile',
        },
        {
          id: 'habits' as const,
          label: 'Habits & Accolades',
          mobileLabel: 'Habits',
          icon: <span data-testid="icon-habits" />,
          buttonId: 'cap-tab-habits',
          ariaControls: 'panel-habits',
          count: 0,
          hideZeroCount: true,
          testId: 'cap-habits',
        },
        {
          id: 'prefs' as const,
          label: 'Preferences',
          mobileLabel: 'Prefs',
          icon: <span data-testid="icon-prefs" />,
          buttonId: 'cap-tab-prefs',
          ariaControls: 'panel-prefs',
          testId: 'cap-prefs',
        },
        {
          id: 'security' as const,
          label: 'Security',
          icon: <span data-testid="icon-security" />,
          buttonId: 'cap-tab-security',
          ariaControls: 'panel-security',
          testId: 'cap-security',
        },
      ];

      render(
        <EditorialUnderlineTabs
          variant="recessed-capsule"
          tabs={capsuleTabs}
          activeTab="profile"
          onSelectTab={onSelectTab}
          ariaLabel="Capsule sections"
          useKeyboardNavigation
          capsuleTestId="custom-capsule"
        />
      );

      const tablist = screen.getByRole('tablist', { name: 'Capsule sections' });
      expect(tablist).toHaveAttribute('data-no-swipe', 'true');
      expect(tablist).toHaveClass('relative', 'grid', 'grid-cols-4', 'bg-muted/55', 'rounded-2xl');
      expect(tablist.querySelector('[data-scrub-chevron]')).toBeNull();

      const profileBtn = screen.getByTestId('cap-profile');
      const habitsBtn = screen.getByTestId('cap-habits');
      expect(profileBtn).toHaveClass('w-full', 'min-w-0', 'px-1.5', 'sm:px-2.5', 'md:px-3', 'bg-card', 'border-primary');
      expect(habitsBtn).toHaveClass('w-full', 'min-w-0', 'px-1.5', 'sm:px-2.5', 'md:px-3', 'border-transparent');
      expect(profileBtn).toHaveAttribute('tabIndex', '0');
      expect(habitsBtn).toHaveAttribute('tabIndex', '-1');
      expect(within(profileBtn).getByText('Profile')).toHaveClass('md:hidden');
      expect(within(profileBtn).getByText('Scholar Profile')).toHaveClass('hidden', 'md:inline');
      expect(screen.getByTestId('badge-profile')).toHaveClass('bg-amber-500', 'text-white');

      // Keyboard navigation moves right & wraps left
      fireEvent.keyDown(tablist, { key: 'ArrowRight' });
      expect(onSelectTab).toHaveBeenCalledWith('habits');
      fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
      expect(onSelectTab).toHaveBeenCalledWith('security');
      // Ignores unrelated keys
      fireEvent.keyDown(tablist, { key: 'Enter' });
      expect(onSelectTab).toHaveBeenCalledTimes(2);
    });

    it('renders inline 2-tab capsule layout, supports aria-pressed & >4 tabs fallback, and glides GPU capsule when measurable', () => {
      const origLeft = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetLeft');
      const origTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop');
      const origWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
      const origHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');

      Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
        configurable: true,
        get(this: HTMLElement) {
          return this.dataset.tabId === 'second' ? 140 : 4;
        },
      });
      Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
        configurable: true,
        get() {
          return 4;
        },
      });
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        get() {
          return 128;
        },
      });
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
        configurable: true,
        get() {
          return 38;
        },
      });

      const onSelectTab = vi.fn();
      const twoTabs = [
        { id: 'first' as const, label: 'Preferences', icon: <span /> },
        {
          id: 'second' as const,
          label: 'Local Habits & Accolades',
          mobileLabel: 'Local Habits',
          icon: <span />,
        },
      ];

      try {
        const { rerender, unmount } = render(
          <EditorialUnderlineTabs
            variant="recessed-capsule"
            tabs={twoTabs}
            activeTab="first"
            onSelectTab={onSelectTab}
            ariaLabel="Inline pair"
            selectionAttr="aria-pressed"
          />
        );

        const pairNav = screen.getByRole('tablist', { name: 'Inline pair' });
        expect(pairNav).toHaveClass('grid-cols-2');
        expect(screen.getByTestId('recessed-tab-active-capsule')).toHaveStyle({
          transform: 'translate3d(4px, 4px, 0)',
          width: '128px',
          height: '38px',
        });

        rerender(
          <EditorialUnderlineTabs
            variant="recessed-capsule"
            tabs={twoTabs}
            activeTab="second"
            onSelectTab={onSelectTab}
            ariaLabel="Inline pair"
            selectionAttr="aria-pressed"
          />
        );

        expect(screen.getByTestId('recessed-tab-active-capsule')).toHaveStyle({
          transform: 'translate3d(140px, 4px, 0)',
        });
        expect(screen.getByRole('tab', { name: 'Local Habits & Accolades' })).toHaveAttribute(
          'aria-pressed',
          'true'
        );

        // 5-tab fallback renders flex track gracefully without grid-cols-4 constraint
        const fiveTabs = ['a', 'b', 'c', 'd', 'e'].map((id) => ({
          id,
          label: `Tab ${id}`,
          icon: <span />,
        }));
        rerender(
          <EditorialUnderlineTabs
            variant="recessed-capsule"
            tabs={fiveTabs}
            activeTab="a"
            onSelectTab={onSelectTab}
            ariaLabel="Five tabs"
          />
        );
        expect(screen.getByRole('tablist', { name: 'Five tabs' })).toHaveClass('flex', 'items-center');

        unmount();
      } finally {
        if (origLeft) Object.defineProperty(HTMLElement.prototype, 'offsetLeft', origLeft);
        if (origTop) Object.defineProperty(HTMLElement.prototype, 'offsetTop', origTop);
        if (origWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', origWidth);
        if (origHeight) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', origHeight);
      }
    });
  });
});

