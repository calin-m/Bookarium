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
}

export const READER_THEMES: Record<ReaderTheme, ReaderThemeConfig> = {
  light: {
    surface: 'bg-[#fcfbf9] text-[#1a1a1a]',
    header: 'bg-[#fcfbf9] text-[#1a1a1a] border-stone-200 shadow-xs',
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
  },
  sepia: {
    surface: 'bg-[#f4ebd9] text-[#2c1d11]',
    header: 'bg-[#ede2cc] text-[#2c1d11] border-[#d4c19c] shadow-xs',
    footer: 'bg-[#ede2cc] text-[#2c1d11] border-[#d4c19c] shadow-xs',
    pill: 'bg-[#e2d3b7] border-[#ccb893] text-[#3f2b1c]',
    activePill: 'bg-[#f5eedb] text-[#78350f] shadow-xs font-bold',
    inactivePill: 'text-[#4e3624] hover:text-[#2c1d11]',
    button: 'bg-[#e2d3b7] border-[#ccb893] text-[#3f2b1c] hover:text-[#78350f] hover:border-[#78350f]',
    border: 'border-[#ccb893]',
    textMuted: 'text-[#6e533c]',
    drawerBg: 'bg-[#ede2cc] border-[#d4c19c] text-[#2c1d11]',
    drawerActive: 'bg-[#f5eedb] text-[#78350f] border-[#ccb893]',
    drawerHover: 'hover:bg-[#e2d3b7] text-[#3f2b1c]',
    scrollbarClass: 'reader-surface-sepia',
  },
  dark: {
    surface: 'bg-[#0e1117] text-[#f5f5f4]',
    header: 'bg-[#161b26] text-[#f5f5f4] border-stone-800 shadow-xs',
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
  },
};

