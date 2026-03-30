export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_broadcasts: {
        Row: {
          created_at: string
          id: string
          message: string
          sent_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sent_by: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sent_by?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          content: string
          created_at: string
          id: string
          obradeno: boolean
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          obradeno?: boolean
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          obradeno?: boolean
          user_id?: string
        }
        Relationships: []
      }
      kitchen_schedule_exceptions: {
        Row: {
          close_time: string | null
          closed_all_day: boolean
          company_id: string | null
          created_at: string
          exception_date: string
          id: string
          note: string | null
          open_time: string | null
          updated_at: string
        }
        Insert: {
          close_time?: string | null
          closed_all_day?: boolean
          company_id?: string | null
          created_at?: string
          exception_date: string
          id?: string
          note?: string | null
          open_time?: string | null
          updated_at?: string
        }
        Update: {
          close_time?: string | null
          closed_all_day?: boolean
          company_id?: string | null
          created_at?: string
          exception_date?: string
          id?: string
          note?: string | null
          open_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_schedule_exceptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_schedule_weekly: {
        Row: {
          close_time: string
          company_id: string | null
          created_at: string
          day_of_week: number
          enabled: boolean
          id: string
          open_time: string
          updated_at: string
        }
        Insert: {
          close_time: string
          company_id?: string | null
          created_at?: string
          day_of_week: number
          enabled?: boolean
          id?: string
          open_time: string
          updated_at?: string
        }
        Update: {
          close_time?: string
          company_id?: string | null
          created_at?: string
          day_of_week?: number
          enabled?: boolean
          id?: string
          open_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_schedule_weekly_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      meals: {
        Row: {
          allergens: string[] | null
          allowed_tags: string[] | null
          category: string
          code: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          meal_group: string | null
          name: string
          nutritional_info: Json | null
          price: number
          purchase_price: number | null
          shifts: string[]
          status: string
          updated_at: string
        }
        Insert: {
          allergens?: string[] | null
          allowed_tags?: string[] | null
          category: string
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          meal_group?: string | null
          name: string
          nutritional_info?: Json | null
          price: number
          purchase_price?: number | null
          shifts?: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          allergens?: string[] | null
          allowed_tags?: string[] | null
          category?: string
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          meal_group?: string | null
          name?: string
          nutritional_info?: Json | null
          price?: number
          purchase_price?: number | null
          shifts?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      menu_meals: {
        Row: {
          created_at: string
          id: string
          meal_id: string
          menu_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          meal_id: string
          menu_id: string
          quantity?: number
        }
        Update: {
          created_at?: string
          id?: string
          meal_id?: string
          menu_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_meals_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_meals_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_meals_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          menu_date: string
          name: string
          organization_tag: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          menu_date: string
          name: string
          organization_tag?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          menu_date?: string
          name?: string
          organization_tag?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          id: string
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          meal_id: string
          order_id: string
          pickup_status: string
          pickup_time: string | null
          quantity: number
          shift: string
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          meal_id: string
          order_id: string
          pickup_status?: string
          pickup_time?: string | null
          quantity?: number
          shift?: string
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          meal_id?: string
          order_id?: string
          pickup_status?: string
          pickup_time?: string | null
          quantity?: number
          shift?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          delivery_date: string | null
          id: string
          menu_id: string | null
          notes: string | null
          order_date: string
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivery_date?: string | null
          id?: string
          menu_id?: string | null
          notes?: string | null
          order_date?: string
          status?: string
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivery_date?: string | null
          id?: string
          menu_id?: string | null
          notes?: string | null
          order_date?: string
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_requests: {
        Row: {
          company_id: string | null
          created_at: string
          employee_identifier: string
          fiscal_error: string | null
          fiscal_external_id: string | null
          fiscal_retry_count: number
          fiscal_status: string
          fiscalized_at: string | null
          id: string
          invoice_number: string | null
          meal_name_snapshot: string | null
          note: string | null
          octopos_weborder_id: number | null
          order_id: string | null
          order_item_id: string | null
          pickup_date: string
          profile_id: string | null
          receipt_file_path: string | null
          receipt_text_bottom: string | null
          receipt_text_top: string | null
          served_at: string | null
          served_by: string | null
          status: string
          verification_url: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          employee_identifier: string
          fiscal_error?: string | null
          fiscal_external_id?: string | null
          fiscal_retry_count?: number
          fiscal_status?: string
          fiscalized_at?: string | null
          id?: string
          invoice_number?: string | null
          meal_name_snapshot?: string | null
          note?: string | null
          octopos_weborder_id?: number | null
          order_id?: string | null
          order_item_id?: string | null
          pickup_date: string
          profile_id?: string | null
          receipt_file_path?: string | null
          receipt_text_bottom?: string | null
          receipt_text_top?: string | null
          served_at?: string | null
          served_by?: string | null
          status?: string
          verification_url?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          employee_identifier?: string
          fiscal_error?: string | null
          fiscal_external_id?: string | null
          fiscal_retry_count?: number
          fiscal_status?: string
          fiscalized_at?: string | null
          id?: string
          invoice_number?: string | null
          meal_name_snapshot?: string | null
          note?: string | null
          octopos_weborder_id?: number | null
          order_id?: string | null
          order_item_id?: string | null
          pickup_date?: string
          profile_id?: string | null
          receipt_file_path?: string | null
          receipt_text_bottom?: string | null
          receipt_text_top?: string | null
          served_at?: string | null
          served_by?: string | null
          status?: string
          verification_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pickup_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickup_requests_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickup_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_card_id: string | null
          company_card_serial: string | null
          company_id: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          full_name: string | null
          id: string
          password_set: boolean
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          tag: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_card_id?: string | null
          company_card_serial?: string | null
          company_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          password_set?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          tag?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_card_id?: string | null
          company_card_serial?: string | null
          company_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          password_set?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          tag?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suggestions: {
        Row: {
          additional_notes: string | null
          created_at: string
          description: string
          id: string
          meal_name: string
          obradeno: boolean
          user_id: string
        }
        Insert: {
          additional_notes?: string | null
          created_at?: string
          description: string
          id?: string
          meal_name: string
          obradeno?: boolean
          user_id: string
        }
        Update: {
          additional_notes?: string | null
          created_at?: string
          description?: string
          id?: string
          meal_name?: string
          obradeno?: boolean
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      meals_secure: {
        Row: {
          allergens: string[] | null
          allowed_tags: string[] | null
          category: string | null
          code: string | null
          created_at: string | null
          description: string | null
          id: string | null
          image_url: string | null
          is_available: boolean | null
          meal_group: string | null
          name: string | null
          nutritional_info: Json | null
          price: number | null
          purchase_price: number | null
          shifts: string[] | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          allergens?: string[] | null
          allowed_tags?: string[] | null
          category?: string | null
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          image_url?: string | null
          is_available?: boolean | null
          meal_group?: string | null
          name?: string | null
          nutritional_info?: Json | null
          price?: number | null
          purchase_price?: never
          shifts?: string[] | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          allergens?: string[] | null
          allowed_tags?: string[] | null
          category?: string | null
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          image_url?: string | null
          is_available?: boolean | null
          meal_group?: string | null
          name?: string | null
          nutritional_info?: Json | null
          price?: number | null
          purchase_price?: never
          shifts?: string[] | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_view_company: { Args: { company_uuid: string }; Returns: boolean }
      email_exists: { Args: { check_email: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_user: { Args: { user_uuid: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "employee"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "employee"],
    },
  },
} as const
