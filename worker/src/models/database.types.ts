// Este arquivo será gerado automaticamente pelo comando:
// npm run update-types
// Por enquanto, definindo tipos manualmente baseados no schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type MotorcycleStatus = 'Disponível' | 'Alugada' | 'Manutenção' | 'Inativa';
export type PaymentStatus = 'Pendente' | 'Pago' | 'Atrasado' | 'Cancelado';

export interface Database {
  public: {
    Tables: {
      motorcycles: {
        Row: {
          id: string;
          plate: string;
          model: string;
          year: number;
          status: MotorcycleStatus;
          image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plate: string;
          model: string;
          year: number;
          status?: MotorcycleStatus;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          plate?: string;
          model?: string;
          year?: number;
          status?: MotorcycleStatus;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      subscribers: {
        Row: {
          id: string;
          name: string;
          phone: string;
          email: string | null;
          document: string;
          active: boolean;
          notes: string | null;
          auto_reminders_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone: string;
          email?: string | null;
          document: string;
          active?: boolean;
          notes?: string | null;
          auto_reminders_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string;
          email?: string | null;
          document?: string;
          active?: boolean;
          notes?: string | null;
          auto_reminders_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      rentals: {
        Row: {
          id: string;
          motorcycle_id: string;
          subscriber_id: string;
          start_date: string;
          end_date: string | null;
          weekly_value: number;
          due_day_of_week: number;
          is_active: boolean;
          terminated_at: string | null;
          termination_reason: string | null;
          outstanding_balance: number;
          total_contract_value: number;
          total_paid: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          motorcycle_id: string;
          subscriber_id: string;
          start_date: string;
          end_date?: string | null;
          weekly_value: number;
          due_day_of_week: number;
          is_active?: boolean;
          terminated_at?: string | null;
          termination_reason?: string | null;
          outstanding_balance?: number;
          total_contract_value?: number;
          total_paid?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          motorcycle_id?: string;
          subscriber_id?: string;
          start_date?: string;
          end_date?: string | null;
          weekly_value?: number;
          due_day_of_week?: number;
          is_active?: boolean;
          terminated_at?: string | null;
          termination_reason?: string | null;
          outstanding_balance?: number;
          total_contract_value?: number;
          total_paid?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          rental_id: string;
          subscriber_name: string;
          amount: number;
          expected_amount: number;
          due_date: string;
          status: PaymentStatus;
          paid_at: string | null;
          marked_as_paid_at: string | null;
          previous_status: PaymentStatus | null;
          is_amount_overridden: boolean;
          reminder_sent_count: number;
          abacate_pix_id: string | null;
          pix_br_code: string | null;
          pix_expires_at: string | null;
          pix_qr_code_url: string | null;
          pix_payment_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          rental_id: string;
          subscriber_name: string;
          amount: number;
          expected_amount: number;
          due_date: string;
          status?: PaymentStatus;
          paid_at?: string | null;
          marked_as_paid_at?: string | null;
          previous_status?: PaymentStatus | null;
          is_amount_overridden?: boolean;
          reminder_sent_count?: number;
          abacate_pix_id?: string | null;
          pix_br_code?: string | null;
          pix_expires_at?: string | null;
          pix_qr_code_url?: string | null;
          pix_payment_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          rental_id?: string;
          subscriber_name?: string;
          amount?: number;
          expected_amount?: number;
          due_date?: string;
          status?: PaymentStatus;
          paid_at?: string | null;
          marked_as_paid_at?: string | null;
          previous_status?: PaymentStatus | null;
          is_amount_overridden?: boolean;
          reminder_sent_count?: number;
          abacate_pix_id?: string | null;
          pix_br_code?: string | null;
          pix_expires_at?: string | null;
          pix_qr_code_url?: string | null;
          pix_payment_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      payment_status_changes: {
        Row: {
          id: string;
          payment_id: string;
          from_status: PaymentStatus;
          to_status: PaymentStatus;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          from_status: PaymentStatus;
          to_status: PaymentStatus;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          payment_id?: string;
          from_status?: PaymentStatus;
          to_status?: PaymentStatus;
          reason?: string | null;
          created_at?: string;
        };
      };
      notification_log: {
        Row: {
          id: string;
          payment_id: string;
          subscriber_id: string;
          subscriber_name: string;
          notification_type: 'payment_created' | 'reminder' | 'consolidated';
          week_key: string;
          sent_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          subscriber_id: string;
          subscriber_name: string;
          notification_type: 'payment_created' | 'reminder' | 'consolidated';
          week_key: string;
          sent_at?: string;
        };
        Update: {
          id?: string;
          payment_id?: string;
          subscriber_id?: string;
          subscriber_name?: string;
          notification_type?: 'payment_created' | 'reminder' | 'consolidated';
          week_key?: string;
          sent_at?: string;
        };
      };
    };
  };
}
