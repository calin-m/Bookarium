-- ============================================================================
-- Bookarium — Supabase PostgreSQL Schema & Security Policies (Idempotent DDL)
-- Description: Complete idempotent DDL for profiles, custom bookshelves, items,
--              reading progress, Row Level Security (RLS), and triggers.
-- Safe to re-run multiple times without data loss or policy collision errors.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
CREATE POLICY "Public profiles are viewable by everyone when is_public is true"
  ON public.profiles FOR SELECT
  USING (is_public = true OR auth.uid() = id);

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
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Reader'),
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id)
);

ALTER TABLE public.user_reading_habits
  ADD COLUMN IF NOT EXISTS total_listening_seconds BIGINT NOT NULL DEFAULT 0;

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



