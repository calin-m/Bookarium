import { describe, it, expect } from 'vitest';
import { SimpleLRUCache } from './cache';

describe('SimpleLRUCache', () => {
  it('stores and retrieves items correctly', () => {
    const cache = new SimpleLRUCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);

    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBeUndefined();
    expect(cache.size()).toBe(2);
  });

  it('evicts the least recently used item when maxEntries is exceeded', () => {
    const cache = new SimpleLRUCache<string, string>(3);
    cache.set('key1', 'val1');
    cache.set('key2', 'val2');
    cache.set('key3', 'val3');

    // Access key1 so key2 becomes the least recently used
    expect(cache.get('key1')).toBe('val1');

    // Add key4, which should evict key2
    cache.set('key4', 'val4');

    expect(cache.get('key2')).toBeUndefined();
    expect(cache.get('key1')).toBe('val1');
    expect(cache.get('key3')).toBe('val3');
    expect(cache.get('key4')).toBe('val4');
    expect(cache.size()).toBe(3);
  });

  it('overwriting an existing key updates its value and recency without exceeding max size', () => {
    const cache = new SimpleLRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 10);

    expect(cache.size()).toBe(2);
    expect(cache.get('a')).toBe(10);

    // Adding 'c' should evict 'b' since 'a' was updated recently
    cache.set('c', 3);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(10);
    expect(cache.get('c')).toBe(3);
  });

  it('supports has, delete, and clear operations', () => {
    const cache = new SimpleLRUCache<string, string>(5);
    cache.set('x', '100');
    cache.set('y', '200');

    expect(cache.has('x')).toBe(true);
    expect(cache.has('z')).toBe(false);

    expect(cache.delete('x')).toBe(true);
    expect(cache.has('x')).toBe(false);
    expect(cache.size()).toBe(1);

    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get('y')).toBeUndefined();
  });
});

