import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Providers } from './providers';

describe('Providers component', () => {
  it('should render children within QueryClientProvider', () => {
    render(
      <Providers>
        <div>Child Content</div>
      </Providers>
    );

    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });
});

