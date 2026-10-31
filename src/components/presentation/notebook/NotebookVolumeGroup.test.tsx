import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotebookVolumeGroup } from './NotebookVolumeGroup';

describe('NotebookVolumeGroup', () => {
  const sampleGroup = {
    bookId: 1342,
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    isRestricted: false,
    country: 'US',
    items: [{ id: 'q1', text: 'First quote' }],
  };

  it('renders volume header, quote count, and invokes onOpenVolume when accessible', () => {
    const onOpenVolume = vi.fn();
    render(
      <NotebookVolumeGroup
        group={sampleGroup}
        isUnavailableOffline={false}
        onOpenVolume={onOpenVolume}
        renderQuoteCard={(item) => <div key={item.id}>{item.text}</div>}
      />
    );

    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    expect(screen.getByText('by Jane Austen')).toBeInTheDocument();
    expect(screen.getByText('1 quote')).toBeInTheDocument();
    expect(screen.getByText('First quote')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Pride and Prejudice'));
    expect(onOpenVolume).toHaveBeenCalledWith(1342);
  });

  it('renders Not Downloaded or Protected badges and blocks onOpenVolume when restricted or offline', () => {
    const onOpenVolume = vi.fn();
    const { rerender } = render(
      <NotebookVolumeGroup
        group={sampleGroup}
        isUnavailableOffline={true}
        onOpenVolume={onOpenVolume}
        renderQuoteCard={(item) => <div key={item.id}>{item.text}</div>}
      />
    );

    expect(screen.getByTestId('notebook-volume-offline-badge-1342')).toHaveTextContent(
      'Not Downloaded'
    );
    fireEvent.click(screen.getByText('Pride and Prejudice'));
    expect(onOpenVolume).not.toHaveBeenCalled();

    rerender(
      <NotebookVolumeGroup
        group={{ ...sampleGroup, isRestricted: true, country: 'DE' }}
        isUnavailableOffline={false}
        onOpenVolume={onOpenVolume}
        renderQuoteCard={(item) => <div key={item.id}>{item.text}</div>}
      />
    );
    expect(screen.getByText('Protected (DE)')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Pride and Prejudice'));
    expect(onOpenVolume).not.toHaveBeenCalled();
  });
});

