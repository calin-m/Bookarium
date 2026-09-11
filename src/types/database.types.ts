export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          username: string | null;
          bio: string | null;
          is_public: boolean;
          show_streak: boolean;
          show_challenge: boolean;
          show_bookshelves: boolean;
          show_saved_books?: boolean;
          show_custom_shelves?: boolean;
          preferred_theme: string | null;
          font_size: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          username?: string | null;
          bio?: string | null;
          is_public?: boolean;
          show_streak?: boolean;
          show_challenge?: boolean;
          show_bookshelves?: boolean;
          show_saved_books?: boolean;
          show_custom_shelves?: boolean;
          preferred_theme?: string | null;
          font_size?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          username?: string | null;
          bio?: string | null;
          is_public?: boolean;
          show_streak?: boolean;
          show_challenge?: boolean;
          show_bookshelves?: boolean;
          show_saved_books?: boolean;
          show_custom_shelves?: boolean;
          preferred_theme?: string | null;
          font_size?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bookshelves: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          is_default: boolean;
          is_public?: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          is_default?: boolean;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          is_default?: boolean;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bookshelf_items: {
        Row: {
          id: string;
          bookshelf_id: string;
          user_id: string;
          book_id: number;
          book_title: string;
          book_authors: string[];
          cover_url: string | null;
          added_at: string;
        };
        Insert: {
          id?: string;
          bookshelf_id: string;
          user_id: string;
          book_id: number;
          book_title: string;
          book_authors?: string[];
          cover_url?: string | null;
          added_at?: string;
        };
        Update: {
          id?: string;
          bookshelf_id?: string;
          user_id?: string;
          book_id?: number;
          book_title?: string;
          book_authors?: string[];
          cover_url?: string | null;
          added_at?: string;
        };
        Relationships: [];
      };
      reading_progress: {
        Row: {
          id: string;
          user_id: string;
          book_id: number;
          book_title: string | null;
          book_authors: string[];
          cover_url: string | null;
          current_chapter_index: number;
          progress_percent: number;
          scroll_offset: number;
          last_read_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          book_id: number;
          book_title?: string | null;
          book_authors?: string[];
          cover_url?: string | null;
          current_chapter_index?: number;
          progress_percent?: number;
          scroll_offset?: number;
          last_read_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          book_id?: number;
          book_title?: string | null;
          book_authors?: string[];
          cover_url?: string | null;
          current_chapter_index?: number;
          progress_percent?: number;
          scroll_offset?: number;
          last_read_at?: string;
        };
        Relationships: [];
      };
      user_favorites: {
        Row: {
          user_id: string;
          book_id: number;
          book_title: string;
          book_authors: string[];
          cover_url: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          book_id: number;
          book_title: string;
          book_authors?: string[];
          cover_url?: string | null;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          book_id?: number;
          book_title?: string;
          book_authors?: string[];
          cover_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      user_annotations: {
        Row: {
          id: string;
          user_id: string;
          book_id: number;
          chapter_index: number;
          chapter_page: number;
          selected_text: string;
          color: string;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          book_id: number;
          chapter_index: number;
          chapter_page: number;
          selected_text: string;
          color: string;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          book_id?: number;
          chapter_index?: number;
          chapter_page?: number;
          selected_text?: string;
          color?: string;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_book_curation: {
        Row: {
          id: string;
          user_id: string;
          book_id: number;
          rating: number | null;
          reading_status: 'want_to_read' | 'currently_reading' | 'finished' | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          book_id: number;
          rating?: number | null;
          reading_status?: 'want_to_read' | 'currently_reading' | 'finished' | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          book_id?: number;
          rating?: number | null;
          reading_status?: 'want_to_read' | 'currently_reading' | 'finished' | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_reading_habits: {
        Row: {
          id: string;
          user_id: string;
          annual_goal: number;
          annual_goal_year: number;
          active_dates: Json;
          total_reading_seconds: number;
          total_listening_seconds: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          annual_goal?: number;
          annual_goal_year?: number;
          active_dates?: Json;
          total_reading_seconds?: number;
          total_listening_seconds?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          annual_goal?: number;
          annual_goal_year?: number;
          active_dates?: Json;
          total_reading_seconds?: number;
          total_listening_seconds?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_accolades: {
        Row: {
          id: string;
          user_id: string;
          accolade_id: string;
          unlocked_at: string;
          is_pinned: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          accolade_id: string;
          unlocked_at?: string;
          is_pinned?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          accolade_id?: string;
          unlocked_at?: string;
          is_pinned?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      books: {
        Row: {
          id: number;
          title: string;
          authors: Json;
          translators: Json;
          subjects: string[];
          bookshelves: string[];
          languages: string[];
          copyright: boolean;
          media_type: string;
          formats: Json;
          download_count: number;
          max_author_death_year: number | null;
          min_author_birth_year: number | null;
          content?: string | null;
          search_vector?: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: number;
          title: string;
          authors?: Json;
          translators?: Json;
          subjects?: string[];
          bookshelves?: string[];
          languages?: string[];
          copyright?: boolean;
          media_type?: string;
          formats?: Json;
          download_count?: number;
          max_author_death_year?: number | null;
          min_author_birth_year?: number | null;
          content?: string | null;
          search_vector?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          title?: string;
          authors?: Json;
          translators?: Json;
          subjects?: string[];
          bookshelves?: string[];
          languages?: string[];
          copyright?: boolean;
          media_type?: string;
          formats?: Json;
          download_count?: number;
          max_author_death_year?: number | null;
          min_author_birth_year?: number | null;
          content?: string | null;
          search_vector?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      delete_current_user: {
        Args: Record<string, never>;
        Returns: void;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Bookshelf = Database['public']['Tables']['bookshelves']['Row'];
export type BookshelfItem = Database['public']['Tables']['bookshelf_items']['Row'];
export type UserFavorite = Database['public']['Tables']['user_favorites']['Row'];
export type ReadingProgress = Database['public']['Tables']['reading_progress']['Row'];
export type UserAnnotation = Database['public']['Tables']['user_annotations']['Row'];
export type UserBookCuration = Database['public']['Tables']['user_book_curation']['Row'];
export type UserReadingHabits = Database['public']['Tables']['user_reading_habits']['Row'];
export type UserAccolade = Database['public']['Tables']['user_accolades']['Row'];
export type DatabaseBook = Database['public']['Tables']['books']['Row'];