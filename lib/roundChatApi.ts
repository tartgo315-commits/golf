import { supabase } from '@/lib/supabase';

export type RoundMessage = {
  id: string;
  roundId: string;
  userId: string;
  displayName: string;
  content: string;
  createdAt: string;
};

function mapRow(m: Record<string, unknown>): RoundMessage {
  return {
    id: String(m.id),
    roundId: String(m.round_id),
    userId: String(m.user_id),
    displayName: String(m.display_name ?? '球友'),
    content: String(m.content ?? ''),
    createdAt: String(m.created_at ?? ''),
  };
}

export async function loadRoundMessages(roundId: string): Promise<RoundMessage[]> {
  const { data, error } = await supabase
    .from('round_messages')
    .select('id, round_id, user_id, display_name, content, created_at')
    .eq('round_id', roundId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function sendRoundMessage(input: {
  roundId: string;
  userId: string;
  displayName: string;
  content: string;
}): Promise<void> {
  const { error } = await supabase.from('round_messages').insert({
    round_id: input.roundId,
    user_id: input.userId,
    display_name: input.displayName.trim() || '球友',
    content: input.content.trim(),
  });
  if (error) throw error;
}

export function subscribeRoundMessages(
  roundId: string,
  onInsert: (msg: RoundMessage) => void,
): ReturnType<typeof supabase.channel> {
  const channel = supabase
    .channel(`round-chat-${roundId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'round_messages',
        filter: `round_id=eq.${roundId}`,
      },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        if (!row?.id) return;
        onInsert(mapRow(row));
      },
    )
    .subscribe();
  return channel;
}
