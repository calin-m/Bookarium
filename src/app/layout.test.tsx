import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import RootLayout, { metadata } from './layout';

describe('RootLayout', () => {
  it('should expose valid metadata', () => {
    expect(metadata.title).toContain('Bookarium');
    expect(metadata.description).toBeDefined();
  });

  it('should render children within html structure', () => {
    render(
      <RootLayout>
        <div data-testid="layout-children">Layout App</div>
      </RootLayout>
    );

    expect(screen.getByTestId('layout-children')).toBeInTheDocument();
  });
});

