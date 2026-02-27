import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Send, Search, Users, ArrowLeft, Hash, Loader2, Plus, X, Paperclip, Image as ImageIcon, Film, XCircle, Pin, PinOff, Reply, MoreHorizontal } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useSocket } from '../../src/hooks/useSocket';
import * as chatApi from '../../src/services/chatApi';
import type { Conversation, Message } from '../../src/services/chatApi';
import { UserSearch } from './UserSearch';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = Math.max(0, now - then);
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return 'now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDateHeader(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000 && d.getDate() === now.getDate()) return 'Today';
    if (diff < 172800000) return 'Yesterday';
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function getConversationName(conv: Conversation, currentUserId: string): string {
    if (conv.type === 'group') return conv.name || 'Group Chat';
    const other = conv.members?.find((m) => m.id !== currentUserId);
    return other?.name || other?.username || 'Direct Message';
}

function getConversationAvatar(conv: Conversation, currentUserId: string): string {
    if (conv.type === 'group') return conv.name?.[0]?.toUpperCase() || '#';
    const other = conv.members?.find((m) => m.id !== currentUserId);
    return other?.name?.[0]?.toUpperCase() || other?.username?.[0]?.toUpperCase() || 'U';
}

function getDmUsername(conv: Conversation, currentUserId: string): string | null {
    if (conv.type !== 'dm') return null;
    const other = conv.members?.find((m) => m.id !== currentUserId);
    return other?.username || null;
}

function renderMessageContent(content: string) {
    if (!content) return null;
    // Regex matches @username, ensuring it's preceded by space/start and followed by space/end/punctuation
    const mentionRegex = /(?<=^|\s)(@\w+)(?=\s|$|[.,!?])/g;

    const parts = content.split(mentionRegex);
    return parts.map((part, i) => {
        if (part.match(/^@\w+$/)) {
            return <span key={i} className="text-[#2AABEE] font-medium bg-[#2AABEE]/10 px-1 py-0.5 rounded-md">{part}</span>;
        }
        return part;
    });
}

// ─── Main Component ──────────────────────────────────────────────────────────

