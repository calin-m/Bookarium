import React from 'react';
import Link from 'next/link';
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
import { BackToTop } from '@/components/ui/BackToTop';
import { ROUTES } from '@/config/routes';
import { SITE_CONFIG } from '@/config/site-config';

export default function PrivacyPage() {
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
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 border border-border text-primary text-xs font-mono">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Transparent Data Architecture</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-foreground tracking-tight">
              Privacy & Data Architecture
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground font-sans leading-relaxed">
              Bookarium is engineered with an uncompromising commitment to digital sovereignty: zero advertising networks,
              zero cross-site behavioral profiling, and zero monetization of your reading habits.
            </p>
          </div>
        </div>

        {/* Section Grid */}
        <div className="space-y-6">
          {/* 1. No Ad Tracking & Privacy-First Telemetry */}
          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-border text-primary flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-serif font-semibold text-foreground">
                  1. No Ad Tracking &amp; Privacy-First Telemetry
                </h2>
                <p className="text-xs font-mono text-muted-foreground">GDPR Recital 30, Art. 6(1)(f) &amp; Privacy by Design</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed font-sans pt-1">
              Bookarium does not load Google Analytics, Meta Pixels, Hotjar, tracking beacons, or third-party marketing
              scripts. We do not profile your reading tastes, build behavioral advertising dossiers, or sell information
              to data brokers. Your reading journey is never monetized.
            </p>
            <div className="bg-muted/50 border border-border rounded-xl p-4 text-xs font-sans text-muted-foreground space-y-2.5">
              <p>
                <strong className="text-foreground font-medium">Privacy-First Aggregate Telemetry (Vercel Web Analytics &amp; Speed Insights):</strong> To monitor site reliability, Core Web Vitals, and general catalog reach, Bookarium uses cookie-free Vercel Web Analytics and Speed Insights processed by Vercel Inc. Aggregate page views, referrers, country, browser/device metadata, and performance timings are grouped via an ephemeral cryptographic hash (derived from the incoming request IP, User-Agent, and a daily salt) that is automatically discarded within 24 hours—zero persistent IP tracking, device fingerprinting, or cross-site tracking occurs.
              </p>
              <p>
                <strong className="text-foreground font-medium">Edge Infrastructure, Firewall (WAF) &amp; Security Logging:</strong> Under GDPR Article 6(1)(f) (legitimate infrastructure security interest), edge nodes (Vercel) and endpoint rate limiters transiently inspect request IP addresses for DDoS/WAF mitigation, abuse blocking, and short-lived operational/firewall security logs. Geolocation reads platform-supplied country headers (<code className="font-mono">x-vercel-ip-country</code> / <code className="font-mono">cf-ipcountry</code>) strictly to resolve a two-letter ISO country code without collecting GPS coordinates or storing IP addresses inside cookies. Web fonts are self-hosted at build time via <code className="font-mono">next/font/google</code>, generating zero runtime requests to Google.
              </p>
            </div>
          </section>

          {/* 2. The Cookie Exemption */}
          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-border text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Cookie className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-serif font-semibold text-foreground">
                  2. Why There Is No Cookie Consent Banner
                </h2>
                <p className="text-xs font-mono text-muted-foreground">EU ePrivacy Directive (Article 5(3)) &amp; EDPB Exemption</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed font-sans pt-1">
              Under the European Union ePrivacy Directive and European Data Protection Board (EDPB) guidelines, websites
              are only legally required to display intrusive consent banners when using non-essential, advertising, or
              cross-site tracking cookies. Every cookie stored by Bookarium serves an exempt strictly necessary or
              functional user-interface purpose:
            </p>
            <div className="bg-muted/50 border border-border rounded-xl p-4 text-xs font-sans text-muted-foreground space-y-2.5">
              <p>
                <strong className="text-foreground font-medium">Strictly Necessary Authentication &amp; Session Cookies:</strong> When you sign into your account, Supabase Auth sets encrypted session cookies (<code className="font-mono text-primary font-semibold">sb-*-auth-token</code>, including chunked <code className="font-mono">.0</code>/<code className="font-mono">.1</code> fragments and PKCE sign-in verifiers) alongside a short-lived post-login origin flag (<code className="font-mono text-primary font-semibold">bookarium-client-ip-sync</code>, <code className="font-mono">Max-Age=120 seconds</code>, <code className="font-mono">SameSite=Lax</code>, cleared after session reconciliation). Across visitors, <code className="font-mono text-primary font-semibold">bookarium-auth-hint</code> (<code className="font-mono">SameSite=Lax</code>, <code className="font-mono">Max-Age=30 days</code>) stores only <code className="font-mono">&apos;authenticated&apos;</code> or <code className="font-mono">&apos;guest&apos;</code> so server-rendered navigation avoids flicker.
              </p>
              <p>
                <strong className="text-foreground font-medium">Functional Copyright Jurisdiction Verification:</strong> To ensure regulatory compliance with international public domain copyright statutes (e.g. U.S. 1930 vs. Life+70/80/100 rules), Bookarium sets a non-tracking, functional cookie (<code className="font-mono text-primary font-semibold">bookarium-geo-country</code>, <code className="font-mono">SameSite=Lax</code>, <code className="font-mono">Max-Age=7 days</code>) storing solely your two-letter ISO country code. This functional cookie retains zero personal identifiers, zero IP addresses, and zero browsing history, serving exclusively to withhold copyrighted works in restricted countries. For details on term calculations, consult our{' '}
                <Link
                  href={ROUTES.COPYRIGHT}
                  className="font-medium text-foreground underline-offset-4 hover:underline hover:text-primary transition-colors inline-flex items-center gap-0.5"
                >
                  <span>Copyright & Public Domain Governance</span>
                  <ExternalLink className="w-3 h-3 text-muted-foreground inline" />
                </Link>.
              </p>
              <p>
                <strong className="text-foreground font-medium">Functional Display Preference Cookie:</strong> To prevent white-screen flash on dark or sepia visits, Bookarium sets <code className="font-mono text-primary font-semibold">bookarium-theme-preference</code> (<code className="font-mono">SameSite=Lax</code>, <code className="font-mono">Max-Age=1 year</code>) storing solely your active theme (<code className="font-mono">light</code>, <code className="font-mono">sepia</code>, or <code className="font-mono">dark</code>) so initial HTML renders in your preferred palette.
              </p>
              <p>
                <strong className="text-foreground font-medium">Zero Advertising or Tracking Cookies:</strong> Zero marketing, behavioral, or cross-site tracking cookies are written to your browser. Vercel Web Analytics and Speed Insights operate completely cookie-free, and optional Cloudflare Turnstile verification loads only on authentication forms for anti-bot security tokens without advertising cookies.
              </p>
            </div>
          </section>

          {/* 3. Local-First Storage */}
          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-border text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
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
              Bookarium prioritizes local-first architecture. Your reading preferences, speech narration settings, personal library state, and offline assets are preserved directly on your device:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1.5 font-sans pl-1">
              <li>
                <strong className="text-foreground font-medium">localStorage &amp; sessionStorage:</strong> <code className="font-mono text-primary font-semibold">localStorage</code> persists your active theme, reader typography/brightness/layout, narration voice/rate, bookmarks and reading positions, shelves/favorites/ratings, highlights and margin notes, reading habits/streaks/duration logs, accolades, local catalog quote/passage preview caches (<code className="font-mono">bookarium-quote-enriched-books-v1</code>, <code className="font-mono">bookarium-extracted-passages-v1</code>), fellowship/auth profile state, and reload-safe cleanup markers. Transient <code className="font-mono text-primary font-semibold">sessionStorage</code> keys (<code className="font-mono">bookarium-consumed-recovery</code>, <code className="font-mono">bookarium_auto_heal_attempted</code>) expire automatically when the browser tab closes.
              </li>
              <li>
                <strong className="text-foreground font-medium">IndexedDB &amp; Service Worker Cache Storage:</strong> <code className="font-mono text-primary font-semibold">BookariumOfflineDB</code> caches unabridged public domain texts and covers when you click &ldquo;Download for Offline&rdquo; (<code className="font-mono">offline_books</code>), and automatically caches catalog cover images while browsing (<code className="font-mono">cover_cache</code>, bounded to 300 covers with a 30-day TTL) to prevent redundant origin fetches. Our PWA Service Worker (<code className="font-mono">bookarium-app-shell-v7</code>) stores static app-shell assets for offline navigation while bypassing <code className="font-mono">/api/*</code>, <code className="font-mono">/auth/*</code>, <code className="font-mono">/covers/*</code>, and <code className="font-mono">/og/*</code>.
              </li>
              <li>
                <strong className="text-foreground font-medium">On-Device Web Speech API Narration:</strong> Text-to-speech audio reader functionality runs 100% locally via your browser&apos;s native <code className="font-mono text-primary font-semibold">window.speechSynthesis</code> engine using voices installed in your operating system. Bookarium never records reader voice input, never streams generated audio from remote servers, and never transmits your reading coordinates, notes, or chapter text to external speech intelligence APIs.
              </li>
            </ul>
            <p className="text-xs font-mono text-muted-foreground pt-1">
              This local device data is never transmitted to analytics or advertising networks.
            </p>
          </section>

          {/* 4. Account Data & Cloud Sync */}
          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-border text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
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
              If you choose to create an optional account via email/password, passwordless Magic Link, or Google OAuth, we store data strictly required to synchronize your library and optional social scholar features across devices:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1.5 font-sans pl-1">
              <li>Your email address, salted password hash (for email-password accounts) or Google OAuth identity metadata (when connected), and synced reader/narration preferences.</li>
              <li>Custom bookshelves, favorited book IDs, personal 1–5 star ratings, and reading statuses (<code className="font-mono">bookshelves</code>, <code className="font-mono">bookshelf_items</code>, <code className="font-mono">user_favorites</code>, <code className="font-mono">user_book_curation</code>).</li>
              <li>Cross-device reading positions, chapter progress, passage bookmarks, highlights, and written margin notes (<code className="font-mono">reading_progress</code>, <code className="font-mono">user_annotations</code>).</li>
              <li>Reading habits (annual goals, calendar active dates, total reading and audio-listening duration, completed book counts) and unlocked accolades (<code className="font-mono">user_reading_habits</code>, <code className="font-mono">user_accolades</code>).</li>
              <li>Optional opt-in Public Scholar Profile (<code className="font-mono">/u/&lt;username&gt;</code> and shareable card previews via <code className="font-mono">/api/profiles/card</code>): custom <code className="font-mono">@username</code>, display name, bio, motto book attribution, and per-section public visibility toggles (remaining hidden and marked <code className="font-mono">noindex</code> unless you explicitly enable public visibility).</li>
              <li>Optional Reader Circles &amp; Literary Symposium pacts (<code className="font-mono">reader_circles</code>, <code className="font-mono">symposium_sessions</code>): accepted fellow handles and shared per-book chapter/progress checkpoints visible strictly to connected participants.</li>
              <li>
                Active session metadata maintained natively by Supabase Auth (browser user-agent, session timestamps, and network IP) solely to secure your login state and let you inspect masked network IP and device labels or revoke active sessions from Account Security.
              </li>
            </ul>
          </section>

          {/* 5. User Rights & Self-Service Erasure */}
          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-border text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-serif font-semibold text-foreground">
                  5. Your Rights &amp; Self-Service Data Erasure
                </h2>
                <p className="text-xs font-mono text-muted-foreground">GDPR Articles 15–20 (Access, Rectification &amp; Erasure) &amp; CCPA § 1798.105</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed font-sans pt-1">
              You maintain total dominion over your personal data. Under GDPR, CCPA, and global statutory standards, you can
              inspect and edit your synced account records in Account Settings, or permanently erase your account at any moment.
              If you require assistance accessing data or deleting an account without active inbox access, contact our privacy intake channel where configured below.
            </p>

            {/* Email-Verified 3-Tier Zero-Retention Protocol Callout */}
            <div className="bg-muted/50 border border-border rounded-xl p-4 sm:p-5 space-y-3 text-xs font-sans text-muted-foreground">
              <div className="space-y-1">
                <h3 className="font-mono font-bold uppercase tracking-wider text-foreground text-[11px]">
                  Email-Verified 3-Tier Zero-Retention Erasure Protocol
                </h3>
                <p className="leading-relaxed">
                  To protect your account against unauthorized destruction, session hijacking, or accidental deletion on shared computers, server-side account erasure strictly requires two-step email link verification opened in the same browser where you initiated the request. Dispatching a request sends a one-time confirmation link to your registered email address; your account remains intact until you click the link and confirm on the deletion portal.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="p-3 rounded-lg bg-card border border-border space-y-1">
                  <span className="font-mono font-bold text-foreground block text-[11px]">1. Database Purge</span>
                  <p className="text-[11px] leading-relaxed">
                    Atomic cascading deletion via <code className="font-mono text-primary font-semibold">public.delete_current_user()</code> permanently purges all 11 user tables (bookshelves, shelf items, favorites, ratings &amp; statuses, reading progress &amp; bookmarks, highlights &amp; margin notes, reading habits &amp; streaks, accolades, public profile/handle, and mutual Reader Circle &amp; Symposium links without altering fellow scholars&apos; own libraries), plus authentication credentials and avatar files.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-card border border-border space-y-1">
                  <span className="font-mono font-bold text-foreground block text-[11px]">2. Hardware Teardown</span>
                  <p className="text-[11px] leading-relaxed">
                    Immediately after verified erasure succeeds, client teardown wipes unabridged offline books and cached covers from IndexedDB, resets all persistent Zustand stores, clears cached quote pools and session flags, and resets session cookies on the active device.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-card border border-border space-y-1">
                  <span className="font-mono font-bold text-foreground block text-[11px]">3. Zero Soft Deletes</span>
                  <p className="text-[11px] leading-relaxed">
                    Bookarium enforces immediate zero retention. We maintain zero 30-day holding periods, zero recycling bins, and zero shadow archives. Deletion is instantaneous, synchronous, and irreversible.
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground pt-1 border-t border-border">
                <strong className="text-foreground font-medium">Guest Reader Dominion:</strong> Readers browsing without an account generate zero server-side user records. Local shelves, favorites, bookmarks, highlights, habits, accolades, preferences, and downloaded offline books live strictly on your device and can be deleted item-by-item (on Favorites, Bookshelf including <em>Clear Offline Downloads</em>, Bookmarks, and Notebook), wiped all at once via <strong>Clear All Local Data</strong> on{' '}
                <Link href={ROUTES.ACCOUNT} className="text-primary hover:underline underline-offset-4">
                  /account
                </Link>
                , or cleared through your browser&apos;s site-storage settings.
              </p>
            </div>

            <div className="pt-1 flex flex-wrap items-center gap-4">
              <Link
                href={ROUTES.ACCOUNT + '?tab=security'}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-primary hover:underline underline-offset-4"
              >
                <span>Execute Self-Service Deletion in Account Security</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
              {SITE_CONFIG.LEGAL_CONTACT_FORM ? (
                <a
                  href={SITE_CONFIG.LEGAL_CONTACT_FORM}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-foreground hover:text-primary hover:underline underline-offset-4"
                >
                  <span>Submit Privacy / GDPR Inquiry</span>
                  <ExternalLink className="w-3 h-3 text-muted-foreground" />
                </a>
              ) : null}
            </div>
          </section>

          {/* 6. US & Global Privacy Compliance */}
          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-border text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
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
                  Children&apos;s Online Privacy Protection (COPPA &amp; GDPR Art. 8)
                </h3>
                <p>
                  Bookarium is a dedicated open-access cultural archive. Guest reading operates anonymously with zero account requirement or personal data collection. For optional cloud bookshelf synchronization, account registration is strictly limited to individuals aged 13 or older (or the digital age of consent in their jurisdiction). We do not knowingly collect, solicit, or maintain personal information from children under the age of 13.
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
              <div className="w-10 h-10 rounded-xl bg-zinc-500/10 border border-border text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-serif font-semibold text-foreground">
                  7. Infrastructure Partners
                </h2>
                <p className="text-xs font-mono text-muted-foreground">Data Processors &amp; Content Delivery</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
                <span className="text-xs font-mono font-bold text-foreground block">Vercel Edge Platform</span>
                <p className="text-[11px] text-muted-foreground font-sans">
                  Edge hosting, global CDN, WAF/firewall IP protection, and cookie-free aggregate telemetry (Web Analytics &amp; Speed Insights via 24h ephemeral request hashes).
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
                <span className="text-xs font-mono font-bold text-foreground block">Supabase</span>
                <p className="text-[11px] text-muted-foreground font-sans">
                  Encrypted PostgreSQL database and Email / Magic Link / OAuth authentication with Row Level Security (RLS) across all 14 tables.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
                <span className="text-xs font-mono font-bold text-foreground block">Project Gutenberg</span>
                <p className="text-[11px] text-muted-foreground font-sans">
                  Open-source archive providing unabridged public domain texts and metadata.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
                <span className="text-xs font-mono font-bold text-foreground block">Cloudflare R2 &amp; Turnstile</span>
                <p className="text-[11px] text-muted-foreground font-sans">
                  Self-hosted Cloudflare R2 object storage serving public domain texts/covers via same-origin routes, plus optional Turnstile auth bot protection loaded on login/recovery forms with zero advertising or cross-site tracking cookies.
                </p>
              </div>
            </div>
            <div className="space-y-1.5 text-[11px] text-muted-foreground font-sans pt-1">
              <p>
                <strong className="text-foreground">Project Gutenberg Archive Source:</strong> Unabridged public domain metadata and works originate from Project Gutenberg and are synced offline into Bookarium&apos;s Supabase catalog and private Cloudflare R2 storage so live reader sessions never transmit requests to Gutenberg servers.
              </p>
              <p>
                <strong className="text-foreground">Optional Google OAuth &amp; Self-Hosted Typography:</strong> Google authentication is contacted only if you explicitly choose &ldquo;Continue with Google&rdquo; for sign-in or account linking. Application fonts (<code className="font-mono">Playfair Display</code>, <code className="font-mono">Inter</code>, <code className="font-mono">JetBrains Mono</code>) are bundled at build time via <code className="font-mono">next/font/google</code> with zero runtime browser requests to Google Fonts.
              </p>
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
            Last Updated: November 2026 • 100% CC0 Public Domain Preservation
          </p>
        </div>
      </main>

      <Footer />
      <BackToTop />
    </div>
  );
}

