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
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
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
  ADD COLUMN IF NOT EXISTS show_custom_shelves BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Case-insensitive unique index for public scholar handles
CREATE UNIQUE INDEX IF NOT EXISTS unique_profile_username_lower
  ON public.profiles (lower(trim(username)))
  WHERE username IS NOT NULL;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone when is_public is true" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles or connected fellow profiles are viewable" ON public.profiles;
CREATE POLICY "Public profiles or connected fellow profiles are viewable"
  ON public.profiles FOR SELECT
  USING (
    is_public = true 
    OR (select auth.uid()) = id
    OR (
      (select auth.uid()) IS NOT NULL AND (
        EXISTS (
          SELECT 1 FROM public.reader_circles rc
          WHERE (rc.requester_id = (select auth.uid()) AND rc.recipient_id = profiles.id)
             OR (rc.recipient_id = (select auth.uid()) AND rc.requester_id = profiles.id)
        )
        OR EXISTS (
          SELECT 1 FROM public.symposium_sessions ss
          WHERE (ss.host_id = (select auth.uid()) AND ss.fellow_id = profiles.id)
             OR (ss.fellow_id = (select auth.uid()) AND ss.host_id = profiles.id)
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
CREATE POLICY "Users can delete their own profile"
  ON public.profiles FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = id);

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

DROP POLICY IF EXISTS "Users can manage own bookshelves" ON public.bookshelves;
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
    OR (select auth.uid()) = user_id
  );

DROP POLICY IF EXISTS "Users can insert their own bookshelves" ON public.bookshelves;
CREATE POLICY "Users can insert their own bookshelves"
  ON public.bookshelves FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own bookshelves" ON public.bookshelves;
CREATE POLICY "Users can update their own bookshelves"
  ON public.bookshelves FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own bookshelves" ON public.bookshelves;
CREATE POLICY "Users can delete their own bookshelves"
  ON public.bookshelves FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

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
  cover_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(bookshelf_id, book_id)
);

-- Idempotent column additions for existing installations
ALTER TABLE public.bookshelf_items
  ADD COLUMN IF NOT EXISTS cover_url TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_bookshelf_items_user_id
  ON public.bookshelf_items(user_id);

ALTER TABLE public.bookshelf_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own bookshelf items" ON public.bookshelf_items;
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
    OR (select auth.uid()) = user_id
  );

DROP POLICY IF EXISTS "Users can insert their own bookshelf items" ON public.bookshelf_items;
CREATE POLICY "Users can insert their own bookshelf items"
  ON public.bookshelf_items FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.bookshelves
      WHERE bookshelves.id = bookshelf_items.bookshelf_id
        AND bookshelves.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own bookshelf items" ON public.bookshelf_items;
CREATE POLICY "Users can update their own bookshelf items"
  ON public.bookshelf_items FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.bookshelves
      WHERE bookshelves.id = bookshelf_items.bookshelf_id
        AND bookshelves.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.bookshelves
      WHERE bookshelves.id = bookshelf_items.bookshelf_id
        AND bookshelves.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own bookshelf items" ON public.bookshelf_items;
CREATE POLICY "Users can delete their own bookshelf items"
  ON public.bookshelf_items FOR DELETE
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.bookshelves
      WHERE bookshelves.id = bookshelf_items.bookshelf_id
        AND bookshelves.user_id = (select auth.uid())
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

DROP POLICY IF EXISTS "Users can manage own favorites" ON public.user_favorites;
DROP POLICY IF EXISTS "Users can view their own favorites" ON public.user_favorites;
CREATE POLICY "Users can view their own favorites"
  ON public.user_favorites FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own favorites" ON public.user_favorites;
CREATE POLICY "Users can insert their own favorites"
  ON public.user_favorites FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own favorites" ON public.user_favorites;
CREATE POLICY "Users can delete their own favorites"
  ON public.user_favorites FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

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
  bookmark_text TEXT,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- Idempotent column migrations for existing instances:
