import { getSupabaseClient } from '../config/supabase';
import { Database } from '../models/database.types';

type ReminderJob = Database['public']['Tables']['reminder_jobs']['Row'];
type ReminderJobInsert = Database['public']['Tables']['reminder_jobs']['Insert'];
type ReminderJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export class ReminderJobRepository {
  private supabase = getSupabaseClient();

  async create(paymentId: string): Promise<ReminderJob> {
    const insert: ReminderJobInsert = { payment_id: paymentId };

    const { data, error } = await this.supabase
      .from('reminder_jobs')
      // @ts-expect-error - Tipos do Supabase serão gerados após configuração
      .insert(insert)
      .select()
      .single();

    if (error) throw new Error(`Failed to create reminder job: ${error.message}`);
    return data;
  }

  async findById(id: string): Promise<ReminderJob | null> {
    const { data, error } = await this.supabase
      .from('reminder_jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async updateStatus(id: string, status: ReminderJobStatus, errorMessage?: string): Promise<void> {
    const updates: any = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (errorMessage !== undefined) {
      updates.error = errorMessage;
    }

    const { error } = await this.supabase
      .from('reminder_jobs')
      // @ts-expect-error - Tipos do Supabase serão gerados após configuração
      .update(updates)
      .eq('id', id);

    if (error) throw new Error(`Failed to update reminder job status: ${error.message}`);
  }
}
