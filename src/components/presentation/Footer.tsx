import React from 'react';
import { ShieldCheck, Heart, ExternalLink, BookOpen } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-stone-200/90 dark:border-stone-800 bg-[#f5f3ec] dark:bg-[#0b0e14] py-16 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          
          {/* Col 1: About Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-primary-600 dark:bg-primary-500 flex items-center justify-center text-white">
                <BookOpen className="w-3.5 h-3.5" />
              </div>
              <span className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100">
                BOOKARIUM
              </span>
            </div>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed font-sans">
              A high-performance, keyless public domain digital library. Dedicated to free, universal
              access to the world’s greatest literature, philosophy, and timeless works.
            </p>
            <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-mono font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>100% CC0 Public Domain</span>
            </div>
          </div>

          {/* Col 2: Open Data Sources */}
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-stone-900 dark:text-stone-100 mb-4 pb-1 border-b border-stone-200 dark:border-stone-800">
              Open Archives
            </h4>
            <ul className="space-y-2.5 text-xs text-stone-600 dark:text-stone-400 font-mono">
              <li>
                <a
                  href="https://www.gutenberg.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors inline-flex items-center gap-1"
                >
                  Project Gutenberg <ExternalLink className="w-3 h-3 text-stone-400" />
                </a>
              </li>
              <li>
                <a
                  href="https://gutendex.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors inline-flex items-center gap-1"
                >
                  Gutendex Mirror <ExternalLink className="w-3 h-3 text-stone-400" />
                </a>
              </li>
              <li>
                <a
                  href="https://standardebooks.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors inline-flex items-center gap-1"
                >
                  Standard Ebooks <ExternalLink className="w-3 h-3 text-stone-400" />
                </a>
              </li>
              <li>
                <a
                  href="https://openlibrary.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors inline-flex items-center gap-1"
                >
                  Open Library Archive <ExternalLink className="w-3 h-3 text-stone-400" />
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Popular Genres */}
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-stone-900 dark:text-stone-100 mb-4 pb-1 border-b border-stone-200 dark:border-stone-800">
              Preserved Collections
            </h4>
            <ul className="space-y-2.5 text-xs text-stone-600 dark:text-stone-400 font-sans">
              <li>Classical Philosophy & Ethics</li>
              <li>Gothic & Romantic Fiction</li>
              <li>Victorian Poetry & Sonnets</li>
              <li>Enlightenment Science & Astronomy</li>
              <li>Historical Treatises & Speeches</li>
            </ul>
          </div>

          {/* Col 4: Legal & CC0 Manifesto */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-stone-900 dark:text-stone-100 mb-4 pb-1 border-b border-stone-200 dark:border-stone-800">
              100% Legal & Open
            </h4>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed font-sans">
              All books listed in Bookarium are in the public domain worldwide. Zero DRM, no subscriptions, zero user tracking.
            </p>
            <div className="text-xs text-stone-500 font-mono flex items-center gap-1 pt-2">
              Crafted with <Heart className="w-3 h-3 text-red-500 fill-current" /> for open culture.
            </div>
          </div>

        </div>

        {/* Bottom copyright / legal strip */}
        <div className="mt-12 pt-8 border-t border-stone-300/70 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-stone-500">
          <p>© {new Date().getFullYear()} BOOKARIUM. Zero Rights Reserved (CC0 Public Domain Dedication).</p>
          <p>Zero API Keys Required • Offline Local Storage Enabled</p>
        </div>
      </div>
    </footer>
  );
};
