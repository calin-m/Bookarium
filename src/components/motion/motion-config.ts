export const motionTokens = {
  spring: {
    snappy: { type: 'spring', stiffness: 400, damping: 30 },
    gentle: { type: 'spring', stiffness: 200, damping: 25 },
    bouncy: { type: 'spring', stiffness: 350, damping: 15 },
  },
  ease: {
    smooth: [0.16, 1, 0.3, 1],
    fade: [0.4, 0, 0.2, 1],
  },
  duration: {
    fast: 0.15,
    normal: 0.25,
    slow: 0.4,
  },
};

export const fadeInVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: motionTokens.duration.normal,
      ease: motionTokens.ease.smooth,
    },
  },
};

export const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};

