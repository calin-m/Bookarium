/**
 * @module src/types/accolades.types
 * @scope Canonical TypeScript contracts (`AccoladeId`, `AccoladeTier`, `AccoladeCategory`, `AccoladeDefinition`, `UnlockedAccolade`, `AccoladeProgress`, `AccoladeEvaluationResult`) for literary accolades and Ex-Libris bookplates.
 * @invariant Keep `AccoladeId`, `AccoladeTier`, and `AccoladeCategory` unions synchronized with `ACCOLADES_CATALOG` and `evaluate` context shapes (`AccoladeEvaluationContext`) across client engines, Supabase serialization, and Account UI views.
 * @rationale Isolating accolade domain types in a pure dependency-free contract module prevents circular dependencies between store persistence, evaluation math, and 3D bookplate components.
 * @adr ADR-025, ADR-080
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
  | 'symposium-companion'
  | 'bibliophile-novice'
  | 'canonical-scholar'
  | 'master-of-the-canon'
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
  completedSymposiumsCount?: number;
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

