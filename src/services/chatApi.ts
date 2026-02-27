const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000';

function authHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

export interface ConversationMember {
    id: string;
    name: string;
    username: string;
    email: string;
}

export interface Conversation {
    id: string;
    type: 'group' | 'dm';
    name: string | null;
    team_id: string | null;
    created_at: string;
    member_count: number;
    members: ConversationMember[];
    last_message: string | null;
    last_message_at: string | null;
    pinned_message?: Message | null;
}

export interface MessageSender {
    id: string;
    name: string;
    username: string;
}

export interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    media_type: string | null;
    media_data: string | null;
    reply_to_id?: string | null;
    reply_to?: Message; // populated locally or from API
    created_at: string;
    sender: MessageSender;
}

export async function listConversations(): Promise<Conversation[]> {
    const res = await fetch(`${API_BASE}/api/chat/conversations`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to load conversations');
    const data = await res.json();
    return data.conversations;
}

export async function getMessages(conversationId: string, limit = 50, before?: string): Promise<Message[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.set('before', before);
    const res = await fetch(`${API_BASE}/api/chat/conversations/${conversationId}/messages?${params}`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load messages');
    const data = await res.json();
    return data.messages;
}

export async function createDm(targetUserId: string): Promise<Conversation> {
    const res = await fetch(`${API_BASE}/api/chat/dm`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ targetUserId }),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create DM');
    }
    const data = await res.json();
    return data.conversation;
}

export async function sendMediaMessage(
    conversationId: string,
    mediaType: string,
    mediaData: string,
    content?: string,
    replyToId?: string,
): Promise<Message> {
    const res = await fetch(`${API_BASE}/api/chat/conversations/${conversationId}/media`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ mediaType, mediaData, content: content || '', replyToId }),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send media');
    }
    const data = await res.json();
    return data.message;
}

export async function pinMessage(conversationId: string, messageId: string | null): Promise<void> {
    const res = await fetch(`${API_BASE}/api/chat/conversations/${conversationId}/pin`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ messageId }),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to pin message');
    }
}
