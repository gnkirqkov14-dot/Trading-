// Hand-written to match supabase/migrations/0001_init.sql, shaped like the
// output of `npx supabase gen types typescript`. Once the project is linked
// to a real Supabase project, regenerate with:
//   npx supabase gen types typescript --project-id <id> > src/lib/types/database.ts

export type SubscriptionPlan = "basic" | "pro" | "unlimited";
export type ListingDealType = "rent" | "sale";
export type PropertyType = "apartment" | "house" | "plot" | "office" | "shop";
export type ListingStatus = "active" | "inactive" | "expired" | "archived";

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<
        {
          id: string;
          name: string | null;
          phone: string | null;
          email: string | null;
          subscription_plan: SubscriptionPlan;
          subscription_expires_at: string | null;
          is_admin: boolean;
          listing_limit: number;
          created_at: string;
        },
        {
          id: string;
          name?: string | null;
          phone?: string | null;
          email?: string | null;
          subscription_plan?: SubscriptionPlan;
          subscription_expires_at?: string | null;
          is_admin?: boolean;
          listing_limit?: number;
          created_at?: string;
        }
      >;
      cities: Table<
        {
          id: string;
          name: string;
          region: string;
          municipality: string | null;
          is_village: boolean;
          ekatte: string | null;
          lat: number | null;
          lng: number | null;
        },
        {
          id?: string;
          name: string;
          region: string;
          municipality?: string | null;
          is_village?: boolean;
          ekatte?: string | null;
          lat?: number | null;
          lng?: number | null;
        }
      >;
      neighborhoods: Table<
        {
          id: string;
          city_id: string;
          name: string;
          lat: number | null;
          lng: number | null;
        },
        {
          id?: string;
          city_id: string;
          name: string;
          lat?: number | null;
          lng?: number | null;
        }
      >;
      listings: Table<
        {
          id: string;
          user_id: string;
          type: ListingDealType;
          property_type: PropertyType;
          city_id: string | null;
          neighborhood_id: string | null;
          lat: number | null;
          lng: number | null;
          price: number;
          area_sqm: number;
          rooms: number | null;
          floor: number | null;
          year_built: number | null;
          heating: string | null;
          has_parking: boolean;
          has_elevator: boolean;
          has_terrace: boolean;
          is_furnished: boolean;
          title: string;
          description: string | null;
          address: string;
          phone: string;
          status: ListingStatus;
          reminder_count: number;
          last_confirmed_at: string;
          view_count: number;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          type: ListingDealType;
          property_type: PropertyType;
          city_id?: string | null;
          neighborhood_id?: string | null;
          lat?: number | null;
          lng?: number | null;
          price: number;
          area_sqm: number;
          rooms?: number | null;
          floor?: number | null;
          year_built?: number | null;
          heating?: string | null;
          has_parking?: boolean;
          has_elevator?: boolean;
          has_terrace?: boolean;
          is_furnished?: boolean;
          title: string;
          description?: string | null;
          address: string;
          phone: string;
          status?: ListingStatus;
          reminder_count?: number;
          last_confirmed_at?: string;
          view_count?: number;
          created_at?: string;
          updated_at?: string;
        }
      >;
      listing_photos: Table<
        { id: string; listing_id: string; url: string; position: number },
        {
          id?: string;
          listing_id: string;
          url: string;
          position?: number;
        }
      >;
      listing_videos: Table<
        { id: string; listing_id: string; url: string },
        { id?: string; listing_id: string; url: string }
      >;
      listing_edit_log: Table<
        {
          id: string;
          listing_id: string;
          changed_by: string | null;
          changed_fields: Record<string, { old: unknown; new: unknown }>;
          changed_at: string;
        },
        {
          id?: string;
          listing_id: string;
          changed_by?: string | null;
          changed_fields: Record<string, { old: unknown; new: unknown }>;
          changed_at?: string;
        }
      >;
      messages: Table<
        {
          id: string;
          from_user_id: string;
          to_user_id: string;
          listing_id: string | null;
          content: string;
          created_at: string;
        },
        {
          id?: string;
          from_user_id: string;
          to_user_id: string;
          listing_id?: string | null;
          content: string;
          created_at?: string;
        }
      >;
      subscriptions: Table<
        {
          id: string;
          user_id: string;
          plan: SubscriptionPlan;
          status: string;
          current_period_end: string | null;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          plan: SubscriptionPlan;
          status?: string;
          current_period_end?: string | null;
          created_at?: string;
        }
      >;
      listing_reports: Table<
        {
          id: string;
          listing_id: string;
          reported_by: string;
          created_at: string;
        },
        {
          id?: string;
          listing_id: string;
          reported_by: string;
          created_at?: string;
        }
      >;
      agency_bans: Table<
        {
          id: string;
          kind: "phone" | "email";
          value: string;
          banned_by: string | null;
          banned_at: string;
        },
        {
          id?: string;
          kind: "phone" | "email";
          value: string;
          banned_by?: string | null;
          banned_at?: string;
        }
      >;
      // Състояние на разговорите във Viber — пълни се от робота през
      // `viber_ingest`, чете се само от собственика (виж 0027).
      viber_chats: Table<
        {
          id: string;
          owner_id: string;
          chat_key: string;
          display_name: string;
          last_preview: string | null;
          last_time_label: string | null;
          last_from_me: boolean;
          unread_count: number;
          waiting_since: string | null;
          first_seen_at: string;
          updated_at: string;
        },
        {
          owner_id: string;
          chat_key: string;
          display_name: string;
          last_preview?: string | null;
          last_time_label?: string | null;
          last_from_me?: boolean;
          unread_count?: number;
          waiting_since?: string | null;
        }
      >;
      viber_observations: Table<
        {
          id: number;
          owner_id: string;
          chat_key: string;
          observed_at: string;
          preview: string | null;
          time_label: string | null;
          last_from_me: boolean | null;
          unread_count: number | null;
        },
        {
          owner_id: string;
          chat_key: string;
          preview?: string | null;
          time_label?: string | null;
          last_from_me?: boolean | null;
          unread_count?: number | null;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      process_listing_reminders: {
        Args: Record<PropertyKey, never>;
        Returns: {
          listing_id: string;
          owner_email: string | null;
          owner_name: string | null;
          listing_title: string;
          stage: number;
        }[];
      };
      admin_get_profile_emails: {
        Args: { profile_ids: string[] };
        Returns: { id: string; email: string | null }[];
      };
      increment_listing_view: {
        Args: { p_listing_id: string };
        Returns: void;
      };
      admin_set_listing_limit: {
        Args: { target_user_id: string; new_limit: number };
        Returns: void;
      };
      is_contact_banned: {
        Args: { p_phone: string | null; p_email: string | null };
        Returns: boolean;
      };
      admin_ban_agency: {
        Args: { p_listing_id: string };
        Returns: void;
      };
      assistant_consume_quota: {
        Args: { visitor: string; daily_limit: number };
        /** Оставащи въпроси за деня; -1 = лимитът е изчерпан. */
        Returns: number;
      };
      /**
       * Иска разрешение за разход ПРЕДИ извикването на модела.
       * 1 = може; -1 твърде рано; -2 часови таван; -3 дневен таван.
       */
      viber_claim_slot: {
        Args: {
          agent_token_hash: string;
          min_interval_seconds?: number;
          max_calls_per_hour?: number;
          max_calls_per_day?: number;
        };
        Returns: number;
      };
      viber_ingest: {
        Args: {
          agent_token_hash: string;
          chats: Array<{
            name: string;
            preview: string;
            time_label: string;
            last_from_me: boolean;
            unread_count: number;
          }>;
        };
        /** Брой записани разговора. */
        Returns: number;
      };
    };
    Enums: {
      subscription_plan: SubscriptionPlan;
      listing_deal_type: ListingDealType;
      property_type: PropertyType;
      listing_status: ListingStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
