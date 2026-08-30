import React from 'react';
import { ShieldCheck, Heart, ExternalLink } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 py-12 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Col 1: About */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg font-serif font-bold text-stone-900 dark:text-stone-100">
                Bookarium
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-primary-700 dark:text-primary-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                Zero-Copyright
              </span>
            </div>
            <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
              A high-performance, keyless public domain digital library. Dedicated to free, universal
              access to the world’s greatest literature, philosophy, and timeless works.
            </p>
          </div>

          {/* Col 2: Open Data Sources */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-3">
              Open Data Providers
            </h4>
            <ul className="space-y-2 text-sm text-stone-600 dark:text-stone-400">
              <li>
                <a
                  href="https://www.gutenberg.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary-600 transition-colors inline-flex items-center gap-1"
                >
                  Project Gutenberg <ExternalLink className="w-3 h-3 text-stone-400" />
                </a>
              </li>
              <li>
                <a
                  href="https://gutendex.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary-600 transition-colors inline-flex items-center gap-1"
                >
                  Gutendex API <ExternalLink className="w-3 h-3 text-stone-400" />
                </a>
              </li>
              <li>
                <a
                  href="https://standardebooks.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary-600 transition-colors inline-flex items-center gap-1"
                >
                  Standard Ebooks <ExternalLink className="w-3 h-3 text-stone-400" />
                </a>
              </li>
              <li>
                <a
                  href="https://openlibrary.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary-600 transition-colors inline-flex items-center gap-1"
                >
                  Open Library Public Domain <ExternalLink className="w-3 h-3 text-stone-400" />
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Legal Manifesto */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-3">
              100% Legal & Open
            </h4>
            <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed mb-3">
              All books listed in Bookarium are in the public domain in the United States and countries
              where copyright expires 70+ years post-mortem. No DRM, no paywalls, zero tracking.
            </p>
            <div className="text-xs text-stone-400 flex items-center gap-1">
              Crafted with <Heart className="w-3 h-3 text-red-500 fill-current" /> for open culture.
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-stone-200 dark:border-stone-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <p>© {new Date().getFullYear()} Bookarium. Zero Rights Reserved (CC0 Public Domain Dedication).</p>
          <p>Zero API Keys Required • Offline Enabled</p>
        </div>
      </div>
    </footer>
  );
};