export const ChatPage: React.FC = () => {
    const { auth } = useStore();
    const currentUserId = auth.user?.id || '';

    const { sendMessage, onNewMessage, onNewConversation, joinConversation, isConnected, emitTypingStart, emitTypingStop, onTyping, onStopTyping, onPinnedMessageUpdated } = useSocket();

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConvId, setActiveConvId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageInput, setMessageInput] = useState('');
    const [loadingConvs, setLoadingConvs] = useState(true);
    const [loadingMsgs, setLoadingMsgs] = useState(false);
    const [sending, setSending] = useState(false);
    const [showNewDm, setShowNewDm] = useState(false);
    const [dmError, setDmError] = useState<string | null>(null);
    const [searchFilter, setSearchFilter] = useState('');
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const [showMobileChat, setShowMobileChat] = useState(false);

    // Pinned conversations (local storage)
    const [pinnedConvs, setPinnedConvs] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem(`boardlyX_pinned_${currentUserId}`);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    // Media states
    const [mediaPreview, setMediaPreview] = useState<{ type: string; data: string; name: string } | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [showAttachMenu, setShowAttachMenu] = useState(false);

    // Reply state
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);

    // Mentions state
    const [mentionQuery, setMentionQuery] = useState<{ active: boolean; text: string; index: number } | null>(null);

    // Message action dropdown state
    const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const typingTimerRef = useRef<ReturnType<typeof setTimeout>>();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const activeConv = conversations.find((c) => c.id === activeConvId);

    // ── Load conversations ──
    useEffect(() => {
        loadConversations();
    }, []);

    // Save pinned convs
    useEffect(() => {
        localStorage.setItem(`boardlyX_pinned_${currentUserId}`, JSON.stringify(pinnedConvs));
    }, [pinnedConvs, currentUserId]);

    const loadConversations = async () => {
        try {
            setLoadingConvs(true);
            const convs = await chatApi.listConversations();
            setConversations(convs);
        } catch (err) {
            console.error('Failed to load conversations', err);
        } finally {
            setLoadingConvs(false);
        }
    };

    // ── Load messages when active conversation changes ──
    useEffect(() => {
        if (!activeConvId) return;
        loadMessages(activeConvId);
    }, [activeConvId]);

    const loadMessages = async (convId: string) => {
        try {
            setLoadingMsgs(true);
            const msgs = await chatApi.getMessages(convId);
            setMessages(msgs);
            setTimeout(() => scrollToBottom(), 100);
        } catch (err) {
            console.error('Failed to load messages', err);
        } finally {
            setLoadingMsgs(false);
        }
    };

    // ── Listen for new messages ──
    useEffect(() => {
        const unsub = onNewMessage((message: Message) => {
            if (message.conversation_id === activeConvId) {
                setMessages((prev) => {
                    if (prev.some((m) => m.id === message.id)) return prev;
                    return [...prev, message];
                });
                setTimeout(() => scrollToBottom(), 50);
            }

            setConversations((prev) =>
                prev.map((c) =>
                    c.id === message.conversation_id
                        ? { ...c, last_message: message.media_type ? `📎 ${message.media_type.startsWith('image') ? 'Photo' : 'Video'}` : message.content, last_message_at: message.created_at }
                        : c,
                ).sort((a, b) => {
                    const aTime = a.last_message_at || a.created_at;
                    const bTime = b.last_message_at || b.created_at;
                    return new Date(bTime).getTime() - new Date(aTime).getTime();
                }),
            );
        });

        return unsub;
    }, [activeConvId, onNewMessage]);

    // ── Listen for new conversations (DM created by another user) ──
    useEffect(() => {
        const unsub = onNewConversation((conversation: Conversation) => {
            setConversations((prev) => {
                if (prev.some((c) => c.id === conversation.id)) return prev;
                return [conversation, ...prev];
            });
            joinConversation(conversation.id);
        });

        return unsub;
    }, [onNewConversation, joinConversation]);

    // ── Listen for pinned message updates ──
    useEffect(() => {
        const unsub = onPinnedMessageUpdated((data) => {
            setConversations((prev) =>
                prev.map((c) =>
                    c.id === data.conversationId
                        ? { ...c, pinned_message: data.pinnedMessage }
                        : c
                )
            );
        });
        return unsub;
    }, [onPinnedMessageUpdated]);

    // ── Typing indicators ──
    useEffect(() => {
        const unsubTyping = onTyping((data) => {
            if (data.conversationId === activeConvId && data.userId !== currentUserId) {
                setTypingUsers((prev) => new Set(prev).add(data.userId));
            }
        });

        const unsubStop = onStopTyping((data) => {
            if (data.conversationId === activeConvId) {
                setTypingUsers((prev) => {
                    const next = new Set(prev);
                    next.delete(data.userId);
                    return next;
                });
            }
        });

        return () => { unsubTyping(); unsubStop(); };
    }, [activeConvId, currentUserId, onTyping, onStopTyping]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // ── Auto-grow textarea ──
    const adjustTextareaHeight = () => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.style.height = 'auto';
        const lineHeight = 20;
        const maxHeight = lineHeight * 3 + 24; // 3 lines + padding
        textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    };

    useEffect(() => {
        adjustTextareaHeight();
    }, [messageInput]);

    // ── Send text message ──
    const handleSend = async () => {
        if ((!messageInput.trim() && !mediaPreview) || !activeConvId || sending || uploading) return;

        // If there's media, send via REST
        if (mediaPreview) {
            await handleSendMedia();
            return;
        }

        const content = messageInput.trim();
        const replyToId = replyingTo?.id;

        setMessageInput('');
        setReplyingTo(null);
        setSending(true);

        try {
            await sendMessage(activeConvId, content, replyToId);
            emitTypingStop(activeConvId);
        } catch (err) {
            console.error('Failed to send message', err);
            setMessageInput(content);
        } finally {
            setSending(false);
        }

        textareaRef.current?.focus();
    };

    // ── Send media message ──
    const handleSendMedia = async () => {
        if (!mediaPreview || !activeConvId || uploading) return;

        setUploading(true);
        setUploadError(null);
        const replyToId = replyingTo?.id;

        try {
            await chatApi.sendMediaMessage(
                activeConvId,
                mediaPreview.type,
                mediaPreview.data,
                messageInput.trim() || undefined,
                replyToId
            );
            setMediaPreview(null);
            setMessageInput('');
            setReplyingTo(null);
        } catch (err: any) {
            setUploadError(err.message || 'Failed to send media');
        } finally {
            setUploading(false);
        }

        textareaRef.current?.focus();
    };

    // ── Handle file selection ──
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadError(null);
        setShowAttachMenu(false);

        // Validate size
        if (file.size > MAX_FILE_SIZE) {
            setUploadError(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 2MB.`);
            return;
        }

        // Validate type
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        if (!isImage && !isVideo) {
            setUploadError('Only images and videos are supported.');
            return;
        }

        // Convert to base64
        const reader = new FileReader();
        reader.onload = () => {
            setMediaPreview({
                type: file.type,
                data: reader.result as string,
                name: file.name,
            });
        };
        reader.onerror = () => {
            setUploadError('Failed to read file.');
        };
        reader.readAsDataURL(file);

        // Reset input so same file can be re-selected
        e.target.value = '';
    };

    // ── Handle typing ──
    const handleInputChange = (val: string) => {
        setMessageInput(val);

        // Handle mentioning logic
        const cursorPosition = textareaRef.current?.selectionStart || 0;
        const textBeforeCursor = val.slice(0, cursorPosition);
        const words = textBeforeCursor.split(/[\s\n]/);
        const currentWord = words[words.length - 1];

        if (currentWord.startsWith('@')) {
            setMentionQuery({
                active: true,
                text: currentWord.slice(1).toLowerCase(),
                index: cursorPosition - currentWord.length
            });
        } else {
            setMentionQuery(null);
        }

        if (activeConvId && val.trim()) {
            emitTypingStart(activeConvId);
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
            typingTimerRef.current = setTimeout(() => {
                if (activeConvId) emitTypingStop(activeConvId);
            }, 2000);
        } else if (activeConvId) {
            emitTypingStop(activeConvId);
        }
    };

    const handleMentionSelect = (username: string) => {
        if (!mentionQuery) return;
        const beforeMention = messageInput.slice(0, mentionQuery.index);
        const afterMention = messageInput.slice(textareaRef.current?.selectionStart || 0);
        const newText = `${beforeMention}@${username} ${afterMention}`;
        setMessageInput(newText);
        setMentionQuery(null);
        textareaRef.current?.focus();
    };

    // ── Create DM ──
    const handleCreateDm = async (user: { id: string }) => {
        try {
            setDmError(null);
            const conv = await chatApi.createDm(user.id);
            joinConversation(conv.id);
            setConversations((prev) => {
                if (prev.some((c) => c.id === conv.id)) return prev;
                return [conv, ...prev];
            });
            setActiveConvId(conv.id);
            setShowNewDm(false);
            setShowMobileChat(true);
        } catch (err: any) {
            setDmError(err.message || 'Failed to create DM');
        }
    };

    const handleSelectConversation = (convId: string) => {
        setActiveConvId(convId);
        setShowMobileChat(true);
        setTypingUsers(new Set());
        setReplyingTo(null);
    };

    const togglePin = (convId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setPinnedConvs(prev =>
            prev.includes(convId) ? prev.filter(id => id !== convId) : [...prev, convId]
        );
    };

    // ── Filter conversations ──
    const filteredConversations = conversations.filter((c) => {
        if (!searchFilter) return true;
        const name = getConversationName(c, currentUserId).toLowerCase();
        return name.includes(searchFilter.toLowerCase());
    });

    const groupConversations = filteredConversations.filter((c) => c.type === 'group');
    const dmConversations = filteredConversations.filter((c) => c.type === 'dm');

    // Sort by pinned
    const sortConvs = (a: Conversation, b: Conversation) => {
        const aPinned = pinnedConvs.includes(a.id);
        const bPinned = pinnedConvs.includes(b.id);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        return 0; // maintain default date sorting within groups
    };

    const sortedGroups = [...groupConversations].sort(sortConvs);
    const sortedDms = [...dmConversations].sort(sortConvs);

    // ── Global Pin Handlers ──
    const handleToggleGlobalPin = async (message: Message) => {
        if (!activeConvId) return;
        const isCurrentlyPinned = activeConv?.pinned_message?.id === message.id;

        try {
            await chatApi.pinMessage(activeConvId, isCurrentlyPinned ? null : message.id);
            // Optimistic update
            setConversations((prev) =>
                prev.map((c) =>
                    c.id === activeConvId
                        ? { ...c, pinned_message: isCurrentlyPinned ? null : message }
                        : c
                )
            );
        } catch (err) {
            console.error('Failed to pin message', err);
        }
    };

    // Filter members for mention dropdown
    const mentionableMembers = activeConv?.members?.filter(m => m.id !== currentUserId && (m.username?.toLowerCase().includes(mentionQuery?.text || '') || m.name?.toLowerCase().includes(mentionQuery?.text || ''))) || [];

    // ── Group messages by date ──
    const groupedMessages: { date: string; messages: Message[] }[] = [];
    messages.forEach((msg) => {
        const date = new Date(msg.created_at).toDateString();
        const last = groupedMessages[groupedMessages.length - 1];
        if (last && last.date === date) {
            last.messages.push(msg);
        } else {
            groupedMessages.push({ date, messages: [msg] });
        }
    });

    return (
        <div className="flex h-[calc(100vh-80px)] md:h-[calc(100vh-80px)] overflow-hidden">
            {/* ─── Sidebar: Conversations ─── */}
            <div className={`${showMobileChat ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 border-r border-white/5 bg-[#0F1117]`}>
                {/* Header */}
                <div className="px-5 py-4 border-b border-white/5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <MessageCircle size={20} className="text-indigo-400" />
                            <h2 className="text-lg font-bold text-white">Messages</h2>
                        </div>
                        <button
                            onClick={() => setShowNewDm(true)}
                            className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-all"
                            title="New message"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                        <input
                            value={searchFilter}
                            onChange={(e) => setSearchFilter(e.target.value)}
                            placeholder="Search conversations..."
                            className="w-full bg-[#1A1D25] border border-white/5 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>
                </div>

                {/* New DM Panel */}
                {showNewDm && (
                    <div className="px-4 py-3 border-b border-white/5 bg-indigo-500/[0.03]">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">New Message</span>
                            <button onClick={() => { setShowNewDm(false); setDmError(null); }} className="text-white/30 hover:text-white/60">
                                <X size={14} />
                            </button>
                        </div>
                        <UserSearch
                            onSelect={(user) => handleCreateDm({ id: user.id })}
                            placeholder="Search teammate by username..."
                            autoFocus
                        />
                        {dmError && (
                            <p className="mt-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-1.5">{dmError}</p>
                        )}
                    </div>
                )}

                {/* Conversation List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loadingConvs ? (
                        <div className="flex items-center justify-center py-20 text-white/30">
                            <Loader2 className="animate-spin mr-2" size={16} />
                            <span className="text-sm">Loading...</span>
                        </div>
                    ) : conversations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-white/30 px-6 text-center">
                            <MessageCircle size={40} className="mb-3 opacity-30" />
                            <p className="text-sm font-medium mb-1">No conversations yet</p>
                            <p className="text-xs text-white/20">Create a team to get a group chat, or start a DM with a teammate.</p>
                        </div>
                    ) : (
                        <>
                            {groupConversations.length > 0 && (
                                <>
                                    <div className="px-5 py-2.5 text-[10px] font-bold text-white/25 uppercase tracking-[0.15em]">Team Chats</div>
                                    {sortedGroups.map((conv) => (
                                        <ConversationItem key={conv.id} conv={conv} isActive={conv.id === activeConvId} isPinned={pinnedConvs.includes(conv.id)} currentUserId={currentUserId} onClick={() => handleSelectConversation(conv.id)} onTogglePin={(e) => togglePin(conv.id, e)} />
                                    ))}
                                </>
                            )}
                            {sortedDms.length > 0 && (
                                <>
                                    <div className="px-5 py-2.5 mt-1 text-[10px] font-bold text-white/25 uppercase tracking-[0.15em]">Direct Messages</div>
                                    {sortedDms.map((conv) => (
                                        <ConversationItem key={conv.id} conv={conv} isActive={conv.id === activeConvId} isPinned={pinnedConvs.includes(conv.id)} currentUserId={currentUserId} onClick={() => handleSelectConversation(conv.id)} onTogglePin={(e) => togglePin(conv.id, e)} />
                                    ))}
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* Socket Status */}
                <div className="px-5 py-2 border-t border-white/5">
                    <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                        <span className="text-[10px] text-white/20">{isConnected ? 'Connected' : 'Reconnecting...'}</span>
                    </div>
                </div>
            </div>

            {/* ─── Main Chat Area ─── */}
            <div className={`${showMobileChat ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-[#0F1117] min-w-0`}>
                {activeConv ? (
                    <>
                        {/* Chat Header */}
                        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 bg-[#0F1117]/80 backdrop-blur-sm">
                            <button onClick={() => setShowMobileChat(false)} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all md:hidden">
                                <ArrowLeft size={18} />
                            </button>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${activeConv.type === 'group'
                                ? 'bg-gradient-to-br from-indigo-500/30 to-purple-500/30 text-indigo-300 border border-indigo-500/20'
                                : 'bg-gradient-to-br from-emerald-500/30 to-teal-500/30 text-emerald-300 border border-emerald-500/20'
                                }`}>
                                {activeConv.type === 'group' ? <Hash size={18} /> : getConversationAvatar(activeConv, currentUserId)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold text-white truncate">{getConversationName(activeConv, currentUserId)}</h3>
                                <p className="text-[11px] text-white/30">
                                    {activeConv.type === 'group' ? `${activeConv.member_count} members` : getDmUsername(activeConv, currentUserId) ? `@${getDmUsername(activeConv, currentUserId)}` : 'Direct message'}
                                </p>
                            </div>
                            {activeConv.type === 'group' && (
                                <div className="flex -space-x-2">
                                    {activeConv.members?.slice(0, 4).map((m, i) => (
                                        <div key={m.id} className="w-7 h-7 rounded-full bg-[#1A1D25] border-2 border-[#0F1117] overflow-hidden" style={{ zIndex: 4 - i }}>
                                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${m.name || m.username}`} alt="" className="w-full h-full" />
                                        </div>
                                    ))}
                                    {(activeConv.member_count || 0) > 4 && (
                                        <div className="w-7 h-7 rounded-full bg-[#1A1D25] border-2 border-[#0F1117] flex items-center justify-center text-[9px] font-bold text-white/40">+{(activeConv.member_count || 0) - 4}</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Global Pinned Message Banner */}
                        {activeConv.pinned_message && (
                            <div className="px-5 py-2.5 bg-[#1A1D25] border-b border-white/5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors" onClick={() => {
                                // Scroll to message logic could go here
                            }}>
                                <div className="flex items-start gap-3 min-w-0">
                                    <Pin size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold text-emerald-400 mb-0.5">Pinned Message</p>
                                        <div className="text-xs text-white/70 truncate">
                                            <span className="font-semibold mr-1">{activeConv.pinned_message.sender?.name || activeConv.pinned_message.sender?.username}:</span>
                                            {activeConv.pinned_message.media_type ? '📎 Media attached' : activeConv.pinned_message.content}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleGlobalPin(activeConv.pinned_message!);
                                    }}
                                    className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all ml-2 flex-shrink-0"
                                    title="Unpin message"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-6 py-4">
                            {loadingMsgs ? (
                                <div className="flex items-center justify-center py-20 text-white/30">
                                    <Loader2 className="animate-spin mr-2" size={16} />
                                    <span className="text-sm">Loading messages...</span>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-white/30">
                                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
                                        <MessageCircle size={28} className="text-indigo-400/50" />
                                    </div>
                                    <p className="text-sm font-medium mb-1">No messages yet</p>
                                    <p className="text-xs text-white/20">Send the first message to start the conversation!</p>
                                </div>
                            ) : (
                                groupedMessages.map((group) => (
                                    <div key={group.date}>
                                        <div className="flex items-center gap-3 my-5">
                                            <div className="flex-1 h-px bg-white/5" />
                                            <span className="text-[10px] font-medium text-white/20 uppercase tracking-wider">{formatDateHeader(group.messages[0].created_at)}</span>
                                            <div className="flex-1 h-px bg-white/5" />
                                        </div>
                                        {group.messages.map((msg, idx) => {
                                            const isOwn = msg.sender_id === currentUserId;
                                            const showAvatar = !isOwn && (idx === 0 || group.messages[idx - 1]?.sender_id !== msg.sender_id);
                                            const showName = showAvatar;
                                            const isConsecutive = idx > 0 && group.messages[idx - 1]?.sender_id === msg.sender_id;

                                            return (
                                                <div key={msg.id} className={`group flex gap-2.5 ${isOwn ? 'justify-end' : 'justify-start'} ${isConsecutive && !msg.reply_to_id ? 'mt-0.5' : 'mt-3'}`}>
                                                    {!isOwn && (
                                                        <div className="w-8 flex-shrink-0">
                                                            {showAvatar && (
                                                                <div className="w-8 h-8 rounded-full overflow-hidden bg-[#1A1D25] ring-2 ring-white/5">
                                                                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.sender?.name || msg.sender?.username}`} alt="" className="w-full h-full" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Hover Actions (Desktop) - Left Side */}
                                                    {isOwn && (
                                                        <div className="hidden md:flex items-center self-center mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => handleToggleGlobalPin(msg)}
                                                                className={`p-1.5 rounded-lg transition-colors ${activeConv.pinned_message?.id === msg.id ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20' : 'text-white/30 hover:text-white hover:bg-white/10'}`}
                                                                title={activeConv.pinned_message?.id === msg.id ? "Unpin message" : "Pin message"}
                                                            >
                                                                <Pin size={14} className={activeConv.pinned_message?.id === msg.id ? "fill-emerald-400" : ""} />
                                                            </button>
                                                        </div>
                                                    )
                                                    }

                                                    <div className={`max-w-[75%] md:max-w-[65%]`} onDoubleClick={() => setReplyingTo(msg)}>
                                                        {showName && !isOwn && (
                                                            <p className="text-[11px] font-medium text-indigo-400/70 mb-1 ml-1">{msg.sender?.name || msg.sender?.username || 'User'}</p>
                                                        )}

                                                        {/* Reply Preview */}
                                                        {msg.reply_to_id && (
                                                            <div className={`flex items-start gap-2 mb-1 px-3 py-1.5 opacity-70 ${isOwn ? 'bg-white/5 rounded-2xl rounded-br-md text-right flex-row-reverse border-r-2 border-indigo-400' : 'bg-white/5 rounded-2xl rounded-bl-md border-l-2 border-emerald-400'}`}>
                                                                <Reply size={12} className="mt-0.5 text-white/50 flex-shrink-0" />
                                                                <div className={`min-w-0 ${isOwn ? 'text-right' : 'text-left'}`}>
                                                                    <p className="text-[10px] font-semibold text-white/80">{msg.reply_to?.sender?.username || 'Previous message'}</p>
                                                                    <p className="text-[11px] text-white/50 truncate max-w-[150px] sm:max-w-[250px]">
                                                                        {msg.reply_to?.content || (msg.reply_to?.media_type ? '📎 Media' : 'Message...')}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Media content */}
                                                        {msg.media_type && msg.media_data && (
                                                            <div className={`rounded-2xl overflow-hidden mb-1 border border-white/5 ${isOwn ? 'rounded-br-md' : 'rounded-bl-md'}`}>
                                                                {msg.media_type.startsWith('image/') ? (
                                                                    <img src={msg.media_data} alt="Shared image" className="max-w-full max-h-72 object-contain bg-[#1A1D25]" loading="lazy" />
                                                                ) : msg.media_type.startsWith('video/') ? (
                                                                    <video src={msg.media_data} controls className="max-w-full max-h-72 bg-[#1A1D25]" preload="metadata" />
                                                                ) : null}
                                                            </div>
                                                        )}

                                                        {/* Text content */}
                                                        {msg.content && (
                                                            <div className={`px-3.5 py-2 text-[13px] leading-relaxed break-words ${isOwn ? 'bg-indigo-500 text-white rounded-2xl rounded-br-md' : 'bg-[#1A1D25] text-white/90 border border-white/5 rounded-2xl rounded-bl-md'
                                                                }`}>
                                                                {renderMessageContent(msg.content)}
                                                            </div>
                                                        )}

                                                        <p className={`text-[10px] text-white/15 mt-0.5 ${isOwn ? 'text-right mr-1' : 'ml-1'}`}>{formatTime(msg.created_at)}</p>
                                                    </div>

                                                    {/* Hover Actions (Desktop) - Right Side */}
                                                    {
                                                        !isOwn && (
                                                            <div className="hidden md:flex items-center self-center ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => handleToggleGlobalPin(msg)}
                                                                    className={`p-1.5 rounded-lg transition-colors ${activeConv.pinned_message?.id === msg.id ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20' : 'text-white/30 hover:text-white hover:bg-white/10'}`}
                                                                    title={activeConv.pinned_message?.id === msg.id ? "Unpin message" : "Pin message"}
                                                                >
                                                                    <Pin size={14} className={activeConv.pinned_message?.id === msg.id ? "fill-emerald-400" : ""} />
                                                                </button>
                                                            </div>
                                                        )
                                                    }
                                                </div>
                                            );
                                        })}
                                    </div>
                                )))}

                            {/* Typing Indicator */}
                            {typingUsers.size > 0 && (
                                <div className="flex items-center gap-2 mt-3 ml-10">
                                    <div className="flex gap-1 px-3 py-2 rounded-2xl bg-[#1A1D25] border border-white/5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                    <span className="text-[10px] text-white/20">typing...</span>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Reply Composer Preview */}
                        {replyingTo && (
                            <div className="px-4 md:px-6 pt-3 border-t border-white/5 bg-[#0F1117]">
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border-l-2 border-indigo-500">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-indigo-400">Replying to {replyingTo.sender?.username || 'User'}</p>
                                        <p className="text-[11px] text-white/50 truncate mt-0.5">
                                            {replyingTo.content || (replyingTo.media_type ? '📎 Media' : '')}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setReplyingTo(null)}
                                        className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                        )}



                        {/* Media Preview Bar */}
                        {mediaPreview && (
                            <div className="px-4 md:px-6 pt-3 border-t border-white/5 bg-[#0F1117]">
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#1A1D25] border border-white/5">
                                    <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-black/30 flex-shrink-0">
                                        {mediaPreview.type.startsWith('image/') ? (
                                            <img src={mediaPreview.data} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Film size={24} className="text-indigo-400" />
                                            </div>
                                        )}
                                        {uploading && (
                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                <Loader2 size={20} className="text-white animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-white/70 truncate font-medium">{mediaPreview.name}</p>
                                        <p className="text-[10px] text-white/30 mt-0.5">
                                            {mediaPreview.type.startsWith('image/') ? '📷 Image' : '🎬 Video'} • Ready to send
                                        </p>
                                        {uploadError && <p className="text-[10px] text-red-400 mt-1">{uploadError}</p>}
                                    </div>
                                    <button
                                        onClick={() => { setMediaPreview(null); setUploadError(null); }}
                                        className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                        disabled={uploading}
                                    >
                                        <XCircle size={18} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Message Input */}
                        <div className="relative px-4 md:px-6 py-3 border-t border-white/5 bg-[#0F1117]">
                            {/* Mention Dropdown */}
                            {mentionQuery?.active && mentionableMembers.length > 0 && (
                                <div className="absolute bottom-full left-0 w-full px-4 md:px-6 mb-2 z-50 pointer-events-none">
                                    <div className="bg-[#1A1D25] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-w-sm pointer-events-auto max-h-48 overflow-y-auto custom-scrollbar">
                                        <div className="px-3 py-2 text-[10px] font-bold text-white/30 uppercase tracking-wider border-b border-white/5 bg-black/20">Mentions</div>
                                        {mentionableMembers.map(member => (
                                            <button
                                                key={member.id}
                                                onClick={() => handleMentionSelect(member.username)}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
                                            >
                                                <div className="w-6 h-6 rounded-full overflow-hidden bg-black/30 flex-shrink-0">
                                                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name || member.username}`} alt="" className="w-full h-full" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[13px] font-medium text-white truncate">{member.name}</p>
                                                    <p className="text-[11px] text-indigo-400/70 truncate">@{member.username}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-end gap-2">
                                {/* Attachment button */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowAttachMenu(!showAttachMenu)}
                                        className="p-3 rounded-xl text-white/30 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
                                        disabled={uploading}
                                    >
                                        <Paperclip size={18} />
                                    </button>
                                    {showAttachMenu && (
                                        <div className="absolute bottom-full left-0 mb-2 bg-[#1A1D25] border border-white/10 rounded-xl shadow-xl overflow-hidden min-w-[160px] z-10">
                                            <button
                                                onClick={() => { fileInputRef.current?.setAttribute('accept', 'image/*'); fileInputRef.current?.click(); }}
                                                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 transition-all"
                                            >
                                                <ImageIcon size={15} className="text-emerald-400" />
                                                <span>Photo</span>
                                            </button>
                                            <button
                                                onClick={() => { fileInputRef.current?.setAttribute('accept', 'video/*'); fileInputRef.current?.click(); }}
                                                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 transition-all"
                                            >
                                                <Film size={15} className="text-indigo-400" />
                                                <span>Video</span>
                                            </button>
                                        </div>
                                    )}
                                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
                                </div>

                                {/* Textarea */}
                                <div className="flex-1">
                                    <textarea
                                        ref={textareaRef}
                                        value={messageInput}
                                        onChange={(e) => handleInputChange(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSend();
                                            }
                                        }}
                                        placeholder="Type a message..."
                                        rows={1}
                                        className="w-full bg-[#1A1D25] border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/30 transition-all resize-none overflow-y-auto leading-5"
                                        style={{ minHeight: '44px', maxHeight: '84px' }}
                                    />
                                </div>

                                {/* Send button */}
                                <button
                                    onClick={handleSend}
                                    disabled={(!messageInput.trim() && !mediaPreview) || sending || uploading}
                                    className="p-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 shadow-lg shadow-indigo-500/20"
                                >
                                    {uploading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-white/30 px-6">
                        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center mb-5 border border-white/5">
                            <MessageCircle size={36} className="text-indigo-400/40" />
                        </div>
                        <h3 className="text-lg font-semibold text-white/50 mb-2">Welcome to Chat</h3>
                        <p className="text-sm text-white/20 text-center max-w-sm">Select a conversation from the sidebar or start a new direct message with a teammate.</p>
                    </div>
                )}
            </div>
        </div >
    );
};

// ─── Conversation Item ───────────────────────────────────────────────────────

interface ConversationItemProps {
    conv: Conversation;
    isActive: boolean;
    isPinned: boolean;
    currentUserId: string;
    onClick: () => void;
    onTogglePin: (e: React.MouseEvent) => void;
}

const ConversationItem: React.FC<ConversationItemProps> = ({ conv, isActive, isPinned, currentUserId, onClick, onTogglePin }) => {
    const name = getConversationName(conv, currentUserId);
    const avatar = getConversationAvatar(conv, currentUserId);
    const username = getDmUsername(conv, currentUserId);

    return (
        <button
            onClick={onClick}
            className={`group w-full flex items-center gap-3 px-5 py-3 text-left transition-all hover:bg-white/[0.03] ${isActive ? 'bg-indigo-500/[0.08] border-r-2 border-indigo-500' : ''
                }`}
        >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${conv.type === 'group'
                ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-300'
                : 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-300'
                }`}>
                {conv.type === 'group' ? <Hash size={16} /> : avatar}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 min-w-0">
                        {isPinned && <Pin size={10} className="text-indigo-400 rotate-45 flex-shrink-0" />}
                        <span className={`text-sm truncate ${isActive ? 'text-white font-semibold' : 'text-white/80 font-medium'}`}>{name}</span>
                    </div>
                    {conv.last_message_at && <span className="text-[10px] text-white/20 flex-shrink-0">{timeAgo(conv.last_message_at)}</span>}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                    {conv.type === 'group' && <Users size={10} className="text-white/15 flex-shrink-0" />}
                    {username && conv.type === 'dm' && <span className="text-[10px] text-indigo-400/50 flex-shrink-0">@{username}</span>}
                    {conv.last_message ? (
                        <p className="text-xs text-white/25 truncate">{conv.last_message}</p>
                    ) : (
                        <p className="text-xs text-white/15 italic">No messages yet</p>
                    )}
                </div>
            </div>

            {/* Pin action button */}
            <div
                onClick={onTogglePin}
                className={`p-1.5 rounded-lg transition-opacity flex-shrink-0 hover:bg-white/10 ${isPinned ? 'opacity-100 text-indigo-400' : 'opacity-0 group-hover:opacity-100 text-white/30 hover:text-white'}`}
                title={isPinned ? "Unpin" : "Pin"}
            >
                {isPinned ? <PinOff size={14} /> : <Pin size={14} className="rotate-45" />}
            </div>
        </button>
    );
};
