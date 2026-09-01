import { useQuery } from '@tanstack/react-query';
import { sampleBookText } from '@/mocks/handlers';
import { API_ENDPOINTS } from '@/config/api-endpoints';

export async function fetchBookContent(url?: string, bookId?: number): Promise<string> {
  if (!url && !bookId) {
    return sampleBookText;
  }

  const params = new URLSearchParams();
  if (bookId) params.set('id', String(bookId));
  if (url) params.set('url', url);

  const res = await fetch(`${API_ENDPOINTS.INTERNAL_API_CONTENT}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch book content from upstream proxy: ${res.statusText || res.status}`);
  }
  const text = await res.text();
  if (!text || text.trim().length === 0) {
    throw new Error('Received empty text content from upstream.');
  }
  return text;
}


export function useBookContent(contentUrl?: string, bookId?: number) {
  return useQuery({
    queryKey: ['book-content', contentUrl, bookId],
    queryFn: () => fetchBookContent(contentUrl, bookId),
    enabled: Boolean(contentUrl || bookId),
    staleTime: 60 * 60 * 1000, // 1 hour caching for book text
  });
}