ALTER TABLE public.reading_progress ADD COLUMN IF NOT EXISTS book_title TEXT;
ALTER TABLE public.reading_progress ADD COLUMN IF NOT EXISTS book_authors TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.reading_progress ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE public.reading_progress ADD COLUMN IF NOT EXISTS bookmark_text TEXT;

ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own reading progress" ON public.reading_progress;
DROP POLICY IF EXISTS "Users can view their own reading progress" ON public.reading_progress;
CREATE POLICY "Users can view their own reading progress"
  ON public.reading_progress FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own reading progress" ON public.reading_progress;
CREATE POLICY "Users can insert their own reading progress"
  ON public.reading_progress FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own reading progress" ON public.reading_progress;
CREATE POLICY "Users can update their own reading progress"
  ON public.reading_progress FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own reading progress" ON public.reading_progress;
CREATE POLICY "Users can delete their own reading progress"
  ON public.reading_progress FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

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

DROP POLICY IF EXISTS "Users can insert their own annotations" ON public.user_annotations;
CREATE POLICY "Users can insert their own annotations"
  ON public.user_annotations FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own annotations" ON public.user_annotations;
CREATE POLICY "Users can update their own annotations"
  ON public.user_annotations FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own annotations" ON public.user_annotations;
CREATE POLICY "Users can delete their own annotations"
  ON public.user_annotations FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

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
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own book curation" ON public.user_book_curation;
CREATE POLICY "Users can insert their own book curation"
  ON public.user_book_curation FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own book curation" ON public.user_book_curation;
CREATE POLICY "Users can update their own book curation"
  ON public.user_book_curation FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own book curation" ON public.user_book_curation;
CREATE POLICY "Users can delete their own book curation"
  ON public.user_book_curation FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

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
DECLARE
  target_uid UUID := auth.uid();
BEGIN
  -- Enforce active authenticated session
  IF target_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Explicitly purge all shared and personal relational rows across all 11 user tables
  DELETE FROM public.symposium_sessions WHERE host_id = target_uid OR fellow_id = target_uid;
  DELETE FROM public.reader_circles WHERE requester_id = target_uid OR recipient_id = target_uid;
  DELETE FROM public.user_accolades WHERE user_id = target_uid;
  DELETE FROM public.user_annotations WHERE user_id = target_uid;
  DELETE FROM public.reading_progress WHERE user_id = target_uid;
  DELETE FROM public.user_favorites WHERE user_id = target_uid;
  DELETE FROM public.user_book_curation WHERE user_id = target_uid;
  DELETE FROM public.user_reading_habits WHERE user_id = target_uid;
  DELETE FROM public.bookshelf_items WHERE user_id = target_uid;
  DELETE FROM public.bookshelves WHERE user_id = target_uid;
  DELETE FROM public.profiles WHERE id = target_uid;

  -- 2. Purge any user-owned objects in Supabase Storage if storage.objects exists
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage' AND c.relname = 'objects'
  ) THEN
    EXECUTE 'DELETE FROM storage.objects WHERE owner = $1 OR owner_id = $1::text'
      USING target_uid;
  END IF;

  -- 3. Delete root authentication account (cascades auth.identities, sessions, refresh_tokens)
  DELETE FROM auth.users WHERE id = target_uid;
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
    OR (select auth.uid()) = user_id
  );

DROP POLICY IF EXISTS "Users can insert their own reading habits" ON public.user_reading_habits;
CREATE POLICY "Users can insert their own reading habits"
  ON public.user_reading_habits FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own reading habits" ON public.user_reading_habits;
CREATE POLICY "Users can update their own reading habits"
  ON public.user_reading_habits FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own reading habits" ON public.user_reading_habits;
CREATE POLICY "Users can delete their own reading habits"
  ON public.user_reading_habits FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

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
DROP POLICY IF EXISTS "Public accolades viewable when owner profile is public" ON public.user_accolades;
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
    OR (select auth.uid()) = user_id
  );

