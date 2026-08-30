import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const topic = searchParams.get('topic') || '';
    const languages = searchParams.get('languages') || '';
    const page = searchParams.get('page') || '1';

    const gutendexParams = new URLSearchParams();

    // STRICT ZERO-COPYRIGHT ENFORCEMENT
    gutendexParams.set('copyright', 'false');

    if (search.trim()) {
      gutendexParams.set('search', search.trim());
    }
    if (topic.trim()) {
      gutendexParams.set('topic', topic.trim());
    }
    if (languages.trim()) {
      gutendexParams.set('languages', languages.trim());
    }
    if (page && parseInt(page, 10) > 1) {
      gutendexParams.set('page', page);
    }

    const apiUrl = `https://gutendex.com/books?${gutendexParams.toString()}`;
    const response = await fetch(apiUrl, {
      headers: {
        Accept: 'application/json',
      },
      next: { revalidate: 300 }, // Next.js cache for 5 minutes
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream error from Gutendex: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal Server Error while querying public domain books', details: error.message },
      { status: 500 }
    );
  }
}

