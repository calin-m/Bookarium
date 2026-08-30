import { useQuery } from '@tanstack/react-query';
import { sampleBookText } from '@/mocks/handlers';
import { API_ENDPOINTS } from '@/config/api-endpoints';

export async function fetchBookContent(url?: string, bookId?: number): Promise<string> {
  if (!url && !bookId) {
    return sampleBookText;
  }

  try {
    const params = new URLSearchParams();
    if (bookId) params.set('id', String(bookId));
    if (url) params.set('url', url);

    const res = await fetch(`${API_ENDPOINTS.INTERNAL_API_CONTENT}?${params.toString()}`);
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
