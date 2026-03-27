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
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      _revenue_category_cleanup_evidence: {
        Row: {
          cleaned_at: string | null
          id: string
          new_revenue_category: string | null
          old_revenue_category: string | null
          probable_cause: string | null
        }
        Insert: {
          cleaned_at?: string | null
          id: string
          new_revenue_category?: string | null
          old_revenue_category?: string | null
          probable_cause?: string | null
        }
        Update: {
          cleaned_at?: string | null
          id?: string
          new_revenue_category?: string | null
          old_revenue_category?: string | null
          probable_cause?: string | null
        }
        Relationships: []
      }
      accountant_at_config: {
        Row: {
          accountant_id: string
          at_public_key_base64: string | null
          ca_chain_pem: string | null
          certificate_cn: string | null
          certificate_password_encrypted: string | null
          certificate_pfx_base64: string | null
          certificate_valid_from: string | null
          certificate_valid_to: string | null
          created_at: string | null
          environment: string | null
          id: string
          is_active: boolean | null
          subuser_id: string | null
          subuser_password_encrypted: string | null
          updated_at: string | null
        }
        Insert: {
          accountant_id: string
          at_public_key_base64?: string | null
          ca_chain_pem?: string | null
          certificate_cn?: string | null
          certificate_password_encrypted?: string | null
          certificate_pfx_base64?: string | null
          certificate_valid_from?: string | null
          certificate_valid_to?: string | null
          created_at?: string | null
          environment?: string | null
          id?: string
          is_active?: boolean | null
          subuser_id?: string | null
          subuser_password_encrypted?: string | null
          updated_at?: string | null
        }
        Update: {
          accountant_id?: string
          at_public_key_base64?: string | null
          ca_chain_pem?: string | null
          certificate_cn?: string | null
          certificate_password_encrypted?: string | null
          certificate_pfx_base64?: string | null
          certificate_valid_from?: string | null
          certificate_valid_to?: string | null
          created_at?: string | null
          environment?: string | null
          id?: string
          is_active?: boolean | null
          subuser_id?: string | null
          subuser_password_encrypted?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      accountant_requests: {
        Row: {
          admin_notes: string | null
          cedula_number: string | null
          company_name: string | null
          created_at: string | null
          id: string
          motivation: string | null
          occ_number: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          specializations: string[] | null
          status: string
          tax_office: string | null
          updated_at: string | null
          user_id: string
          years_experience: number | null
        }
        Insert: {
          admin_notes?: string | null
          cedula_number?: string | null
          company_name?: string | null
          created_at?: string | null
          id?: string
          motivation?: string | null
          occ_number?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          specializations?: string[] | null
          status?: string
          tax_office?: string | null
          updated_at?: string | null
          user_id: string
          years_experience?: number | null
        }
        Update: {
          admin_notes?: string | null
          cedula_number?: string | null
          company_name?: string | null
          created_at?: string | null
          id?: string
          motivation?: string | null
          occ_number?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          specializations?: string[] | null
          status?: string
          tax_office?: string | null
          updated_at?: string | null
          user_id?: string
          years_experience?: number | null
        }
        Relationships: []
      }
      ai_metrics: {
        Row: {
          created_at: string | null
          id: string
          last_classification_at: string | null
          last_correction_at: string | null
          supplier_name: string | null
          supplier_nif: string
          total_classifications: number | null
          total_corrections: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_classification_at?: string | null
          last_correction_at?: string | null
          supplier_name?: string | null
          supplier_nif: string
          total_classifications?: number | null
          total_corrections?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_classification_at?: string | null
          last_correction_at?: string | null
          supplier_name?: string | null
          supplier_nif?: string
          total_classifications?: number | null
          total_corrections?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      at_credentials: {
        Row: {
          accountant_id: string
          at_public_key_base64: string | null
          certificate_password_encrypted: string | null
          certificate_pfx_base64: string | null
          certificate_valid_from: string | null
          certificate_valid_to: string | null
          client_id: string
          consecutive_failures: number
          created_at: string | null
          encrypted_password: string
          encrypted_username: string
          environment: string | null
          id: string
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          portal_nif: string | null
          portal_password_encrypted: string | null
          subuser_id: string | null
          updated_at: string | null
        }
        Insert: {
          accountant_id: string
          at_public_key_base64?: string | null
          certificate_password_encrypted?: string | null
          certificate_pfx_base64?: string | null
          certificate_valid_from?: string | null
          certificate_valid_to?: string | null
          client_id: string
          consecutive_failures?: number
          created_at?: string | null
          encrypted_password: string
          encrypted_username: string
          environment?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          portal_nif?: string | null
          portal_password_encrypted?: string | null
          subuser_id?: string | null
          updated_at?: string | null
        }
        Update: {
          accountant_id?: string
          at_public_key_base64?: string | null
          certificate_password_encrypted?: string | null
          certificate_pfx_base64?: string | null
          certificate_valid_from?: string | null
          certificate_valid_to?: string | null
          client_id?: string
          consecutive_failures?: number
          created_at?: string | null
          encrypted_password?: string
          encrypted_username?: string
          environment?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          portal_nif?: string | null
          portal_password_encrypted?: string | null
          subuser_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "at_credentials_accountant_id_fkey"
            columns: ["accountant_id"]
            isOneToOne: false
            referencedRelation: "at_control_center_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "at_credentials_accountant_id_fkey"
            columns: ["accountant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "at_credentials_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "at_control_center_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "at_credentials_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      at_sync_automation_runs: {
        Row: {
          batches: Json
          id: string
          local_time: string
          notes: string | null
          run_date: string
          run_slot: string
          total_jobs: number
          triggered_at: string
        }
        Insert: {
          batches?: Json
          id?: string
          local_time: string
          notes?: string | null
          run_date: string
          run_slot: string
          total_jobs?: number
          triggered_at?: string
        }
        Update: {
          batches?: Json
          id?: string
          local_time?: string
          notes?: string | null
          run_date?: string
          run_slot?: string
          total_jobs?: number
          triggered_at?: string
        }
        Relationships: []
      }
      at_sync_history: {
        Row: {
          accountant_id: string | null
          client_id: string
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          end_date: string
          error_details: Json | null
          error_message: string | null
          id: string
          metadata: Json | null
          reason_code: string | null
          records_errors: number | null
          records_imported: number | null
          records_skipped: number | null
          records_updated: number | null
          start_date: string
          status: string | null
          sync_method: string
          sync_type: string
        }
        Insert: {
          accountant_id?: string | null
          client_id: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          end_date: string
          error_details?: Json | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          reason_code?: string | null
          records_errors?: number | null
          records_imported?: number | null
          records_skipped?: number | null
          records_updated?: number | null
          start_date: string
          status?: string | null
          sync_method: string
          sync_type: string
        }
        Update: {
          accountant_id?: string | null
          client_id?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          end_date?: string
          error_details?: Json | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          reason_code?: string | null
          records_errors?: number | null
          records_imported?: number | null
          records_skipped?: number | null
          records_updated?: number | null
          start_date?: string
          status?: string | null
          sync_method?: string
          sync_type?: string
        }
        Relationships: []
      }
      at_sync_jobs: {
        Row: {
          accountant_id: string
          client_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          fiscal_year: number
          id: string
          invoices_synced: number | null
          job_batch_id: string | null
          max_retries: number
          next_retry_at: string | null
          retry_count: number
          started_at: string | null
          status: string
        }
        Insert: {
          accountant_id: string
          client_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          fiscal_year?: number
          id?: string
          invoices_synced?: number | null
          job_batch_id?: string | null
          max_retries?: number
          next_retry_at?: string | null
          retry_count?: number
          started_at?: string | null
          status?: string
        }
        Update: {
          accountant_id?: string
          client_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          fiscal_year?: number
          id?: string
          invoices_synced?: number | null
          job_batch_id?: string | null
          max_retries?: number
          next_retry_at?: string | null
          retry_count?: number
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "at_sync_jobs_accountant_id_fkey"
            columns: ["accountant_id"]
            isOneToOne: false
            referencedRelation: "at_control_center_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "at_sync_jobs_accountant_id_fkey"
            columns: ["accountant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "at_sync_jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "at_control_center_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "at_sync_jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      at_sync_override_audit: {
        Row: {
          accountant_id: string
          batch_id: string | null
          fiscal_year: number
          id: string
          override_id: string | null
          requested_by: string | null
          source: string
          used_at: string
        }
        Insert: {
          accountant_id: string
          batch_id?: string | null
          fiscal_year: number
          id?: string
          override_id?: string | null
          requested_by?: string | null
          source?: string
          used_at?: string
        }
        Update: {
          accountant_id?: string
          batch_id?: string | null
          fiscal_year?: number
          id?: string
          override_id?: string | null
          requested_by?: string | null
          source?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "at_sync_override_audit_accountant_id_fkey"
            columns: ["accountant_id"]
            isOneToOne: false
            referencedRelation: "at_control_center_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "at_sync_override_audit_accountant_id_fkey"
            columns: ["accountant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "at_sync_override_audit_override_id_fkey"
            columns: ["override_id"]
            isOneToOne: false
            referencedRelation: "at_sync_year_overrides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "at_sync_override_audit_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "at_control_center_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "at_sync_override_audit_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      at_sync_runtime_config: {
        Row: {
          check_deadlines_url: string | null
          created_at: string
          id: boolean
          process_queue_url: string
          updated_at: string
        }
        Insert: {
          check_deadlines_url?: string | null
          created_at?: string
          id?: boolean
          process_queue_url: string
          updated_at?: string
        }
        Update: {
          check_deadlines_url?: string | null
          created_at?: string
          id?: boolean
          process_queue_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      at_sync_year_overrides: {
        Row: {
          accountant_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          fiscal_year: number
          id: string
          is_active: boolean
          reason: string
          updated_at: string
        }
        Insert: {
          accountant_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          fiscal_year: number
          id?: string
          is_active?: boolean
          reason: string
          updated_at?: string
        }
        Update: {
          accountant_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          fiscal_year?: number
          id?: string
          is_active?: boolean
          reason?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "at_sync_year_overrides_accountant_id_fkey"
            columns: ["accountant_id"]
            isOneToOne: false
            referencedRelation: "at_control_center_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "at_sync_year_overrides_accountant_id_fkey"
            columns: ["accountant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "at_sync_year_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "at_control_center_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "at_sync_year_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      at_withholding_candidates: {
        Row: {
          accountant_id: string | null
          beneficiary_name: string | null
          beneficiary_nif: string
          client_id: string
          confidence: number | null
          confidence_score: number
          created_at: string
          detected_keys: string[]
          detection_reason: string | null
          document_reference: string
          fiscal_year: number
          gross_amount: number
          id: string
          income_category: string
          notes: string | null
          payment_date: string
          promoted_at: string | null
          promoted_withholding_id: string | null
          raw_payload: Json
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_sales_invoice_id: string | null
          source_sync_history_id: string | null
          status: string
          sync_history_id: string | null
          updated_at: string
          withholding_amount: number
          withholding_rate: number | null
        }
        Insert: {
          accountant_id?: string | null
          beneficiary_name?: string | null
          beneficiary_nif: string
          client_id: string
          confidence?: number | null
          confidence_score?: number
          created_at?: string
          detected_keys?: string[]
          detection_reason?: string | null
          document_reference: string
          fiscal_year: number
          gross_amount: number
          id?: string
          income_category: string
          notes?: string | null
          payment_date: string
          promoted_at?: string | null
          promoted_withholding_id?: string | null
          raw_payload?: Json
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_sales_invoice_id?: string | null
          source_sync_history_id?: string | null
          status?: string
          sync_history_id?: string | null
          updated_at?: string
          withholding_amount?: number
          withholding_rate?: number | null
        }
        Update: {
          accountant_id?: string | null
          beneficiary_name?: string | null
          beneficiary_nif?: string
          client_id?: string
          confidence?: number | null
          confidence_score?: number
          created_at?: string
          detected_keys?: string[]
          detection_reason?: string | null
          document_reference?: string
          fiscal_year?: number
          gross_amount?: number
          id?: string
          income_category?: string
          notes?: string | null
          payment_date?: string
          promoted_at?: string | null
          promoted_withholding_id?: string | null
          raw_payload?: Json
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_sales_invoice_id?: string | null
          source_sync_history_id?: string | null
          status?: string
          sync_history_id?: string | null
          updated_at?: string
          withholding_amount?: number
          withholding_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "at_withholding_candidates_accountant_id_fkey"
            columns: ["accountant_id"]
            isOneToOne: false
            referencedRelation: "at_control_center_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "at_withholding_candidates_accountant_id_fkey"
            columns: ["accountant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "at_withholding_candidates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "at_control_center_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "at_withholding_candidates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "at_withholding_candidates_promoted_withholding_id_fkey"
            columns: ["promoted_withholding_id"]
            isOneToOne: false
            referencedRelation: "tax_withholdings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "at_withholding_candidates_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "at_control_center_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "at_withholding_candidates_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "at_withholding_candidates_source_sales_invoice_id_fkey"
            columns: ["source_sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "at_withholding_candidates_source_sync_history_id_fkey"
            columns: ["source_sync_history_id"]
            isOneToOne: false
            referencedRelation: "at_sync_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "at_withholding_candidates_sync_history_id_fkey"
            columns: ["sync_history_id"]
            isOneToOne: false
            referencedRelation: "at_sync_history"
            referencedColumns: ["id"]
          },
        ]
      }
      category_preferences: {
        Row: {
          cae_prefix: string | null
          category: string
          created_at: string
          id: string
          last_used_at: string
          usage_count: number
          user_id: string
        }
        Insert: {
          cae_prefix?: string | null
          category: string
          created_at?: string
          id?: string
          last_used_at?: string
          usage_count?: number
          user_id: string
        }
        Update: {
          cae_prefix?: string | null
          category?: string
          created_at?: string
          id?: string
          last_used_at?: string
          usage_count?: number
          user_id?: string
        }
        Relationships: []
      }
      classification_batches: {
        Row: {
          batch_type: string
          chunk_size: number
          completed_at: string | null
          created_at: string | null
          cursor_position: string | null
          error_log: Json | null
          id: string
          started_at: string | null
          status: string
          total_classified: number
          total_errors: number
          total_processed: number
          total_review: number
          total_target: number
        }
        Insert: {
          batch_type?: string
          chunk_size?: number
          completed_at?: string | null
          created_at?: string | null
          cursor_position?: string | null
          error_log?: Json | null
          id?: string
          started_at?: string | null
          status?: string
          total_classified?: number
          total_errors?: number
          total_processed?: number
          total_review?: number
          total_target?: number
        }
        Update: {
          batch_type?: string
          chunk_size?: number
          completed_at?: string | null
          created_at?: string | null
          cursor_position?: string | null
          error_log?: Json | null
          id?: string
          started_at?: string | null
          status?: string
          total_classified?: number
          total_errors?: number
          total_processed?: number
          total_review?: number
          total_target?: number
        }
        Relationships: []
      }
      classification_examples: {
        Row: {
          client_activity: string | null
          created_at: string | null
          expense_category: string | null
          final_classification: string
          final_deductibility: number | null
          final_dp_field: number | null
          id: string
          reason: string | null
          supplier_name: string | null
          supplier_nif: string
        }
        Insert: {
          client_activity?: string | null
          created_at?: string | null
          expense_category?: string | null
          final_classification: string
          final_deductibility?: number | null
          final_dp_field?: number | null
          id?: string
          reason?: string | null
          supplier_name?: string | null
          supplier_nif: string
        }
        Update: {
          client_activity?: string | null
          created_at?: string | null
          expense_category?: string | null
          final_classification?: string
          final_deductibility?: number | null
          final_dp_field?: number | null
          id?: string
          reason?: string | null
          supplier_name?: string | null
          supplier_nif?: string
        }
        Relationships: []
      }
      classification_rules: {
        Row: {
          classification: string
          client_cae: string | null
          client_id: string | null
          confidence: number | null
          created_at: string | null
          created_by: string | null
          deductibility: number | null
          dp_field: number | null
          id: string
          is_global: boolean | null
          last_used_at: string | null
          notes: string | null
          requires_review: boolean | null
          supplier_name_pattern: string | null
          supplier_nif: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          classification: string
          client_cae?: string | null
          client_id?: string | null
          confidence?: number | null
          created_at?: string | null
          created_by?: string | null
          deductibility?: number | null
          dp_field?: number | null
          id?: string
          is_global?: boolean | null
          last_used_at?: string | null
          notes?: string | null
          requires_review?: boolean | null
          supplier_name_pattern?: string | null
          supplier_nif: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          classification?: string
          client_cae?: string | null
          client_id?: string | null
          confidence?: number | null
          created_at?: string | null
          created_by?: string | null
          deductibility?: number | null
          dp_field?: number | null
          id?: string
          is_global?: boolean | null
          last_used_at?: string | null
          notes?: string | null
          requires_review?: boolean | null
          supplier_name_pattern?: string | null
          supplier_nif?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "classification_rules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "at_control_center_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "classification_rules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classification_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "at_control_center_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "classification_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_accountants: {
        Row: {
          access_level: string
          accountant_id: string
          client_id: string
          created_at: string
          id: string
          invited_by: string | null
          is_primary: boolean
        }
        Insert: {
          access_level?: string
          accountant_id: string
          client_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          is_primary?: boolean
        }
        Update: {
          access_level?: string
          accountant_id?: string
          client_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          is_primary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "client_accountants_accountant_id_fkey"
            columns: ["accountant_id"]
            isOneToOne: false
            referencedRelation: "at_control_center_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_accountants_accountant_id_fkey"
            columns: ["accountant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_accountants_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "at_control_center_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_accountants_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_accountants_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "at_control_center_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_accountants_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_invitations: {
        Row: {
          accepted_at: string | null
          accountant_id: string
          client_email: string
          client_id: string | null
          client_name: string
          client_nif: string
          company_name: string | null
          created_at: string | null
          id: string
          magic_link_used: boolean | null
        }
        Insert: {
          accepted_at?: string | null
          accountant_id: string
          client_email: string
          client_id?: string | null
          client_name: string
          client_nif: string
          company_name?: string | null
          created_at?: string | null
          id?: string
          magic_link_used?: boolean | null
        }
        Update: {
          accepted_at?: string | null
          accountant_id?: string
          client_email?: string
          client_id?: string | null
          client_name?: string
          client_nif?: string
          company_name?: string | null
          created_at?: string | null
          id?: string
          magic_link_used?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "client_invitations_accountant_id_fkey"
            columns: ["accountant_id"]
            isOneToOne: false
            referencedRelation: "at_control_center_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_invitations_accountant_id_fkey"
            columns: ["accountant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invitations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "at_control_center_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_invitations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_webhook_keys: {
        Row: {
          created_at: string
          name: string
          token: string
        }
        Insert: {
          created_at?: string
          name: string
          token: string
        }
        Update: {
          created_at?: string
          name?: string
          token?: string
        }
        Relationships: []
      }
      invoice_validation_logs: {
        Row: {
          action: string
          changes: Json | null
          created_at: string | null
          id: string
          invoice_id: string
          invoice_type: string
          user_id: string
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string | null
          id?: string
          invoice_id: string
          invoice_type: string
          user_id: string
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string | null
          id?: string
          invoice_id?: string
          invoice_type?: string
          user_id?: string
        }
        Relationships: []
      }
      invoice_vat_lines: {
        Row: {
          created_at: string | null
          deductibility_percent: number | null
          dp_field: number | null
          id: string
          invoice_id: string | null
          is_deductible: boolean | null
          source: string | null
          tax_amount: number
          tax_base: number
          tax_code: string
          tax_rate: number
        }
        Insert: {
          created_at?: string | null
          deductibility_percent?: number | null
          dp_field?: number | null
          id?: string
          invoice_id?: string | null
          is_deductible?: boolean | null
          source?: string | null
          tax_amount: number
          tax_base: number
          tax_code: string
          tax_rate: number
        }
        Update: {
          created_at?: string | null
          deductibility_percent?: number | null
          dp_field?: number | null
          id?: string
          invoice_id?: string | null
          is_deductible?: boolean | null
          source?: string | null
          tax_amount?: number
          tax_base?: number
          tax_code?: string
          tax_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_vat_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          accounting_excluded: boolean
          ai_classification: string | null
          ai_confidence: number | null
          ai_deductibility: number | null
          ai_dp_field: number | null
          ai_reason: string | null
          atcud: string | null
          base_exempt: number | null
          base_intermediate: number | null
          base_reduced: number | null
          base_standard: number | null
          client_id: string
          created_at: string | null
          customer_nif: string | null
          data_authority: string | null
          document_date: string
          document_number: string | null
          document_type: string | null
          efatura_source: string | null
          exclusion_reason: string | null
          final_classification: string | null
          final_deductibility: number | null
          final_dp_field: number | null
          fiscal_period: string | null
          fiscal_region: string | null
          id: string
          image_path: string
          is_activity_related: boolean | null
          qr_raw: string | null
          requires_accountant_validation: boolean | null
          status: string | null
          supplier_cae: string | null
          supplier_name: string | null
          supplier_nif: string
          supplier_vat_id: string | null
          total_amount: number
          total_vat: number | null
          validated_at: string | null
          validated_by: string | null
          vat_intermediate: number | null
          vat_reduced: number | null
          vat_standard: number | null
        }
        Insert: {
          accounting_excluded?: boolean
          ai_classification?: string | null
          ai_confidence?: number | null
          ai_deductibility?: number | null
          ai_dp_field?: number | null
          ai_reason?: string | null
          atcud?: string | null
          base_exempt?: number | null
          base_intermediate?: number | null
          base_reduced?: number | null
          base_standard?: number | null
          client_id: string
          created_at?: string | null
          customer_nif?: string | null
          data_authority?: string | null
          document_date: string
          document_number?: string | null
          document_type?: string | null
          efatura_source?: string | null
          exclusion_reason?: string | null
          final_classification?: string | null
          final_deductibility?: number | null
          final_dp_field?: number | null
          fiscal_period?: string | null
          fiscal_region?: string | null
          id?: string
          image_path: string
          is_activity_related?: boolean | null
          qr_raw?: string | null
          requires_accountant_validation?: boolean | null
          status?: string | null
          supplier_cae?: string | null
          supplier_name?: string | null
          supplier_nif: string
          supplier_vat_id?: string | null
          total_amount: number
          total_vat?: number | null
          validated_at?: string | null
          validated_by?: string | null
          vat_intermediate?: number | null
          vat_reduced?: number | null
          vat_standard?: number | null
        }
        Update: {
          accounting_excluded?: boolean
          ai_classification?: string | null
          ai_confidence?: number | null
          ai_deductibility?: number | null
          ai_dp_field?: number | null
          ai_reason?: string | null
          atcud?: string | null
          base_exempt?: number | null
          base_intermediate?: number | null
          base_reduced?: number | null
          base_standard?: number | null
          client_id?: string
          created_at?: string | null
          customer_nif?: string | null
          data_authority?: string | null
          document_date?: string
          document_number?: string | null
          document_type?: string | null
          efatura_source?: string | null
          exclusion_reason?: string | null
          final_classification?: string | null
          final_deductibility?: number | null
          final_dp_field?: number | null
          fiscal_period?: string | null
          fiscal_region?: string | null
          id?: string
          image_path?: string
          is_activity_related?: boolean | null
          qr_raw?: string | null
          requires_accountant_validation?: boolean | null
          status?: string | null
          supplier_cae?: string | null
          supplier_name?: string | null
          supplier_nif?: string
          supplier_vat_id?: string | null
          total_amount?: number
          total_vat?: number | null
          validated_at?: string | null
          validated_by?: string | null
          vat_intermediate?: number | null
          vat_reduced?: number | null
          vat_standard?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "at_control_center_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "at_control_center_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "invoices_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          deadline_reminders: boolean
          id: string
          new_uploads: boolean
          pending_invoices: boolean
          reminder_days: number[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deadline_reminders?: boolean
          id?: string
          new_uploads?: boolean
          pending_invoices?: boolean
          reminder_days?: number[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deadline_reminders?: boolean
          id?: string
          new_uploads?: boolean
          pending_invoices?: boolean
          reminder_days?: number[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          initials: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          initials: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          initials?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accountant_id: string | null
          accounting_regime: string | null
          activity_description: string | null
          address: string | null
          at_contact_email: string | null
          cae: string | null
          company_name: string | null
          created_at: string | null
          email: string | null
          full_name: string
          has_accountant_ss: boolean | null
          has_other_employment: boolean | null
          id: string
          is_first_year: boolean | null
          iva_cadence: string
          last_ss_declaration: string | null
          nif: string | null
          niss: string | null
          other_employment_salary: number | null
          phone: string | null
          ss_contribution_rate: number | null
          taxable_profit: number | null
          taxpayer_kind: string | null
          vat_regime: string | null
          worker_type: string | null
        }
        Insert: {
          accountant_id?: string | null
          accounting_regime?: string | null
          activity_description?: string | null
          address?: string | null
          at_contact_email?: string | null
          cae?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          full_name: string
          has_accountant_ss?: boolean | null
          has_other_employment?: boolean | null
          id: string
          is_first_year?: boolean | null
          iva_cadence?: string
          last_ss_declaration?: string | null
          nif?: string | null
          niss?: string | null
          other_employment_salary?: number | null
          phone?: string | null
          ss_contribution_rate?: number | null
          taxable_profit?: number | null
          taxpayer_kind?: string | null
          vat_regime?: string | null
          worker_type?: string | null
        }
        Update: {
          accountant_id?: string | null
          accounting_regime?: string | null
          activity_description?: string | null
          address?: string | null
          at_contact_email?: string | null
          cae?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          has_accountant_ss?: boolean | null
          has_other_employment?: boolean | null
          id?: string
          is_first_year?: boolean | null
          iva_cadence?: string
          last_ss_declaration?: string | null
          nif?: string | null
          niss?: string | null
          other_employment_salary?: number | null
          phone?: string | null
          ss_contribution_rate?: number | null
          taxable_profit?: number | null
          taxpayer_kind?: string | null
          vat_regime?: string | null
          worker_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_accountant_id_fkey"
            columns: ["accountant_id"]
            isOneToOne: false
            referencedRelation: "at_control_center_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "profiles_accountant_id_fkey"
            columns: ["accountant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      revenue_entries: {
        Row: {
          amount: number
          category: string
          client_id: string
          created_at: string | null
          id: string
          notes: string | null
          period_quarter: string
          source: string | null
          source_withholding_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number
          category: string
          client_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          period_quarter: string
          source?: string | null
          source_withholding_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category?: string
          client_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          period_quarter?: string
          source?: string | null
          source_withholding_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "at_control_center_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "revenue_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_entries_source_withholding_id_fkey"
            columns: ["source_withholding_id"]
            isOneToOne: true
            referencedRelation: "tax_withholdings"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoices: {
        Row: {
          ai_category_confidence: number | null
          atcud: string | null
          base_exempt: number | null
          base_intermediate: number | null
          base_reduced: number | null
          base_standard: number | null
          client_id: string
          created_at: string | null
          customer_name: string | null
          customer_nif: string | null
          document_date: string
          document_number: string | null
          document_type: string | null
          fiscal_period: string | null
          fiscal_region: string | null
          id: string
          image_path: string
          import_source: string | null
          notes: string | null
          qr_raw: string | null
          revenue_category: string | null
          status: string | null
          supplier_cae: string | null
          supplier_nif: string
          total_amount: number
          total_vat: number | null
          validated_at: string | null
          vat_intermediate: number | null
          vat_reduced: number | null
          vat_standard: number | null
          withholding_amount_imported: number | null
        }
        Insert: {
          ai_category_confidence?: number | null
          atcud?: string | null
          base_exempt?: number | null
          base_intermediate?: number | null
          base_reduced?: number | null
          base_standard?: number | null
          client_id: string
          created_at?: string | null
          customer_name?: string | null
          customer_nif?: string | null
          document_date: string
          document_number?: string | null
          document_type?: string | null
          fiscal_period?: string | null
          fiscal_region?: string | null
          id?: string
          image_path: string
          import_source?: string | null
          notes?: string | null
          qr_raw?: string | null
          revenue_category?: string | null
          status?: string | null
          supplier_cae?: string | null
          supplier_nif: string
          total_amount: number
          total_vat?: number | null
          validated_at?: string | null
          vat_intermediate?: number | null
          vat_reduced?: number | null
          vat_standard?: number | null
          withholding_amount_imported?: number | null
        }
        Update: {
          ai_category_confidence?: number | null
          atcud?: string | null
          base_exempt?: number | null
          base_intermediate?: number | null
          base_reduced?: number | null
          base_standard?: number | null
          client_id?: string
          created_at?: string | null
          customer_name?: string | null
          customer_nif?: string | null
          document_date?: string
          document_number?: string | null
          document_type?: string | null
          fiscal_period?: string | null
          fiscal_region?: string | null
          id?: string
          image_path?: string
          import_source?: string | null
          notes?: string | null
          qr_raw?: string | null
          revenue_category?: string | null
          status?: string | null
          supplier_cae?: string | null
          supplier_nif?: string
          total_amount?: number
          total_vat?: number | null
          validated_at?: string | null
          vat_intermediate?: number | null
          vat_reduced?: number | null
          vat_standard?: number | null
          withholding_amount_imported?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "at_control_center_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "sales_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_notifications: {
        Row: {
          body: string | null
          id: string
          notification_type: string
          reference_id: string | null
          sent_at: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          id?: string
          notification_type: string
          reference_id?: string | null
          sent_at?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          id?: string
          notification_type?: string
          reference_id?: string | null
          sent_at?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      ss_declarations: {
        Row: {
          client_id: string
          contribution_amount: number
          contribution_base: number
          contribution_rate: number
          created_at: string | null
          id: string
          notes: string | null
          period_quarter: string
          status: string | null
          submitted_at: string | null
          total_revenue: number
        }
        Insert: {
          client_id: string
          contribution_amount?: number
          contribution_base?: number
          contribution_rate: number
          created_at?: string | null
          id?: string
          notes?: string | null
          period_quarter: string
          status?: string | null
          submitted_at?: string | null
          total_revenue?: number
        }
        Update: {
          client_id?: string
          contribution_amount?: number
          contribution_base?: number
          contribution_rate?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          period_quarter?: string
          status?: string | null
          submitted_at?: string | null
          total_revenue?: number
        }
        Relationships: [
          {
            foreignKeyName: "ss_declarations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "at_control_center_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ss_declarations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_directory: {
        Row: {
          activity: string | null
          cae: string | null
          city: string | null
          confidence: number
          created_at: string
          name: string
          nif: string
          source: string
          updated_at: string
        }
        Insert: {
          activity?: string | null
          cae?: string | null
          city?: string | null
          confidence?: number
          created_at?: string
          name: string
          nif: string
          source?: string
          updated_at?: string
        }
        Update: {
          activity?: string | null
          cae?: string | null
          city?: string | null
          confidence?: number
          created_at?: string
          name?: string
          nif?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      tax_withholdings: {
        Row: {
          beneficiary_address: string | null
          beneficiary_name: string | null
          beneficiary_nif: string
          client_id: string
          country_code: string | null
          created_at: string | null
          dispensed_amount: number | null
          document_reference: string | null
          exempt_amount: number | null
          fiscal_year: number
          gross_amount: number
          id: string
          import_source: string | null
          income_category: string
          income_code: string | null
          is_non_resident: boolean | null
          location_code: string
          notes: string | null
          payer_nif: string | null
          payment_date: string
          source_invoice_id: string | null
          source_sales_invoice_id: string | null
          status: string | null
          updated_at: string | null
          withholding_amount: number
          withholding_rate: number | null
          withholding_reason_text: string | null
          withholding_semantic_status: string | null
        }
        Insert: {
          beneficiary_address?: string | null
          beneficiary_name?: string | null
          beneficiary_nif: string
          client_id: string
          country_code?: string | null
          created_at?: string | null
          dispensed_amount?: number | null
          document_reference?: string | null
          exempt_amount?: number | null
          fiscal_year: number
          gross_amount: number
          id?: string
          import_source?: string | null
          income_category: string
          income_code?: string | null
          is_non_resident?: boolean | null
          location_code?: string
          notes?: string | null
          payer_nif?: string | null
          payment_date: string
          source_invoice_id?: string | null
          source_sales_invoice_id?: string | null
          status?: string | null
          updated_at?: string | null
          withholding_amount?: number
          withholding_rate?: number | null
          withholding_reason_text?: string | null
          withholding_semantic_status?: string | null
        }
        Update: {
          beneficiary_address?: string | null
          beneficiary_name?: string | null
          beneficiary_nif?: string
          client_id?: string
          country_code?: string | null
          created_at?: string | null
          dispensed_amount?: number | null
          document_reference?: string | null
          exempt_amount?: number | null
          fiscal_year?: number
          gross_amount?: number
          id?: string
          import_source?: string | null
          income_category?: string
          income_code?: string | null
          is_non_resident?: boolean | null
          location_code?: string
          notes?: string | null
          payer_nif?: string | null
          payment_date?: string
          source_invoice_id?: string | null
          source_sales_invoice_id?: string | null
          status?: string | null
          updated_at?: string | null
          withholding_amount?: number
          withholding_rate?: number | null
          withholding_reason_text?: string | null
          withholding_semantic_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_withholdings_source_invoice_id_fkey"
            columns: ["source_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_withholdings_source_sales_invoice_id_fkey"
            columns: ["source_sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_queue: {
        Row: {
          client_id: string
          confidence: number | null
          created_at: string
          error_message: string | null
          extracted_data: Json | null
          file_data: string
          file_name: string
          fiscal_year: number | null
          id: string
          normalized_doc_ref: string | null
          outcome_code: string | null
          processed_at: string | null
          qr_content: string | null
          retry_count: number
          started_at: string | null
          status: string
          upload_type: string
          user_id: string
          warnings: string[] | null
        }
        Insert: {
          client_id: string
          confidence?: number | null
          created_at?: string
          error_message?: string | null
          extracted_data?: Json | null
          file_data: string
          file_name: string
          fiscal_year?: number | null
          id?: string
          normalized_doc_ref?: string | null
          outcome_code?: string | null
          processed_at?: string | null
          qr_content?: string | null
          retry_count?: number
          started_at?: string | null
          status?: string
          upload_type?: string
          user_id: string
          warnings?: string[] | null
        }
        Update: {
          client_id?: string
          confidence?: number | null
          created_at?: string
          error_message?: string | null
          extracted_data?: Json | null
          file_data?: string
          file_name?: string
          fiscal_year?: number | null
          id?: string
          normalized_doc_ref?: string | null
          outcome_code?: string | null
          processed_at?: string | null
          qr_content?: string | null
          retry_count?: number
          started_at?: string | null
          status?: string
          upload_type?: string
          user_id?: string
          warnings?: string[] | null
        }
        Relationships: []
      }
      user_onboarding_progress: {
        Row: {
          completed_steps: string[]
          created_at: string
          id: string
          is_dismissed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_steps?: string[]
          created_at?: string
          id?: string
          is_dismissed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_steps?: string[]
          created_at?: string
          id?: string
          is_dismissed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      withholding_logs: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          id: string
          user_id: string
          withholding_id: string
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          id?: string
          user_id: string
          withholding_id: string
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          id?: string
          user_id?: string
          withholding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withholding_logs_withholding_id_fkey"
            columns: ["withholding_id"]
            isOneToOne: false
            referencedRelation: "tax_withholdings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      at_control_center_view: {
        Row: {
          accountant_id: string | null
          client_email: string | null
          client_id: string | null
          client_name: string | null
          client_nif: string | null
          compras_total: number | null
          credential_environment: string | null
          has_credentials: boolean | null
          jobs_completed: number | null
          jobs_error: number | null
          jobs_pending: number | null
          jobs_processing: number | null
          last_error_message: string | null
          last_job_at: string | null
          last_reason_code: string | null
          last_sync_at: string | null
          last_sync_method: string | null
          last_sync_status: string | null
          operational_status: string | null
          vendas_total: number | null
          withholding_candidates_high_confidence: number | null
          withholding_candidates_pending: number | null
          withholding_candidates_rejected: number | null
          withholdings_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_accountants_accountant_id_fkey"
            columns: ["accountant_id"]
            isOneToOne: false
            referencedRelation: "at_control_center_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_accountants_accountant_id_fkey"
            columns: ["accountant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      at_sync_health_view: {
        Row: {
          client_id: string | null
          compras_total: number | null
          error_message: string | null
          last_sync_at: string | null
          method: string | null
          reason_code: string | null
          records_errors: number | null
          records_imported: number | null
          records_skipped: number | null
          status: string | null
          sync_method: string | null
          vendas_total: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      approve_accountant_request: {
        Args: { p_admin_notes?: string; request_id: string }
        Returns: boolean
      }
      associate_client: {
        Args: {
          client_uuid: string
          p_access_level?: string
          p_is_primary?: boolean
        }
        Returns: boolean
      }
      backfill_sales_invoices_from_invoices: {
        Args: { p_created_after?: string }
        Returns: number
      }
      cleanup_old_queue_items: { Args: never; Returns: number }
      count_rows_by_client: {
        Args: { p_client_ids: string[]; p_table_name: string }
        Returns: {
          client_id: string
          row_count: number
        }[]
      }
      get_accountant_clients: {
        Args: { accountant_uuid: string }
        Returns: {
          access_level: string
          address: string
          company_name: string
          email: string
          full_name: string
          id: string
          is_primary: boolean
          iva_cadence: string
          nif: string
          pending_invoices: number
          phone: string
          validated_invoices: number
        }[]
      }
      get_at_control_center: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_reason?: string
          p_search?: string
          p_status?: string
        }
        Returns: {
          accountant_id: string
          client_email: string
          client_id: string
          client_name: string
          client_nif: string
          compras_total: number
          credential_environment: string
          has_credentials: boolean
          jobs_completed: number
          jobs_error: number
          jobs_pending: number
          jobs_processing: number
          last_error_message: string
          last_job_at: string
          last_reason_code: string
          last_sync_at: string
          last_sync_method: string
          last_sync_status: string
          operational_status: string
          vendas_total: number
          withholding_candidates_high_confidence: number
          withholding_candidates_pending: number
          withholding_candidates_rejected: number
          withholdings_total: number
        }[]
      }
      get_at_control_center_stats: { Args: never; Returns: Json }
      get_at_sync_health: { Args: never; Returns: Json }
      get_client_accountants: {
        Args: { client_uuid: string }
        Returns: {
          access_level: string
          accountant_id: string
          company_name: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_primary: boolean
          nif: string
        }[]
      }
      get_distinct_fiscal_periods: {
        Args: { p_client_id?: string; p_table_name?: string }
        Returns: string[]
      }
      get_my_accountant_request: {
        Args: never
        Returns: {
          admin_notes: string
          cedula_number: string
          created_at: string
          id: string
          occ_number: string
          reviewed_at: string
          status: string
        }[]
      }
      get_pending_accountant_requests: {
        Args: never
        Returns: {
          cedula_number: string
          company_name: string
          created_at: string
          email: string
          full_name: string
          id: string
          motivation: string
          occ_number: string
          specializations: string[]
          tax_office: string
          user_id: string
          years_experience: number
        }[]
      }
      get_queue_stats: {
        Args: { p_user_id: string }
        Returns: {
          completed_count: number
          failed_count: number
          pending_count: number
          processing_count: number
          total_count: number
        }[]
      }
      get_sync_batch_progress: {
        Args: { p_batch_id: string }
        Returns: {
          completed: number
          errors: number
          pending: number
          processing: number
          total: number
          total_invoices: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_consecutive_failures: {
        Args: { p_client_id: string }
        Returns: undefined
      }
      invite_accountant_to_client: {
        Args: {
          accountant_nif: string
          client_uuid: string
          p_access_level?: string
        }
        Returns: boolean
      }
      is_at_sync_year_override_active: {
        Args: { p_accountant_id: string; p_fiscal_year: number }
        Returns: boolean
      }
      log_invoice_validation: {
        Args: {
          p_action: string
          p_changes?: Json
          p_invoice_id: string
          p_invoice_type: string
        }
        Returns: string
      }
      map_withholding_income_to_revenue_category: {
        Args: { p_income_category: string }
        Returns: string
      }
      promote_withholding_candidates: {
        Args: { p_client_id: string; p_ids?: string[]; p_mode?: string }
        Returns: Json
      }
      reject_accountant_request: {
        Args: { p_admin_notes: string; request_id: string }
        Returns: boolean
      }
      remove_client: { Args: { client_uuid: string }; Returns: boolean }
      remove_client_accountant: {
        Args: { p_accountant_id: string }
        Returns: boolean
      }
      remove_my_accountant: { Args: never; Returns: boolean }
      run_scheduled_at_sync: { Args: { p_force?: boolean }; Returns: Json }
      search_available_clients: {
        Args: { search_term: string }
        Returns: {
          address: string
          already_associated: boolean
          company_name: string
          email: string
          full_name: string
          id: string
          nif: string
          phone: string
        }[]
      }
      sync_profile_emails: { Args: never; Returns: undefined }
      sync_revenue_entries_from_withholdings: {
        Args: { p_client_id?: string; p_fiscal_year?: number }
        Returns: number
      }
      sync_revenue_entry_from_withholding: {
        Args: { p_withholding_id: string }
        Returns: undefined
      }
      update_ai_metrics: {
        Args: {
          p_supplier_name?: string
          p_supplier_nif: string
          p_was_correction?: boolean
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "client" | "accountant" | "admin"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["client", "accountant", "admin"],
    },
  },
} as const
A new version of Supabase CLI is available: v2.78.1 (currently installed v2.72.7)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
