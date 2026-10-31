import { describe, it, expect } from 'vitest';
import {
  motionTokens,
  fadeInVariants,
  staggerContainerVariants,
} from './motion-config';

describe('src/components/motion/motion-config', () => {
  it('defines spring physics, cubic-bezier easing arrays, and duration tokens', () => {
    expect(motionTokens.spring.snappy).toEqual({
      type: 'spring',
      stiffness: 400,
      damping: 30,
    });
    expect(motionTokens.spring.gentle.stiffness).toBe(200);
    expect(motionTokens.spring.bouncy.damping).toBe(15);
    expect(motionTokens.ease.smooth).toHaveLength(4);
    expect(motionTokens.ease.fade).toHaveLength(4);
    expect(motionTokens.duration.fast).toBeLessThan(motionTokens.duration.normal);
    expect(motionTokens.duration.normal).toBeLessThan(motionTokens.duration.slow);
  });

  it('defines fadeInVariants and staggerContainerVariants using motionTokens', () => {
    expect(fadeInVariants.hidden).toEqual({ opacity: 0, y: 12 });
    expect(fadeInVariants.visible.opacity).toBe(1);
    expect(fadeInVariants.visible.y).toBe(0);
    expect(fadeInVariants.visible.transition.duration).toBe(motionTokens.duration.normal);
    expect(staggerContainerVariants.visible.transition.staggerChildren).toBe(0.06);
  });
});

