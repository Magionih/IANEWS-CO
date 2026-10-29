export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      ad_events: {
        Row: {
          ad_name: string;
          article_slug: string | null;
          category: string | null;
          country: string | null;
          created_at: string;
          device: string;
          event: string;
          id: string;
          page: string;
          path: string;
          referrer_host: string | null;
          session_id: string;
          slot_id: string;
          utm_campaign: string | null;
          utm_medium: string | null;
          utm_source: string | null;
          visible_ms: number;
          visible_pct: number;
          visitor_hash: string;
        };
        Insert: {
          ad_name: string;
          article_slug?: string | null;
          category?: string | null;
          country?: string | null;
          created_at?: string;
          device?: string;
          event: string;
          id?: string;
          page: string;
          path?: string;
          referrer_host?: string | null;
          session_id?: string;
          slot_id?: string;
          utm_campaign?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
          visible_ms?: number;
          visible_pct?: number;
          visitor_hash?: string;
        };
        Update: {
          ad_name?: string;
          article_slug?: string | null;
          category?: string | null;
          country?: string | null;
          created_at?: string;
          device?: string;
          event?: string;
          id?: string;
          page?: string;
          path?: string;
          referrer_host?: string | null;
          session_id?: string;
          slot_id?: string;
          utm_campaign?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
          visible_ms?: number;
          visible_pct?: number;
          visitor_hash?: string;
        };
        Relationships: [];
      };
      ai_tool_ratings: {
        Row: {
          comment: string | null;
          created_at: string;
          id: string;
          rating: number;
          tool_id: string;
          updated_at: string;
          use_case: string | null;
          user_id: string;
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          rating: number;
          tool_id: string;
          updated_at?: string;
          use_case?: string | null;
          user_id: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          rating?: number;
          tool_id?: string;
          updated_at?: string;
          use_case?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_tool_ratings_tool_id_fkey";
            columns: ["tool_id"];
            isOneToOne: false;
            referencedRelation: "ai_tools";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_tools: {
        Row: {
          about: string;
          base_score: number;
          brand: string;
          buzz_score: number;
          category: string;
          cons: string[];
          context_window: string;
          created_at: string;
          icon: string;
          id: string;
          is_active: boolean;
          last_ranked_at: string | null;
          maker: string;
          name: string;
          previous_position: number;
          previous_score: number;
          pricing: string;
          pros: string[];
          rank_position: number;
          ratings_avg: number;
          ratings_count: number;
          released: string;
          scores: Json;
          slug: string;
          updated_at: string;
          website: string;
          weekly_score: number;
        };
        Insert: {
          about?: string;
          base_score?: number;
          brand?: string;
          buzz_score?: number;
          category?: string;
          cons?: string[];
          context_window?: string;
          created_at?: string;
          icon?: string;
          id?: string;
          is_active?: boolean;
          last_ranked_at?: string | null;
          maker: string;
          name: string;
          previous_position?: number;
          previous_score?: number;
          pricing?: string;
          pros?: string[];
          rank_position?: number;
          ratings_avg?: number;
          ratings_count?: number;
          released?: string;
          scores?: Json;
          slug: string;
          updated_at?: string;
          website?: string;
          weekly_score?: number;
        };
        Update: {
          about?: string;
          base_score?: number;
          brand?: string;
          buzz_score?: number;
          category?: string;
          cons?: string[];
          context_window?: string;
          created_at?: string;
          icon?: string;
          id?: string;
          is_active?: boolean;
          last_ranked_at?: string | null;
          maker?: string;
          name?: string;
          previous_position?: number;
          previous_score?: number;
          pricing?: string;
          pros?: string[];
          rank_position?: number;
          ratings_avg?: number;
          ratings_count?: number;
          released?: string;
          scores?: Json;
          slug?: string;
          updated_at?: string;
          website?: string;
          weekly_score?: number;
        };
        Relationships: [];
      };
      articles: {
        Row: {
          analysis_markdown: string | null;
          author: string | null;
          body_markdown: string;
          business_context: string | null;
          business_impacts: string[];
          category: string;
          cover_image_url: string | null;
          created_at: string;
          dek: string | null;
          editorial_angle: string | null;
          editorial_conclusion: string | null;
          id: string;
          published_at: string;
          quality_report: Json | null;
          quality_score: number | null;
          status: string;
          origin: string | null;
          social_url: string | null;
          scheduled_by: string | null;
          read_minutes: number | null;
          seo_description: string | null;
          seo_title: string | null;
          slug: string;
          source_name: string | null;
          source_url: string | null;
          sources: Json;
          tags: string[];
          title: string;
          updated_at: string;
          views_count: number;
          why_it_matters: string | null;
        };
        Insert: {
          analysis_markdown?: string | null;
          author?: string | null;
          body_markdown: string;
          business_context?: string | null;
          business_impacts?: string[];
          category?: string;
          cover_image_url?: string | null;
          created_at?: string;
          dek?: string | null;
          editorial_angle?: string | null;
          editorial_conclusion?: string | null;
          id?: string;
          published_at?: string;
          quality_report?: Json | null;
          quality_score?: number | null;
          status?: string;
          origin?: string | null;
          social_url?: string | null;
          scheduled_by?: string | null;
          read_minutes?: number | null;
          seo_description?: string | null;
          seo_title?: string | null;
          slug: string;
          source_name?: string | null;
          source_url?: string | null;
          sources?: Json;
          tags?: string[];
          title: string;
          updated_at?: string;
          views_count?: number;
          why_it_matters?: string | null;
        };
        Update: {
          analysis_markdown?: string | null;
          author?: string | null;
          body_markdown?: string;
          business_context?: string | null;
          business_impacts?: string[];
          category?: string;
          cover_image_url?: string | null;
          created_at?: string;
          dek?: string | null;
          editorial_angle?: string | null;
          editorial_conclusion?: string | null;
          id?: string;
          published_at?: string;
          quality_report?: Json | null;
          quality_score?: number | null;
          status?: string;
          origin?: string | null;
          social_url?: string | null;
          scheduled_by?: string | null;
          read_minutes?: number | null;
          seo_description?: string | null;
          seo_title?: string | null;
          slug?: string;
          source_name?: string | null;
          source_url?: string | null;
          sources?: Json;
          tags?: string[];
          title?: string;
          updated_at?: string;
          views_count?: number;
          why_it_matters?: string | null;
        };
        Relationships: [];
      };
      contact_messages: {
        Row: {
          admin_notes: string | null;
          budget: string | null;
          company: string | null;
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          kind: string;
          message: string;
          phone: string | null;
          status: string;
          subject: string | null;
          updated_at: string;
        };
        Insert: {
          admin_notes?: string | null;
          budget?: string | null;
          company?: string | null;
          created_at?: string;
          email: string;
          full_name: string;
          id?: string;
          kind?: string;
          message: string;
          phone?: string | null;
          status?: string;
          subject?: string | null;
          updated_at?: string;
        };
        Update: {
          admin_notes?: string | null;
          budget?: string | null;
          company?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          kind?: string;
          message?: string;
          phone?: string | null;
          status?: string;
          subject?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      content_engagement: {
        Row: {
          article_slug: string;
          article_title: string;
          category: string;
          completed: boolean;
          created_at: string;
          device: string;
          id: string;
          referrer_host: string | null;
          scroll_pct: number;
          seconds: number;
          session_id: string;
          updated_at: string;
          visitor_hash: string;
        };
        Insert: {
          article_slug: string;
          article_title?: string;
          category?: string;
          completed?: boolean;
          created_at?: string;
          device?: string;
          id?: string;
          referrer_host?: string | null;
          scroll_pct?: number;
          seconds?: number;
          session_id?: string;
          updated_at?: string;
          visitor_hash?: string;
        };
        Update: {
          article_slug?: string;
          article_title?: string;
          category?: string;
          completed?: boolean;
          created_at?: string;
          device?: string;
          id?: string;
          referrer_host?: string | null;
          scroll_pct?: number;
          seconds?: number;
          session_id?: string;
          updated_at?: string;
          visitor_hash?: string;
        };
        Relationships: [];
      };
      cta_events: {
        Row: {
          article_slug: string | null;
          country: string | null;
          created_at: string;
          device: string;
          event: string;
          id: string;
          lead_email: string | null;
          path: string;
          placement: string;
          referrer_host: string | null;
          session_id: string;
          utm_campaign: string | null;
          utm_medium: string | null;
          utm_source: string | null;
          variant: string;
          visitor_hash: string;
        };
        Insert: {
          article_slug?: string | null;
          country?: string | null;
          created_at?: string;
          device?: string;
          event: string;
          id?: string;
          lead_email?: string | null;
          path?: string;
          placement: string;
          referrer_host?: string | null;
          session_id?: string;
          utm_campaign?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
          variant?: string;
          visitor_hash?: string;
        };
        Update: {
          article_slug?: string | null;
          country?: string | null;
          created_at?: string;
          device?: string;
          event?: string;
          id?: string;
          lead_email?: string | null;
          path?: string;
          placement?: string;
          referrer_host?: string | null;
          session_id?: string;
          utm_campaign?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
          variant?: string;
          visitor_hash?: string;
        };
        Relationships: [];
      };
      ingest_runs: {
        Row: {
          error: string | null;
          finished_at: string | null;
          id: string;
          imported_count: number;
          notes: string | null;
          options: Json;
          started_at: string;
          status: string;
        };
        Insert: {
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          imported_count?: number;
          notes?: string | null;
          options?: Json;
          started_at?: string;
          status?: string;
        };
        Update: {
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          imported_count?: number;
          notes?: string | null;
          options?: Json;
          started_at?: string;
          status?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          article_slug: string | null;
          confirm_token: string;
          confirmed_at: string | null;
          country: string | null;
          created_at: string;
          cta_placement: string | null;
          cta_variant: string | null;
          email: string;
          full_name: string | null;
          id: string;
          is_active: boolean;
          landing_path: string | null;
          phone: string | null;
          reminder_sent_at: string | null;
          source: string;
          unsubscribed_at: string | null;
          updated_at: string;
          utm_campaign: string | null;
          utm_medium: string | null;
          utm_source: string | null;
          welcome_sent_at: string | null;
        };
        Insert: {
          article_slug?: string | null;
          confirm_token?: string;
          confirmed_at?: string | null;
          country?: string | null;
          created_at?: string;
          cta_placement?: string | null;
          cta_variant?: string | null;
          email: string;
          full_name?: string | null;
          id?: string;
          is_active?: boolean;
          landing_path?: string | null;
          phone?: string | null;
          reminder_sent_at?: string | null;
          source?: string;
          unsubscribed_at?: string | null;
          updated_at?: string;
          utm_campaign?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
          welcome_sent_at?: string | null;
        };
        Update: {
          article_slug?: string | null;
          confirm_token?: string;
          confirmed_at?: string | null;
          country?: string | null;
          created_at?: string;
          cta_placement?: string | null;
          cta_variant?: string | null;
          email?: string;
          full_name?: string | null;
          id?: string;
          is_active?: boolean;
          landing_path?: string | null;
          phone?: string | null;
          reminder_sent_at?: string | null;
          source?: string;
          unsubscribed_at?: string | null;
          updated_at?: string;
          utm_campaign?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
          welcome_sent_at?: string | null;
        };
        Relationships: [];
      };
      newsletter_recipients: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          lead_id: string | null;
          reason: string | null;
          send_id: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          lead_id?: string | null;
          reason?: string | null;
          send_id: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          lead_id?: string | null;
          reason?: string | null;
          send_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "newsletter_recipients_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "newsletter_recipients_send_id_fkey";
            columns: ["send_id"];
            isOneToOne: false;
            referencedRelation: "newsletter_sends";
            referencedColumns: ["id"];
          },
        ];
      };
      newsletter_sends: {
        Row: {
          article_slugs: string[];
          created_at: string;
          delivered_count: number;
          edition_date: string;
          error: string | null;
          failed_count: number;
          finished_at: string | null;
          id: string;
          recipients_count: number;
          started_at: string;
          status: string;
          subject: string;
          triggered_by: string;
          updated_at: string;
        };
        Insert: {
          article_slugs?: string[];
          created_at?: string;
          delivered_count?: number;
          edition_date?: string;
          error?: string | null;
          failed_count?: number;
          finished_at?: string | null;
          id?: string;
          recipients_count?: number;
          started_at?: string;
          status?: string;
          subject: string;
          triggered_by?: string;
          updated_at?: string;
        };
        Update: {
          article_slugs?: string[];
          created_at?: string;
          delivered_count?: number;
          edition_date?: string;
          error?: string | null;
          failed_count?: number;
          finished_at?: string | null;
          id?: string;
          recipients_count?: number;
          started_at?: string;
          status?: string;
          subject?: string;
          triggered_by?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          phone: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          phone?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          phone?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      push_sends: {
        Row: {
          article_slug: string | null;
          body: string;
          created_at: string;
          delivered_count: number;
          failed_count: number;
          id: string;
          recipients_count: number;
          title: string;
          triggered_by: string;
          url: string;
        };
        Insert: {
          article_slug?: string | null;
          body: string;
          created_at?: string;
          delivered_count?: number;
          failed_count?: number;
          id?: string;
          recipients_count?: number;
          title: string;
          triggered_by?: string;
          url: string;
        };
        Update: {
          article_slug?: string | null;
          body?: string;
          created_at?: string;
          delivered_count?: number;
          failed_count?: number;
          id?: string;
          recipients_count?: number;
          title?: string;
          triggered_by?: string;
          url?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          browser: string;
          country: string | null;
          created_at: string;
          device: string;
          endpoint: string;
          failure_count: number;
          id: string;
          is_active: boolean;
          last_sent_at: string | null;
          p256dh: string;
          updated_at: string;
          user_id: string | null;
          visitor_hash: string;
        };
        Insert: {
          auth: string;
          browser?: string;
          country?: string | null;
          created_at?: string;
          device?: string;
          endpoint: string;
          failure_count?: number;
          id?: string;
          is_active?: boolean;
          last_sent_at?: string | null;
          p256dh: string;
          updated_at?: string;
          user_id?: string | null;
          visitor_hash?: string;
        };
        Update: {
          auth?: string;
          browser?: string;
          country?: string | null;
          created_at?: string;
          device?: string;
          endpoint?: string;
          failure_count?: number;
          id?: string;
          is_active?: boolean;
          last_sent_at?: string | null;
          p256dh?: string;
          updated_at?: string;
          user_id?: string | null;
          visitor_hash?: string;
        };
        Relationships: [];
      };
      reading_events: {
        Row: {
          article_slug: string;
          article_title: string;
          category: string;
          completed: boolean;
          created_at: string;
          device: string | null;
          id: string;
          minutes: number;
          read_at: string;
          read_date: string;
          scroll_pct: number;
          seconds_read: number;
          user_id: string;
        };
        Insert: {
          article_slug: string;
          article_title?: string;
          category?: string;
          completed?: boolean;
          created_at?: string;
          device?: string | null;
          id?: string;
          minutes?: number;
          read_at?: string;
          read_date?: string;
          scroll_pct?: number;
          seconds_read?: number;
          user_id: string;
        };
        Update: {
          article_slug?: string;
          article_title?: string;
          category?: string;
          completed?: boolean;
          created_at?: string;
          device?: string | null;
          id?: string;
          minutes?: number;
          read_at?: string;
          read_date?: string;
          scroll_pct?: number;
          seconds_read?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      reading_goals: {
        Row: {
          created_at: string;
          daily_streak_goal: number;
          id: string;
          updated_at: string;
          user_id: string;
          weekly_articles: number;
          weekly_minutes: number;
        };
        Insert: {
          created_at?: string;
          daily_streak_goal?: number;
          id?: string;
          updated_at?: string;
          user_id: string;
          weekly_articles?: number;
          weekly_minutes?: number;
        };
        Update: {
          created_at?: string;
          daily_streak_goal?: number;
          id?: string;
          updated_at?: string;
          user_id?: string;
          weekly_articles?: number;
          weekly_minutes?: number;
        };
        Relationships: [];
      };
      share_link_clicks: {
        Row: {
          article_slug: string;
          browser: string;
          city: string | null;
          click_date: string;
          clicked_at: string;
          code: string;
          country: string | null;
          created_at: string;
          device: string;
          id: string;
          is_new_visitor: boolean;
          link_id: string;
          os: string;
          referrer: string | null;
          user_agent: string | null;
          visitor_hash: string;
        };
        Insert: {
          article_slug: string;
          browser?: string;
          city?: string | null;
          click_date?: string;
          clicked_at?: string;
          code: string;
          country?: string | null;
          created_at?: string;
          device?: string;
          id?: string;
          is_new_visitor?: boolean;
          link_id: string;
          os?: string;
          referrer?: string | null;
          user_agent?: string | null;
          visitor_hash?: string;
        };
        Update: {
          article_slug?: string;
          browser?: string;
          city?: string | null;
          click_date?: string;
          clicked_at?: string;
          code?: string;
          country?: string | null;
          created_at?: string;
          device?: string;
          id?: string;
          is_new_visitor?: boolean;
          link_id?: string;
          os?: string;
          referrer?: string | null;
          user_agent?: string | null;
          visitor_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "share_link_clicks_link_id_fkey";
            columns: ["link_id"];
            isOneToOne: false;
            referencedRelation: "share_links";
            referencedColumns: ["id"];
          },
        ];
      };
      share_links: {
        Row: {
          article_id: string | null;
          article_slug: string;
          article_title: string;
          campaign: string;
          channel: string;
          clicks_count: number;
          code: string;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          label: string;
          last_click_at: string | null;
          unique_visitors: number;
          updated_at: string;
        };
        Insert: {
          article_id?: string | null;
          article_slug: string;
          article_title?: string;
          campaign?: string;
          channel?: string;
          clicks_count?: number;
          code: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          label?: string;
          last_click_at?: string | null;
          unique_visitors?: number;
          updated_at?: string;
        };
        Update: {
          article_id?: string | null;
          article_slug?: string;
          article_title?: string;
          campaign?: string;
          channel?: string;
          clicks_count?: number;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          label?: string;
          last_click_at?: string | null;
          unique_visitors?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "share_links_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
        ];
      };
      site_visits: {
        Row: {
          browser: string;
          country: string | null;
          created_at: string;
          device: string;
          id: string;
          is_new_visitor: boolean;
          os: string;
          path: string;
          referrer: string | null;
          referrer_host: string | null;
          session_id: string;
          title: string | null;
          user_id: string | null;
          utm_campaign: string | null;
          utm_medium: string | null;
          utm_source: string | null;
          visit_date: string;
          visited_at: string;
          visitor_hash: string;
        };
        Insert: {
          browser?: string;
          country?: string | null;
          created_at?: string;
          device?: string;
          id?: string;
          is_new_visitor?: boolean;
          os?: string;
          path: string;
          referrer?: string | null;
          referrer_host?: string | null;
          session_id?: string;
          title?: string | null;
          user_id?: string | null;
          utm_campaign?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
          visit_date?: string;
          visited_at?: string;
          visitor_hash?: string;
        };
        Update: {
          browser?: string;
          country?: string | null;
          created_at?: string;
          device?: string;
          id?: string;
          is_new_visitor?: boolean;
          os?: string;
          path?: string;
          referrer?: string | null;
          referrer_host?: string | null;
          session_id?: string;
          title?: string | null;
          user_id?: string | null;
          utm_campaign?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
          visit_date?: string;
          visited_at?: string;
          visitor_hash?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      increment_article_views: { Args: { _slug: string }; Returns: undefined };
      recompute_ai_ranking: { Args: never; Returns: undefined };
      register_share_click: {
        Args: {
          _browser: string;
          _code: string;
          _country: string;
          _device: string;
          _os: string;
          _referrer: string;
          _user_agent: string;
          _visitor_hash: string;
        };
        Returns: string;
      };
    };
    Enums: {
      app_role: "admin" | "editor" | "reader";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "editor", "reader"],
    },
  },
} as const;
