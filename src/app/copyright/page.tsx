'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { ROUTES } from '@/config/routes';
import { SITE_CONFIG } from '@/config/site-config';

export default function CopyrightPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col justify-between bg-background text-foreground transition-colors duration-theme">
      <Navbar
        onViewChange={(view) => {
          router.push(ROUTES.VIEW(view));
        }}
      />

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
              Every volume indexed in Bookarium is part of the global cultural commons. We strictly query and ingest catalog data with{' '}
              <code className="font-mono text-primary font-semibold">copyright=false</code>. There are zero digital rights management (DRM) restrictions, zero paywalls, zero advertisements, and zero reader subscriptions.
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
                  <span className="text-xs font-mono font-bold text-foreground">United States (Pre-1930 / 95 Years)</span>
                </div>
                <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                  Project Gutenberg operates under United States copyright law. Pre-1978 published works enter the US public domain 95 years after original publication. All titles published before January 1, 1930 are in the US public domain.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-1.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-xs font-mono font-bold text-foreground">European Union &amp; UK (Life + 70)</span>
                </div>
                <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                  Directive 2006/116/EC (and UK/Canada/Australia statutes) establishes copyright for the author&apos;s lifetime plus 70 calendar years, expiring on January 1 following the 70th anniversary of the author&apos;s death.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-1.5">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-xs font-mono font-bold text-foreground">Extended Life: Colombia &amp; Spain (Life + 80)</span>
                </div>
                <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                  Colombia and Spain (for authors deceased prior to December 7, 1987) enforce an 80-year post-mortem protection term. Bookarium respects these extended terms for visitors from these jurisdictions.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-1.5">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-xs font-mono font-bold text-foreground">Extended Life: Mexico (Life + 100)</span>
                </div>
                <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                  Mexico enforces the world&apos;s longest general copyright duration of 100 years post-mortem. Works by authors deceased after 1925 remain protected in Mexico until at least 2026.
                </p>
              </div>
            </div>

            <div className="bg-muted/50 border border-border rounded-xl p-4 text-xs font-sans text-muted-foreground space-y-2">
              <p>
                <strong className="text-foreground font-medium">Joint Authorship (Berne Convention Art. 7bis):</strong> For collaborative works created by two or more authors, the copyright term is calculated exclusively from the death of the <em>last surviving author</em>.
              </p>
              <p>
                <strong className="text-foreground font-medium">Translations &amp; Derivative Works (Berne Convention Art. 2(3)):</strong> Translations receive independent copyright protection. An ancient classic (e.g. Homer, Dante, or Sun Tzu) is in the worldwide public domain, but a modern translation remains restricted until 70 years after the translator&apos;s death. Bookarium parses translator metadata to prevent premature streaming of copyrighted translations.
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
                <strong className="text-foreground font-medium">Zero Automated Scraping:</strong> Bookarium never runs scrapers, spiders, or automated crawlers against <code className="font-mono text-primary font-semibold">www.gutenberg.org</code>.
              </li>
              <li>
                <strong className="text-foreground font-medium">Decoupled Architecture:</strong> All user catalog browsing, keyword searches, and subject facets are served via the Gutendex REST API and our regional Supabase cache, completely shielding Gutenberg origin servers from discovery traffic.
              </li>
              <li>
                <strong className="text-foreground font-medium">Official Bulk Data Feeds:</strong> Catalog indexes are synchronized using Gutenberg&apos;s authorized weekly catalog archives (<code className="font-mono text-primary font-semibold">pg_catalog.csv.gz</code>).
              </li>
              <li>
                <strong className="text-foreground font-medium">Bandwidth Shielding &amp; Edge Caching:</strong> Masterwork text and EPUB packages are cached at the Vercel Edge CDN for 24 hours (<code className="font-mono">s-maxage=86400, stale-while-revalidate=604800</code>) and locally in browser IndexedDB for offline reading. Direct downloads are strictly human-initiated.
              </li>
              <li>
                <strong className="text-foreground font-medium">Transparent User-Agent:</strong> All server-side requests transmit identifying headers (<code className="font-mono text-primary font-semibold">Bookarium/2.5.1 (+https://github.com/calin-m/Bookarium)</code>).
              </li>
              <li>
                <strong className="text-foreground font-medium">Trademark &amp; Non-Commercialization:</strong> Bookarium operates non-commercially with zero advertisements or subscription fees. Bookarium is an independent open-source reader and is not officially affiliated with or endorsed by the Project Gutenberg Literary Archive Foundation (PGLAF).
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
              When a title cleared in the United States remains under copyright protection in your country (such as an author who died between 1956 and 1970 in an EU Life+70 state), Bookarium halts the reader and returns standard{' '}
              <code className="font-mono text-primary font-semibold">HTTP 451: Unavailable For Legal Reasons</code>.
            </p>
            <div className="bg-muted/50 border border-border rounded-xl p-4 text-xs font-sans text-muted-foreground space-y-2">
              <p>
                <strong className="text-foreground font-medium">Privacy-First Functional Verification:</strong> Edge routers inspect non-identifying country headers (<code className="font-mono">CF-IPCountry</code> / <code className="font-mono">x-vercel-ip-country</code>) to set the functional cookie <code className="font-mono text-primary font-semibold">bookarium-geo-country</code>. No IP addresses, user locations, or reading habits are ever logged, tracked, or stored.
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
            <div className="bg-muted/50 border border-border rounded-xl p-4 text-xs font-sans text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">Please provide the following details in your notice:</p>
              <ul className="list-disc list-inside space-y-1 pl-1">
                <li>Identification of the copyrighted work and specific Bookarium/Gutenberg ID.</li>
                <li>Jurisdiction(s) in which copyright is asserted and author/translator date of death.</li>
                <li>Evidence of ownership or legal authorization from the author or estate.</li>
                <li>Your contact name, email address, and physical or electronic signature.</li>
              </ul>
              <p className="pt-1">
                Notices may be submitted directly via our{' '}
                <a
                  href={`${SITE_CONFIG.GITHUB_REPO}/issues`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-foreground underline-offset-4 hover:underline hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  GitHub Repository Issue Tracker <ExternalLink className="w-3 h-3 text-muted-foreground" />
                </a>. Valid notices are investigated and resolved within 24 to 48 hours.
              </p>
            </div>
          </section>

          {/* 6. Open Cultural Preservation Partners */}
          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-serif font-semibold text-foreground">
                  6. Open Cultural Preservation Partners
                </h2>
                <p className="text-xs font-mono text-muted-foreground">Upstream Archives &amp; Digital Commons</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
                <span className="text-xs font-mono font-bold text-foreground block">Project Gutenberg</span>
                <p className="text-[11px] text-muted-foreground font-sans">
                  The original digital library founded by Michael S. Hart in 1971, curating over 70,000 public domain ebooks.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
                <span className="text-xs font-mono font-bold text-foreground block">Gutendex</span>
                <p className="text-[11px] text-muted-foreground font-sans">
                  Open-source REST API providing decoupled, high-performance catalog search and metadata retrieval.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
                <span className="text-xs font-mono font-bold text-foreground block">Standard Ebooks</span>
                <p className="text-[11px] text-muted-foreground font-sans">
                  Volunteer-driven project producing beautifully formatted, modern digital editions of public domain masterworks.
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
            Last Updated: March 2026 • Verified Public Domain Preservation
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}

