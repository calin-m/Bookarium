-- ============================================================================
-- Bookarium — Supabase PostgreSQL Schema & Security Policies (Idempotent DDL)
-- Description: Complete idempotent DDL for profiles, custom bookshelves, items,
--              reading progress, Row Level Security (RLS), and triggers.
-- Safe to re-run multiple times without data loss or policy collision errors.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Supabase Studio CLI Migration Tracker (Prevents 42P01 dashboard warnings)
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS supabase_migrations;

CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version TEXT PRIMARY KEY,
  statements TEXT[],
  name TEXT
);

ALTER TABLE supabase_migrations.schema_migrations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 1. Profiles Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  username TEXT UNIQUE,
  bio TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  show_streak BOOLEAN NOT NULL DEFAULT true,
  show_challenge BOOLEAN NOT NULL DEFAULT true,
  show_bookshelves BOOLEAN NOT NULL DEFAULT true,
  show_saved_books BOOLEAN NOT NULL DEFAULT true,
  show_custom_shelves BOOLEAN NOT NULL DEFAULT true,
  preferred_theme TEXT DEFAULT 'light',
  font_size INTEGER DEFAULT 18,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent column additions for existing installations
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_streak BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_challenge BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_bookshelves BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_saved_books BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_custom_shelves BOOLEAN NOT NULL DEFAULT true;

-- Case-insensitive unique index for public scholar handles
CREATE UNIQUE INDEX IF NOT EXISTS unique_profile_username_lower
  ON public.profiles (lower(trim(username)))
  WHERE username IS NOT NULL;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone when is_public is true" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles or connected fellow profiles are viewable" ON public.profiles;