DROP POLICY IF EXISTS "Users can insert their own accolades" ON public.user_accolades;
CREATE POLICY "Users can insert their own accolades"
  ON public.user_accolades FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own accolades" ON public.user_accolades;
CREATE POLICY "Users can update their own accolades"
  ON public.user_accolades FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own accolades" ON public.user_accolades;
CREATE POLICY "Users can delete their own accolades"
  ON public.user_accolades FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 9. Books Table (Dedicated Public Domain Catalog)
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
  -- Joint-authorship invariant (Berne Convention Art. 7bis): NULL if any contributor has unlisted dates
  max_author_death_year INTEGER,
  min_author_birth_year INTEGER,
  quotes JSONB NOT NULL DEFAULT '[]'::jsonb,
  content TEXT,
  search_vector TSVECTOR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent column evolution for existing public.books tables
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS quotes JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Trigger to automatically populate and maintain search_vector on insert/update
-- Guards UPDATE with IS DISTINCT FROM so download_count-only upserts never recompute
-- to_tsvector() or dirty the idx_books_search_vector GIN index.
CREATE OR REPLACE FUNCTION public.books_search_vector_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.search_vector IS NULL
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.subjects IS DISTINCT FROM OLD.subjects
     OR NEW.bookshelves IS DISTINCT FROM OLD.bookshelves
  THEN
    NEW.search_vector := pg_catalog.to_tsvector(
      'pg_catalog.english'::pg_catalog.regconfig,
      COALESCE(NEW.title, '') || ' ' ||
      COALESCE(pg_catalog.array_to_string(NEW.subjects, ' '), '') || ' ' ||
      COALESCE(pg_catalog.array_to_string(NEW.bookshelves, ' '), '')
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Security hardening: Trigger functions should never be executable via PostgREST RPC
REVOKE EXECUTE ON FUNCTION public.books_search_vector_trigger() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.books_search_vector_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.books_search_vector_trigger() FROM authenticated;

DROP TRIGGER IF EXISTS trigger_books_search_vector ON public.books;
CREATE TRIGGER trigger_books_search_vector
  BEFORE INSERT OR UPDATE OF title, subjects, bookshelves ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.books_search_vector_trigger();

-- Full-text search and query performance indexes
-- Note: idx_books_subjects (0005_unused_index) is dropped because topic/subject searches query search_vector via idx_books_search_vector
DROP INDEX IF EXISTS public.idx_books_subjects;
CREATE INDEX IF NOT EXISTS idx_books_search_vector ON public.books USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_books_languages ON public.books USING GIN(languages);
CREATE INDEX IF NOT EXISTS idx_books_download_count ON public.books(download_count DESC);
CREATE INDEX IF NOT EXISTS idx_books_author_death_year ON public.books(max_author_death_year);
CREATE INDEX IF NOT EXISTS idx_books_with_quotes_popular ON public.books(download_count DESC) WHERE quotes <> '[]'::jsonb;

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

-- Note: idx_book_translations_work_id (0005_unused_index) is dropped because work_id is the leading column of PRIMARY KEY (work_id, book_id) and idx_book_translations_work_lang
DROP INDEX IF EXISTS public.idx_book_translations_work_id;
CREATE INDEX IF NOT EXISTS idx_book_translations_book_id ON public.book_translations (book_id);
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
  USING ((select auth.uid()) = requester_id OR (select auth.uid()) = recipient_id);

DROP POLICY IF EXISTS "Scholars can send reader circle invitations" ON public.reader_circles;
CREATE POLICY "Scholars can send reader circle invitations"
  ON public.reader_circles FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = requester_id AND requester_id <> recipient_id);

DROP POLICY IF EXISTS "Participants can update their reader circle status" ON public.reader_circles;
CREATE POLICY "Participants can update their reader circle status"
  ON public.reader_circles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = requester_id OR (select auth.uid()) = recipient_id)
  WITH CHECK (
    ((select auth.uid()) = recipient_id)
    OR ((select auth.uid()) = requester_id AND status = 'pending')
  );

