import React from 'react';
import Link from 'next/link';
import {
  Scale,
  Globe,
  ShieldCheck,
  FileText,
  BookOpen,
  Server,
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { Navbar } from '@/components/presentation/Navbar';
import { Footer } from '@/components/presentation/Footer';
import { BackToTop } from '@/components/ui/BackToTop';
import { ROUTES } from '@/config/routes';
import { SITE_CONFIG } from '@/config/site-config';

export default function CopyrightPage() {
  return (
    <div className="min-h-dvh flex flex-col justify-between bg-background text-foreground transition-colors duration-theme">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
        {/* Back Link & Header */}
        <div className="space-y-4">
          <Link
            href={ROUTES.HOME}
            className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Catalog</span>
          </Link>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono">
              <Scale className="w-3.5 h-3.5" />
              <span>Public Domain &amp; Legal Governance</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-foreground tracking-tight">
              Copyright &amp; Public Domain Governance
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground font-sans leading-relaxed">
              Bookarium is engineered with an unwavering commitment to cultural preservation and international copyright compliance: 100% public domain literature, multi-jurisdiction legal clearance, and strict adherence to Project Gutenberg policies.
            </p>
          </div>
        </div>

        {/* Section Grid */}
        <div className="space-y-6">
          {/* 1. CC0 & Public Domain Manifesto */}
          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-serif font-semibold text-foreground">
                  1. 100% CC0 &amp; Public Domain Manifesto
                </h2>
                <p className="text-xs font-mono text-muted-foreground">Universal Cultural Heritage &amp; Zero DRM</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed font-sans pt-1">
              Every volume presented to readers on Bookarium belongs to the public domain. While our catalog index tracks per-entry rights metadata to block copyrighted entries at the API boundary, we strictly query, display, quote, and serve only volumes verified with{' '}
              <code className="font-mono text-primary font-semibold">copyright=false</code> and cleared in your jurisdiction. There are zero digital rights management (DRM) restrictions, zero paywalls, zero advertisements, and zero reader subscriptions.
            </p>
            <div className="bg-muted/50 border border-border rounded-xl p-4 text-xs font-sans text-muted-foreground space-y-2">
              <p>
                <strong className="text-foreground font-medium">Universal Reading Liberty:</strong> You are free to read, download, annotate, research, and format these masterworks across all devices. Literature that has entered the public domain belongs collectively to all humankind.
              </p>
            </div>
          </section>

          {/* 2. Multi-Jurisdictional Legal Matrix */}
          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-serif font-semibold text-foreground">
                  2. Multi-Jurisdiction Copyright Matrix
                </h2>
                <p className="text-xs font-mono text-muted-foreground">Berne Convention &amp; Territorial Duration Rules</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed font-sans">
              Under the <strong className="text-foreground font-medium">Berne Convention for the Protection of Literary and Artistic Works</strong>, copyright protection is strictly territorial. A work that is in the public domain in one nation may still be subject to statutory protection in another:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-1.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-xs font-mono font-bold text-foreground">United States &amp; Territories (Pre-1930 / 95 Years)</span>
                </div>
                <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                  Project Gutenberg operates under United States copyright law, shared across US territories (<code className="font-mono">PR, VI, GU, AS, MP</code>). Pre-1978 published works enter the US public domain 95 years after original publication; titles published before January 1, 1930 are in the US public domain.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-1.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-xs font-mono font-bold text-foreground">European Union, UK &amp; International Default (Life + 70)</span>
                </div>
                <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                  Directive 2006/116/EC (and UK, Canada, Australia, New Zealand, Japan, Brazil, and other mapped laws) enforces author&apos;s life plus 70 calendar years, expiring January 1 after the 70th death anniversary. Bookarium also applies <code className="font-mono">Life + 70</code> conservatively across all other unmapped international jurisdictions.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-1.5">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-xs font-mono font-bold text-foreground">Extended Life: Colombia &amp; Spain (Life + 80)</span>
                </div>
                <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                  Colombia enforces an 80-year post-mortem term (and Spain enforces 80 years for authors deceased prior to December 7, 1987). Bookarium conservatively evaluates visitors from Colombia and Spain under <code className="font-mono">Life + 80</code>.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-1.5">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-xs font-mono font-bold text-foreground">Extended Life: Mexico &amp; C&ocirc;te d&apos;Ivoire (Life + 100)</span>
                </div>
                <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                  Mexico and C&ocirc;te d&apos;Ivoire enforce a 100-year post-mortem copyright duration. Protected works remain withheld in these jurisdictions until January 1 following the 100th anniversary of the contributor&apos;s death.
                </p>
              </div>
            </div>

            <div className="bg-muted/50 border border-border rounded-xl p-4 text-xs font-sans text-muted-foreground space-y-2">
              <p>
                <strong className="text-foreground font-medium">Joint Authorship (Berne Convention Art. 7bis):</strong> For collaborative works created by two or more authors, the copyright term is calculated exclusively from the death of the <em>last surviving author</em>.
              </p>
              <p>
                <strong className="text-foreground font-medium">Translations &amp; Derivative Works (Berne Convention Art. 2(3)):</strong> Translations receive independent copyright protection. An ancient classic (e.g. Homer, Dante, or Sun Tzu) is in the worldwide public domain, while a modern translation remains restricted until 70, 80, or 100 years depending on your jurisdiction after the translator&apos;s death. Bookarium parses translator metadata to prevent premature streaming of copyrighted translations.
              </p>
            </div>
          </section>

          {/* 3. Project Gutenberg Policy Compliance */}
          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-serif font-semibold text-foreground">
                  3. Project Gutenberg Archive Compliance
                </h2>
                <p className="text-xs font-mono text-muted-foreground">Robot Access Policy &amp; Terms of Use Adherence</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed font-sans pt-1">
              Bookarium is designed to be an exemplary downstream citizen of the{' '}
              <a
                href={SITE_CONFIG.PROJECT_GUTENBERG}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground font-medium underline-offset-4 hover:underline hover:text-primary transition-colors inline-flex items-center gap-1"
              >
                Project Gutenberg Archive <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </a>
              , strictly abiding by its published{' '}
              <a
                href="https://www.gutenberg.org/policy/robot_access.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground font-medium underline-offset-4 hover:underline hover:text-primary transition-colors inline-flex items-center gap-1"
              >
                Robot Access Policy <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </a>{' '}
              and{' '}
              <a
                href="https://www.gutenberg.org/policy/terms_of_use.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground font-medium underline-offset-4 hover:underline hover:text-primary transition-colors inline-flex items-center gap-1"
              >
                Terms of Use <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </a>:
            </p>

            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 font-sans pl-1">
              <li>
                <strong className="text-foreground font-medium">Zero Live Visitor Traffic to Project Gutenberg:</strong> Runtime reading sessions, cover artwork, and plain-text exports never trigger client, SSR, or API mirror requests against <code className="font-mono text-primary font-semibold">www.gutenberg.org</code> or external mirrors. All public-domain assets are self-hosted and streamed from Bookarium&apos;s private Cloudflare R2 storage and regional Edge CDN.
              </li>
              <li>
                <strong className="text-foreground font-medium">Decoupled Architecture:</strong> All user catalog browsing, keyword searches, and subject facets are served via our dedicated Supabase PostgreSQL catalog and regional Edge cache, completely shielding external origin servers from discovery traffic.
              </li>
              <li>
                <strong className="text-foreground font-medium">Official Bulk Data Feeds &amp; Background `rsync` Architecture:</strong> Scheduled background catalog synchronization runs strictly once per week outside visitor traffic using Project Gutenberg&apos;s official bulk catalog dumps (<code className="font-mono text-primary font-semibold">pg_catalog.csv.gz</code> and <code className="font-mono text-primary font-semibold">rdf-files.tar.bz2</code> from <code className="font-mono">gutenberg.pglaf.org</code> / <code className="font-mono">aleph.gutenberg.org</code>), while plain-text and cover deltas synchronize strictly via targeted multi-host <code className="font-mono">rsync</code> (<code className="font-mono">aleph.gutenberg.org</code> &harr; <code className="font-mono">rsync.ibiblio.org</code>) with zero bulk HTTP asset scraping and <code className="font-mono">&lt;dcterms:rights&gt;</code> global exclusion of copyrighted donations. Quote extraction reads exclusively from Bookarium&apos;s private Cloudflare R2 bucket.
              </li>
              <li>
                <strong className="text-foreground font-medium">Self-Hosted Edge Caching &amp; Browser IndexedDB:</strong> Self-hosted Cloudflare R2 assets are cached at the Vercel Edge CDN (<code className="font-mono">s-maxage=86400</code> for 24h plain texts and OpenGraph cards; <code className="font-mono">s-maxage=2592000</code> for 30d covers). Full-text offline volume downloads (<code className="font-mono">offline_books</code>) in browser IndexedDB are strictly human-initiated per book, while browsed cover thumbnails (<code className="font-mono">cover_cache</code>, bounded to 300 covers / 30-day LRU) and static App Shell resources cache automatically for instant responsiveness.
              </li>
              <li>
                <strong className="text-foreground font-medium">Transparent User-Agent:</strong> Background weekly catalog feed and translation graph requests transmit identifying, email-free headers (<code className="font-mono text-primary font-semibold">{SITE_CONFIG.PUBLIC_USER_AGENT}</code> alongside <code className="font-mono">Bookarium-Catalog-Sync/1.0</code>).
              </li>
              <li>
                <strong className="text-foreground font-medium">Trademark &amp; Non-Commercialization:</strong> Bookarium operates non-commercially for readers with zero advertisements or subscription fees. Bookarium is an independent open-source reader and is not officially affiliated with, sponsored by, or endorsed by Project Gutenberg or the Project Gutenberg Literary Archive Foundation (PGLAF).
              </li>
            </ul>
          </section>

          {/* 4. HTTP 451 & Edge Geolocation */}
          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-serif font-semibold text-foreground">
                  4. HTTP 451: Unavailable For Legal Reasons
                </h2>
                <p className="text-xs font-mono text-muted-foreground">RFC 7725 Territorial Enforcement &amp; Fail-Closed Heuristics</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed font-sans pt-1">
              When an entry carries an active copyright notice in Project Gutenberg metadata (blocked globally, including in the United States) or when a title cleared in the US remains protected in your country (such as an author or translator deceased within local <code className="font-mono">Life+70</code>, <code className="font-mono">Life+80</code>, or <code className="font-mono">Life+100</code> terms), Bookarium halts plain-text streaming (<code className="font-mono">/api/books/content</code>) and dynamic OpenGraph book cards (<code className="font-mono">/api/books/content?type=card</code> and <code className="font-mono">/og/books/[file]</code>) and returns standard{' '}
              <code className="font-mono text-primary font-semibold">HTTP 451: Unavailable For Legal Reasons</code>.
            </p>
            <div className="bg-muted/50 border border-border rounded-xl p-4 text-xs font-sans text-muted-foreground space-y-2">
              <p>
                <strong className="text-foreground font-medium">Privacy-First Functional Verification:</strong> Edge routers inspect platform country headers (<code className="font-mono">CF-IPCountry</code> / <code className="font-mono">x-vercel-ip-country</code>) to set the functional cookie <code className="font-mono text-primary font-semibold">bookarium-geo-country</code> (<code className="font-mono">Max-Age=7 days</code>). Jurisdiction evaluation writes zero IP addresses into cookies or user libraries, collecting zero personal reading profiles; transient Edge WAF and rate-limiter IP security logging is detailed in our{' '}
                <Link
                  href={ROUTES.PRIVACY}
                  className="font-medium text-foreground underline-offset-4 hover:underline hover:text-primary transition-colors"
                >
                  Privacy Architecture
                </Link>
                .
              </p>
              <p>
                <strong className="text-foreground font-medium">Fail-Closed Longevity Heuristic:</strong> If author or translator death dates cannot be verified with mathematical certainty from authoritative national libraries, Bookarium conservatively withholds modern titles in Life+70/80/100 jurisdictions to guarantee zero infringement.
              </p>
            </div>
          </section>

          {/* 5. Notice & Takedown Protocol */}
          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-serif font-semibold text-foreground">
                  5. Notice &amp; Takedown Protocol
                </h2>
                <p className="text-xs font-mono text-muted-foreground">Copyright Holder Inquiries &amp; Rapid Resolution</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed font-sans pt-1">
              Bookarium respects the legitimate rights of authors, translators, and literary estates. If you are a copyright holder or authorized representative and believe that a volume or translation has been made available in a jurisdiction where it remains protected:
            </p>

            {/* Confidential Intake Form Callout */}
            {SITE_CONFIG.LEGAL_CONTACT_FORM ? (
              <div className="p-4 sm:p-5 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-xs font-mono font-bold text-primary uppercase tracking-wider">
                      Official Confidential Intake Portal
                    </span>
                    <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                      Submit notices, DMCA notifications, public domain verification queries, or general inquiries confidentially without creating a public developer account.
                    </p>
                  </div>
                  <a
                    href={SITE_CONFIG.LEGAL_CONTACT_FORM}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium font-sans hover:bg-primary/90 transition-colors shadow-xs shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span>Submit Notice or Inquiry Form</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ) : null}

            <div className="bg-muted/50 border border-border rounded-xl p-4 text-xs font-sans text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">Please provide the following details in your notice:</p>
              <ul className="list-disc list-inside space-y-1 pl-1">
                <li>Identification of the copyrighted work and specific Bookarium/Gutenberg ID.</li>
                <li>Jurisdiction(s) in which copyright is asserted and author/translator date of death.</li>
                <li>Evidence of ownership or legal authorization from the author or estate.</li>
                <li>Your contact name, email address, and physical or electronic signature.</li>
              </ul>
              <p className="pt-1">
                {SITE_CONFIG.LEGAL_CONTACT_FORM ? (
                  <>
                    For confidential inquiries, copyright notices, and estate verification, please use our{' '}
                    <a
                      href={SITE_CONFIG.LEGAL_CONTACT_FORM}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-primary underline-offset-4 hover:underline transition-colors inline-flex items-center gap-1"
                    >
                      Official Intake Form <ExternalLink className="w-3 h-3 text-muted-foreground" />
                    </a>
                    . For open-source technical issues or bug reports, you may also open a ticket on our{' '}
                  </>
                ) : (
                  <>Notices and inquiries may be submitted directly via our{' '}</>
                )}
                <a
                  href={`${SITE_CONFIG.GITHUB_REPO}/issues`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-foreground underline-offset-4 hover:underline hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  GitHub Repository Issue Tracker <ExternalLink className="w-3 h-3 text-muted-foreground" />
                </a>
                . Valid notices are investigated and resolved within 24 to 48 hours.
              </p>
            </div>
          </section>

          {/* 6. Upstream Open Cultural Archives */}
          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-serif font-semibold text-foreground">
                  6. Upstream Open Cultural Archives
                </h2>
                <p className="text-xs font-mono text-muted-foreground">Upstream Archives &amp; Digital Commons</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
                <span className="text-xs font-mono font-bold text-foreground block">Project Gutenberg</span>
                <p className="text-[11px] text-muted-foreground font-sans">
                  The original digital library founded by Michael S. Hart in 1971, curating over 78,000 public domain ebooks. Independent upstream archive with no official affiliation or endorsement.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
                <span className="text-xs font-mono font-bold text-foreground block">Wikidata (CC0 1.0)</span>
                <p className="text-[11px] text-muted-foreground font-sans">
                  Wikimedia&apos;s public-domain SPARQL knowledge graph linking Gutenberg eBook IDs (P2034) across multilingual editions.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Closing Guarantee */}
        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-muted-foreground">
          <div className="inline-flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <span>{SITE_CONFIG.NAME} • 100% CC0 &amp; Public Domain Governance</span>
          </div>
          <p className="text-[11px] text-muted-foreground/80">
            Last Updated: November 2026 • Verified Public Domain Preservation
          </p>
        </div>
      </main>

      <Footer />
      <BackToTop />
    </div>
  );
}

