import type { HighlightColor } from '@/stores/useAnnotationStore';

export interface AnnotationColorTheme {
  readonly id: HighlightColor;
  readonly label: string;
  readonly detailedLabel: string;
  readonly dotClass: string;
  readonly popoverPillClass: string;
  readonly popoverActiveRing: string;
  readonly notebookSwatchClass: string;
  readonly notebookActiveRing: string;
  readonly filterBadgeClass: string;
  readonly cardBorderClass: string;
  readonly cardBgClass: string;
  readonly cardTextClass: string;
  readonly drawerCardClass: string;
  readonly surfaceHighlightClass: string;
}

export const ANNOTATION_COLOR_CONFIG: Record<HighlightColor, AnnotationColorTheme> = {
  yellow: {
    id: 'yellow',
    label: 'Yellow',
    detailedLabel: 'Canary Yellow',
    dotClass: 'bg-amber-400',
    popoverPillClass: 'bg-amber-300 hover:bg-amber-400 border-amber-400 text-amber-950',
    popoverActiveRing: 'ring-2 ring-amber-500 ring-offset-1',
    notebookSwatchClass: 'bg-amber-300 border-amber-400 dark:bg-amber-400/80',
    notebookActiveRing: 'ring-2 ring-offset-2 ring-amber-500',
    filterBadgeClass: 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
    cardBorderClass: 'border-l-amber-400 dark:border-l-amber-500',
    cardBgClass: 'bg-amber-50/60 dark:bg-amber-950/15',
    cardTextClass: 'text-amber-900 dark:text-amber-200',
    drawerCardClass: 'border-l-amber-400 bg-amber-500/5',
    surfaceHighlightClass:
      'bg-amber-300/40 dark:bg-amber-400/25 border-b-2 border-amber-400/80 text-inherit cursor-pointer rounded-xs px-0.5 transition-colors hover:bg-amber-300/60 dark:hover:bg-amber-400/40 selection:bg-amber-300/70 dark:selection:bg-amber-400/50 selection:text-inherit',
  },
  amber: {
    id: 'amber',
    label: 'Amber',
    detailedLabel: 'Vintage Amber',
    dotClass: 'bg-orange-400',
    popoverPillClass: 'bg-orange-300 hover:bg-orange-400 border-orange-400 text-orange-950',
    popoverActiveRing: 'ring-2 ring-orange-500 ring-offset-1',
    notebookSwatchClass: 'bg-orange-300 border-orange-400 dark:bg-orange-400/80',
    notebookActiveRing: 'ring-2 ring-offset-2 ring-orange-500',
    filterBadgeClass: 'bg-orange-100 text-orange-900 border border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800/60',
    cardBorderClass: 'border-l-orange-400 dark:border-l-orange-500',
    cardBgClass: 'bg-orange-50/60 dark:bg-orange-950/15',
    cardTextClass: 'text-orange-900 dark:text-orange-200',
    drawerCardClass: 'border-l-orange-400 bg-orange-500/5',
    surfaceHighlightClass:
      'bg-orange-300/40 dark:bg-orange-400/25 border-b-2 border-orange-400/80 text-inherit cursor-pointer rounded-xs px-0.5 transition-colors hover:bg-orange-300/60 dark:hover:bg-orange-400/40 selection:bg-orange-300/70 dark:selection:bg-orange-400/50 selection:text-inherit',
  },
  mint: {
    id: 'mint',
    label: 'Mint',
    detailedLabel: 'Calm Mint',
    dotClass: 'bg-emerald-400',
    popoverPillClass: 'bg-emerald-300 hover:bg-emerald-400 border-emerald-400 text-emerald-950',
    popoverActiveRing: 'ring-2 ring-emerald-500 ring-offset-1',
    notebookSwatchClass: 'bg-emerald-300 border-emerald-400 dark:bg-emerald-400/80',
    notebookActiveRing: 'ring-2 ring-offset-2 ring-emerald-500',
    filterBadgeClass: 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
    cardBorderClass: 'border-l-emerald-400 dark:border-l-emerald-500',
    cardBgClass: 'bg-emerald-50/60 dark:bg-emerald-950/15',
    cardTextClass: 'text-emerald-900 dark:text-emerald-200',
    drawerCardClass: 'border-l-emerald-400 bg-emerald-500/5',
    surfaceHighlightClass:
      'bg-emerald-300/40 dark:bg-emerald-400/25 border-b-2 border-emerald-400/80 text-inherit cursor-pointer rounded-xs px-0.5 transition-colors hover:bg-emerald-300/60 dark:hover:bg-emerald-400/40 selection:bg-emerald-300/70 dark:selection:bg-emerald-400/50 selection:text-inherit',
  },
  rose: {
    id: 'rose',
    label: 'Rose',
    detailedLabel: 'Soft Rose',
    dotClass: 'bg-rose-400',
    popoverPillClass: 'bg-rose-300 hover:bg-rose-400 border-rose-400 text-rose-950',
    popoverActiveRing: 'ring-2 ring-rose-500 ring-offset-1',
    notebookSwatchClass: 'bg-rose-300 border-rose-400 dark:bg-rose-400/80',
    notebookActiveRing: 'ring-2 ring-offset-2 ring-rose-500',
    filterBadgeClass: 'bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60',
    cardBorderClass: 'border-l-rose-400 dark:border-l-rose-500',
    cardBgClass: 'bg-rose-50/60 dark:bg-rose-950/15',
    cardTextClass: 'text-rose-900 dark:text-rose-200',
    drawerCardClass: 'border-l-rose-400 bg-rose-500/5',
    surfaceHighlightClass:
      'bg-rose-300/40 dark:bg-rose-400/25 border-b-2 border-rose-400/80 text-inherit cursor-pointer rounded-xs px-0.5 transition-colors hover:bg-rose-300/60 dark:hover:bg-rose-400/40 selection:bg-rose-300/70 dark:selection:bg-rose-400/50 selection:text-inherit',
  },
};

export const ANNOTATION_COLOR_LIST: readonly AnnotationColorTheme[] = Object.values(ANNOTATION_COLOR_CONFIG);

export const ALL_COLORS_FILTER_BADGE =
  'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-border';

