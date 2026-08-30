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
    header: 'bg-[#fcfbf9]/95 text-[#1a1a1a] border-stone-200/90 shadow-xs',
    footer: 'bg-[#fcfbf9]/95 text-[#1a1a1a] border-stone-200/90 shadow-xs',
    pill: 'bg-stone-100 border-stone-200/90 text-stone-700',
    activePill: 'bg-white text-primary-600 shadow-xs font-bold',
    inactivePill: 'text-stone-600 hover:text-stone-900',
    button: 'bg-stone-50 border-stone-200/90 text-stone-700 hover:text-primary-600 hover:border-primary-500',
    border: 'border-stone-200/90',
    textMuted: 'text-stone-500',
    drawerBg: 'bg-white border-stone-200 text-stone-900',
    drawerActive: 'bg-primary-50 text-primary-700 border-primary-500/40',
    drawerHover: 'hover:bg-stone-100 text-stone-700',
    scrollbarClass: 'reader-surface-light',
  },
  sepia: {
    surface: 'bg-[#f4ebd9] text-[#2c1d11]',
    header: 'bg-[#ede2cc]/95 text-[#2c1d11] border-[#d4c19c] shadow-xs',
    footer: 'bg-[#ede2cc]/95 text-[#2c1d11] border-[#d4c19c] shadow-xs',
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
    surface: 'bg-[#0c0e12] text-[#e2e8f0]',
    header: 'bg-[#12151c]/95 text-[#e2e8f0] border-[#232936] shadow-xs',
    footer: 'bg-[#12151c]/95 text-[#e2e8f0] border-[#232936] shadow-xs',
    pill: 'bg-[#1a1f2b] border-[#232936] text-stone-300',
    activePill: 'bg-[#252c3b] text-primary-400 shadow-xs font-bold',
    inactivePill: 'text-stone-400 hover:text-stone-200',
    button: 'bg-[#1a1f2b] border-[#232936] text-stone-300 hover:text-white hover:border-primary-400',
    border: 'border-[#232936]',
    textMuted: 'text-stone-400',
    drawerBg: 'bg-[#12151c] border-[#232936] text-stone-100',
    drawerActive: 'bg-[#1e2430] text-primary-400 border-primary-500/40',
    drawerHover: 'hover:bg-[#1a1f2b] text-stone-300',
    scrollbarClass: 'reader-surface-dark',
  },
};

