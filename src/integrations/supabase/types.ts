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
      email_reminders_log: {
        Row: {
          certification: string
          expiry_date: string
          id: string
          months_before: number
          recipient_email: string
          recipient_id: string
          recipient_type: string
          sent_at: string
        }
        Insert: {
          certification: string
          expiry_date: string
          id?: string
          months_before: number
          recipient_email: string
          recipient_id: string
          recipient_type: string
          sent_at?: string
        }
        Update: {
          certification?: string
          expiry_date?: string
          id?: string
          months_before?: number
          recipient_email?: string
          recipient_id?: string
          recipient_type?: string
          sent_at?: string
        }
        Relationships: []
      }
      formateurs: {
        Row: {
          carte_pro_expiry: string | null
          carte_pro_number: string | null
          created_at: string
          created_by: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          mac_aps_date: string | null
          mac_aps_expiry: string | null
          notes: string | null
          phone: string | null
          ssiap1_date: string | null
          ssiap1_expiry: string | null
          ssiap2_date: string | null
          ssiap2_expiry: string | null
          ssiap3_date: string | null
          ssiap3_expiry: string | null
          sst_date: string | null
          sst_expiry: string | null
          tfp_aps_date: string | null
          tfp_aps_expiry: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          carte_pro_expiry?: string | null
          carte_pro_number?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          mac_aps_date?: string | null
          mac_aps_expiry?: string | null
          notes?: string | null
          phone?: string | null
          ssiap1_date?: string | null
          ssiap1_expiry?: string | null
          ssiap2_date?: string | null
          ssiap2_expiry?: string | null
          ssiap3_date?: string | null
          ssiap3_expiry?: string | null
          sst_date?: string | null
          sst_expiry?: string | null
          tfp_aps_date?: string | null
          tfp_aps_expiry?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          carte_pro_expiry?: string | null
          carte_pro_number?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          mac_aps_date?: string | null
          mac_aps_expiry?: string | null
          notes?: string | null
          phone?: string | null
          ssiap1_date?: string | null
          ssiap1_expiry?: string | null
          ssiap2_date?: string | null
          ssiap2_expiry?: string | null
          ssiap3_date?: string | null
          ssiap3_expiry?: string | null
          sst_date?: string | null
          sst_expiry?: string | null
          tfp_aps_date?: string | null
          tfp_aps_expiry?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      formation_participants: {
        Row: {
          created_at: string
          formation_id: string
          id: string
          notes: string | null
          stagiaire_id: string
          status: Database["public"]["Enums"]["participant_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          formation_id: string
          id?: string
          notes?: string | null
          stagiaire_id: string
          status?: Database["public"]["Enums"]["participant_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          formation_id?: string
          id?: string
          notes?: string | null
          stagiaire_id?: string
          status?: Database["public"]["Enums"]["participant_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "formation_participants_formation_id_fkey"
            columns: ["formation_id"]
            isOneToOne: false
            referencedRelation: "formations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formation_participants_stagiaire_id_fkey"
            columns: ["stagiaire_id"]
            isOneToOne: false
            referencedRelation: "stagiaires"
            referencedColumns: ["id"]
          },
        ]
      }
      formations: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string
          formateur_id: string | null
          id: string
          location: string | null
          max_participants: number | null
          start_date: string
          status: string
          title: string
          type: Database["public"]["Enums"]["formation_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date: string
          formateur_id?: string | null
          id?: string
          location?: string | null
          max_participants?: number | null
          start_date: string
          status?: string
          title: string
          type?: Database["public"]["Enums"]["formation_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string
          formateur_id?: string | null
          id?: string
          location?: string | null
          max_participants?: number | null
          start_date?: string
          status?: string
          title?: string
          type?: Database["public"]["Enums"]["formation_type"]
          updated_at?: string
        }
        Relationships: []
      }
      incidents: {
        Row: {
          author_id: string
          created_at: string
          description: string | null
          id: string
          location: string | null
          occurred_at: string
          severity: Database["public"]["Enums"]["incident_severity"]
          status: Database["public"]["Enums"]["incident_status"]
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          occurred_at?: string
          severity?: Database["public"]["Enums"]["incident_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          occurred_at?: string
          severity?: Database["public"]["Enums"]["incident_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stagiaires: {
        Row: {
          address: string | null
          birth_date: string | null
          carte_pro_expiry: string | null
          carte_pro_number: string | null
          city: string | null
          created_at: string
          created_by: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          mac_aps_date: string | null
          mac_aps_expiry: string | null
          notes: string | null
          phone: string | null
          photo_url: string | null
          postal_code: string | null
          status: Database["public"]["Enums"]["stagiaire_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          carte_pro_expiry?: string | null
          carte_pro_number?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          mac_aps_date?: string | null
          mac_aps_expiry?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          postal_code?: string | null
          status?: Database["public"]["Enums"]["stagiaire_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          carte_pro_expiry?: string | null
          carte_pro_number?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          mac_aps_date?: string | null
          mac_aps_expiry?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          postal_code?: string | null
          status?: Database["public"]["Enums"]["stagiaire_status"]
          updated_at?: string
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
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "administrateur"
        | "formateur"
        | "agent"
        | "secretaire"
        | "stagiaire"
      formation_type:
        | "APS"
        | "SST"
        | "SSIAP1"
        | "SSIAP2"
        | "SSIAP3"
        | "MAC_APS"
        | "H0B0"
        | "AUTRE"
      incident_severity: "faible" | "moyen" | "eleve" | "critique"
      incident_status: "ouvert" | "en_cours" | "resolu"
      participant_status: "inscrit" | "present" | "absent" | "valide" | "echec"
      stagiaire_status: "en_attente" | "valide" | "rejete" | "archive"
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
      app_role: [
        "administrateur",
        "formateur",
        "agent",
        "secretaire",
        "stagiaire",
      ],
      formation_type: [
        "APS",
        "SST",
        "SSIAP1",
        "SSIAP2",
        "SSIAP3",
        "MAC_APS",
        "H0B0",
        "AUTRE",
      ],
      incident_severity: ["faible", "moyen", "eleve", "critique"],
      incident_status: ["ouvert", "en_cours", "resolu"],
      participant_status: ["inscrit", "present", "absent", "valide", "echec"],
      stagiaire_status: ["en_attente", "valide", "rejete", "archive"],
    },
  },
} as const
