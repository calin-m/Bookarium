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
  preferred_theme TEXT DEFAULT 'light',
  font_size INTEGER DEFAULT 18,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
CREATE POLICY "Users can delete their own profile"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

-- ============================================================================
-- 2. Bookshelves Table (Master 'General' + Custom Shelves)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bookshelves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.bookshelves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own bookshelves" ON public.bookshelves;
CREATE POLICY "Users can view their own bookshelves"
  ON public.bookshelves FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own bookshelves" ON public.bookshelves;
CREATE POLICY "Users can insert their own bookshelves"
  ON public.bookshelves FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own bookshelves" ON public.bookshelves;
CREATE POLICY "Users can update their own bookshelves"
  ON public.bookshelves FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own bookshelves" ON public.bookshelves;
CREATE POLICY "Users can delete their own bookshelves"
  ON public.bookshelves FOR DELETE
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
  book_authors TEXT[] NOT NULL DEFAULT '{}',
  cover_url TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(bookshelf_id, book_id)
);

ALTER TABLE public.bookshelf_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own bookshelf items" ON public.bookshelf_items;
CREATE POLICY "Users can view their own bookshelf items"
  ON public.bookshelf_items FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own bookshelf items" ON public.bookshelf_items;
CREATE POLICY "Users can insert their own bookshelf items"
  ON public.bookshelf_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own bookshelf items" ON public.bookshelf_items;
CREATE POLICY "Users can update their own bookshelf items"
  ON public.bookshelf_items FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own bookshelf items" ON public.bookshelf_items;
CREATE POLICY "Users can delete their own bookshelf items"
  ON public.bookshelf_items FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 4. Reading Progress Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reading_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL,
  current_chapter_index INTEGER NOT NULL DEFAULT 0,
  progress_percent NUMERIC NOT NULL DEFAULT 0,
  scroll_offset NUMERIC NOT NULL DEFAULT 0,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own reading progress" ON public.reading_progress;
CREATE POLICY "Users can view their own reading progress"
  ON public.reading_progress FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own reading progress" ON public.reading_progress;
CREATE POLICY "Users can insert their own reading progress"
  ON public.reading_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own reading progress" ON public.reading_progress;
CREATE POLICY "Users can update their own reading progress"
  ON public.reading_progress FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own reading progress" ON public.reading_progress;
CREATE POLICY "Users can delete their own reading progress"
  ON public.reading_progress FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 5. Auto-Provisioning User Trigger (Profile + Default General Shelf)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 6. RPC Function: Delete Current User Account
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delete_current_user()
RETURNS VOID AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
