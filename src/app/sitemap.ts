import type { MetadataRoute } from 'next';
import { SITE_CONFIG } from '@/config/site-config';

export const FEATURED_CLASSIC_BOOK_IDS = [
  84, // Frankenstein by Mary Wollstonecraft Shelley
  1342, // Pride and Prejudice by Jane Austen
  11, // Alice's Adventures in Wonderland by Lewis Carroll
  345, // Dracula by Bram Stoker
  64317, // The Great Gatsby by F. Scott Fitzgerald
  2701, // Moby Dick by Herman Melville
  1661, // The Adventures of Sherlock Holmes by Arthur Conan Doyle
  1232, // The Prince by Niccolò Machiavelli
  74, // The Adventures of Tom Sawyer by Mark Twain
  98, // A Tale of Two Cities by Charles Dickens
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = SITE_CONFIG.SITE_URL;
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  for (const bookId of FEATURED_CLASSIC_BOOK_IDS) {
    entries.push({
      url: `${baseUrl}/read/${bookId}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  }

  return entries;
}

