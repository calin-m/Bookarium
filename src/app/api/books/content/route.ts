import { NextRequest, NextResponse } from 'next/server';
import { API_ENDPOINTS } from '@/config/api-endpoints';
import { SITE_CONFIG } from '@/config/site-config';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const urlParam = searchParams.get('url') || '';
  const idParam = searchParams.get('id') || '';

  if (!urlParam && !idParam) {
    return NextResponse.json(
      { error: 'Missing "url" or "id" parameter.' },
      { status: 400 }
    );
  }

  const bookId = idParam || (urlParam.match(/(\d+)/)?.[1] ?? '');

  // URLs to try in order
  const targetUrls: string[] = [];
  if (bookId) {
    targetUrls.push(`${API_ENDPOINTS.GUTENBERG_CACHE_BASE_URL}/${bookId}/pg${bookId}.txt`);
  }
  if (urlParam && !targetUrls.includes(urlParam)) {
    targetUrls.push(urlParam);
  }

  let textContent = '';
  let fetchSuccess = false;

  for (const targetUrl of targetUrls) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(targetUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': `Bookarium-PublicDomain-Reader/1.0 (${SITE_CONFIG.GITHUB_REPO})`,
          Accept: 'text/plain, text/html, */*',
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const text = await response.text();
        // Verify it's not a redirect HTML page
        if (text && !text.trim().startsWith('<p>The document has moved')) {
          textContent = text;
          fetchSuccess = true;
          break;
        }
      }
    } catch {
      clearTimeout(timeoutId);
    }
  }

  if (!fetchSuccess || !textContent) {
    return NextResponse.json(
      { error: 'Failed to fetch unabridged text from Project Gutenberg upstream.' },
      { status: 502 }
    );
  }

  return new NextResponse(textContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}

