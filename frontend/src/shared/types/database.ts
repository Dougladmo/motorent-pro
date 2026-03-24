/**
 * Supabase Database types
 * This file can be auto-generated with: npm run update-types
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Type aliases for database string literals
type DbMotorcycleStatus = 'Disponível' | 'Alugada' | 'Manutenção' | 'Inativa';
type DbPaymentStatus = 'Pendente' | 'Pago' | 'Atrasado' | 'Cancelado';

export interface Database {
  public: {
    Tables: {
      motorcycles: {
        Row: {
          id: string;
          plate: string;
          chassi: string | null;
          renavam: string | null;
          model: string;
          year: number;
          mileage: number;
          status: DbMotorcycleStatus;
          image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plate: string;
          chassi?: string | null;
          renavam?: string | null;
          model: string;
          year: number;
          mileage?: number;
          status?: DbMotorcycleStatus;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          plate?: string;
          chassi?: string;
          renavam?: string;
          model?: string;
          year?: number;
          mileage?: number;
          status?: DbMotorcycleStatus;
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
          document: string;
          active: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone: string;
          document: string;
          active?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string;
          document?: string;
          active?: boolean;
          notes?: string | null;
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
          status: DbPaymentStatus;
          paid_at: string | null;
          marked_as_paid_at: string | null;
          previous_status: DbPaymentStatus | null;
          is_amount_overridden: boolean;
          reminder_sent_count: number;
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
          status?: DbPaymentStatus;
          paid_at?: string | null;
          marked_as_paid_at?: string | null;
          previous_status?: DbPaymentStatus | null;
          is_amount_overridden?: boolean;
          reminder_sent_count?: number;
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
          status?: DbPaymentStatus;
          paid_at?: string | null;
          marked_as_paid_at?: string | null;
          previous_status?: DbPaymentStatus | null;
          is_amount_overridden?: boolean;
          reminder_sent_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      payment_status_changes: {
        Row: {
          id: string;
          payment_id: string;
          from_status: DbPaymentStatus;
          to_status: DbPaymentStatus;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          from_status: DbPaymentStatus;
          to_status: DbPaymentStatus;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          payment_id?: string;
          from_status?: DbPaymentStatus;
          to_status?: DbPaymentStatus;
          reason?: string | null;
          created_at?: string;
        };
      };
    };
  };
}
