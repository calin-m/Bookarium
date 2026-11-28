import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CopyrightPage from './page';
import { ROUTES } from '@/config/routes';
import { SITE_CONFIG } from '@/config/site-config';

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
    vi.stubGlobal('scrollTo', vi.fn());
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    expect(screen.getByText(/block copyrighted entries at the API boundary/i)).toBeInTheDocument();
    expect(screen.getByText(/Universal Reading Liberty:/i)).toBeInTheDocument();
  });

  it('renders Section 2: Multi-Jurisdiction Legal Matrix with Berne Convention rules', () => {
    render(<CopyrightPage />);

    expect(screen.getByText(/2\. Multi-Jurisdiction Copyright Matrix/i)).toBeInTheDocument();
    expect(screen.getByText(/United States & Territories \(Pre-1930 \/ 95 Years\)/i)).toBeInTheDocument();
    expect(screen.getByText(/European Union, UK & International Default \(Life \+ 70\)/i)).toBeInTheDocument();
    expect(screen.getByText(/all other unmapped international jurisdictions/i)).toBeInTheDocument();
    expect(screen.getByText(/Extended Life: Colombia & Spain \(Life \+ 80\)/i)).toBeInTheDocument();
    expect(screen.getByText(/conservatively evaluates visitors from Colombia and Spain/i)).toBeInTheDocument();
    expect(screen.getByText(/Extended Life: Mexico & Côte d'Ivoire \(Life \+ 100\)/i)).toBeInTheDocument();
    expect(screen.getByText(/100th anniversary of the contributor's death/i)).toBeInTheDocument();
    expect(screen.queryByText(/until at least 2026/i)).not.toBeInTheDocument();

    // Joint authorship and translations
    expect(screen.getByText(/Joint Authorship \(Berne Convention Art\. 7bis\):/i)).toBeInTheDocument();
    expect(screen.getByText(/Translations & Derivative Works \(Berne Convention Art\. 2\(3\)\):/i)).toBeInTheDocument();
    expect(screen.getByText(/70, 80, or 100 years depending on your jurisdiction/i)).toBeInTheDocument();
  });

  it('renders Section 3: Project Gutenberg Compliance and policy links', () => {
    render(<CopyrightPage />);

    expect(screen.getByText(/3\. Project Gutenberg Archive Compliance/i)).toBeInTheDocument();

    const robotAccessLink = screen.getByRole('link', { name: /Robot Access Policy/i });
    expect(robotAccessLink).toHaveAttribute('href', 'https://www.gutenberg.org/policy/robot_access.html');

    const termsOfUseLink = screen.getByRole('link', { name: /Terms of Use/i });
    expect(termsOfUseLink).toHaveAttribute('href', 'https://www.gutenberg.org/policy/terms_of_use.html');

    expect(screen.getByText(/Zero Live Visitor Traffic to Project Gutenberg:/i)).toBeInTheDocument();
    expect(screen.getByText(/Decoupled Architecture:/i)).toBeInTheDocument();
    expect(screen.getByText(/Self-Hosted Edge Caching & Browser IndexedDB:/i)).toBeInTheDocument();
    expect(screen.getByText(/2592000/)).toBeInTheDocument();
    expect(screen.getByText(/cover_cache/i)).toBeInTheDocument();
    expect(screen.getByText(/300 covers \/ 30-day LRU/i)).toBeInTheDocument();
    expect(screen.getByText(/offline_books/i)).toBeInTheDocument();
    expect(screen.getByText(/Official Bulk Data Feeds & Background Sync:/i)).toBeInTheDocument();
    expect(screen.getByText(/pg_catalog\.csv\.gz/i)).toBeInTheDocument();
    expect(screen.getByText(/rdf-files\.tar\.bz2/i)).toBeInTheDocument();
    expect(screen.getByText(/rsync\.ibiblio\.org/i)).toBeInTheDocument();
    expect(screen.getByText(/gutenberg\.pglaf\.org/i)).toBeInTheDocument();
    expect(screen.getByText(/<dcterms:rights>/i)).toBeInTheDocument();
    expect(screen.getByText(/Bookarium-Catalog-Sync\/1\.0/i)).toBeInTheDocument();
    expect(screen.getByText(/Bookarium-R2-Sync\/1\.0/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /not officially affiliated with, sponsored by, or endorsed by Project Gutenberg or the Project Gutenberg Literary Archive Foundation \(PGLAF\)/i
      )
    ).toBeInTheDocument();
  });

  it('displays the email-free PUBLIC_USER_AGENT dynamically derived from SITE_CONFIG without stale legacy strings', async () => {
    const { SITE_CONFIG } = await import('@/config/site-config');
    render(<CopyrightPage />);

    expect(SITE_CONFIG.PUBLIC_USER_AGENT).toMatch(
      /^Bookarium-PublicDomain-Reader\/1\.0 \(\+https:\/\/[^;)]+\)$/
    );
    expect(screen.getByText(SITE_CONFIG.PUBLIC_USER_AGENT)).toBeInTheDocument();
    expect(screen.queryByText(/Bookarium\/2\.8\.1/i)).not.toBeInTheDocument();
  });

  it('renders Section 4: HTTP 451, geolocation, and fail-closed heuristics', () => {
    render(<CopyrightPage />);

    expect(screen.getByText(/4\. HTTP 451: Unavailable For Legal Reasons/i)).toBeInTheDocument();
    expect(screen.getByText(/blocked globally, including in the United States/i)).toBeInTheDocument();
    expect(screen.getByText(/\/og\/books\/\[file\]/i)).toBeInTheDocument();
    expect(screen.getByText(/Privacy-First Functional Verification:/i)).toBeInTheDocument();
    expect(screen.getByText(/bookarium-geo-country/i)).toBeInTheDocument();
    expect(screen.getByText(/Max-Age=7 days/i)).toBeInTheDocument();
    expect(
      screen.getByText(/writes zero IP addresses into cookies or user libraries/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Privacy Architecture/i })).toHaveAttribute(
      'href',
      ROUTES.PRIVACY
    );
    expect(screen.getByText(/Fail-Closed Longevity Heuristic:/i)).toBeInTheDocument();
  });

  it('renders Section 5: Notice & Takedown Protocol with GitHub tracker fallback when form is unconfigured', () => {
    const originalForm = SITE_CONFIG.LEGAL_CONTACT_FORM;
    (SITE_CONFIG as any).LEGAL_CONTACT_FORM = '';

    render(<CopyrightPage />);

    expect(screen.getByText(/5\. Notice & Takedown Protocol/i)).toBeInTheDocument();
    expect(screen.queryByText(/Official Confidential Intake Portal/i)).not.toBeInTheDocument();

    const issueLink = screen.getByRole('link', { name: /GitHub Repository Issue Tracker/i });
    expect(issueLink).toBeInTheDocument();
    expect(issueLink).toHaveAttribute('target', '_blank');
    expect(issueLink.getAttribute('href')).toContain('/issues');

    (SITE_CONFIG as any).LEGAL_CONTACT_FORM = originalForm;
  });

  it('renders Section 5: Notice & Takedown Protocol with confidential intake portal when configured', () => {
    const originalForm = SITE_CONFIG.LEGAL_CONTACT_FORM;
    const testFormUrl = 'https://docs.google.com/forms/d/e/test-form/viewform';
    (SITE_CONFIG as any).LEGAL_CONTACT_FORM = testFormUrl;

    render(<CopyrightPage />);

    expect(screen.getByText(/5\. Notice & Takedown Protocol/i)).toBeInTheDocument();
    expect(screen.getByText(/Official Confidential Intake Portal/i)).toBeInTheDocument();

    const formButton = screen.getByRole('link', { name: /Submit Notice or Inquiry Form/i });
    expect(formButton).toBeInTheDocument();
    expect(formButton).toHaveAttribute('href', testFormUrl);
    expect(formButton).toHaveAttribute('target', '_blank');

    const formTextLink = screen.getByRole('link', { name: /Official Intake Form/i });
    expect(formTextLink).toBeInTheDocument();
    expect(formTextLink).toHaveAttribute('href', testFormUrl);

    const issueLink = screen.getByRole('link', { name: /GitHub Repository Issue Tracker/i });
    expect(issueLink).toBeInTheDocument();
    expect(issueLink).toHaveAttribute('target', '_blank');
    expect(issueLink.getAttribute('href')).toContain('/issues');

    (SITE_CONFIG as any).LEGAL_CONTACT_FORM = originalForm;
  });

  it('renders Section 6: Upstream Open Cultural Archives and footer', () => {
    render(<CopyrightPage />);

    expect(screen.getByText(/6\. Upstream Open Cultural Archives/i)).toBeInTheDocument();
    expect(screen.queryByText(/Open Cultural Preservation Partners/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Gutendex/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Standard Ebooks/i)).not.toBeInTheDocument();
    expect(screen.getByText('Project Gutenberg')).toBeInTheDocument();
    expect(screen.getByText(/over 78,000 public domain ebooks/i)).toBeInTheDocument();
    expect(screen.getByText(/Independent upstream archive with no official affiliation or endorsement/i)).toBeInTheDocument();
    expect(screen.getByText('Wikidata (CC0 1.0)')).toBeInTheDocument();
    expect(screen.getByText(/Last Updated: November 2026/i)).toBeInTheDocument();
    expect(screen.getByTestId('mock-footer')).toBeInTheDocument();
  });

  it('handles navigation actions from Navbar', () => {
    render(<CopyrightPage />);

    const bookshelfButtons = screen.getAllByRole('button', { name: /bookshelf/i });
    expect(bookshelfButtons.length).toBeGreaterThan(0);
    fireEvent.click(bookshelfButtons[0]);
    expect(mockPush).toHaveBeenCalledWith(ROUTES.BOOKSHELF);
  });

  it('renders BackToTop button upon scrolling past threshold and triggers smooth scroll to top', () => {
    render(<CopyrightPage />);

    expect(screen.queryByRole('button', { name: /Back to top/i })).not.toBeInTheDocument();

    window.scrollY = 400;
    fireEvent.scroll(window);

    const backToTopBtn = screen.getByRole('button', { name: /Back to top/i });
    expect(backToTopBtn).toBeInTheDocument();

    fireEvent.click(backToTopBtn);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});

