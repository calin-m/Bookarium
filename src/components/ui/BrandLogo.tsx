import React from 'react';

export interface BrandLogoProps extends React.SVGProps<SVGSVGElement> {
  /**
   * Deterministic ID prefix for embedded SVG gradients and shadows.
   * Prevents DOM ID collisions when multiple logos render simultaneously on a page.
   * @default 'brand'
   */
  idPrefix?: string;
  className?: string;
  testId?: string;
}

/**
 * Universal Brand Emblem (Soaring Book).
 * Represents the 3-tiered open pages with sunlit amber peaks, core terracotta arched bodies,
 * and deep burnt outer wingtips, optically centered within a square viewBox.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  idPrefix = 'brand',
  className = 'w-8 h-8',
  testId = 'brand-monogram-icon',
  ...rest
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="30 38 456 456"
      fill="none"
      className={className}
      data-testid={testId}
      aria-hidden={rest['aria-label'] ? undefined : true}
      {...rest}
    >
      <defs>
        {/* 1. OUTER WINGS & TAILS: Lit tips fading into deep occlusion */}
        <linearGradient
          id={`${idPrefix}-grad-wing-left`}
          x1="36"
          y1="214"
          x2="108"
          y2="306"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#9e4422" />
          <stop offset="42%" stopColor="#7b341e" />
          <stop offset="76%" stopColor="#521d0d" />
          <stop offset="100%" stopColor="#330f05" />
        </linearGradient>

        <linearGradient
          id={`${idPrefix}-grad-tail-left`}
          x1="170"
          y1="422"
          x2="140"
          y2="476"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#2e0d04" />
          <stop offset="48%" stopColor="#57200f" />
          <stop offset="100%" stopColor="#82361d" />
        </linearGradient>

        <linearGradient
          id={`${idPrefix}-grad-wing-right`}
          x1="476"
          y1="214"
          x2="404"
          y2="306"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#b54f26" />
          <stop offset="45%" stopColor="#8f3d20" />
          <stop offset="78%" stopColor="#5e2310" />
          <stop offset="100%" stopColor="#3b1206" />
        </linearGradient>

        <linearGradient
          id={`${idPrefix}-grad-tail-right`}
          x1="342"
          y1="422"
          x2="372"
          y2="476"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#361006" />
          <stop offset="48%" stopColor="#632511" />
          <stop offset="100%" stopColor="#913e20" />
        </linearGradient>

        {/* 2. MIDDLE ARCHED PAGES: Ambient terracotta + radial cast shadows */}
        <linearGradient
          id={`${idPrefix}-grad-middle-left`}
          x1="115"
          y1="154"
          x2="175"
          y2="448"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#df6c2c" />
          <stop offset="48%" stopColor="#c05621" />
          <stop offset="100%" stopColor="#993c16" />
        </linearGradient>

        <radialGradient
          id={`${idPrefix}-shadow-middle-left`}
          cx="340"
          cy="281"
          r="248"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#2b0c03" stopOpacity="0.72" />
          <stop offset="65%" stopColor="#381105" stopOpacity="0.64" />
          <stop offset="74%" stopColor="#4a1707" stopOpacity="0.50" />
          <stop offset="81%" stopColor="#61210b" stopOpacity="0.32" />
          <stop offset="90%" stopColor="#7d2e12" stopOpacity="0.11" />
          <stop offset="100%" stopColor="#7d2e12" stopOpacity="0" />
        </radialGradient>

        <linearGradient
          id={`${idPrefix}-grad-middle-right`}
          x1="397"
          y1="154"
          x2="337"
          y2="448"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#ee7b33" />
          <stop offset="48%" stopColor="#d46227" />
          <stop offset="100%" stopColor="#ad4619" />
        </linearGradient>

        <radialGradient
          id={`${idPrefix}-shadow-middle-right`}
          cx="172"
          cy="281"
          r="242"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#330e04" stopOpacity="0.64" />
          <stop offset="65%" stopColor="#421406" stopOpacity="0.56" />
          <stop offset="74%" stopColor="#571d09" stopOpacity="0.42" />
          <stop offset="82%" stopColor="#70280e" stopOpacity="0.25" />
          <stop offset="91%" stopColor="#8c3515" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#8c3515" stopOpacity="0" />
        </radialGradient>

        {/* 3. TALL CENTER PAGES: Sunlit peaks + central spine gradient */}
        <linearGradient
          id={`${idPrefix}-grad-center-left`}
          x1="196"
          y1="56"
          x2="242"
          y2="468"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#ffb449" />
          <stop offset="36%" stopColor="#ee8231" />
          <stop offset="74%" stopColor="#d66221" />
          <stop offset="100%" stopColor="#9e3a13" />
        </linearGradient>

        <linearGradient
          id={`${idPrefix}-gutter-center-left`}
          x1="184"
          y1="265"
          x2="252"
          y2="265"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="62%" stopColor="#6e230b" stopOpacity="0" />
          <stop offset="88%" stopColor="#6e230b" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#4f1707" stopOpacity="0.36" />
        </linearGradient>

        <linearGradient
          id={`${idPrefix}-grad-center-right`}
          x1="318"
          y1="56"
          x2="270"
          y2="468"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#ffc55c" />
          <stop offset="38%" stopColor="#f69638" />
          <stop offset="76%" stopColor="#e07026" />
          <stop offset="100%" stopColor="#ab4216" />
        </linearGradient>

        <linearGradient
          id={`${idPrefix}-gutter-center-right`}
          x1="328"
          y1="265"
          x2="260"
          y2="265"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="64%" stopColor="#78270d" stopOpacity="0" />
          <stop offset="88%" stopColor="#78270d" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#591b08" stopOpacity="0.32" />
        </linearGradient>
      </defs>

      {/* 1. OUTER WINGS & TAILS */}
      <path
        id={`${idPrefix}-outer-left-wing`}
        d="M 98 220 C 78 222, 56 220, 36 214 C 64 272, 88 332, 104 388 C 106 332, 104 274, 98 220 Z"
        fill={`url(#${idPrefix}-grad-wing-left)`}
      />
      <path
        id={`${idPrefix}-outer-left-tail`}
        d="M 126 448 L 142 476 C 164 452, 186 434, 206 424 C 182 418, 154 430, 126 448 Z"
        fill={`url(#${idPrefix}-grad-tail-left)`}
      />

      <path
        id={`${idPrefix}-outer-right-wing`}
        d="M 414 220 C 434 222, 456 220, 476 214 C 448 272, 424 332, 408 388 C 406 332, 408 274, 414 220 Z"
        fill={`url(#${idPrefix}-grad-wing-right)`}
      />
      <path
        id={`${idPrefix}-outer-right-tail`}
        d="M 386 448 L 370 476 C 348 452, 326 434, 306 424 C 330 418, 358 430, 386 448 Z"
        fill={`url(#${idPrefix}-grad-tail-right)`}
      />

      {/* 2. MIDDLE ARCHED PAGES */}
      <g id={`${idPrefix}-middle-left-group`}>
        <path
          id={`${idPrefix}-middle-left`}
          d="M 181 166 C 156 148, 120 150, 94 178 C 110 256, 118 356, 108 452 C 154 416, 204 402, 232 444 C 216 382, 184 334, 145 300 C 160 254, 171 210, 181 166 Z"
          fill={`url(#${idPrefix}-grad-middle-left)`}
        />
        <path
          d="M 181 166 C 156 148, 120 150, 94 178 C 110 256, 118 356, 108 452 C 154 416, 204 402, 232 444 C 216 382, 184 334, 145 300 C 160 254, 171 210, 181 166 Z"
          fill={`url(#${idPrefix}-shadow-middle-left)`}
        />
      </g>

      <g id={`${idPrefix}-middle-right-group`}>
        <path
          id={`${idPrefix}-middle-right`}
          d="M 331 166 C 356 148, 392 150, 418 178 C 402 256, 394 356, 404 452 C 358 416, 308 402, 280 444 C 296 382, 328 334, 367 300 C 352 254, 341 210, 331 166 Z"
          fill={`url(#${idPrefix}-grad-middle-right)`}
        />
        <path
          d="M 331 166 C 356 148, 392 150, 418 178 C 402 256, 394 356, 404 452 C 358 416, 308 402, 280 444 C 296 382, 328 334, 367 300 C 352 254, 341 210, 331 166 Z"
          fill={`url(#${idPrefix}-shadow-middle-right)`}
        />
      </g>

      {/* 3. TALL CENTER PAGES */}
      <g id={`${idPrefix}-center-left-group`}>
        <path
          id={`${idPrefix}-center-left`}
          d="M 204 56 C 236 96, 250 150, 250 216 C 250 284, 246 376, 244 468 C 232 392, 198 334, 156 296 C 178 222, 192 142, 204 56 Z"
          fill={`url(#${idPrefix}-grad-center-left)`}
        />
        <path
          d="M 204 56 C 236 96, 250 150, 250 216 C 250 284, 246 376, 244 468 C 232 392, 198 334, 156 296 C 178 222, 192 142, 204 56 Z"
          fill={`url(#${idPrefix}-gutter-center-left)`}
        />
      </g>

      <g id={`${idPrefix}-center-right-group`}>
        <path
          id={`${idPrefix}-center-right`}
          d="M 308 56 C 276 96, 262 150, 262 216 C 262 284, 266 376, 268 468 C 280 392, 314 334, 356 296 C 334 222, 320 142, 308 56 Z"
          fill={`url(#${idPrefix}-grad-center-right)`}
        />
        <path
          d="M 308 56 C 276 96, 262 150, 262 216 C 262 284, 266 376, 268 468 C 280 392, 314 334, 356 296 C 334 222, 320 142, 308 56 Z"
          fill={`url(#${idPrefix}-gutter-center-right)`}
        />
      </g>
    </svg>
  );
};
