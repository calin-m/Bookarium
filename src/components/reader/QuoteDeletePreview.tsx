import React from 'react';

export interface QuoteDeletePreviewProps {
  selectedText: string;
  note?: string | null;
}

export const QuoteDeletePreview: React.FC<QuoteDeletePreviewProps> = ({
  selectedText,
  note,
}) => {
  return (
    <div className="mt-2 p-3 rounded-lg bg-muted/40 border border-border text-xs">
      <p className="font-serif italic text-foreground/90 line-clamp-3">
        &ldquo;{selectedText}&rdquo;
      </p>
      {note && (
        <p className="mt-1.5 pt-1.5 border-t border-border font-sans text-muted-foreground line-clamp-2">
          <span className="font-mono text-[10px] uppercase text-primary mr-1">Note:</span>
          {note}
        </p>
      )}
    </div>
  );
};
