import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Heart, ExternalLink, BookOpen } from 'lucide-react';
import { SITE_CONFIG } from '@/config/site-config';
import { ROUTES } from '@/config/routes';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-border bg-muted text-foreground pt-12 sm:pt-14 pb-6 sm:pb-8 transition-colors duration-theme">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          
          {/* Col 1: About Brand */}
          <div className="space-y-4">
            <a
              href={SITE_CONFIG.GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 group hover:opacity-90 transition-opacity"
              aria-label="Bookarium GitHub repository"
            >
              <div className="w-7 h-7 rounded bg-primary flex items-center justify-center text-primary-foreground group-hover:scale-105 transition-transform">
                <BookOpen className="w-3.5 h-3.5" />
              </div>
              <span className="text-xl font-serif font-bold text-foreground group-hover:text-primary transition-colors">
                {SITE_CONFIG.LOGO_TEXT}
              </span>
            </a>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed font-sans">
              A high-performance, keyless public domain digital library. Dedicated to free, universal
              access to the world’s greatest literature, philosophy, and timeless works.
            </p>
            <div className="inline-flex items-center gap-1.5 text-xs text-success font-mono font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>100% CC0 Public Domain</span>
            </div>
          </div>

          {/* Col 2: Open Data Sources & Design Foundation */}
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground mb-4 pb-1 border-b border-border">
              Sources & Credits
            </h4>
            <ul className="space-y-2.5 text-xs text-muted-foreground font-mono">
              <li>
                <a
                  href={SITE_CONFIG.PROJECT_GUTENBERG}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  Project Gutenberg Archive <ExternalLink className="w-3 h-3 text-muted-foreground" />
                </a>
              </li>
              <li>
                <a
                  href={SITE_CONFIG.GUTENDEX}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  Gutendex REST API <ExternalLink className="w-3 h-3 text-muted-foreground" />
                </a>
              </li>
              <li>
                <a
                  href={SITE_CONFIG.FIGMA_BOOKSAW}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  Booksaw UI Template (CC BY 4.0) <ExternalLink className="w-3 h-3 text-muted-foreground" />
                </a>
              </li>
              <li>
                <a
                  href={SITE_CONFIG.GOOGLE_ANTIGRAVITY}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  Google Antigravity (AI Co-Engineer) <ExternalLink className="w-3 h-3 text-muted-foreground" />
                </a>
              </li>
              <li className="text-[11px] font-sans text-muted-foreground/80 pt-1 leading-relaxed">
                70,000+ public domain volumes indexed with zero-copyright verification. Editorial UI inspired by Booksaw. Co-engineered with Google Antigravity.
              </li>
            </ul>
          </div>

          {/* Col 3: Popular Genres */}
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground mb-4 pb-1 border-b border-border">
              Preserved Collections
            </h4>
            <ul className="space-y-2.5 text-xs text-muted-foreground font-sans">
              <li>Classical Philosophy & Ethics</li>
              <li>Gothic & Romantic Fiction</li>
              <li>Victorian Poetry & Sonnets</li>
              <li>Enlightenment Science & Astronomy</li>
              <li>Historical Treatises & Speeches</li>
            </ul>
          </div>

          {/* Col 4: Legal & CC0 Manifesto */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground mb-4 pb-1 border-b border-border">
              100% Legal & Open
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed font-sans">
              All books listed in Bookarium are in the public domain worldwide. Zero DRM, no subscriptions, zero user tracking.
            </p>
            <div className="pt-1">
              <Link
                href={ROUTES.PRIVACY}
                className="text-xs font-mono text-foreground hover:text-primary transition-colors inline-flex items-center gap-1 underline-offset-4 hover:underline"
              >
                Privacy & Data Architecture →
              </Link>
            </div>
            <div className="pt-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                Zero API Keys Required • Public Domain Preservation
              </span>
            </div>
          </div>

        </div>

        {/* Bottom Copyright Strip */}
        <div className="mt-8 pt-4 sm:pt-5 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-xs font-mono text-muted-foreground">
          <div>
            © {new Date().getFullYear()}{' '}
            <a
              href={SITE_CONFIG.GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary underline-offset-4 hover:underline transition-colors font-medium text-foreground"
            >
              {SITE_CONFIG.NAME}
            </a>
            . Designed for Literature.
          </div>
          <div className="flex items-center gap-1">
            <span>{SITE_CONFIG.TAGLINE}</span>
            <Heart className="w-3 h-3 text-destructive fill-current ml-1" />
          </div>
        </div>

      </div>
    </footer>
  );
};
