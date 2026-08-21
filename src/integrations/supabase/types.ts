export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      bookings: {
        Row: {
          booking_type: string;
          checked_in_at: string | null;
          code: string;
          created_at: string;
          desk_code: string;
          desk_id: string | null;
          end_at: string;
          full_name: string;
          id: string;
          note: string;
          payment_status: string;
          phone: string;
          start_at: string;
          status: string;
          total_amount: number;
          unit_price: number;
          units: number;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          booking_type?: string;
          checked_in_at?: string | null;
          code: string;
          created_at?: string;
          desk_code?: string;
          desk_id?: string | null;
          end_at: string;
          full_name?: string;
          id?: string;
          note?: string;
          payment_status?: string;
          phone?: string;
          start_at: string;
          status?: string;
          total_amount?: number;
          unit_price?: number;
          units?: number;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          booking_type?: string;
          checked_in_at?: string | null;
          code?: string;
          created_at?: string;
          desk_code?: string;
          desk_id?: string | null;
          end_at?: string;
          full_name?: string;
          id?: string;
          note?: string;
          payment_status?: string;
          phone?: string;
          start_at?: string;
          status?: string;
          total_amount?: number;
          unit_price?: number;
          units?: number;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_desk_id_fkey";
            columns: ["desk_id"];
            isOneToOne: false;
            referencedRelation: "desks";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_desks: {
        Row: {
          id: string;
          booking_id: string;
          desk_id: string;
          desk_code: string;
          unit_price: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          desk_id: string;
          desk_code: string;
          unit_price: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          desk_id?: string;
          desk_code?: string;
          unit_price?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_desks_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_desks_desk_id_fkey";
            columns: ["desk_id"];
            isOneToOne: false;
            referencedRelation: "desks";
            referencedColumns: ["id"];
          },
        ];
      };
      desks: {
        Row: {
          code: string;
          created_at: string;
          daily_rate: number;
          features: string[];
          hourly_rate: number;
          id: string;
          is_active: boolean;
          location_note: string;
          monthly_rate: number;
          name: string;
          status: string;
          updated_at: string;
          zone: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          daily_rate?: number;
          features?: string[];
          hourly_rate?: number;
          id?: string;
          is_active?: boolean;
          location_note?: string;
          monthly_rate?: number;
          name: string;
          status?: string;
          updated_at?: string;
          zone?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          daily_rate?: number;
          features?: string[];
          hourly_rate?: number;
          id?: string;
          is_active?: boolean;
          location_note?: string;
          monthly_rate?: number;
          name?: string;
          status?: string;
          updated_at?: string;
          zone?: string;
        };
        Relationships: [];
      };
      pricing_settings: {
        Row: {
          id: string;
          card_holder: string;
          card_number: string;
          hourly_rate: number;
          daily_rate: number;
          monthly_rate: number;
          discount_percent: number;
          discount_ends_at: string | null;
          max_desks_per_booking: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          card_holder?: string;
          card_number?: string;
          hourly_rate?: number;
          daily_rate?: number;
          monthly_rate?: number;
          discount_percent?: number;
          discount_ends_at?: string | null;
          max_desks_per_booking?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          card_holder?: string;
          card_number?: string;
          hourly_rate?: number;
          daily_rate?: number;
          monthly_rate?: number;
          discount_percent?: number;
          discount_ends_at?: string | null;
          max_desks_per_booking?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      phone_otps: {
        Row: {
          attempts: number;
          code_hash: string;
          consumed_at: string | null;
          created_at: string;
          education: string | null;
          expires_at: string;
          full_name: string | null;
          id: string;
          job_title: string | null;
          national_id: string | null;
          phone: string;
        };
        Insert: {
          attempts?: number;
          code_hash: string;
          consumed_at?: string | null;
          created_at?: string;
          education?: string | null;
          expires_at: string;
          full_name?: string | null;
          id?: string;
          job_title?: string | null;
          national_id?: string | null;
          phone: string;
        };
        Update: {
          attempts?: number;
          code_hash?: string;
          consumed_at?: string | null;
          created_at?: string;
          education?: string | null;
          expires_at?: string;
          full_name?: string | null;
          id?: string;
          job_title?: string | null;
          national_id?: string | null;
          phone?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          education: string;
          full_name: string;
          id: string;
          job_title: string;
          national_id: string;
          notification_pref: string;
          phone: string;
          telegram_id: number | null;
          telegram_linked_at: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          education?: string;
          full_name?: string;
          id: string;
          job_title?: string;
          national_id?: string;
          notification_pref?: string;
          phone?: string;
          telegram_id?: number | null;
          telegram_linked_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          education?: string;
          full_name?: string;
          id?: string;
          job_title?: string;
          national_id?: string;
          notification_pref?: string;
          phone?: string;
          telegram_id?: number | null;
          telegram_linked_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      telegram_link_tokens: {
        Row: {
          created_at: string;
          expires_at: string;
          token: string;
          used_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          token: string;
          used_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          token?: string;
          used_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "telegram_link_tokens_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_receipts: {
        Row: {
          booking_id: string;
          created_at: string;
          id: string;
          image_path: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          booking_id: string;
          created_at?: string;
          id?: string;
          image_path?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          booking_id?: string;
          created_at?: string;
          id?: string;
          image_path?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_receipts_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_receipts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_orders: {
        Row: {
          amount: number;
          authority: string;
          booking_id: string | null;
          created_at: string;
          gateway: string;
          id: string;
          ref_id: string;
          status: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          amount?: number;
          authority?: string;
          booking_id?: string | null;
          created_at?: string;
          gateway?: string;
          id?: string;
          ref_id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          amount?: number;
          authority?: string;
          booking_id?: string | null;
          created_at?: string;
          gateway?: string;
          id?: string;
          ref_id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      wallets: {
        Row: {
          balance: number;
          currency: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          balance?: number;
          currency?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          balance?: number;
          currency?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      wallet_transactions: {
        Row: {
          amount: number;
          balance_after: number;
          booking_id: string | null;
          created_at: string;
          description: string;
          id: string;
          kind: string;
          payment_order_id: string | null;
          wallet_user_id: string;
        };
        Insert: {
          amount?: number;
          balance_after?: number;
          booking_id?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          kind?: string;
          payment_order_id?: string | null;
          wallet_user_id: string;
        };
        Update: {
          amount?: number;
          balance_after?: number;
          booking_id?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          kind?: string;
          payment_order_id?: string | null;
          wallet_user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          channel: string;
          created_at: string;
          id: string;
          payload: Json;
          sent_at: string | null;
          status: string;
          type: string;
          user_id: string | null;
        };
        Insert: {
          channel?: string;
          created_at?: string;
          id?: string;
          payload?: Json;
          sent_at?: string | null;
          status?: string;
          type?: string;
          user_id?: string | null;
        };
        Update: {
          channel?: string;
          created_at?: string;
          id?: string;
          payload?: Json;
          sent_at?: string | null;
          status?: string;
          type?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      door_events: {
        Row: {
          booking_id: string | null;
          created_at: string;
          device_id: string;
          id: string;
          result: string;
          token_hash: string;
          user_id: string | null;
        };
        Insert: {
          booking_id?: string | null;
          created_at?: string;
          device_id?: string;
          id?: string;
          result?: string;
          token_hash?: string;
          user_id?: string | null;
        };
        Update: {
          booking_id?: string | null;
          created_at?: string;
          device_id?: string;
          id?: string;
          result?: string;
          token_hash?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          amount: number;
          booking_id: string | null;
          category: string;
          created_at: string;
          created_by: string | null;
          description: string;
          id: string;
          kind: string;
          occurred_on: string;
          updated_at: string;
        };
        Insert: {
          amount?: number;
          booking_id?: string | null;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          id?: string;
          kind?: string;
          occurred_on?: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          booking_id?: string | null;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          id?: string;
          kind?: string;
          occurred_on?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
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
          role: Database["public"]["Enums"]["app_role"];
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
      is_staff: { Args: { _user_id: string }; Returns: boolean };
      is_desk_available: {
        Args: { p_desk_id: string; p_start_at: string; p_end_at: string };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "staff" | "user";
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "staff", "user"],
    },
  },
} as const;
