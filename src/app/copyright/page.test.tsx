import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CopyrightPage from './page';
import { ROUTES } from '@/config/routes';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/copyright',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/presentation/Footer', () => ({
  Footer: () => <footer data-testid="mock-footer">Mock Footer</footer>,
}));

describe('CopyrightPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header, badge, and back link to catalog', () => {
    render(<CopyrightPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: /Copyright & Public Domain Governance/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Public Domain & Legal Governance/i)).toBeInTheDocument();

    const backLink = screen.getByRole('link', { name: /Back to Catalog/i });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', ROUTES.HOME);
  });

  it('renders Section 1: 100% CC0 & Public Domain Manifesto', () => {
    render(<CopyrightPage />);

    expect(screen.getByText(/1\. 100% CC0 & Public Domain Manifesto/i)).toBeInTheDocument();
    expect(screen.getByText(/copyright=false/i)).toBeInTheDocument();
    expect(screen.getByText(/Universal Reading Liberty:/i)).toBeInTheDocument();
  });

  it('renders Section 2: Multi-Jurisdiction Legal Matrix with Berne Convention rules', () => {
    render(<CopyrightPage />);

    expect(screen.getByText(/2\. Multi-Jurisdiction Copyright Matrix/i)).toBeInTheDocument();
    expect(screen.getByText(/United States \(Pre-1930 \/ 95 Years\)/i)).toBeInTheDocument();
    expect(screen.getByText(/European Union & UK \(Life \+ 70\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Extended Life: Colombia & Spain \(Life \+ 80\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Extended Life: Mexico \(Life \+ 100\)/i)).toBeInTheDocument();

    // Joint authorship and translations
    expect(screen.getByText(/Joint Authorship \(Berne Convention Art\. 7bis\):/i)).toBeInTheDocument();
    expect(screen.getByText(/Translations & Derivative Works \(Berne Convention Art\. 2\(3\)\):/i)).toBeInTheDocument();
  });

  it('renders Section 3: Project Gutenberg Compliance and policy links', () => {
    render(<CopyrightPage />);

    expect(screen.getByText(/3\. Project Gutenberg Archive Compliance/i)).toBeInTheDocument();

    const robotAccessLink = screen.getByRole('link', { name: /Robot Access Policy/i });
    expect(robotAccessLink).toHaveAttribute('href', 'https://www.gutenberg.org/policy/robot_access.html');

    const termsOfUseLink = screen.getByRole('link', { name: /Terms of Use/i });
    expect(termsOfUseLink).toHaveAttribute('href', 'https://www.gutenberg.org/policy/terms_of_use.html');

    expect(screen.getByText(/Zero Automated Scraping:/i)).toBeInTheDocument();
    expect(screen.getByText(/Decoupled Architecture:/i)).toBeInTheDocument();
    expect(screen.getByText(/Bandwidth Shielding & Edge Caching:/i)).toBeInTheDocument();
    expect(screen.getByText(/pg_catalog\.csv\.gz/i)).toBeInTheDocument();
  });

  it('renders Section 4: HTTP 451, geolocation, and fail-closed heuristics', () => {
    render(<CopyrightPage />);

    expect(screen.getByText(/4\. HTTP 451: Unavailable For Legal Reasons/i)).toBeInTheDocument();
    expect(screen.getByText(/Privacy-First Functional Verification:/i)).toBeInTheDocument();
    expect(screen.getByText(/bookarium-geo-country/i)).toBeInTheDocument();
    expect(screen.getByText(/Fail-Closed Longevity Heuristic:/i)).toBeInTheDocument();
  });

  it('renders Section 5: Notice & Takedown Protocol with GitHub issue tracker link', () => {
    render(<CopyrightPage />);

    expect(screen.getByText(/5\. Notice & Takedown Protocol/i)).toBeInTheDocument();

    const issueLink = screen.getByRole('link', { name: /GitHub Repository Issue Tracker/i });
    expect(issueLink).toBeInTheDocument();
    expect(issueLink).toHaveAttribute('target', '_blank');
    expect(issueLink.getAttribute('href')).toContain('/issues');
  });

  it('renders Section 6: Open Cultural Preservation Partners and footer', () => {
    render(<CopyrightPage />);

    expect(screen.getByText(/6\. Open Cultural Preservation Partners/i)).toBeInTheDocument();
    expect(screen.getByText('Gutendex')).toBeInTheDocument();
    expect(screen.getByText('Standard Ebooks')).toBeInTheDocument();
    expect(screen.getByTestId('mock-footer')).toBeInTheDocument();
  });

  it('handles navigation actions from Navbar', () => {
    render(<CopyrightPage />);

    const bookshelfButtons = screen.getAllByRole('button', { name: /bookshelf/i });
    if (bookshelfButtons.length > 0) {
      fireEvent.click(bookshelfButtons[0]);
      expect(mockPush).toHaveBeenCalledWith(ROUTES.BOOKSHELF);
    }
  });
});

