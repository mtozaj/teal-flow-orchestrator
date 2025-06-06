export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      batch_logs: {
        Row: {
          batch_id: string
          eid: string | null
          id: string
          level: Database["public"]["Enums"]["log_level"]
          message: string
          timestamp: string
        }
        Insert: {
          batch_id: string
          eid?: string | null
          id?: string
          level?: Database["public"]["Enums"]["log_level"]
          message: string
          timestamp?: string
        }
        Update: {
          batch_id?: string
          eid?: string | null
          id?: string
          level?: Database["public"]["Enums"]["log_level"]
          message?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_logs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          average_processing_time_seconds: number | null
          completed_at: string | null
          created_at: string
          failure_count: number
          file_path: string | null
          id: string
          label: string
          max_parallelism: number
          processed_eids: number
          started_at: string | null
          status: Database["public"]["Enums"]["batch_status"]
          success_count: number
          total_eids: number
          updated_at: string
        }
        Insert: {
          average_processing_time_seconds?: number | null
          completed_at?: string | null
          created_at?: string
          failure_count?: number
          file_path?: string | null
          id?: string
          label: string
          max_parallelism?: number
          processed_eids?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["batch_status"]
          success_count?: number
          total_eids?: number
          updated_at?: string
        }
        Update: {
          average_processing_time_seconds?: number | null
          completed_at?: string | null
          created_at?: string
          failure_count?: number
          file_path?: string | null
          id?: string
          label?: string
          max_parallelism?: number
          processed_eids?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["batch_status"]
          success_count?: number
          total_eids?: number
          updated_at?: string
        }
        Relationships: []
      }
      esim_results: {
        Row: {
          activation_request_id: string | null
          att_iccid: string | null
          att_plan_request_id: string | null
          att_status: string | null
          att_timestamp: string | null
          batch_id: string
          created_at: string
          eid: string
          error_message: string | null
          global_iccid: string | null
          global_plan_request_id: string | null
          global_status: string | null
          global_timestamp: string | null
          id: string
          processing_completed_at: string | null
          processing_duration_seconds: number | null
          processing_started_at: string | null
          tmo_iccid: string | null
          tmo_plan_request_id: string | null
          tmo_status: string | null
          tmo_timestamp: string | null
          updated_at: string
          verizon_iccid: string | null
          verizon_plan_request_id: string | null
          verizon_status: string | null
          verizon_timestamp: string | null
        }
        Insert: {
          activation_request_id?: string | null
          att_iccid?: string | null
          att_plan_request_id?: string | null
          att_status?: string | null
          att_timestamp?: string | null
          batch_id: string
          created_at?: string
          eid: string
          error_message?: string | null
          global_iccid?: string | null
          global_plan_request_id?: string | null
          global_status?: string | null
          global_timestamp?: string | null
          id?: string
          processing_completed_at?: string | null
          processing_duration_seconds?: number | null
          processing_started_at?: string | null
          tmo_iccid?: string | null
          tmo_plan_request_id?: string | null
          tmo_status?: string | null
          tmo_timestamp?: string | null
          updated_at?: string
          verizon_iccid?: string | null
          verizon_plan_request_id?: string | null
          verizon_status?: string | null
          verizon_timestamp?: string | null
        }
        Update: {
          activation_request_id?: string | null
          att_iccid?: string | null
          att_plan_request_id?: string | null
          att_status?: string | null
          att_timestamp?: string | null
          batch_id?: string
          created_at?: string
          eid?: string
          error_message?: string | null
          global_iccid?: string | null
          global_plan_request_id?: string | null
          global_status?: string | null
          global_timestamp?: string | null
          id?: string
          processing_completed_at?: string | null
          processing_duration_seconds?: number | null
          processing_started_at?: string | null
          tmo_iccid?: string | null
          tmo_plan_request_id?: string | null
          tmo_status?: string | null
          tmo_timestamp?: string | null
          updated_at?: string
          verizon_iccid?: string | null
          verizon_plan_request_id?: string | null
          verizon_status?: string | null
          verizon_timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "esim_results_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      update_batch_average_processing_time: {
        Args: { batch_id: string }
        Returns: undefined
      }
    }
    Enums: {
      batch_status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED"
      log_level: "DEBUG" | "INFO" | "WARNING" | "ERROR"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      batch_status: ["PENDING", "RUNNING", "COMPLETED", "FAILED"],
      log_level: ["DEBUG", "INFO", "WARNING", "ERROR"],
    },
  },
} as const
