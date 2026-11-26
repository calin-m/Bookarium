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
          { color: 'sky' },
          { color: 'lavender' },
          { color: 'indigo' },
        ]}
      />
    );

    const strip = screen.getByTestId('notebook-color-tabs');
    expect(strip).toHaveClass('w-fit', 'max-w-full', 'select-none');
    expect(strip).not.toHaveClass('cursor-grab');

    expect(screen.getByTestId('notebook-source-all')).toHaveTextContent('All Marginalia4');
    expect(screen.getByTestId('notebook-source-mine')).toHaveTextContent('My Marginalia3');
    expect(screen.getByTestId('notebook-source-fellows')).toHaveTextContent("Fellows' Marginalia2");
    expect(screen.getByTestId('notebook-filter-sky')).toHaveTextContent('Sky1');
    expect(screen.getByTestId('notebook-filter-lavender')).toHaveTextContent('Lavender1');
    expect(screen.getByTestId('notebook-filter-indigo')).toHaveTextContent('Indigo1');

    fireEvent.click(screen.getByTestId('notebook-source-fellows'));
    expect(onSelectSourceFilter).toHaveBeenCalledWith('fellows');

    fireEvent.click(screen.getByTestId('notebook-filter-indigo'));
    expect(onSelectColor).toHaveBeenCalledWith('indigo');
  });
});

