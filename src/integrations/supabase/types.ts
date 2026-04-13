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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      applicants: {
        Row: {
          age: number | null
          bkr_status: string | null
          consent_given: boolean | null
          created_at: string | null
          desired_lease_length: string | null
          desired_move_in: string | null
          email: string | null
          employment_type: string | null
          full_name: string | null
          gender: string | null
          hard_disqualified: boolean | null
          hard_disqualify_reason: string | null
          id: string
          id_document_url: string | null
          id_verified: boolean | null
          lifestyle_answers: Json | null
          match_flags: Json | null
          match_label: string | null
          match_score: number | null
          monthly_income: number | null
          num_occupants: string | null
          occupation: string | null
          phone: string | null
          property_id: string
          scrape_facebook: Json | null
          scrape_google: Json | null
          scrape_kvk: Json | null
          scrape_linkedin: Json | null
          social_handle: string | null
          social_scrape_data: Json | null
          stage: string | null
          telegram_user_id: string | null
          viewing_booked_at: string | null
        }
        Insert: {
          age?: number | null
          bkr_status?: string | null
          consent_given?: boolean | null
          created_at?: string | null
          desired_lease_length?: string | null
          desired_move_in?: string | null
          email?: string | null
          employment_type?: string | null
          full_name?: string | null
          gender?: string | null
          hard_disqualified?: boolean | null
          hard_disqualify_reason?: string | null
          id?: string
          id_document_url?: string | null
          id_verified?: boolean | null
          lifestyle_answers?: Json | null
          match_flags?: Json | null
          match_label?: string | null
          match_score?: number | null
          monthly_income?: number | null
          num_occupants?: string | null
          occupation?: string | null
          phone?: string | null
          property_id: string
          scrape_facebook?: Json | null
          scrape_google?: Json | null
          scrape_kvk?: Json | null
          scrape_linkedin?: Json | null
          social_handle?: string | null
          social_scrape_data?: Json | null
          stage?: string | null
          telegram_user_id?: string | null
          viewing_booked_at?: string | null
        }
        Update: {
          age?: number | null
          bkr_status?: string | null
          consent_given?: boolean | null
          created_at?: string | null
          desired_lease_length?: string | null
          desired_move_in?: string | null
          email?: string | null
          employment_type?: string | null
          full_name?: string | null
          gender?: string | null
          hard_disqualified?: boolean | null
          hard_disqualify_reason?: string | null
          id?: string
          id_document_url?: string | null
          id_verified?: boolean | null
          lifestyle_answers?: Json | null
          match_flags?: Json | null
          match_label?: string | null
          match_score?: number | null
          monthly_income?: number | null
          num_occupants?: string | null
          occupation?: string | null
          phone?: string | null
          property_id?: string
          scrape_facebook?: Json | null
          scrape_google?: Json | null
          scrape_kvk?: Json | null
          scrape_linkedin?: Json | null
          social_handle?: string | null
          social_scrape_data?: Json | null
          stage?: string | null
          telegram_user_id?: string | null
          viewing_booked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applicants_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "landlord_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      landlord_criteria: {
        Row: {
          accepted_tenant_types: Json | null
          id: string
          max_age: number | null
          max_occupants: number | null
          min_age: number | null
          min_income: number | null
          min_income_multiplier: number | null
          notes: string | null
          pets_allowed: string | null
          preferred_gender: string | null
          professionals_ok: boolean | null
          property_id: string
          references_required: boolean | null
          smoking_allowed: string | null
          students_ok: boolean | null
        }
        Insert: {
          accepted_tenant_types?: Json | null
          id?: string
          max_age?: number | null
          max_occupants?: number | null
          min_age?: number | null
          min_income?: number | null
          min_income_multiplier?: number | null
          notes?: string | null
          pets_allowed?: string | null
          preferred_gender?: string | null
          professionals_ok?: boolean | null
          property_id: string
          references_required?: boolean | null
          smoking_allowed?: string | null
          students_ok?: boolean | null
        }
        Update: {
          accepted_tenant_types?: Json | null
          id?: string
          max_age?: number | null
          max_occupants?: number | null
          min_age?: number | null
          min_income?: number | null
          min_income_multiplier?: number | null
          notes?: string | null
          pets_allowed?: string | null
          preferred_gender?: string | null
          professionals_ok?: boolean | null
          property_id?: string
          references_required?: boolean | null
          smoking_allowed?: string | null
          students_ok?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "landlord_criteria_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "landlord_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      landlord_properties: {
        Row: {
          accommodation_type: string | null
          address: string
          available_date: string | null
          bag_verified: boolean | null
          building_year: number | null
          city: string | null
          created_at: string | null
          energy_label: string | null
          furnished_status: string | null
          id: string
          landlord_id: string
          min_lease_length: string | null
          num_rooms: number | null
          postcode: string | null
          property_type: string | null
          rent_amount: number | null
          sector: string | null
          status: string
          surface_m2: number | null
          tenant_contract_start: string | null
          tenant_deposit: number | null
          tenant_monthly_rent: number | null
          tenant_name: string | null
          viewing_slots: Json | null
          wws_compliant: boolean | null
          wws_max_rent: number | null
          wws_points: number | null
        }
        Insert: {
          accommodation_type?: string | null
          address: string
          available_date?: string | null
          bag_verified?: boolean | null
          building_year?: number | null
          city?: string | null
          created_at?: string | null
          energy_label?: string | null
          furnished_status?: string | null
          id?: string
          landlord_id: string
          min_lease_length?: string | null
          num_rooms?: number | null
          postcode?: string | null
          property_type?: string | null
          rent_amount?: number | null
          sector?: string | null
          status?: string
          surface_m2?: number | null
          tenant_contract_start?: string | null
          tenant_deposit?: number | null
          tenant_monthly_rent?: number | null
          tenant_name?: string | null
          viewing_slots?: Json | null
          wws_compliant?: boolean | null
          wws_max_rent?: number | null
          wws_points?: number | null
        }
        Update: {
          accommodation_type?: string | null
          address?: string
          available_date?: string | null
          bag_verified?: boolean | null
          building_year?: number | null
          city?: string | null
          created_at?: string | null
          energy_label?: string | null
          furnished_status?: string | null
          id?: string
          landlord_id?: string
          min_lease_length?: string | null
          num_rooms?: number | null
          postcode?: string | null
          property_type?: string | null
          rent_amount?: number | null
          sector?: string | null
          status?: string
          surface_m2?: number | null
          tenant_contract_start?: string | null
          tenant_deposit?: number | null
          tenant_monthly_rent?: number | null
          tenant_name?: string | null
          viewing_slots?: Json | null
          wws_compliant?: boolean | null
          wws_max_rent?: number | null
          wws_points?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "landlord_properties_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "landlords"
            referencedColumns: ["id"]
          },
        ]
      }
      landlords: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          portfolio_size: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          portfolio_size?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          portfolio_size?: string | null
        }
        Relationships: []
      }
      tenant_issues: {
        Row: {
          ai_resolved: boolean | null
          ai_response: string | null
          category: string
          created_at: string | null
          id: string
          landlord_resolved: boolean | null
          message: string
          photo_url: string | null
          property_id: string
          telegram_user_id: string | null
          tenant_name: string | null
        }
        Insert: {
          ai_resolved?: boolean | null
          ai_response?: string | null
          category?: string
          created_at?: string | null
          id?: string
          landlord_resolved?: boolean | null
          message: string
          photo_url?: string | null
          property_id: string
          telegram_user_id?: string | null
          tenant_name?: string | null
        }
        Update: {
          ai_resolved?: boolean | null
          ai_response?: string | null
          category?: string
          created_at?: string | null
          id?: string
          landlord_resolved?: boolean | null
          message?: string
          photo_url?: string | null
          property_id?: string
          telegram_user_id?: string | null
          tenant_name?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
