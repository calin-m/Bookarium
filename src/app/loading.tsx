import React from 'react';

export default function Loading() {
  return (
    <div
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-pulse"
      role="status"
      aria-busy="true"
      aria-label="Loading library volumes"
    >
      {/* Hero skeleton */}
      <div className="space-y-4 max-w-2xl mx-auto text-center">
        <div className="h-10 bg-muted/60 rounded-xl w-3/4 mx-auto" />
        <div className="h-4 bg-muted/40 rounded-lg w-1/2 mx-auto" />
      </div>

      {/* Filter toolbar skeleton */}
      <div className="h-14 bg-card/80 border border-border rounded-2xl w-full" />

      {/* Book grid skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col rounded-2xl bg-card border border-border overflow-hidden space-y-3 p-3 shadow-booksaw"
          >
            <div className="w-full aspect-[2/3] bg-muted/70 rounded-xl" />
            <div className="h-4 bg-muted/50 rounded w-4/5" />
            <div className="h-3 bg-muted/30 rounded w-1/2" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading catalog collection...</span>
    </div>
  );
}

