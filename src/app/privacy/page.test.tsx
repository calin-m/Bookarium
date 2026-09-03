import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PrivacyPage from './page';
import { ROUTES } from '@/config/routes';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('@/components/presentation/Footer', () => ({
  Footer: () => <footer data-testid="mock-footer">Mock Footer</footer>,
}));

describe('PrivacyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header and architectural manifesto', () => {
    render(<PrivacyPage />);

    expect(screen.getByRole('heading', { level: 1, name: /Privacy & Data Architecture/i })).toBeInTheDocument();
    expect(screen.getByText(/Transparent Data Architecture/i)).toBeInTheDocument();
    expect(screen.getByText(/zero tracking, zero marketing networks/i)).toBeInTheDocument();
  });

  it('renders all core GDPR and ePrivacy disclosure sections', () => {
    render(<PrivacyPage />);

    // Section 1: Zero tracking
    expect(screen.getByText(/1\. Zero Tracking & No Ad Networks/i)).toBeInTheDocument();
    expect(screen.getByText(/Bookarium does not load Google Analytics, Meta Pixels/i)).toBeInTheDocument();

    // Section 2: Cookie Exemption
    expect(screen.getByText(/2\. Why There Is No Cookie Consent Banner/i)).toBeInTheDocument();
    expect(screen.getByText(/Strictly Necessary Cookies Only/i)).toBeInTheDocument();
    expect(screen.getByText(/sb-\*-auth-token/i)).toBeInTheDocument();

    // Section 3: Local-First Storage
    expect(screen.getByText(/3\. Local-First Browser Storage/i)).toBeInTheDocument();
    expect(screen.getByText(/localStorage:/i)).toBeInTheDocument();
    expect(screen.getByText(/IndexedDB:/i)).toBeInTheDocument();

    // Section 4: Account Data & Cloud Sync
    expect(screen.getByText(/4\. Cloud Sync & Account Data/i)).toBeInTheDocument();
    expect(screen.getByText(/GDPR Article 6\(1\)\(b\)/i)).toBeInTheDocument();

    // Section 5: User Rights & Self-Service Erasure
    expect(screen.getByText(/5\. Your Rights & Self-Service Data Erasure/i)).toBeInTheDocument();
    expect(screen.getByText(/GDPR Articles 15–20/i)).toBeInTheDocument();

    // Section 6: US & Global Privacy Frameworks
    expect(screen.getByText(/6\. United States & Global Privacy Frameworks/i)).toBeInTheDocument();
    expect(screen.getByText(/California Consumer Privacy Act/i)).toBeInTheDocument();
    expect(screen.getByText(/Do Not Sell or Share My Personal Information:/i)).toBeInTheDocument();
    expect(screen.getByText(/Children's Online Privacy Protection \(COPPA\)/i)).toBeInTheDocument();
    expect(screen.getByText(/United Kingdom \(UK GDPR\) & International Parity/i)).toBeInTheDocument();

    // Section 7: Infrastructure Partners
    expect(screen.getByText(/7\. Infrastructure Partners/i)).toBeInTheDocument();
    expect(screen.getByText(/Vercel Edge Platform/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Supabase/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Project Gutenberg/i).length).toBeGreaterThanOrEqual(1);
  });

  it('provides working navigation links to catalog and account settings', () => {
    render(<PrivacyPage />);

    const backLink = screen.getByRole('link', { name: /Back to Catalog/i });
    expect(backLink).toHaveAttribute('href', ROUTES.HOME);

    const accountLink = screen.getByRole('link', { name: /Manage account & self-service data erasure/i });
    expect(accountLink).toHaveAttribute('href', ROUTES.ACCOUNT);
  });

  it('handles Navbar view change callback by navigating via router', () => {
    render(<PrivacyPage />);

    const bookshelfBtn = screen.getByLabelText('Bookshelf');
    fireEvent.click(bookshelfBtn);

    expect(mockPush).toHaveBeenCalledWith(ROUTES.BOOKSHELF);
  });
});
