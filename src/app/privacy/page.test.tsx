import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PrivacyPage from './page';
import { ROUTES } from '@/config/routes';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/privacy',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/presentation/Footer', () => ({
  Footer: () => <footer data-testid="mock-footer">Mock Footer</footer>,
}));

describe('PrivacyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('scrollTo', vi.fn());
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders page header and architectural manifesto with solid border-border', () => {
    const { container } = render(<PrivacyPage />);

    expect(screen.getByRole('heading', { level: 1, name: /Privacy & Data Architecture/i })).toBeInTheDocument();
    expect(screen.getByText(/Transparent Data Architecture/i)).toBeInTheDocument();
    expect(
      screen.getByText(/zero advertising networks, zero cross-site behavioral profiling/i)
    ).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('border-primary/20');
  });

  it('renders all core GDPR and ePrivacy disclosure sections accurately', () => {
    render(<PrivacyPage />);

    // Section 1: No Ad Tracking & Privacy-First Telemetry
    expect(screen.getByText(/1\. No Ad Tracking & Privacy-First Telemetry/i)).toBeInTheDocument();
    expect(screen.getByText(/Bookarium does not load Google Analytics, Meta Pixels/i)).toBeInTheDocument();
    expect(screen.getByText(/Privacy-First Aggregate Telemetry/i)).toBeInTheDocument();
    expect(screen.getByText(/automatically discarded within 24 hours/i)).toBeInTheDocument();
    expect(screen.getByText(/Edge Infrastructure, Firewall \(WAF\) & Security Logging:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/next\/font\/google/i)).toHaveLength(2);

    // Section 2: Cookie Exemption & Accurate First-Party Cookie Inventory
    expect(screen.getByText(/2\. Why There Is No Cookie Consent Banner/i)).toBeInTheDocument();
    expect(screen.getByText(/Strictly Necessary Authentication & Session Cookies:/i)).toBeInTheDocument();
    expect(screen.getByText(/sb-\*-auth-token/i)).toBeInTheDocument();
    expect(screen.getByText(/bookarium-client-ip-sync/i)).toBeInTheDocument();
    expect(screen.getByText(/bookarium-auth-hint/i)).toBeInTheDocument();
    expect(screen.getByText(/Functional Copyright Jurisdiction Verification:/i)).toBeInTheDocument();
    expect(screen.getByText(/bookarium-geo-country/i)).toBeInTheDocument();
    expect(screen.getByText(/Max-Age=7 days/i)).toBeInTheDocument();
    expect(screen.getByText(/bookarium-theme-preference/i)).toBeInTheDocument();
    expect(screen.getByText(/Zero Advertising or Tracking Cookies:/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Copyright & Public Domain Governance/i })).toHaveAttribute(
      'href',
      ROUTES.COPYRIGHT
    );

    // Section 3: Local-First Storage
    expect(screen.getByText(/3\. Local-First Browser Storage/i)).toBeInTheDocument();
    expect(screen.getByText(/localStorage & sessionStorage:/i)).toBeInTheDocument();
    expect(screen.getByText(/IndexedDB & Service Worker Cache Storage:/i)).toBeInTheDocument();
    expect(screen.getByText(/cover_cache/i)).toBeInTheDocument();
    expect(screen.getByText(/bookarium-app-shell-v7/i)).toBeInTheDocument();
    expect(screen.getByText(/On-Device Web Speech API Narration:/i)).toBeInTheDocument();
    expect(screen.getByText(/window\.speechSynthesis/i)).toBeInTheDocument();
    expect(screen.getByText(/Bookarium never records reader voice input/i)).toBeInTheDocument();

    // Section 4: Account Data, Signup Provisioning & Public vs Private Account Modes
    expect(screen.getByText(/4\. Cloud Sync & Account Data/i)).toBeInTheDocument();
    expect(screen.getByText(/GDPR Article 6\(1\)\(b\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Created on Sign-Up \(Account & Profile Initialization\):/i)).toBeInTheDocument();
    expect(screen.getByText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByText(/display_name/i)).toBeInTheDocument();
    expect(screen.getAllByText(/is_public = false/i)).toHaveLength(2);
    expect(screen.getByText(/Google OAuth identity metadata/i)).toBeInTheDocument();
    expect(screen.getByText(/user_book_curation/i)).toBeInTheDocument();
    expect(screen.getAllByText(/book_id/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/user_annotations/i)).toBeInTheDocument();
    expect(screen.getByText(/symposium_sessions/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Active session metadata maintained natively by Supabase Auth/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/inspect masked network IP and device labels or revoke active sessions/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Private vs\. Public Account Modes \(Private by Default on Sign-Up\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Private Sanctuary \(Default on Sign-Up\)/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Public Scholar Profile \(Opt-In — Where to Change\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Enable Public Scholar Profile/i)).toBeInTheDocument();
    expect(screen.getByText(/Public Shelf/i)).toBeInTheDocument();
    const accountLinks = screen.getAllByRole('link', { name: '/account' });
    expect(accountLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of accountLinks) {
      expect(link).toHaveAttribute('href', ROUTES.ACCOUNT);
    }
    expect(screen.getByRole('link', { name: '/bookshelf' })).toHaveAttribute(
      'href',
      ROUTES.BOOKSHELF
    );

    // Section 5: User Rights & Self-Service Erasure
    expect(screen.getByText(/5\. Your Rights & Self-Service Data Erasure/i)).toBeInTheDocument();
    expect(screen.getByText(/GDPR Articles 15–20/i)).toBeInTheDocument();
    expect(screen.getByText(/Email-Verified 3-Tier Zero-Retention Erasure Protocol/i)).toBeInTheDocument();
    expect(screen.getByText(/1\. Database Purge/i)).toBeInTheDocument();
    expect(screen.getByText(/mutual Reader Circle & Symposium links without altering fellow scholars/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Hardware Teardown/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. Zero Soft Deletes/i)).toBeInTheDocument();
    expect(screen.getByText(/Guest Reader Dominion:/i)).toBeInTheDocument();
    expect(screen.getByText(/Clear Offline Downloads/i)).toBeInTheDocument();
    expect(screen.getByText(/Clear All Local Data/i)).toBeInTheDocument();

    // Section 6: US & Global Privacy Frameworks
    expect(screen.getByText(/6\. United States & Global Privacy Frameworks/i)).toBeInTheDocument();
    expect(screen.getByText(/California Consumer Privacy Act/i)).toBeInTheDocument();
    expect(screen.getByText(/Do Not Sell or Share My Personal Information:/i)).toBeInTheDocument();
    expect(screen.getByText(/Children's Online Privacy Protection \(COPPA & GDPR Art\. 8\)/i)).toBeInTheDocument();
    expect(screen.getByText(/account registration is strictly limited to individuals aged 13 or older/i)).toBeInTheDocument();
    expect(screen.getByText(/United Kingdom \(UK GDPR\) & International Parity/i)).toBeInTheDocument();

    // Section 7: Infrastructure Providers & Open Archives & Date
    expect(screen.getByText(/7\. Infrastructure Providers & Open Archives/i)).toBeInTheDocument();
    expect(screen.queryByText(/7\. Infrastructure Partners/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Vercel Edge Platform/i)).toBeInTheDocument();
    expect(screen.getByText(/24h ephemeral request hashes/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Supabase/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Project Gutenberg/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Cloudflare R2 & Turnstile/i)).toBeInTheDocument();
    expect(screen.getByText(/zero advertising or cross-site tracking cookies/i)).toBeInTheDocument();
    expect(screen.getByText(/Optional Google OAuth & Self-Hosted Typography:/i)).toBeInTheDocument();
    expect(screen.getByText(/Last Updated: November 2026/i)).toBeInTheDocument();
  });

  it('provides working navigation links to catalog and account settings', () => {
    render(<PrivacyPage />);

    const backLink = screen.getByRole('link', { name: /Back to Catalog/i });
    expect(backLink).toHaveAttribute('href', ROUTES.HOME);

    const accountLink = screen.getByRole('link', { name: /Execute Self-Service Deletion in Account Security/i });
    expect(accountLink).toHaveAttribute('href', ROUTES.ACCOUNT + '?tab=security');
  });

  it('handles Navbar view change callback by navigating via router', () => {
    render(<PrivacyPage />);

    const bookshelfBtn = screen.getByLabelText('Bookshelf');
    fireEvent.click(bookshelfBtn);

    expect(mockPush).toHaveBeenCalledWith(ROUTES.BOOKSHELF);
  });

  it('renders BackToTop button upon scrolling past threshold and triggers smooth scroll to top', () => {
    render(<PrivacyPage />);

    expect(screen.queryByRole('button', { name: /Back to top/i })).not.toBeInTheDocument();

    window.scrollY = 400;
    fireEvent.scroll(window);

    const backToTopBtn = screen.getByRole('button', { name: /Back to top/i });
    expect(backToTopBtn).toBeInTheDocument();

    fireEvent.click(backToTopBtn);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});
