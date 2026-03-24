import { getSupabaseClient } from '../config/supabase';
import { Database } from '../models/database.types';

type NotificationLog = Database['public']['Tables']['notification_log']['Row'];
type NotificationLogInsert = Database['public']['Tables']['notification_log']['Insert'];

function getCurrentWeekKey(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.ceil((now.getTime() - jan1.getTime()) / 86400000);
  const weekNumber = Math.ceil((dayOfYear + jan1.getDay()) / 7);
  return `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

export class NotificationLogRepository {
  private supabase = getSupabaseClient();

  async wasAlreadySent(
    paymentId: string,
    notificationType: 'payment_created' | 'reminder' | 'consolidated',
    weekKey?: string
  ): Promise<boolean> {
    const week = weekKey ?? getCurrentWeekKey();
    const { data } = await this.supabase
      .from('notification_log')
      .select('id')
      .eq('payment_id', paymentId)
      .eq('notification_type', notificationType)
      .eq('week_key', week)
      .limit(1);

    return (data?.length ?? 0) > 0;
  }

  async log(entry: Omit<NotificationLogInsert, 'week_key'> & { week_key?: string }): Promise<void> {
    const weekKey = entry.week_key ?? getCurrentWeekKey();
    const { error } = await this.supabase
      .from('notification_log')
      // @ts-expect-error - Tipos do Supabase serão gerados após configuração
      .upsert(
        { ...entry, week_key: weekKey },
        { onConflict: 'payment_id,notification_type,week_key' }
      );

    if (error) {
      console.error(`[NotificationLog] Erro ao registrar log:`, error);
    }
  }

  async findByWeek(weekKey?: string): Promise<NotificationLog[]> {
    const week = weekKey ?? getCurrentWeekKey();
    const { data, error } = await this.supabase
      .from('notification_log')
      .select('*')
      .eq('week_key', week)
      .order('sent_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async findBySubscriberAndWeek(subscriberId: string, weekKey?: string): Promise<NotificationLog[]> {
    const week = weekKey ?? getCurrentWeekKey();
    const { data, error } = await this.supabase
      .from('notification_log')
      .select('*')
      .eq('subscriber_id', subscriberId)
      .eq('week_key', week)
      .order('sent_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  getWeekKey(): string {
    return getCurrentWeekKey();
  }
}
