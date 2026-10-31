import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotebookFilterStrip } from './NotebookFilterStrip';

describe('NotebookFilterStrip', () => {
  it('renders symposium source pills when fellowCount > 0 and triggers source and color filter callbacks', () => {
    const onSelectColor = vi.fn();
    const onSelectSourceFilter = vi.fn();

    render(
      <NotebookFilterStrip
        selectedColor="all"
        onSelectColor={onSelectColor}
        marginaliaSourceFilter="all"
        onSelectSourceFilter={onSelectSourceFilter}
        ownCount={3}
        fellowCount={2}
        pairedAllCount={4}
        sourceFilteredItems={[
          { color: 'yellow' },
          { color: 'amber' },
          { color: 'yellow' },
        ]}
      />
    );

    expect(screen.getByTestId('notebook-source-all')).toHaveTextContent('All Marginalia4');
    expect(screen.getByTestId('notebook-source-mine')).toHaveTextContent('My Marginalia3');
    expect(screen.getByTestId('notebook-source-fellows')).toHaveTextContent("Fellows' Marginalia2");

    fireEvent.click(screen.getByTestId('notebook-source-fellows'));
    expect(onSelectSourceFilter).toHaveBeenCalledWith('fellows');

    fireEvent.click(screen.getByTestId('notebook-filter-yellow'));
    expect(onSelectColor).toHaveBeenCalledWith('yellow');
  });
});

