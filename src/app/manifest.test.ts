import { describe, it, expect } from 'vitest';
import manifest from './manifest';

describe('Web App Manifest (PWA)', () => {
  it('returns valid metadata complying with PWA standards', () => {
    const data = manifest();

    expect(data.id).toBe('/?source=pwa');
    expect(data.scope).toBe('/');
    expect(data.name).toBe('Bookarium');
    expect(data.short_name).toBe('Bookarium');
    expect(data.start_url).toBe('/');
    expect(data.display).toBe('standalone');
    expect(data.background_color).toBe('#fcfbf9');
    expect(data.theme_color).toBe('#0e1117');
    expect(data.categories).toContain('books');
  });

  it('includes required icon sizes and purposes for desktop and mobile installation', () => {
    const { icons } = manifest();

    expect(icons).toBeDefined();
    expect(icons?.length).toBeGreaterThanOrEqual(6);

    const sizes = icons?.map((i) => i.sizes);
    expect(sizes).toContain('any');
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(sizes).toContain('1024x1024');

    const purposes = icons?.map((i) => i.purpose);
    expect(purposes).toContain('any');
    expect(purposes).toContain('maskable');

    // Ensure icon URLs have ?v=4 cache-busting parameter
    icons?.forEach((icon) => {
      expect(icon.src).toMatch(/\?v=4$/);
    });
  });
});

