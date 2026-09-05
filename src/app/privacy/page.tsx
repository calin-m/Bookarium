'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Cookie,
  HardDrive,
  Cloud,
  UserCheck,
  Server,
  ArrowLeft,
  ExternalLink,
  BookOpen,
  Globe,
} from 'lucide-react';
import { Navbar } from '@/components/presentation/Navbar';
import { Footer } from '@/components/presentation/Footer';
import { ROUTES } from '@/config/routes';
import { SITE_CONFIG } from '@/config/site-config';

export default function PrivacyPage() {
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
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Transparent Data Architecture</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-foreground tracking-tight">
              Privacy & Data Architecture
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground font-sans leading-relaxed">
              Bookarium is engineered with an uncompromising commitment to digital sovereignty: zero tracking,
              zero marketing networks, and zero monetization of your reading habits.
            </p>
          </div>
        </div>

        {/* Section Grid */}
        <div className="space-y-6">
          {/* 1. Zero Tracking Manifesto */}
          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-serif font-semibold text-foreground">
                  1. Zero Tracking & No Ad Networks
                </h2>
                <p className="text-xs font-mono text-muted-foreground">GDPR Recital 30 & Privacy by Design</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed font-sans pt-1">
              Bookarium does not load Google Analytics, Meta Pixels, Hotjar, tracking beacons, or third-party marketing
              scripts. We do not profile your reading tastes, build behavioral advertising dossiers, or sell information
              to data brokers. Your reading journey is strictly private.
            </p>
            <div className="bg-muted/50 border border-border rounded-xl p-4 text-xs font-sans text-muted-foreground space-y-2">
              <p>
                <strong className="text-foreground font-medium">Privacy-First Aggregate Telemetry:</strong> To monitor system reliability and understand general catalog reach, Bookarium utilizes first-party, cookie-less Vercel Web Analytics and Real User Speed Insights. Telemetry is strictly anonymous and aggregate—no IP addresses are stored, no persistent device fingerprints are collected, and no cross-site tracking occurs.
              </p>
            </div>
          </section>

          {/* 2. The Cookie Exemption */}
          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Cookie className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-serif font-semibold text-foreground">
                  2. Why There Is No Cookie Consent Banner
                </h2>
                <p className="text-xs font-mono text-muted-foreground">EU ePrivacy Directive (Article 5(3)) Exemption</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed font-sans pt-1">
              Under the European Union ePrivacy Directive and European Data Protection Board (EDPB) guidelines, websites
              are only legally required to display intrusive consent banners when using non-essential or advertising
              cookies.
            </p>
            <div className="bg-muted/50 border border-border rounded-xl p-4 text-xs font-sans text-muted-foreground space-y-2">
              <p>
                <strong className="text-foreground font-medium">Strictly Necessary Cookies Only:</strong> When you
                explicitly log into your account, our authentication provider (Supabase) sets a single secure session
                cookie (<code className="font-mono text-primary font-semibold">sb-*-auth-token</code>) solely to maintain
                your authenticated session. This cookie is 100% exempt from consent banner requirements.
              </p>
              <p>
                As a guest reader, <strong className="text-foreground font-medium">zero tracking cookies</strong> are written to
                your browser. First-party aggregate analytics and Core Web Vitals operate completely cookie-free.
              </p>
            </div>
          </section>

          {/* 3. Local-First Storage */}
          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-serif font-semibold text-foreground">
                  3. Local-First Browser Storage
                </h2>
                <p className="text-xs font-mono text-muted-foreground">Client-Side Persistence</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed font-sans pt-1">
              Bookarium prioritizes local-first architecture. Your reading preferences and offline library are preserved
              directly on your device:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1.5 font-sans pl-1">
              <li>
                <strong className="text-foreground font-medium">localStorage:</strong> Stores your active theme
                (Dark, Light, Sepia), reader typography choices (font size, line height, font family), audio speech
                rate, and local guest bookmarks.
              </li>
              <li>
                <strong className="text-foreground font-medium">IndexedDB:</strong> Caches unabridged public domain text
                and EPUB packages when you click &ldquo;Download for Offline&rdquo;, allowing seamless in-browser reading
                even without an internet connection.
              </li>
            </ul>
            <p className="text-xs font-mono text-muted-foreground pt-1">
              This data resides exclusively on your hardware and is never transmitted to analytics providers.
            </p>
          </section>

          {/* 4. Account Data & Cloud Sync */}
          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-serif font-semibold text-foreground">
                  4. Cloud Sync & Account Data
                </h2>
                <p className="text-xs font-mono text-muted-foreground">GDPR Article 6(1)(b) (Performance of Service)</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed font-sans pt-1">
              If you choose to create an optional account, we store minimal data strictly necessary to fulfill your request
              to access your curated library across devices:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 font-sans pl-1">
              <li>Your email address and cryptographically salted password hash (handled by Supabase Auth).</li>
              <li>Optional public display name and preferred reading atmosphere.</li>
              <li>The IDs of books you have saved to your personal custom shelves or favorites list.</li>
            </ul>
          </section>

          {/* 5. User Rights & Self-Service Erasure */}
          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-serif font-semibold text-foreground">
                  5. Your Rights & Self-Service Data Erasure
                </h2>
                <p className="text-xs font-mono text-muted-foreground">GDPR Articles 15–20 (Right to Erasure)</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed font-sans pt-1">
              You maintain total dominion over your personal data. Under GDPR and global privacy standards, you have the
              right to access, rectify, export, and completely delete your account at any moment.
            </p>
            <div className="pt-2">
              <Link
                href={ROUTES.ACCOUNT}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-primary hover:underline underline-offset-4"
              >
                <span>Manage account & self-service data erasure in Account Settings</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </section>

          {/* 6. US & Global Privacy Compliance */}
          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-serif font-semibold text-foreground">
                  6. United States &amp; Global Privacy Frameworks
                </h2>
                <p className="text-xs font-mono text-muted-foreground">California CCPA/CPRA, COPPA, UK GDPR &amp; Canada PIPEDA</p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed font-sans pt-1">
              <div className="space-y-1">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
                  California Consumer Privacy Act (CCPA / CPRA)
                </h3>
                <p>
                  <strong className="text-foreground font-medium">Do Not Sell or Share My Personal Information:</strong> Bookarium
                  does not sell, rent, release, disclose, or transfer personal data to third parties for monetary or other
                  valuable consideration, nor do we share information for cross-context behavioral advertising (Cal. Civ. Code § 1798.120).
                </p>
                <p>
                  <strong className="text-foreground font-medium">Non-Discrimination:</strong> We will never discriminate, charge
                  different rates, or deny library services to any reader who exercises their statutory privacy rights.
                </p>
              </div>

              <div className="space-y-1 pt-1">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
                  Children&apos;s Online Privacy Protection (COPPA)
                </h3>
                <p>
                  Bookarium is a dedicated open-access cultural archive. We do not knowingly collect, solicit, or maintain personal
                  information from children under the age of 13.
                </p>
              </div>

              <div className="space-y-1 pt-1">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
                  United Kingdom (UK GDPR) &amp; International Parity
                </h3>
                <p>
                  Readers in the United Kingdom, Canada (PIPEDA), Brazil (LGPD), Australia, and worldwide receive the same uncompromising
                  standard of privacy protection: zero behavioral profiling, strictly necessary session cookies, and self-service account deletion.
                </p>
              </div>
            </div>
          </section>

          {/* 7. Infrastructure Partners */}
          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-serif font-semibold text-foreground">
                  7. Infrastructure Partners
                </h2>
                <p className="text-xs font-mono text-muted-foreground">Data Processors &amp; Content Delivery</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
                <span className="text-xs font-mono font-bold text-foreground block">Vercel Edge Platform</span>
                <p className="text-[11px] text-muted-foreground font-sans">
                  Edge hosting, global CDN, and cookie-less aggregate performance telemetry (Vercel Web Analytics &amp; Speed Insights).
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
                <span className="text-xs font-mono font-bold text-foreground block">Supabase</span>
                <p className="text-[11px] text-muted-foreground font-sans">
                  Encrypted PostgreSQL database and authentication with Row Level Security (RLS).
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
                <span className="text-xs font-mono font-bold text-foreground block">Project Gutenberg</span>
                <p className="text-[11px] text-muted-foreground font-sans">
                  Open-source archive providing unabridged public domain texts and metadata.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Closing Guarantee */}
        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-muted-foreground">
          <div className="inline-flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <span>{SITE_CONFIG.NAME} • Public Domain Digital Library</span>
          </div>
          <p className="text-[11px] text-muted-foreground/80">
            Last Updated: March 2026 • 100% CC0 Public Domain Preservation
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}