CREATE POLICY "Public profiles or connected fellow profiles are viewable"
  ON public.profiles FOR SELECT
  USING (
    is_public = true 
    OR auth.uid() = id
    OR (
      auth.uid() IS NOT NULL AND (
        EXISTS (
          SELECT 1 FROM public.reader_circles rc
          WHERE (rc.requester_id = auth.uid() AND rc.recipient_id = profiles.id)
             OR (rc.recipient_id = auth.uid() AND rc.requester_id = profiles.id)
        )
        OR EXISTS (
          SELECT 1 FROM public.symposium_sessions ss
          WHERE (ss.host_id = auth.uid() AND ss.fellow_id = profiles.id)
             OR (ss.fellow_id = auth.uid() AND ss.host_id = profiles.id)
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
CREATE POLICY "Users can delete their own profile"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- ============================================================================
-- 2. Bookshelves Table (Master 'General' + Custom Shelves)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bookshelves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent column additions for existing installations
ALTER TABLE public.bookshelves
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;

-- Unique constraints per user
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_default_bookshelf 
  ON public.bookshelves(user_id) 
  WHERE is_default = true;

CREATE UNIQUE INDEX IF NOT EXISTS unique_user_shelf_name 
  ON public.bookshelves(user_id, lower(trim(name)));

ALTER TABLE public.bookshelves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own bookshelves" ON public.bookshelves;
DROP POLICY IF EXISTS "Public bookshelves viewable when owner profile is public" ON public.bookshelves;
CREATE POLICY "Public bookshelves viewable when owner profile is public"
  ON public.bookshelves FOR SELECT
  USING (
    (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = bookshelves.user_id
          AND profiles.is_public = true
          AND profiles.show_bookshelves = true
          AND (
            (bookshelves.is_default = true AND profiles.show_saved_books = true AND bookshelves.is_public = true)
            OR
            (bookshelves.is_default = false AND profiles.show_custom_shelves = true AND bookshelves.is_public = true)
          )
      )
    )
    OR auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Users can insert their own bookshelves" ON public.bookshelves;
CREATE POLICY "Users can insert their own bookshelves"
  ON public.bookshelves FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own bookshelves" ON public.bookshelves;
CREATE POLICY "Users can update their own bookshelves"
  ON public.bookshelves FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own bookshelves" ON public.bookshelves;
CREATE POLICY "Users can delete their own bookshelves"
  ON public.bookshelves FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 3. Bookshelf Items Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bookshelf_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bookshelf_id UUID NOT NULL REFERENCES public.bookshelves(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL,
  book_title TEXT NOT NULL,
  book_authors JSONB NOT NULL DEFAULT '[]'::jsonb,
  book_formats JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(bookshelf_id, book_id)
);

-- Idempotent column additions for existing installations
ALTER TABLE public.bookshelf_items
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_bookshelf_items_user_id
  ON public.bookshelf_items(user_id);

ALTER TABLE public.bookshelf_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own bookshelf items" ON public.bookshelf_items;
DROP POLICY IF EXISTS "Public bookshelf items viewable when owner profile is public" ON public.bookshelf_items;
CREATE POLICY "Public bookshelf items viewable when owner profile is public"
  ON public.bookshelf_items FOR SELECT
  USING (
    (
      EXISTS (
        SELECT 1 FROM public.bookshelves
        JOIN public.profiles ON profiles.id = bookshelves.user_id
        WHERE bookshelves.id = bookshelf_items.bookshelf_id
          AND profiles.is_public = true
          AND profiles.show_bookshelves = true
          AND bookshelves.is_public = true
          AND (
            (bookshelves.is_default = true AND profiles.show_saved_books = true)
            OR
            (bookshelves.is_default = false AND profiles.show_custom_shelves = true)
          )
      )
    )
    OR auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Users can insert their own bookshelf items" ON public.bookshelf_items;
CREATE POLICY "Users can insert their own bookshelf items"
  ON public.bookshelf_items FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.bookshelves
      WHERE bookshelves.id = bookshelf_items.bookshelf_id
        AND bookshelves.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own bookshelf items" ON public.bookshelf_items;
CREATE POLICY "Users can update their own bookshelf items"
  ON public.bookshelf_items FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.bookshelves
      WHERE bookshelves.id = bookshelf_items.bookshelf_id
        AND bookshelves.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.bookshelves
      WHERE bookshelves.id = bookshelf_items.bookshelf_id
        AND bookshelves.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own bookshelf items" ON public.bookshelf_items;
CREATE POLICY "Users can delete their own bookshelf items"
  ON public.bookshelf_items FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.bookshelves
      WHERE bookshelves.id = bookshelf_items.bookshelf_id
        AND bookshelves.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. User Favorites Table (Cross-Device Liked Books Sync)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_favorites (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL,
  book_title TEXT NOT NULL,
  book_authors TEXT[] NOT NULL DEFAULT '{}',
  cover_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, book_id)
);

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own favorites" ON public.user_favorites;
CREATE POLICY "Users can view their own favorites"
  ON public.user_favorites FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own favorites" ON public.user_favorites;
CREATE POLICY "Users can insert their own favorites"
  ON public.user_favorites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own favorites" ON public.user_favorites;
CREATE POLICY "Users can delete their own favorites"
  ON public.user_favorites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 5. Reading Progress Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reading_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL,
  book_title TEXT,
  book_authors TEXT[] NOT NULL DEFAULT '{}',
  cover_url TEXT,
  current_chapter_index INTEGER NOT NULL DEFAULT 0,
  progress_percent NUMERIC NOT NULL DEFAULT 0,
  scroll_offset NUMERIC NOT NULL DEFAULT 0,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- Idempotent column migrations for existing instances:
ALTER TABLE public.reading_progress ADD COLUMN IF NOT EXISTS book_title TEXT;
ALTER TABLE public.reading_progress ADD COLUMN IF NOT EXISTS book_authors TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.reading_progress ADD COLUMN IF NOT EXISTS cover_url TEXT;

ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own reading progress" ON public.reading_progress;
CREATE POLICY "Users can view their own reading progress"
  ON public.reading_progress FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own reading progress" ON public.reading_progress;
CREATE POLICY "Users can insert their own reading progress"
  ON public.reading_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own reading progress" ON public.reading_progress;
CREATE POLICY "Users can update their own reading progress"
  ON public.reading_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own reading progress" ON public.reading_progress;
CREATE POLICY "Users can delete their own reading progress"
  ON public.reading_progress FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 6. User Annotations Table (Highlights & Scholarly Notes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL,
  chapter_index INTEGER NOT NULL,
  chapter_page INTEGER NOT NULL,
  selected_text TEXT NOT NULL,
  color TEXT NOT NULL CHECK (color IN ('yellow', 'amber', 'mint', 'rose')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.user_annotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own annotations" ON public.user_annotations;
CREATE POLICY "Users can view their own annotations"
  ON public.user_annotations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own annotations" ON public.user_annotations;
CREATE POLICY "Users can insert their own annotations"
  ON public.user_annotations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own annotations" ON public.user_annotations;
CREATE POLICY "Users can update their own annotations"
  ON public.user_annotations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own annotations" ON public.user_annotations;
CREATE POLICY "Users can delete their own annotations"
  ON public.user_annotations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_annotations_user_book 
  ON public.user_annotations(user_id, book_id);

-- ============================================================================
-- 7. User Book Curation Table (Personal 1-5 Star Ratings & Reading Statuses)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_book_curation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL,
  rating SMALLINT CHECK (rating >= 1 AND rating <= 5),
  reading_status TEXT CHECK (reading_status IN ('want_to_read', 'currently_reading', 'finished')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, book_id)
);

ALTER TABLE public.user_book_curation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own book curation" ON public.user_book_curation;
CREATE POLICY "Users can view their own book curation"
  ON public.user_book_curation FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own book curation" ON public.user_book_curation;
CREATE POLICY "Users can insert their own book curation"
  ON public.user_book_curation FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own book curation" ON public.user_book_curation;
CREATE POLICY "Users can update their own book curation"
  ON public.user_book_curation FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own book curation" ON public.user_book_curation;
CREATE POLICY "Users can delete their own book curation"
  ON public.user_book_curation FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_book_curation_user_book 
  ON public.user_book_curation(user_id, book_id);

-- ============================================================================
-- 8. Auto-Provisioning User Trigger (Profile + Default General Shelf)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- 1. Create user profile
  INSERT INTO public.profiles (id, display_name, preferred_theme)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      'Reader'
    ),
    'light'
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. Create master default General bookshelf
  INSERT INTO public.bookshelves (user_id, name, is_default)
  VALUES (
    NEW.id,
    'General',
    true
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Security hardening: Trigger functions should never be executable via PostgREST RPC
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 9. RPC Function: Delete Current User Account
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delete_current_user()
RETURNS VOID 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Enforce active authenticated session
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Security hardening: Disallow anonymous execution; allow authenticated users to self-delete
REVOKE EXECUTE ON FUNCTION public.delete_current_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_current_user() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_current_user() TO authenticated;

-- Security hardening: Protect rls_auto_enable if provisioned on remote database
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;';
    EXECUTE 'ALTER FUNCTION public.rls_auto_enable() SET search_path = ''''';
  END IF;
END $$;

-- ============================================================================
-- 10. User Reading Habits Table (Streaks, Active Days & Annual Goals)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_reading_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  annual_goal INTEGER NOT NULL DEFAULT 12,
  annual_goal_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  active_dates JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_reading_seconds BIGINT NOT NULL DEFAULT 0,
  total_listening_seconds BIGINT NOT NULL DEFAULT 0,
  completed_books_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id)
);

ALTER TABLE public.user_reading_habits
  ADD COLUMN IF NOT EXISTS total_listening_seconds BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.user_reading_habits
  ADD COLUMN IF NOT EXISTS completed_books_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.user_reading_habits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own reading habits" ON public.user_reading_habits;
DROP POLICY IF EXISTS "Public reading habits viewable when owner profile is public" ON public.user_reading_habits;
CREATE POLICY "Public reading habits viewable when owner profile is public"
  ON public.user_reading_habits FOR SELECT
  USING (
    (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = user_reading_habits.user_id
          AND profiles.is_public = true
          AND (profiles.show_streak = true OR profiles.show_challenge = true)
      )
    )
    OR auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Users can insert their own reading habits" ON public.user_reading_habits;
CREATE POLICY "Users can insert their own reading habits"
  ON public.user_reading_habits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own reading habits" ON public.user_reading_habits;
CREATE POLICY "Users can update their own reading habits"
  ON public.user_reading_habits FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own reading habits" ON public.user_reading_habits;
CREATE POLICY "Users can delete their own reading habits"
  ON public.user_reading_habits FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_reading_habits_user 
  ON public.user_reading_habits(user_id);

-- ============================================================================
-- 9. User Accolades Table (Literary Accolades & Ex-Libris Bookplates)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_accolades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accolade_id TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_user_accolade 
  ON public.user_accolades(user_id, accolade_id);

CREATE INDEX IF NOT EXISTS idx_user_accolades_user 
  ON public.user_accolades(user_id);

ALTER TABLE public.user_accolades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own accolades" ON public.user_accolades;
DROP POLICY IF EXISTS "Public pinned accolades viewable when owner profile is public" ON public.user_accolades;
CREATE POLICY "Public pinned accolades viewable when owner profile is public"
  ON public.user_accolades FOR SELECT
  USING (
    (
      is_pinned = true AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = user_accolades.user_id
          AND profiles.is_public = true
      )
    )
    OR auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Users can insert their own accolades" ON public.user_accolades;
CREATE POLICY "Users can insert their own accolades"
  ON public.user_accolades FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own accolades" ON public.user_accolades;
CREATE POLICY "Users can update their own accolades"
  ON public.user_accolades FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own accolades" ON public.user_accolades;
CREATE POLICY "Users can delete their own accolades"
  ON public.user_accolades FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 9. Books Table (Self-Hosted Public Domain Catalog)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.books (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  authors JSONB NOT NULL DEFAULT '[]'::jsonb,
  translators JSONB NOT NULL DEFAULT '[]'::jsonb,
  subjects TEXT[] NOT NULL DEFAULT '{}'::text[],
  bookshelves TEXT[] NOT NULL DEFAULT '{}'::text[],
  languages TEXT[] NOT NULL DEFAULT '{en}'::text[],
  copyright BOOLEAN NOT NULL DEFAULT false,
  media_type TEXT NOT NULL DEFAULT 'Text',
  formats JSONB NOT NULL DEFAULT '{}'::jsonb,
  download_count INTEGER NOT NULL DEFAULT 0,
  max_author_death_year INTEGER,
  min_author_birth_year INTEGER,
  content TEXT,
  search_vector TSVECTOR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent column evolution for existing public.books tables
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS content TEXT;

-- Trigger to automatically populate and maintain search_vector on insert/update
CREATE OR REPLACE FUNCTION public.books_search_vector_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.search_vector := pg_catalog.to_tsvector(
    'pg_catalog.english'::pg_catalog.regconfig,
    COALESCE(NEW.title, '') || ' ' || COALESCE(pg_catalog.array_to_string(NEW.subjects, ' '), '')
  );
  RETURN NEW;
END;
$$;

-- Security hardening: Trigger functions should never be executable via PostgREST RPC
REVOKE EXECUTE ON FUNCTION public.books_search_vector_trigger() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.books_search_vector_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.books_search_vector_trigger() FROM authenticated;

DROP TRIGGER IF EXISTS trigger_books_search_vector ON public.books;
CREATE TRIGGER trigger_books_search_vector
  BEFORE INSERT OR UPDATE OF title, subjects ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.books_search_vector_trigger();

-- Full-text search and query performance indexes
CREATE INDEX IF NOT EXISTS idx_books_search_vector ON public.books USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_books_languages ON public.books USING GIN(languages);
CREATE INDEX IF NOT EXISTS idx_books_subjects ON public.books USING GIN(subjects);
CREATE INDEX IF NOT EXISTS idx_books_download_count ON public.books(download_count DESC);
CREATE INDEX IF NOT EXISTS idx_books_author_death_year ON public.books(max_author_death_year);

-- Row Level Security (RLS)
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

-- Allow public read access to catalog books (Zero API Key Requirement)
DROP POLICY IF EXISTS "Allow public read access to catalog books" ON public.books;
CREATE POLICY "Allow public read access to catalog books"
  ON public.books FOR SELECT
  USING (true);

-- Mutations restricted to service_role (Admin / Ingestion Script)
-- Anonymous and standard authenticated clients cannot mutate the catalog
DROP POLICY IF EXISTS "Service role can manage catalog books" ON public.books;
CREATE POLICY "Service role can manage catalog books"
  ON public.books FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 10. Book Translations Junction Table (Relational Multilingual Catalog)
-- Strictly relational: stores lightweight routing metadata (< 2.5 MB total for 75,000 books)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.book_translations (
  work_id TEXT NOT NULL,
  book_id INTEGER NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  language VARCHAR(10) NOT NULL,
  is_original BOOLEAN DEFAULT false,
  confidence_score NUMERIC(3, 2) DEFAULT 1.00,
  source VARCHAR(32) DEFAULT 'authority_wikidata',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (work_id, book_id)
);

CREATE INDEX IF NOT EXISTS idx_book_translations_book_id ON public.book_translations (book_id);
CREATE INDEX IF NOT EXISTS idx_book_translations_work_id ON public.book_translations (work_id);
CREATE INDEX IF NOT EXISTS idx_book_translations_work_lang ON public.book_translations (work_id, language);

ALTER TABLE public.book_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access for book translations" ON public.book_translations;
CREATE POLICY "Public read access for book translations"
  ON public.book_translations FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role can manage book translations" ON public.book_translations;
CREATE POLICY "Service role can manage book translations"
  ON public.book_translations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 11. Reader Circles & Literary Symposiums (Dual Reading — Milestone 7)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reader_circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_username TEXT NOT NULL DEFAULT '',
  requester_display_name TEXT NOT NULL DEFAULT 'Scholar',
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_username TEXT NOT NULL DEFAULT '',
  recipient_display_name TEXT NOT NULL DEFAULT 'Scholar',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(requester_id, recipient_id),
  CHECK (requester_id <> recipient_id)
);

ALTER TABLE public.reader_circles ADD COLUMN IF NOT EXISTS requester_username TEXT NOT NULL DEFAULT '';
ALTER TABLE public.reader_circles ADD COLUMN IF NOT EXISTS requester_display_name TEXT NOT NULL DEFAULT 'Scholar';
ALTER TABLE public.reader_circles ADD COLUMN IF NOT EXISTS recipient_username TEXT NOT NULL DEFAULT '';
ALTER TABLE public.reader_circles ADD COLUMN IF NOT EXISTS recipient_display_name TEXT NOT NULL DEFAULT 'Scholar';

CREATE INDEX IF NOT EXISTS idx_reader_circles_requester ON public.reader_circles(requester_id);
CREATE INDEX IF NOT EXISTS idx_reader_circles_recipient ON public.reader_circles(recipient_id);

ALTER TABLE public.reader_circles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view their reader circle connections" ON public.reader_circles;
CREATE POLICY "Participants can view their reader circle connections"
  ON public.reader_circles FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Scholars can send reader circle invitations" ON public.reader_circles;
CREATE POLICY "Scholars can send reader circle invitations"
  ON public.reader_circles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id AND requester_id <> recipient_id);

DROP POLICY IF EXISTS "Participants can update their reader circle status" ON public.reader_circles;
CREATE POLICY "Participants can update their reader circle status"
  ON public.reader_circles FOR UPDATE
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = requester_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Participants can remove reader circle connections" ON public.reader_circles;
CREATE POLICY "Participants can remove reader circle connections"
  ON public.reader_circles FOR DELETE
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

-- Literary Symposium Sessions (Per-Volume Shared Reading Pacts)
CREATE TABLE IF NOT EXISTS public.symposium_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id INTEGER NOT NULL,
  book_title TEXT NOT NULL DEFAULT '',
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host_username TEXT NOT NULL DEFAULT '',
  host_display_name TEXT NOT NULL DEFAULT 'Scholar',
  fellow_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fellow_username TEXT NOT NULL DEFAULT '',
  fellow_display_name TEXT NOT NULL DEFAULT 'Scholar',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  host_chapter INTEGER NOT NULL DEFAULT 0,
  host_progress INTEGER NOT NULL DEFAULT 0 CHECK (host_progress >= 0 AND host_progress <= 100),
  fellow_chapter INTEGER NOT NULL DEFAULT 0,
  fellow_progress INTEGER NOT NULL DEFAULT 0 CHECK (fellow_progress >= 0 AND fellow_progress <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(book_id, host_id, fellow_id),
  CHECK (host_id <> fellow_id)
);

ALTER TABLE public.symposium_sessions ADD COLUMN IF NOT EXISTS book_title TEXT NOT NULL DEFAULT '';
ALTER TABLE public.symposium_sessions ADD COLUMN IF NOT EXISTS host_username TEXT NOT NULL DEFAULT '';
ALTER TABLE public.symposium_sessions ADD COLUMN IF NOT EXISTS host_display_name TEXT NOT NULL DEFAULT 'Scholar';
ALTER TABLE public.symposium_sessions ADD COLUMN IF NOT EXISTS fellow_username TEXT NOT NULL DEFAULT '';
ALTER TABLE public.symposium_sessions ADD COLUMN IF NOT EXISTS fellow_display_name TEXT NOT NULL DEFAULT 'Scholar';
ALTER TABLE public.symposium_sessions ADD COLUMN IF NOT EXISTS host_chapter INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.symposium_sessions ADD COLUMN IF NOT EXISTS host_progress INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.symposium_sessions ADD COLUMN IF NOT EXISTS fellow_chapter INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.symposium_sessions ADD COLUMN IF NOT EXISTS fellow_progress INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_symposium_sessions_host ON public.symposium_sessions(host_id);
CREATE INDEX IF NOT EXISTS idx_symposium_sessions_fellow ON public.symposium_sessions(fellow_id);
CREATE INDEX IF NOT EXISTS idx_symposium_sessions_book ON public.symposium_sessions(book_id);

ALTER TABLE public.symposium_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view their symposium sessions" ON public.symposium_sessions;
CREATE POLICY "Participants can view their symposium sessions"
  ON public.symposium_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = host_id OR auth.uid() = fellow_id);

DROP POLICY IF EXISTS "Hosts can create symposium invitations" ON public.symposium_sessions;
CREATE POLICY "Hosts can create symposium invitations"
  ON public.symposium_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id AND host_id <> fellow_id);

DROP POLICY IF EXISTS "Participants can update their symposium progress and status" ON public.symposium_sessions;
CREATE POLICY "Participants can update their symposium progress and status"
  ON public.symposium_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id OR auth.uid() = fellow_id)
  WITH CHECK (auth.uid() = host_id OR auth.uid() = fellow_id);

DROP POLICY IF EXISTS "Participants can leave or delete symposium sessions" ON public.symposium_sessions;
CREATE POLICY "Participants can leave or delete symposium sessions"
  ON public.symposium_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = host_id OR auth.uid() = fellow_id);

-- Scoped Marginalia Visibility: Allow Fellow Scholars to read annotations ONLY in shared Symposium volumes
DROP POLICY IF EXISTS "Fellows can view annotations in active symposiums" ON public.user_annotations;
CREATE POLICY "Fellows can view annotations in active symposiums"
  ON public.user_annotations FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.symposium_sessions s
      WHERE s.book_id = user_annotations.book_id
        AND s.status IN ('active', 'completed')
        AND (
          (s.host_id = auth.uid() AND s.fellow_id = user_annotations.user_id)
          OR (s.fellow_id = auth.uid() AND s.host_id = user_annotations.user_id)
        )
    )
  );

-- Zero-PII Handle Lookup RPC for Private-Sanctuary Reader Circle Invitations
CREATE OR REPLACE FUNCTION public.lookup_scholar_by_username(target_username TEXT)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.username,
    COALESCE(p.display_name, 'Scholar') AS display_name
  FROM public.profiles p
  WHERE LOWER(p.username) = LOWER(TRIM(target_username))
  LIMIT 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.lookup_scholar_by_username(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.lookup_scholar_by_username(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.lookup_scholar_by_username(TEXT) TO authenticated;

-- Automatic Profile Identity Propagation to Reader Circles and Literary Symposiums
CREATE OR REPLACE FUNCTION public.handle_profile_identity_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Sync updated username and display_name into reader_circles
  UPDATE public.reader_circles
  SET requester_username = COALESCE(NEW.username, requester_username),
      requester_display_name = COALESCE(NEW.display_name, requester_display_name),
      updated_at = timezone('utc'::text, now())
  WHERE requester_id = NEW.id;

  UPDATE public.reader_circles
  SET recipient_username = COALESCE(NEW.username, recipient_username),
      recipient_display_name = COALESCE(NEW.display_name, recipient_display_name),
      updated_at = timezone('utc'::text, now())
  WHERE recipient_id = NEW.id;

  -- Sync updated username and display_name into symposium_sessions
  UPDATE public.symposium_sessions
  SET host_username = COALESCE(NEW.username, host_username),
      host_display_name = COALESCE(NEW.display_name, host_display_name),
      updated_at = timezone('utc'::text, now())
  WHERE host_id = NEW.id;

  UPDATE public.symposium_sessions
  SET fellow_username = COALESCE(NEW.username, fellow_username),
      fellow_display_name = COALESCE(NEW.display_name, fellow_display_name),
      updated_at = timezone('utc'::text, now())
  WHERE fellow_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_identity_sync ON public.profiles;
CREATE TRIGGER trg_profile_identity_sync
  AFTER UPDATE OF username, display_name ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_identity_sync();

-- Idempotent data healing for existing reader_circles rows
UPDATE public.reader_circles rc
SET requester_username = p.username,
    requester_display_name = COALESCE(p.display_name, rc.requester_display_name)
FROM public.profiles p
WHERE rc.requester_id = p.id
  AND p.username IS NOT NULL
  AND (rc.requester_username = '' OR rc.requester_username = 'scholar' OR rc.requester_username <> p.username);

UPDATE public.reader_circles rc
SET recipient_username = p.username,
    recipient_display_name = COALESCE(p.display_name, rc.recipient_display_name)
FROM public.profiles p
WHERE rc.recipient_id = p.id
  AND p.username IS NOT NULL
  AND (rc.recipient_username = '' OR rc.recipient_username = 'scholar' OR rc.recipient_username <> p.username);

-- Idempotent data healing for existing symposium_sessions rows
UPDATE public.symposium_sessions ss
SET host_username = p.username,
    host_display_name = COALESCE(p.display_name, ss.host_display_name)
FROM public.profiles p
WHERE ss.host_id = p.id
  AND p.username IS NOT NULL
  AND (ss.host_username = '' OR ss.host_username = 'scholar' OR ss.host_username <> p.username);

UPDATE public.symposium_sessions ss
SET fellow_username = p.username,
    fellow_display_name = COALESCE(p.display_name, ss.fellow_display_name)
FROM public.profiles p
WHERE ss.fellow_id = p.id
  AND p.username IS NOT NULL
  AND (ss.fellow_username = '' OR ss.fellow_username = 'scholar' OR ss.fellow_username <> p.username);
