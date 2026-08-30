import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHasMounted } from './useHasMounted';

describe('useHasMounted', () => {
  it('returns true after mounting on client', () => {
    const { result } = renderHook(() => useHasMounted());
    expect(result.current).toBe(true);
  });
});

