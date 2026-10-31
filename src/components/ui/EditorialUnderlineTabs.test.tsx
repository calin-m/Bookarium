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
    expect(nav).toHaveClass('touch-pan-y');

    const allTab = screen.getByTestId('tab-all');
    const activeTab = screen.getByTestId('tab-active');
    const emptyTab = screen.getByTestId('tab-empty');

    expect(allTab).toHaveAttribute('aria-selected', 'true');
    expect(activeTab).toHaveAttribute('aria-selected', 'false');
    expect(within(allTab).getByText('All Items')).toHaveClass('inline');
    expect(within(activeTab).getByText('Active Items')).toHaveClass('hidden', 'xl:inline');

    // Count badge visibility and highlight variant
    expect(within(allTab).getByText('12')).toHaveClass('inline-flex');
    expect(within(activeTab).getByText('4')).toHaveClass('hidden', 'sm:inline-flex', 'bg-primary');
    // Zero count with hideZeroCount=true is omitted
    expect(within(emptyTab).queryByText('0')).not.toBeInTheDocument();

    fireEvent.click(activeTab);
    expect(onSelectTab).toHaveBeenCalledWith('active');
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
    expect(screen.getByTestId('tab-all')).toHaveAttribute('aria-pressed', 'false');
  });
});

