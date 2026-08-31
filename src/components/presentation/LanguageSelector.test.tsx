import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { LanguageSelector } from './LanguageSelector';
import { CATALOG_LANGUAGES } from '@/config/catalog-filters';

describe('LanguageSelector component', () => {
  it('renders compact inline variant with Globe icon and label', () => {
    const handleChange = vi.fn();
    render(
      <LanguageSelector
        variant="compact"
        value=""
        onChange={handleChange}
        dataTestId="test-lang-select"
      />
    );

    expect(screen.getByText('Language:')).toBeInTheDocument();
    const select = screen.getByTestId('test-lang-select');
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Romanian/i })).toBeInTheDocument();
  });

  it('renders full width variant without inline wrapper', () => {
    const handleChange = vi.fn();
    render(
      <LanguageSelector
        variant="full"
        value="fr"
        onChange={handleChange}
        dataTestId="full-lang-select"
      />
    );

    expect(screen.queryByText('Language:')).not.toBeInTheDocument();
    const select = screen.getByTestId('full-lang-select');
    expect(select).toHaveValue('fr');
  });

  it('triggers onChange with selected language code', () => {
    const handleChange = vi.fn();
    render(
      <LanguageSelector
        variant="compact"
        value="en"
        onChange={handleChange}
        dataTestId="interactive-lang-select"
      />
    );

    const select = screen.getByTestId('interactive-lang-select');
    fireEvent.change(select, { target: { value: 'de' } });

    expect(handleChange).toHaveBeenCalledWith('de');
  });

  it('contains all 12 supported public domain languages', () => {
    render(<LanguageSelector variant="full" value="" />);

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(CATALOG_LANGUAGES.length);
  });
});