DROP POLICY IF EXISTS "Participants can remove reader circle connections" ON public.reader_circles;
CREATE POLICY "Participants can remove reader circle connections"
  ON public.reader_circles FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = requester_id OR (select auth.uid()) = recipient_id);

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
  USING ((select auth.uid()) = host_id OR (select auth.uid()) = fellow_id);

DROP POLICY IF EXISTS "Hosts can create symposium invitations" ON public.symposium_sessions;
CREATE POLICY "Hosts can create symposium invitations"
  ON public.symposium_sessions FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = host_id AND host_id <> fellow_id);

DROP POLICY IF EXISTS "Participants can update their symposium progress and status" ON public.symposium_sessions;
CREATE POLICY "Participants can update their symposium progress and status"
  ON public.symposium_sessions FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = host_id OR (select auth.uid()) = fellow_id)
  WITH CHECK ((select auth.uid()) = host_id OR (select auth.uid()) = fellow_id);

DROP POLICY IF EXISTS "Participants can leave or delete symposium sessions" ON public.symposium_sessions;
CREATE POLICY "Participants can leave or delete symposium sessions"
  ON public.symposium_sessions FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = host_id OR (select auth.uid()) = fellow_id);

-- Scoped Marginalia Visibility: Allow Fellow Scholars to read annotations ONLY in shared Symposium volumes
DROP POLICY IF EXISTS "Fellows can view annotations in active symposiums" ON public.user_annotations;
CREATE POLICY "Fellows can view annotations in active symposiums"
  ON public.user_annotations FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.symposium_sessions s
      WHERE s.book_id = user_annotations.book_id
        AND s.status IN ('active', 'completed')
        AND (
          (s.host_id = (select auth.uid()) AND s.fellow_id = user_annotations.user_id)
          OR (s.fellow_id = (select auth.uid()) AND s.host_id = user_annotations.user_id)
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

  IF target_username IS NULL OR char_length(btrim(target_username)) NOT BETWEEN 1 AND 64 THEN
    RETURN;
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

-- Security hardening: Trigger functions should never be executable via PostgREST RPC
REVOKE EXECUTE ON FUNCTION public.handle_profile_identity_sync() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_profile_identity_sync() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_profile_identity_sync() FROM authenticated;

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

-- ============================================================================
-- 12. Security Hardening: Participant Update Guards & Payload Ceiling Constraints
-- ============================================================================

-- Participant Column-Lock Guard: Restricts mutations in reader_circles and symposium_sessions
CREATE OR REPLACE FUNCTION public.enforce_fellowship_update_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id UUID := auth.uid();
BEGIN
  -- Allow nested triggers (such as trg_profile_identity_sync) and service-role / maintenance queries without JWT
  IF pg_trigger_depth() > 1 OR current_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'reader_circles' THEN
    -- Immutable relational keys
    IF NEW.id <> OLD.id OR NEW.requester_id <> OLD.requester_id OR NEW.recipient_id <> OLD.recipient_id OR NEW.created_at <> OLD.created_at THEN
      RAISE EXCEPTION 'Immutable fields in reader_circles cannot be altered.';
    END IF;

    -- Only the recipient can accept a pending invitation
    IF OLD.status = 'pending' AND NEW.status = 'accepted' AND current_user_id <> OLD.recipient_id THEN
      RAISE EXCEPTION 'Only the recipient may accept a reader circle invitation.';
    END IF;

    -- The requester cannot change recipient details, and recipient cannot change requester details
    IF current_user_id = OLD.requester_id THEN
      NEW.recipient_username := OLD.recipient_username;
      NEW.recipient_display_name := OLD.recipient_display_name;
    ELSIF current_user_id = OLD.recipient_id THEN
      NEW.requester_username := OLD.requester_username;
      NEW.requester_display_name := OLD.requester_display_name;
    END IF;

  ELSIF TG_TABLE_NAME = 'symposium_sessions' THEN
    -- Immutable relational keys
    IF NEW.id <> OLD.id OR NEW.book_id <> OLD.book_id OR NEW.host_id <> OLD.host_id OR NEW.fellow_id <> OLD.fellow_id OR NEW.created_at <> OLD.created_at THEN
      RAISE EXCEPTION 'Immutable fields in symposium_sessions cannot be altered.';
    END IF;

    -- Host-scoped permissions
    IF current_user_id = OLD.host_id THEN
      -- Host cannot mutate fellow reading progress or chapter
      IF NEW.fellow_chapter <> OLD.fellow_chapter OR NEW.fellow_progress <> OLD.fellow_progress THEN
        RAISE EXCEPTION 'Host cannot modify fellow reading progress.';
      END IF;
      -- Host cannot accept their own pending invitation
      IF OLD.status = 'pending' AND NEW.status = 'active' THEN
        RAISE EXCEPTION 'Host cannot self-accept a pending symposium invitation.';
      END IF;
      -- Host cannot overwrite fellow identity
      NEW.fellow_username := OLD.fellow_username;
      NEW.fellow_display_name := OLD.fellow_display_name;

    -- Fellow-scoped permissions
    ELSIF current_user_id = OLD.fellow_id THEN
      -- Fellow cannot mutate host reading progress or chapter
      IF NEW.host_chapter <> OLD.host_chapter OR NEW.host_progress <> OLD.host_progress THEN
        RAISE EXCEPTION 'Fellow cannot modify host reading progress.';
      END IF;
      -- Fellow cannot change book title
      IF NEW.book_title <> OLD.book_title THEN
        RAISE EXCEPTION 'Fellow cannot modify shared book title.';
      END IF;
      -- Fellow cannot overwrite host identity
      NEW.host_username := OLD.host_username;
      NEW.host_display_name := OLD.host_display_name;
    ELSE
      RAISE EXCEPTION 'Unauthorized symposium update.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_fellowship_update_guard() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_fellowship_update_guard() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_fellowship_update_guard() FROM authenticated;

DROP TRIGGER IF EXISTS trg_reader_circles_update_guard ON public.reader_circles;
CREATE TRIGGER trg_reader_circles_update_guard
  BEFORE UPDATE ON public.reader_circles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_fellowship_update_guard();

DROP TRIGGER IF EXISTS trg_symposium_sessions_update_guard ON public.symposium_sessions;
CREATE TRIGGER trg_symposium_sessions_update_guard
  BEFORE UPDATE ON public.symposium_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_fellowship_update_guard();

-- Idempotent Payload & Array Size Ceiling CHECK Constraints:
-- Protects against storage exhaustion and memory amplification from direct PostgREST calls
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_profiles_display_name_length') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT chk_profiles_display_name_length CHECK (char_length(display_name) <= 120);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_profiles_bio_length') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT chk_profiles_bio_length CHECK (bio IS NULL OR char_length(bio) <= 1000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_bookshelves_name_length') THEN
    ALTER TABLE public.bookshelves ADD CONSTRAINT chk_bookshelves_name_length CHECK (char_length(name) <= 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_reading_progress_bookmark_length') THEN
    ALTER TABLE public.reading_progress ADD CONSTRAINT chk_reading_progress_bookmark_length CHECK (bookmark_text IS NULL OR char_length(bookmark_text) <= 2000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_annotations_selected_text_length') THEN
    ALTER TABLE public.user_annotations ADD CONSTRAINT chk_user_annotations_selected_text_length CHECK (char_length(selected_text) <= 5000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_annotations_note_length') THEN
    ALTER TABLE public.user_annotations ADD CONSTRAINT chk_user_annotations_note_length CHECK (note IS NULL OR char_length(note) <= 10000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_reading_habits_active_dates_bound') THEN
    ALTER TABLE public.user_reading_habits ADD CONSTRAINT chk_user_reading_habits_active_dates_bound CHECK (jsonb_typeof(active_dates) = 'array' AND jsonb_array_length(active_dates) <= 5000);
  END IF;
END $$;

