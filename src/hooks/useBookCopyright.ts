'use client';

import { useMemo } from 'react';
import { useJurisdiction } from '@/stores/useJurisdictionStore';
import {
  isBookPublicDomainInJurisdiction,
  getJurisdictionRuleDescription,
  type CopyrightEvaluationResult,
  type GenericBookInput,
  type JurisdictionRule,
} from '@/lib/copyright-engine';

export interface BookCopyrightSummary {
  evaluation: CopyrightEvaluationResult;
  country: string;
  rule: JurisdictionRule;
  isAllowed: boolean;
  isRestricted: boolean;
  badgeLabel: string;
  ruleDescription: string;
  reason: string;
  publicDomainYear?: number;
  formatActionAriaLabel: (actionName: string) => string;
}

/**
 * Declarative facade hook for evaluating copyright and public domain status
 * of a book against the user's active jurisdiction.
 */
export function useBookCopyright(book: GenericBookInput | null | undefined): BookCopyrightSummary {
  const { country, rule } = useJurisdiction();

  return useMemo(() => {
    const evaluation = isBookPublicDomainInJurisdiction(book, country);
    const isAllowed = evaluation.isAllowed;
    const isRestricted = !isAllowed;
    const ruleDescription = getJurisdictionRuleDescription(evaluation.rule, country);
    const reason = evaluation.reason || (isRestricted ? `Protected under copyright law in ${country}.` : '');
    const badgeLabel = isRestricted ? `Protected (${country})` : 'CC0 / Free';

    return {
      evaluation,
      country,
      rule,
      isAllowed,
      isRestricted,
      badgeLabel,
      ruleDescription,
      reason,
      publicDomainYear: evaluation.publicDomainYear,
      formatActionAriaLabel: (actionName: string) => {
        const title = book?.title ? `"${book.title}"` : 'this volume';
        return isRestricted
          ? `${actionName} is unavailable: ${title} is restricted in ${country} under ${ruleDescription}`
          : `${actionName} ${title}`;
      },
    };
  }, [book, country, rule]);
}

