import { useQuery } from '@tanstack/react-query';
import { sampleBookText } from '@/mocks/handlers';

export async function fetchBookContent(url?: string, _bookId?: number): Promise<string> {
  if (!url) {
    return sampleBookText;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return sampleBookText;
    }
    const text = await res.text();
    return text || sampleBookText;
  } catch {
    // Gracefully fallback to sample reader text
    return sampleBookText;
  }
}

export function useBookContent(contentUrl?: string, bookId?: number) {
  return useQuery({
    queryKey: ['book-content', contentUrl, bookId],
    queryFn: () => fetchBookContent(contentUrl, bookId),
    enabled: Boolean(contentUrl || bookId),
    staleTime: 60 * 60 * 1000, // 1 hour caching for book text
  });
}

