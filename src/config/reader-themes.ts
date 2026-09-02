import type { ReaderTheme } from '@/stores/useReaderStore';

export interface ReaderThemeConfig {
  surface: string;
  header: string;
  footer: string;
  pill: string;
  activePill: string;
  inactivePill: string;
  button: string;
  border: string;
  textMuted: string;
  drawerBg: string;
  drawerActive: string;
  drawerHover: string;
  scrollbarClass: string;
  iconAccent: string;
}

export const READER_THEMES: Record<ReaderTheme, ReaderThemeConfig> = {
  light: {
    surface: 'bg-[#fcfbf9] text-[#1a1a1a]',
    header: 'bg-[#fcfbf9] text-[#1a1a1a] border-stone-200 shadow-sm',
    footer: 'bg-[#fcfbf9] text-[#1a1a1a] border-stone-200 shadow-xs',
    pill: 'bg-stone-100 border-stone-200 text-stone-700',
    activePill: 'bg-white text-primary-600 shadow-xs font-bold',
    inactivePill: 'text-stone-600 hover:text-stone-900',
    button: 'bg-stone-50 border-stone-200 text-stone-700 hover:text-primary-600 hover:border-primary-500',
    border: 'border-stone-200',
    textMuted: 'text-stone-500',
    drawerBg: 'bg-white border-stone-200 text-stone-900',
    drawerActive: 'bg-primary-50 text-primary-700 border-primary-500',
    drawerHover: 'hover:bg-stone-100 text-stone-700',
    scrollbarClass: 'reader-surface-light',
    iconAccent: 'text-primary-600 dark:text-primary-400',
  },
  sepia: {
    surface: 'bg-[#2b1d16] text-[#fef6eb]',
    header: 'bg-[#332219] text-[#fef6eb] border-[#462e22] shadow-sm',
    footer: 'bg-[#332219] text-[#fef6eb] border-[#462e22] shadow-xs',
    pill: 'bg-[#402a1d] border-[#462e22] text-[#e8d2be]',
    activePill: 'bg-[#f59e0b] text-[#2b1d16] shadow-xs font-bold',
    inactivePill: 'text-[#cbb39d] hover:text-[#fef6eb]',
    button: 'bg-[#402a1d] border-[#462e22] text-[#e8d2be] hover:text-[#f59e0b] hover:border-[#f59e0b]',
    border: 'border-[#462e22]',
    textMuted: 'text-[#cbb39d]',
    drawerBg: 'bg-[#332219] border-[#462e22] text-[#fef6eb]',
    drawerActive: 'bg-[#4a3022] text-[#f59e0b] border-[#f59e0b]',
    drawerHover: 'hover:bg-[#402a1d] text-[#fef6eb]',
    scrollbarClass: 'reader-surface-sepia',
    iconAccent: 'text-amber-500',
  },
  dark: {
    surface: 'bg-[#0e1117] text-[#f5f5f4]',
    header: 'bg-[#161b26] text-[#f5f5f4] border-stone-800 shadow-sm',
    footer: 'bg-[#161b26] text-[#f5f5f4] border-stone-800 shadow-xs',
    pill: 'bg-[#1c1917] border-stone-800 text-stone-300',
    activePill: 'bg-[#292524] text-primary-400 border-primary-500 shadow-xs font-bold',
    inactivePill: 'text-stone-400 hover:text-stone-200',
    button: 'bg-[#1c1917] border-stone-800 text-stone-300 hover:text-white hover:border-primary-400',
    border: 'border-stone-800',
    textMuted: 'text-stone-400',
    drawerBg: 'bg-[#161b26] border-stone-800 text-stone-100',
    drawerActive: 'bg-[#292524] text-primary-400 border-primary-500',
    drawerHover: 'hover:bg-[#22201e] text-stone-200',
    scrollbarClass: 'reader-surface-dark',
    iconAccent: 'text-primary-400',
  },
};

/**
 * Returns the resolved ReaderThemeConfig tokens for a given theme with guaranteed fallback to 'light'.
 */
export function getReaderTheme(theme?: ReaderTheme | string | null): ReaderThemeConfig {
  if (!theme || !(theme in READER_THEMES)) {
    return READER_THEMES.light;
  }
  return READER_THEMES[theme as ReaderTheme];
}

