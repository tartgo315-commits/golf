import { supabase } from '@/lib/supabase';

export type ChatMessage = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  read: boolean;
  createdAt: string;
};

/** 发送消息 */
export async function sendMessage(receiverId: string, content: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const { error } = await supabase.from('messages').insert({
    sender_id: user.id,
    receiver_id: receiverId,
    content: content.trim(),
  });
  if (error) throw error;
}

/** 加载与某人的历史消息（最近100条） */
export async function loadThread(friendId: string): Promise<ChatMessage[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, receiver_id, content, read, created_at')
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`,
    )
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  const rows = [...(data ?? [])].reverse();
  return rows.map((m: any) => ({
    id: m.id,
    senderId: m.sender_id,
    receiverId: m.receiver_id,
    content: m.content,
    read: m.read,
    createdAt: m.created_at,
  }));
}

/** 标记收到的消息为已读 */
export async function markThreadRead(friendId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('messages')
    .update({ read: true })
    .eq('sender_id', friendId)
    .eq('receiver_id', user.id)
    .eq('read', false);
}

/** 获取未读消息总数 */
export async function getUnreadCount(): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('receiver_id', user.id)
    .eq('read', false);
  return count ?? 0;
}
