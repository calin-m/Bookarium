/**
 * Canonical Types & Contracts for Multi-Provider Book Catalog Architecture
 * Bookarium (Strangler Fig Pattern)
 */

import type { GutendexBook } from './book.types';
import type { JurisdictionRule } from '@/lib/copyright-engine';

export interface CatalogQueryOptions {
  search?: string;
  topic?: string;
  languages?: string[];
  page: number;
  limit: number;
  authorYearStart?: number;
  authorYearEnd?: number;
  sort?: 'popular' | 'descending' | 'ascending' | '';
  mimeType?: string;
  ids?: string;
  country: string; // ISO 3166-1 alpha-2, mandatory for legal jurisdiction
}

export interface CatalogQueryResult {
  count: number;
  next: string | null;
  previous: string | null;
  results: GutendexBook[];
  source: 'supabase' | 'upstream' | 'cache';
  latencyMs: number;
  clientCountry: string;
  jurisdictionRule: JurisdictionRule;
  totalFiltered?: number;
}

export class CatalogProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly source: 'upstream' | 'supabase' = 'upstream'
  ) {
    super(message);
    this.name = 'CatalogProviderError';
  }
}

export interface ICatalogProvider {
  readonly name: 'supabase' | 'gutendex';
  searchBooks(options: CatalogQueryOptions): Promise<CatalogQueryResult>;
  isHealthy(): Promise<boolean>;
}

