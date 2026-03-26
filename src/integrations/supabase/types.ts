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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      brands: {
        Row: {
          created_at: string
          dealer_id: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
        }
        Insert: {
          created_at?: string
          dealer_id?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
        }
        Update: {
          created_at?: string
          dealer_id?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      communications: {
        Row: {
          body: string | null
          created_at: string
          customer_id: string
          external_id: string | null
          id: string
          parent_id: string | null
          purpose: Database["public"]["Enums"]["communication_purpose"]
          sent_at: string | null
          sent_to: string
          status: string
          subject: string | null
          test_drive_id: string | null
          type: Database["public"]["Enums"]["communication_type"]
        }
        Insert: {
          body?: string | null
          created_at?: string
          customer_id: string
          external_id?: string | null
          id?: string
          parent_id?: string | null
          purpose: Database["public"]["Enums"]["communication_purpose"]
          sent_at?: string | null
          sent_to: string
          status?: string
          subject?: string | null
          test_drive_id?: string | null
          type: Database["public"]["Enums"]["communication_type"]
        }
        Update: {
          body?: string | null
          created_at?: string
          customer_id?: string
          external_id?: string | null
          id?: string
          parent_id?: string | null
          purpose?: Database["public"]["Enums"]["communication_purpose"]
          sent_at?: string | null
          sent_to?: string
          status?: string
          subject?: string | null
          test_drive_id?: string | null
          type?: Database["public"]["Enums"]["communication_type"]
        }
        Relationships: [
          {
            foreignKeyName: "communications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "communications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_test_drive_id_fkey"
            columns: ["test_drive_id"]
            isOneToOne: false
            referencedRelation: "test_drives"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          driving_license_url: string | null
          driving_license_verified: boolean
          email: string | null
          full_name: string
          id: string
          phone: string
          preferred_contact: string
          total_test_drives: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          driving_license_url?: string | null
          driving_license_verified?: boolean
          email?: string | null
          full_name: string
          id?: string
          phone: string
          preferred_contact?: string
          total_test_drives?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          driving_license_url?: string | null
          driving_license_verified?: boolean
          email?: string | null
          full_name?: string
          id?: string
          phone?: string
          preferred_contact?: string
          total_test_drives?: number
          updated_at?: string
        }
        Relationships: []
      }
      dealers: {
        Row: {
          admin_user_id: string | null
          contact_email: string
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          admin_user_id?: string | null
          contact_email: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          admin_user_id?: string | null
          contact_email?: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      location_blocked_slots: {
        Row: {
          block_source: string
          blocked_date: string
          created_at: string
          end_time: string
          id: string
          location_id: string
          reason: string | null
          start_time: string
        }
        Insert: {
          block_source?: string
          blocked_date: string
          created_at?: string
          end_time: string
          id?: string
          location_id: string
          reason?: string | null
          start_time: string
        }
        Update: {
          block_source?: string
          blocked_date?: string
          created_at?: string
          end_time?: string
          id?: string
          location_id?: string
          reason?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_blocked_slots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_operating_hours: {
        Row: {
          close_time: string
          day_of_week: number
          id: string
          is_closed: boolean
          location_id: string
          open_time: string
        }
        Insert: {
          close_time?: string
          day_of_week: number
          id?: string
          is_closed?: boolean
          location_id: string
          open_time?: string
        }
        Update: {
          close_time?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean
          location_id?: string
          open_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_operating_hours_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string
          city: string
          country: string
          created_at: string
          dealer_id: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address: string
          city: string
          country?: string
          created_at?: string
          dealer_id?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string
          country?: string
          created_at?: string
          dealer_id?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          location_id: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          location_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          location_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      test_drives: {
        Row: {
          assigned_gro_id: string | null
          assigned_sales_person_id: string | null
          cancelled_reason: string | null
          completed_at: string | null
          created_at: string
          customer_id: string
          id: string
          inspection_submitted_at: string | null
          key_handed_at: string | null
          location_id: string
          notes: string | null
          post_drive_fuel_level: string | null
          post_drive_km: number | null
          post_drive_notes: string | null
          post_drive_scratches: string | null
          pre_drive_fuel_level: string | null
          pre_drive_km: number | null
          pre_drive_notes: string | null
          pre_drive_scratches: string | null
          rescheduled_from: string | null
          scheduled_date: string
          scheduled_time: string
          security_checked_in_at: string | null
          security_checked_out_at: string | null
          source: string
          started_at: string | null
          status: Database["public"]["Enums"]["test_drive_status"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          assigned_gro_id?: string | null
          assigned_sales_person_id?: string | null
          cancelled_reason?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id: string
          id?: string
          inspection_submitted_at?: string | null
          key_handed_at?: string | null
          location_id: string
          notes?: string | null
          post_drive_fuel_level?: string | null
          post_drive_km?: number | null
          post_drive_notes?: string | null
          post_drive_scratches?: string | null
          pre_drive_fuel_level?: string | null
          pre_drive_km?: number | null
          pre_drive_notes?: string | null
          pre_drive_scratches?: string | null
          rescheduled_from?: string | null
          scheduled_date: string
          scheduled_time: string
          security_checked_in_at?: string | null
          security_checked_out_at?: string | null
          source?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["test_drive_status"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          assigned_gro_id?: string | null
          assigned_sales_person_id?: string | null
          cancelled_reason?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          inspection_submitted_at?: string | null
          key_handed_at?: string | null
          location_id?: string
          notes?: string | null
          post_drive_fuel_level?: string | null
          post_drive_km?: number | null
          post_drive_notes?: string | null
          post_drive_scratches?: string | null
          pre_drive_fuel_level?: string | null
          pre_drive_km?: number | null
          pre_drive_notes?: string | null
          pre_drive_scratches?: string | null
          rescheduled_from?: string | null
          scheduled_date?: string
          scheduled_time?: string
          security_checked_in_at?: string | null
          security_checked_out_at?: string | null
          source?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["test_drive_status"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_drives_assigned_gro_id_fkey"
            columns: ["assigned_gro_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_drives_assigned_sales_person_id_fkey"
            columns: ["assigned_sales_person_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_drives_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_drives_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_drives_rescheduled_from_fkey"
            columns: ["rescheduled_from"]
            isOneToOne: false
            referencedRelation: "test_drives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_drives_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          acceleration: string | null
          available_units: number
          battery_capacity: string | null
          brand: string
          color: string | null
          created_at: string
          drive_type: string | null
          engine_type: string | null
          fuel_type: string | null
          horsepower: number | null
          id: string
          image_url: string | null
          is_active: boolean
          is_available: boolean
          location_id: string
          mileage: string | null
          model: string
          range_km: number | null
          registration_number: string | null
          seating_capacity: number | null
          top_speed: string | null
          torque: string | null
          total_units: number
          transmission: string | null
          updated_at: string
          variant: string | null
          year: number
        }
        Insert: {
          acceleration?: string | null
          available_units?: number
          battery_capacity?: string | null
          brand: string
          color?: string | null
          created_at?: string
          drive_type?: string | null
          engine_type?: string | null
          fuel_type?: string | null
          horsepower?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_available?: boolean
          location_id: string
          mileage?: string | null
          model: string
          range_km?: number | null
          registration_number?: string | null
          seating_capacity?: number | null
          top_speed?: string | null
          torque?: string | null
          total_units?: number
          transmission?: string | null
          updated_at?: string
          variant?: string | null
          year: number
        }
        Update: {
          acceleration?: string | null
          available_units?: number
          battery_capacity?: string | null
          brand?: string
          color?: string | null
          created_at?: string
          drive_type?: string | null
          engine_type?: string | null
          fuel_type?: string | null
          horsepower?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_available?: boolean
          location_id?: string
          mileage?: string | null
          model?: string
          range_km?: number | null
          registration_number?: string | null
          seating_capacity?: number | null
          top_speed?: string | null
          torque?: string | null
          total_units?: number
          transmission?: string | null
          updated_at?: string
          variant?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_release_noshow_vehicles: { Args: never; Returns: undefined }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_user_dealer_id: { Args: { _user_id: string }; Returns: string }
      get_user_location_id: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      onboard_dealer: {
        Args: {
          _admin_user_id: string
          _brands: string[]
          _contact_email: string
          _contact_phone: string
          _dealer_name: string
          _locations: Json[]
          _slug: string
        }
        Returns: string
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "superadmin" | "gro" | "sales" | "security" | "dealer_admin"
      communication_purpose:
        | "booking_created"
        | "booking_confirmed"
        | "booking_rescheduled"
        | "booking_cancelled"
        | "reminder"
        | "follow_up"
        | "custom"
      communication_type: "email" | "whatsapp" | "sms"
      test_drive_status:
        | "scheduled"
        | "confirmed"
        | "show"
        | "no_show"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "rescheduled"
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
      app_role: ["superadmin", "gro", "sales", "security", "dealer_admin"],
      communication_purpose: [
        "booking_created",
        "booking_confirmed",
        "booking_rescheduled",
        "booking_cancelled",
        "reminder",
        "follow_up",
        "custom",
      ],
      communication_type: ["email", "whatsapp", "sms"],
      test_drive_status: [
        "scheduled",
        "confirmed",
        "show",
        "no_show",
        "in_progress",
        "completed",
        "cancelled",
        "rescheduled",
      ],
    },
  },
} as const
