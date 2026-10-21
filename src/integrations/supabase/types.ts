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
      app_settings: {
        Row: {
          id: number
          low_stock_pcs_threshold: number
          low_stock_sets_threshold: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          low_stock_pcs_threshold?: number
          low_stock_sets_threshold?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          low_stock_pcs_threshold?: number
          low_stock_sets_threshold?: number
          updated_at?: string
          updated_by?: string | null
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
      build_plans: {
        Row: {
          collection_slug: string
          created_at: string
          id: string
          plan_date: string
          sets_planned: number
          updated_at: string
          updated_by: string | null
          updated_by_email: string | null
        }
        Insert: {
          collection_slug: string
          created_at?: string
          id?: string
          plan_date: string
          sets_planned?: number
          updated_at?: string
          updated_by?: string | null
          updated_by_email?: string | null
        }
        Update: {
          collection_slug?: string
          created_at?: string
          id?: string
          plan_date?: string
          sets_planned?: number
          updated_at?: string
          updated_by?: string | null
          updated_by_email?: string | null
        }
        Relationships: []
      }
      collection_costing: {
        Row: {
          box_cost: number
          collection_slug: string
          created_at: string
          created_by: string | null
          id: string
          item_name: string
          material_cost: number
          notes: string | null
          sku_id: string | null
          sort_order: number
          total_cost: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          box_cost?: number
          collection_slug: string
          created_at?: string
          created_by?: string | null
          id?: string
          item_name: string
          material_cost?: number
          notes?: string | null
          sku_id?: string | null
          sort_order?: number
          total_cost?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          box_cost?: number
          collection_slug?: string
          created_at?: string
          created_by?: string | null
          id?: string
          item_name?: string
          material_cost?: number
          notes?: string | null
          sku_id?: string | null
          sort_order?: number
          total_cost?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_costing_collection_slug_fkey"
            columns: ["collection_slug"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "collection_costing_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          cover_image: string | null
          name: string
          sheet_tab: string
          shopify_handle: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          cover_image?: string | null
          name: string
          sheet_tab: string
          shopify_handle?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          cover_image?: string | null
          name?: string
          sheet_tab?: string
          shopify_handle?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          remarks: string | null
          sort_order: number
          source: string
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          remarks?: string | null
          sort_order?: number
          source?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          remarks?: string | null
          sort_order?: number
          source?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      crm_events: {
        Row: {
          calendar_source: string
          created_at: string
          created_by: string | null
          end_time: string | null
          google_calendar_event_id: string | null
          id: string
          is_major: boolean
          notes: string | null
          start_time: string
          title: string
          type_tag: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          calendar_source?: string
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          google_calendar_event_id?: string | null
          id?: string
          is_major?: boolean
          notes?: string | null
          start_time: string
          title: string
          type_tag?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          calendar_source?: string
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          google_calendar_event_id?: string | null
          id?: string
          is_major?: boolean
          notes?: string | null
          start_time?: string
          title?: string
          type_tag?: string
          updated_at?: string
          updated_by?: string | null
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
          approx_weight_grams: number | null
          code: string | null
          collection_slug: string
          cost_price: number | null
          created_at: string
          dimensions: string | null
          dimensions_catalogue: string | null
          id: string
          image_url: string | null
          influencer_remarks: string | null
          influencer_stock: number
          mrp: number | null
          name: string
          ordered_quantity: number | null
          pieces_per_set: number
          printed_image_url: string | null
          product_name: string | null
          remarks: string | null
          sales_remarks: string | null
          shopify_product_id: string | null
          showroom_remarks: string | null
          sold_pcs: number
          sold_sets: number
          sort_order: number | null
          store_stock: number
          unit: string
          ware_media_path: string | null
        }
        Insert: {
          approx_weight_grams?: number | null
          code?: string | null
          collection_slug: string
          cost_price?: number | null
          created_at?: string
          dimensions?: string | null
          dimensions_catalogue?: string | null
          id?: string
          image_url?: string | null
          influencer_remarks?: string | null
          influencer_stock?: number
          mrp?: number | null
          name: string
          ordered_quantity?: number | null
          pieces_per_set?: number
          printed_image_url?: string | null
          product_name?: string | null
          remarks?: string | null
          sales_remarks?: string | null
          shopify_product_id?: string | null
          showroom_remarks?: string | null
          sold_pcs?: number
          sold_sets?: number
          sort_order?: number | null
          store_stock?: number
          unit?: string
          ware_media_path?: string | null
        }
        Update: {
          approx_weight_grams?: number | null
          code?: string | null
          collection_slug?: string
          cost_price?: number | null
          created_at?: string
          dimensions?: string | null
          dimensions_catalogue?: string | null
          id?: string
          image_url?: string | null
          influencer_remarks?: string | null
          influencer_stock?: number
          mrp?: number | null
          name?: string
          ordered_quantity?: number | null
          pieces_per_set?: number
          printed_image_url?: string | null
          product_name?: string | null
          remarks?: string | null
          sales_remarks?: string | null
          shopify_product_id?: string | null
          showroom_remarks?: string | null
          sold_pcs?: number
          sold_sets?: number
          sort_order?: number | null
          store_stock?: number
          unit?: string
          ware_media_path?: string | null
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
      special_combinations: {
        Row: {
          collection_slug: string
          combo_name: string
          combo_price: number
          created_at: string
          created_by: string | null
          id: string
          items_included: Json
          notes: string | null
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          collection_slug: string
          combo_name: string
          combo_price?: number
          created_at?: string
          created_by?: string | null
          id?: string
          items_included?: Json
          notes?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          collection_slug?: string
          combo_name?: string
          combo_price?: number
          created_at?: string
          created_by?: string | null
          id?: string
          items_included?: Json
          notes?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "special_combinations_collection_slug_fkey"
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
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
