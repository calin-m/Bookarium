/**
 * Literary Accolades & Ex-Libris Bookplates - Type Definitions
 * Bookarium Milestone 4, Point 1
 */

export type AccoladeId =
  | 'seven-day-sage'
  | 'equinox-scholar'
  | 'centurion-of-letters'
  | 'the-marathon-reader'
  | 'audio-ascetic'
  | 'ancient-antiquarian'
  | 'century-voyager'
  | 'commonplace-scholar'
  | 'palette-virtuoso'
  | 'the-laureates-crown';

export type AccoladeTier = 'bronze' | 'silver' | 'gold' | 'masterwork';

export type AccoladeCategory = 'all' | 'streaks' | 'immersion' | 'exploration' | 'scholarship' | 'curation';

export interface AccoladeEvaluationContext {
  currentStreak?: number;
  longestStreak?: number;
  totalReadingSeconds?: number;
  totalListeningSeconds?: number;
  activeDates?: string[];
  annualGoalPercent?: number;
  completedBooksCount?: number;
  historicalErasExplored?: string[];
  hasCompletedAncientBook?: boolean;
  totalAnnotationsCount?: number;
  highlightColorsUsed?: string[];
  existingUnlockedIds?: string[];
}

export interface AccoladeDefinition {
  id: AccoladeId;
  title: string;
  latinMotto: string;
  description: string;
  tier: AccoladeTier;
  category: Exclude<AccoladeCategory, 'all'>;
  iconName: string;
  target: number;
  unit: string;
  evaluate: (ctx: AccoladeEvaluationContext) => number;
}

export interface UnlockedAccolade {
  id: AccoladeId;
  unlockedAt: string;
  isPinned: boolean;
  metadata?: Record<string, unknown>;
}

export interface AccoladeProgress {
  id: AccoladeId;
  current: number;
  target: number;
  percent: number;
  isUnlocked: boolean;
  unlockedAt?: string;
  isPinned: boolean;
}

export interface AccoladeEvaluationResult {
  progressMap: Record<AccoladeId, AccoladeProgress>;
  unlockedAccolades: Record<AccoladeId, UnlockedAccolade>;
  newlyUnlocked: AccoladeDefinition[];
}

