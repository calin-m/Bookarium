import { describe, it, expect } from 'vitest';
import robots from './robots';
import { SITE_CONFIG } from '@/config/site-config';

describe('robots() route handler', () => {
  it('returns valid crawler rules and sitemap location', () => {
    const config = robots();

    expect(config.sitemap).toBe(`${SITE_CONFIG.SITE_URL}/sitemap.xml`);
    expect(config.rules).toBeDefined();

    const rules = Array.isArray(config.rules) ? config.rules[0] : config.rules;
    expect(rules.userAgent).toBe('*');
  });

  it('allows public canonical pages while strictly disallowing query parameter search crawling and private routes', () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules[0] : config.rules;

    const allowed = Array.isArray(rules.allow) ? rules.allow : [rules.allow];
    const disallowed = Array.isArray(rules.disallow) ? rules.disallow : [rules.disallow];

    expect(allowed).toContain('/');
    expect(allowed).toContain('/privacy');
    expect(allowed).toContain('/read/');

    expect(disallowed).toContain('/*?*search=*');
    expect(disallowed).toContain('/*?*topic=*');
    expect(disallowed).toContain('/*?*languages=*');
    expect(disallowed).toContain('/api/*');
    expect(disallowed).toContain('/auth/*');
    expect(disallowed).toContain('/account');
  });
});

