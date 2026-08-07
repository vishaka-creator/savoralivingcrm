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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor: string | null
          actor_email: string | null
          created_at: string
          detail: string | null
          id: string
        }
        Insert: {
          action: string
          actor?: string | null
          actor_email?: string | null
          created_at?: string
          detail?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor?: string | null
          actor_email?: string | null
          created_at?: string
          detail?: string | null
          id?: string
        }
        Relationships: []
      }
      bom: {
        Row: {
          box_code: string | null
          collection_slug: string
          component_name: string
          created_at: string
          id: string
          qty_required_per_set: number
          set_name: string
          source: string
        }
        Insert: {
          box_code?: string | null
          collection_slug: string
          component_name: string
          created_at?: string
          id?: string
          qty_required_per_set?: number
          set_name: string
          source?: string
        }
        Update: {
          box_code?: string | null
          collection_slug?: string
          component_name?: string
          created_at?: string
          id?: string
          qty_required_per_set?: number
          set_name?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_collection_slug_fkey"
            columns: ["collection_slug"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["slug"]
          },
        ]
      }
      boxes: {
        Row: {
          code: string | null
          collection_slug: string
          foam: boolean | null
          id: string
          last_synced: string
          print_status: string | null
          product: string
          production_cost: number | null
          quantity_on_hand: number
        }
        Insert: {
          code?: string | null
          collection_slug: string
          foam?: boolean | null
          id?: string
          last_synced?: string
          print_status?: string | null
          product: string
          production_cost?: number | null
          quantity_on_hand?: number
        }
        Update: {
          code?: string | null
          collection_slug?: string
          foam?: boolean | null
          id?: string
          last_synced?: string
          print_status?: string | null
          product?: string
          production_cost?: number | null
          quantity_on_hand?: number
        }
        Relationships: [
          {
            foreignKeyName: "boxes_collection_slug_fkey"
            columns: ["collection_slug"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["slug"]
          },
        ]
      }
      collections: {
        Row: {
          name: string
          sheet_tab: string
          shopify_handle: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          name: string
          sheet_tab: string
          shopify_handle?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          name?: string
          sheet_tab?: string
          shopify_handle?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number | null
          id: string
          last_synced: string
          month: string | null
          remarks: string | null
          source_row: string | null
          spend_date: string | null
          vendor: string | null
        }
        Insert: {
          amount?: number | null
          id?: string
          last_synced?: string
          month?: string | null
          remarks?: string | null
          source_row?: string | null
          spend_date?: string | null
          vendor?: string | null
        }
        Update: {
          amount?: number | null
          id?: string
          last_synced?: string
          month?: string | null
          remarks?: string | null
          source_row?: string | null
          spend_date?: string | null
          vendor?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      raw_materials: {
        Row: {
          id: string
          last_synced: string
          low_stock_threshold: number
          quantity_on_hand: number
          sku_id: string
          unit: string
        }
        Insert: {
          id?: string
          last_synced?: string
          low_stock_threshold?: number
          quantity_on_hand?: number
          sku_id: string
          unit?: string
        }
        Update: {
          id?: string
          last_synced?: string
          low_stock_threshold?: number
          quantity_on_hand?: number
          sku_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_materials_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount: number | null
          billing_details: string | null
          client_name: string | null
          collection_slug: string | null
          id: string
          last_synced: string
          month: string | null
          sale_date: string | null
          source_row: string | null
          status: string | null
        }
        Insert: {
          amount?: number | null
          billing_details?: string | null
          client_name?: string | null
          collection_slug?: string | null
          id?: string
          last_synced?: string
          month?: string | null
          sale_date?: string | null
          source_row?: string | null
          status?: string | null
        }
        Update: {
          amount?: number | null
          billing_details?: string | null
          client_name?: string | null
          collection_slug?: string | null
          id?: string
          last_synced?: string
          month?: string | null
          sale_date?: string | null
          source_row?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_collection_slug_fkey"
            columns: ["collection_slug"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["slug"]
          },
        ]
      }
      skus: {
        Row: {
          code: string | null
          collection_slug: string
          created_at: string
          id: string
          name: string
          ordered_quantity: number | null
          shopify_product_id: string | null
          unit: string
        }
        Insert: {
          code?: string | null
          collection_slug: string
          created_at?: string
          id?: string
          name: string
          ordered_quantity?: number | null
          shopify_product_id?: string | null
          unit?: string
        }
        Update: {
          code?: string | null
          collection_slug?: string
          created_at?: string
          id?: string
          name?: string
          ordered_quantity?: number | null
          shopify_product_id?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "skus_collection_slug_fkey"
            columns: ["collection_slug"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["slug"]
          },
        ]
      }
      sync_log: {
        Row: {
          id: string
          message: string | null
          row_count: number | null
          source: string
          status: string
          synced_at: string
          tab_or_endpoint: string | null
        }
        Insert: {
          id?: string
          message?: string | null
          row_count?: number | null
          source: string
          status?: string
          synced_at?: string
          tab_or_endpoint?: string | null
        }
        Update: {
          id?: string
          message?: string | null
          row_count?: number | null
          source?: string
          status?: string
          synced_at?: string
          tab_or_endpoint?: string | null
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
      app_role: "admin" | "viewer"
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
      app_role: ["admin", "viewer"],
    },
  },
} as const
