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
          subscription_plan: SubscriptionPlan;
          subscription_expires_at: string | null;
          is_admin: boolean;
          created_at: string;
        },
        {
          id: string;
          name?: string | null;
          phone?: string | null;
          subscription_plan?: SubscriptionPlan;
          subscription_expires_at?: string | null;
          is_admin?: boolean;
          created_at?: string;
        }
      >;
      cities: Table<
        {
          id: string;
          name: string;
          region: string;
          lat: number | null;
          lng: number | null;
        },
        {
          id?: string;
          name: string;
          region: string;
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
          created_at: string;
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
          created_at?: string;
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
