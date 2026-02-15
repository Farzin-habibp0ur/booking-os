'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { useSocket } from '@/lib/use-socket';
import { useToast } from '@/lib/toast';
import { useI18n } from '@/lib/i18n';
import {
  Send, Plus, User, Phone, Tag, Search, MessageSquare,
  Clock, AlertCircle, UserCheck, Archive, Inbox as InboxIcon,
  ChevronDown, FileText, X, AlarmClock, StickyNote, Zap, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import BookingFormModal from '@/components/booking-form-modal';
import AiSuggestions from '@/components/ai-suggestions';
import AiBookingPanel from '@/components/ai-booking-panel';
import AiSummary from '@/components/ai-summary';

type Filter = 'all' | 'unassigned' | 'mine' | 'overdue' | 'waiting' | 'snoozed' | 'closed';

interface FilterCounts {
  all: number; unassigned: number; mine: number; overdue: number;
  waiting: number; snoozed: number; closed: number;
}

const FILTER_ICONS: Record<Filter, any> = {
  all: InboxIcon, unassigned: UserCheck, mine: User, overdue: AlertCircle,
  waiting: Clock, snoozed: AlarmClock, closed: Archive,
};

const SNOOZE_HOURS = [
  { key: '1h', hours: 1 },
  { key: '3h', hours: 3 },
  { key: 'tomorrow', hours: -1 },
  { key: '1d', hours: 24 },
  { key: '3d', hours: 72 },
];

export default function InboxPage() {
  const { t } = useI18n();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [customer, setCustomer] = useState<any>(null);
  const [customerBookings, setCustomerBookings] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const [filterCounts, setFilterCounts] = useState<FilterCounts>({ all: 0, unassigned: 0, mine: 0, overdue: 0, waiting: 0, snoozed: 0, closed: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [staffList, setStaffList] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [sidebarTab, setSidebarTab] = useState<'info' | 'notes'>('info');
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [convTags, setConvTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [aiDraftText, setAiDraftText] = useState<string>('');
  const [aiIntent, setAiIntent] = useState<string | undefined>();
  const [aiConfidence, setAiConfidence] = useState<number | undefined>();
  const [aiBookingState, setAiBookingState] = useState<any>(null);
  const [aiCancelState, setAiCancelState] = useState<any>(null);
  const [aiRescheduleState, setAiRescheduleState] = useState<any>(null);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [transferredToHuman, setTransferredToHuman] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const msgPollRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const selectedRef = useRef<any>(null);
  const { toast } = useToast();

  const FILTER_KEYS: Filter[] = ['all', 'unassigned', 'mine', 'overdue', 'waiting', 'snoozed', 'closed'];

  const FILTER_LABELS: Record<Filter, string> = {
    all: t('inbox.filter_all'),
    unassigned: t('inbox.filter_unassigned'),
    mine: t('inbox.filter_mine'),
    overdue: t('inbox.filter_overdue'),
    waiting: t('inbox.filter_waiting'),
    snoozed: t('inbox.filter_snoozed'),
    closed: t('inbox.filter_closed'),
  };

  const QUICK_REPLIES = [
    t('inbox.quick_reply_1'),
    t('inbox.quick_reply_2'),
    t('inbox.quick_reply_3'),
    t('inbox.quick_reply_4'),
    t('inbox.quick_reply_5'),
  ];

  const SNOOZE_LABELS: Record<string, string> = {
    '1h': t('inbox.snooze_1h'),
    '3h': t('inbox.snooze_3h'),
    'tomorrow': t('inbox.snooze_tomorrow'),
    '1d': t('inbox.snooze_1d'),
    '3d': t('inbox.snooze_3d'),
  };

  selectedRef.current = selected;

  useSocket({
    'message:new': useCallback((msg: any) => {
      if (selectedRef.current && msg.conversationId === selectedRef.current.id) {
        loadMessages(selectedRef.current.id);
      }
      loadConversations();
      loadFilterCounts();
    }, []),
    'conversation:update': useCallback((_conv: any) => {
      loadConversations();
      loadFilterCounts();
    }, []),
    'booking:update': useCallback((_booking: any) => {
      if (selectedRef.current?.customerId) {
        loadCustomerBookings(selectedRef.current.customerId);
      }
    }, []),
    'ai:suggestions': useCallback((data: any) => {
      if (selectedRef.current && data.conversationId === selectedRef.current.id) {
        setAiDraftText(data.draftText || '');
        setAiIntent(data.intent);
        setAiConfidence(data.confidence);
        if (data.bookingState) setAiBookingState(data.bookingState);
        if (data.cancelState) setAiCancelState(data.cancelState);
        if (data.rescheduleState) setAiRescheduleState(data.rescheduleState);
      }
    }, []),
    'ai:auto-replied': useCallback((data: any) => {
      if (selectedRef.current && data.conversationId === selectedRef.current.id) {
        loadMessages(selectedRef.current.id);
      }
      toast(t('ai.auto_replied_notification'), 'info');
      loadConversations();
    }, []),
    'ai:transferred': useCallback((data: any) => {
      if (selectedRef.current && data.conversationId === selectedRef.current.id) {
        setTransferredToHuman(true);
        loadMessages(selectedRef.current.id);
      }
      toast(t('ai.transferred_notification', { name: data.assignedTo?.name || '' }), 'info');
      loadConversations();
      loadFilterCounts();
    }, []),
  });

  useEffect(() => {
    loadFilterCounts();
    loadStaff();
    loadTemplates();
  }, []);

  useEffect(() => {
    loadConversations();
    pollRef.current = setInterval(() => {
      loadConversations();
      loadFilterCounts();
    }, 15000);
    return () => clearInterval(pollRef.current);
  }, [activeFilter, searchQuery]);

  useEffect(() => {
    if (selected) {
      loadMessages(selected.id);
      loadCustomer(selected.customerId);
      loadCustomerBookings(selected.customerId);
      loadNotes(selected.id);
      setConvTags(selected.tags || []);
      setSidebarTab('info');
      // Load AI metadata from conversation
      const meta = selected.metadata || {};
      setAiSummary(meta.aiSummary || '');
      setAiBookingState(meta.aiBookingState || null);
      setAiCancelState(meta.aiCancelState || null);
      setAiRescheduleState(meta.aiRescheduleState || null);
      setTransferredToHuman(!!meta.transferredToHuman);
      // Clear per-message AI state
      setAiDraftText('');
      setAiIntent(undefined);
      setAiConfidence(undefined);
      msgPollRef.current = setInterval(() => loadMessages(selected.id), 15000);
    }
    return () => clearInterval(msgPollRef.current);
  }, [selected?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // Restore AI draft from last inbound message metadata if no draft is currently showing
    if (messages.length > 0 && !aiDraftText) {
      const reversed = [...messages].reverse();
      const lastInbound = reversed.find((m: any) => m.direction === 'INBOUND');
      if (lastInbound) {
        const aiMeta = lastInbound.metadata?.ai;
        if (aiMeta?.draftText) {
          // Don't restore if an outbound message was already sent after this inbound
          // (means draft was already sent or auto-replied)
          const lastInboundIdx = messages.indexOf(lastInbound);
          const hasOutboundAfter = messages.slice(lastInboundIdx + 1).some((m: any) => m.direction === 'OUTBOUND');
          if (!hasOutboundAfter) {
            setAiDraftText(aiMeta.draftText);
            setAiIntent(aiMeta.intent);
            setAiConfidence(aiMeta.confidence);
          }
        }
      }
    }
  }, [messages]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSnoozeMenu(false);
        setShowAssignDropdown(false);
        setShowTemplates(false);
        setShowQuickReplies(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadConversations = async () => {
    try {
      const params = new URLSearchParams({ filter: activeFilter, pageSize: '50' });
      if (searchQuery) params.set('search', searchQuery);
      const res = await api.get<any>(`/conversations?${params}`);
      setConversations(res.data || []);
    } catch (e) { console.error(e); }
  };

  const loadFilterCounts = async () => {
    try { setFilterCounts(await api.get<FilterCounts>('/conversations/counts')); } catch (e) { console.error(e); }
  };

  const loadMessages = async (id: string) => {
    try { setMessages(await api.get<any[]>(`/conversations/${id}/messages`)); } catch (e) { console.error(e); }
  };

  const loadCustomer = async (id: string) => {
    try { setCustomer(await api.get<any>(`/customers/${id}`)); } catch (e) { console.error(e); }
  };

  const loadCustomerBookings = async (customerId: string) => {
    try { setCustomerBookings(await api.get<any[]>(`/customers/${customerId}/bookings`) || []); } catch (e) { console.error(e); }
  };

  const loadStaff = async () => {
    try { setStaffList(await api.get<any[]>('/staff') || []); } catch (e) { console.error(e); }
  };

  const loadTemplates = async () => {
    try { setTemplates(await api.get<any[]>('/templates') || []); } catch (e) { console.error(e); }
  };

  const loadNotes = async (conversationId: string) => {
    try { setNotes(await api.get<any[]>(`/conversations/${conversationId}/notes`) || []); } catch (e) { console.error(e); }
  };

  const sendMessage = async (content?: string) => {
    const text = content || newMessage.trim();
    if (!text || !selected) return;
    setSending(true);
    try {
      await api.post(`/conversations/${selected.id}/messages`, { content: text });
      setNewMessage('');
      setAiDraftText('');
      setAiIntent(undefined);
      setAiConfidence(undefined);
      setShowQuickReplies(false);
      await loadMessages(selected.id);
      await loadConversations();
      await loadFilterCounts();
    } catch (e) {
      toast(t('inbox.failed_to_send'), 'error');
      console.error(e);
    }
    setSending(false);
  };

  const assignConversation = async (staffId: string | null) => {
    if (!selected) return;
    try {
      const updated = await api.patch<any>(`/conversations/${selected.id}/assign`, { staffId });
      setSelected(updated);
      setShowAssignDropdown(false);
      toast(staffId ? t('inbox.assigned_success', { name: updated.assignedTo?.name || '' }) : t('inbox.unassigned_success'));
      await loadConversations();
      await loadFilterCounts();
    } catch (e) { toast(t('inbox.failed_to_assign'), 'error'); console.error(e); }
  };

  const closeConversation = async () => {
    if (!selected) return;
    try {
      await api.patch(`/conversations/${selected.id}/status`, { status: 'RESOLVED' });
      toast(t('inbox.conversation_closed'));
      setSelected(null);
      await loadConversations();
      await loadFilterCounts();
    } catch (e) { toast(t('inbox.failed_to_close'), 'error'); console.error(e); }
  };

  const snoozeConversation = async (hours: number) => {
    if (!selected) return;
    let until: Date;
    if (hours === -1) {
      until = new Date();
      until.setDate(until.getDate() + 1);
      until.setHours(9, 0, 0, 0);
    } else {
      until = new Date(Date.now() + hours * 60 * 60 * 1000);
    }
    try {
      await api.patch(`/conversations/${selected.id}/snooze`, { until: until.toISOString() });
      setShowSnoozeMenu(false);
      toast(t('inbox.conversation_snoozed'));
      setSelected(null);
      await loadConversations();
      await loadFilterCounts();
    } catch (e) { toast(t('inbox.failed_to_snooze'), 'error'); console.error(e); }
  };

  const addNote = async () => {
    if (!newNote.trim() || !selected) return;
    try {
      await api.post(`/conversations/${selected.id}/notes`, { content: newNote });
      setNewNote('');
      toast(t('inbox.note_added'));
      await loadNotes(selected.id);
    } catch (e) { toast(t('inbox.failed_to_add_note'), 'error'); console.error(e); }
  };

  const deleteNote = async (noteId: string) => {
    if (!selected) return;
    try {
      await api.del(`/conversations/${selected.id}/notes/${noteId}`);
      toast(t('inbox.note_deleted'));
      await loadNotes(selected.id);
    } catch (e) { console.error(e); }
  };

  const addConvTag = async (tag: string) => {
    if (!tag || !selected) return;
    const tags = [...new Set([...convTags, tag])];
    try {
      await api.patch(`/conversations/${selected.id}/tags`, { tags });
      setConvTags(tags);
      setNewTag('');
      toast(t('inbox.tag_added', { tag }));
    } catch (e) { console.error(e); }
  };

  const removeConvTag = async (tag: string) => {
    if (!selected) return;
    const tags = convTags.filter((tg) => tg !== tag);
    try {
      await api.patch(`/conversations/${selected.id}/tags`, { tags });
      setConvTags(tags);
    } catch (e) { console.error(e); }
  };

  const resumeAutoReply = async () => {
    if (!selected) return;
    try {
      await api.post(`/ai/conversations/${selected.id}/resume-auto-reply`);
      setTransferredToHuman(false);
      toast(t('ai.auto_reply_resumed'));
    } catch (e) {
      toast(t('ai.auto_reply_resume_failed'), 'error');
      console.error(e);
    }
  };

  const insertTemplate = (template: any) => {
    let text = template.body;
    if (customer) text = text.replace(/\{\{customerName\}\}/g, customer.name || '');
    if (customerBookings.length > 0) {
      const next = customerBookings.find((b: any) => ['PENDING', 'CONFIRMED'].includes(b.status));
      if (next) {
        text = text.replace(/\{\{serviceName\}\}/g, next.service?.name || '');
        text = text.replace(/\{\{staffName\}\}/g, next.staff?.name || '');
        text = text.replace(/\{\{date\}\}/g, new Date(next.startTime).toLocaleDateString());
        text = text.replace(/\{\{time\}\}/g, new Date(next.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    }
    setNewMessage(text);
    setShowTemplates(false);
  };

  return (
    <div className="flex h-full">
      {/* Filter sidebar */}
      <div className="w-48 border-r bg-gray-50 flex flex-col">
        <div className="p-3 border-b"><h2 className="font-semibold text-sm text-gray-700">{t('inbox.title')}</h2></div>
        <div className="flex-1 py-1">
          {FILTER_KEYS.map((key) => {
            const Icon = FILTER_ICONS[key];
            const count = filterCounts[key] || 0;
            return (
              <button
                key={key}
                onClick={() => { setActiveFilter(key); setSelected(null); }}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 text-sm transition-colors',
                  activeFilter === key ? 'bg-blue-50 text-blue-700 font-medium border-r-2 border-blue-600' : 'text-gray-600 hover:bg-gray-100',
                )}
              >
                <div className="flex items-center gap-2"><Icon size={15} /><span>{FILTER_LABELS[key]}</span></div>
                {count > 0 && (
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
                    key === 'overdue' ? 'bg-red-100 text-red-700' :
                    key === 'unassigned' ? 'bg-orange-100 text-orange-700' :
                    key === 'snoozed' ? 'bg-purple-100 text-purple-700' :
                    'bg-gray-200 text-gray-600',
                  )}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversation list */}
      <div className="w-80 border-r bg-white flex flex-col">
        <div className="p-3 border-b space-y-2">
          <h2 className="font-semibold">{t('inbox.title')}</h2>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('inbox.search_placeholder')} className="w-full pl-8 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {conversations.map((c) => (
            <div key={c.id} onClick={() => setSelected(c)} className={cn('p-3 border-b cursor-pointer hover:bg-gray-50 transition-colors', selected?.id === c.id && 'bg-blue-50')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {c.isOverdue && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />}
                  <p className="text-sm font-medium truncate">{c.customer?.name || t('common.unknown')}</p>
                </div>
                <div className="flex items-center gap-1">
                  {c.isNew && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{t('inbox.new_badge')}</span>}
                  {c.status === 'SNOOZED' && <AlarmClock size={12} className="text-purple-500" />}
                </div>
              </div>
              <p className="text-xs text-gray-500 truncate mt-0.5">{c.messages?.[0]?.content || t('dashboard.no_messages')}</p>
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-1.5">
                  <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full',
                    c.status === 'OPEN' ? 'bg-green-100 text-green-700' :
                    c.status === 'WAITING' ? 'bg-yellow-100 text-yellow-700' :
                    c.status === 'SNOOZED' ? 'bg-purple-100 text-purple-700' :
                    c.status === 'RESOLVED' ? 'bg-gray-100 text-gray-500' : 'bg-gray-100 text-gray-600',
                  )}>{t(`status.${c.status.toLowerCase()}`)}</span>
                  {c.assignedTo && <span className="text-[9px] text-gray-400">{c.assignedTo.name}</span>}
                </div>
                {c.lastMessageAt && <span className="text-[9px] text-gray-400">{formatRelativeTime(c.lastMessageAt)}</span>}
              </div>
              {c.tags?.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {c.tags.slice(0, 3).map((tg: string) => (
                    <span key={tg} className="text-[8px] bg-blue-50 text-blue-600 px-1 py-0.5 rounded">{tg}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {conversations.length === 0 && (
            <div className="text-center p-6">
              <InboxIcon size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-400 text-sm">{searchQuery ? t('inbox.no_search_results', { query: searchQuery }) : t('inbox.no_conversations')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Message thread */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {selected ? (
          <>
            <div className="p-3 border-b bg-white flex items-center justify-between">
              <div>
                <p className="font-medium">{selected.customer?.name}</p>
                <p className="text-xs text-gray-500">{selected.customer?.phone}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button onClick={() => setShowSnoozeMenu(!showSnoozeMenu)} className="text-xs text-gray-500 hover:text-purple-600 border px-2 py-1 rounded flex items-center gap-1">
                    <AlarmClock size={12} /> {t('inbox.snooze')}
                  </button>
                  {showSnoozeMenu && (
                    <div className="absolute right-0 mt-1 w-40 bg-white border rounded-md shadow-lg z-20">
                      {SNOOZE_HOURS.map((opt) => (
                        <button key={opt.key} onClick={() => snoozeConversation(opt.hours)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-0">
                          {SNOOZE_LABELS[opt.key]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {transferredToHuman && (
                  <button onClick={resumeAutoReply} className="text-xs text-purple-600 hover:text-purple-700 border border-purple-300 bg-purple-50 px-2 py-1 rounded flex items-center gap-1">
                    <Zap size={12} /> {t('ai.resume_auto_reply')}
                  </button>
                )}
                <button onClick={closeConversation} className="text-xs text-gray-500 hover:text-gray-700 border px-2 py-1 rounded">{t('inbox.close_conversation')}</button>
                <button onClick={() => setShowBookingForm(!showBookingForm)} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700">
                  <Plus size={14} /> {t('inbox.new_booking')}
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {messages.map((m) => (
                <div key={m.id} className={cn('flex', m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[70%] p-3 rounded-lg text-sm', m.direction === 'OUTBOUND' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border rounded-bl-none')}>
                    {m.senderStaff && <p className={cn('text-[10px] mb-1', m.direction === 'OUTBOUND' ? 'text-blue-200' : 'text-gray-400')}>{m.senderStaff.name}</p>}
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    <p className={cn('text-[10px] mt-1', m.direction === 'OUTBOUND' ? 'text-blue-200' : 'text-gray-400')}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* AI Draft Response */}
            <AiSuggestions
              intent={aiIntent}
              confidence={aiConfidence}
              draftText={aiDraftText}
              onSendDraft={(text) => sendMessage(text)}
              onDismiss={() => setAiDraftText('')}
            />

            {/* Quick replies */}
            {showQuickReplies && (
              <div className="px-3 pb-1 bg-white border-t">
                <div className="flex flex-wrap gap-1.5 py-2">
                  {QUICK_REPLIES.map((qr) => (
                    <button key={qr} onClick={() => sendMessage(qr)} className="text-xs bg-gray-100 hover:bg-blue-50 hover:text-blue-700 px-2.5 py-1.5 rounded-full transition-colors">
                      {qr}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Composer */}
            <div className="p-3 border-t bg-white">
              {showTemplates && (
                <div className="mb-2 border rounded-md bg-white shadow-lg max-h-48 overflow-auto">
                  <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">{t('inbox.templates')}</span>
                    <button onClick={() => setShowTemplates(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                  </div>
                  {templates.map((tpl) => (
                    <button key={tpl.id} onClick={() => insertTemplate(tpl)} className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-0">
                      <p className="text-sm font-medium">{tpl.name}</p>
                      <p className="text-xs text-gray-500 truncate">{tpl.body}</p>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-end">
                <div className="flex gap-0.5">
                  <button onClick={() => setShowTemplates(!showTemplates)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" title={t('inbox.templates')}><FileText size={18} /></button>
                  <button onClick={() => setShowQuickReplies(!showQuickReplies)} className={cn('p-2 rounded', showQuickReplies ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100')} title={t('inbox.quick_replies')}><Zap size={18} /></button>
                </div>
                <textarea
                  value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendMessage(); }
                  }}
                  placeholder={t('inbox.type_message')} rows={1}
                  className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[38px] max-h-24"
                  style={{ height: 'auto' }}
                  onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 96) + 'px'; }}
                />
                <button onClick={() => sendMessage()} disabled={sending || !newMessage.trim()} className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex-shrink-0"><Send size={18} /></button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <MessageSquare size={48} className="mb-3 text-gray-300" />
            <p className="font-medium">{t('inbox.select_conversation')}</p>
            <p className="text-sm">{t('inbox.select_conversation_hint')}</p>
          </div>
        )}
      </div>

      {/* Customer sidebar */}
      {selected && customer && (
        <div className="w-72 border-l bg-white overflow-auto">
          <div className="flex border-b">
            <button onClick={() => setSidebarTab('info')} className={cn('flex-1 py-2.5 text-xs font-medium text-center', sidebarTab === 'info' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500')}>{t('inbox.info_tab')}</button>
            <button onClick={() => setSidebarTab('notes')} className={cn('flex-1 py-2.5 text-xs font-medium text-center relative', sidebarTab === 'notes' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500')}>
              {t('inbox.notes_tab')} {notes.length > 0 && <span className="ml-1 text-[9px] bg-yellow-100 text-yellow-700 px-1 py-0.5 rounded-full">{notes.length}</span>}
            </button>
          </div>

          {sidebarTab === 'info' && (
            <>
              <div className="p-4 border-b">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm">
                    {(customer.name || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{customer.name}</p>
                    <p className="text-xs text-gray-500">{customer.phone}</p>
                  </div>
                </div>
                {customer.email && <p className="text-xs text-gray-500 mb-2">{customer.email}</p>}
                {customer.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {customer.tags.map((tg: string) => <span key={tg} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tg}</span>)}
                  </div>
                )}
              </div>

              {/* AI Summary */}
              <AiSummary
                conversationId={selected.id}
                summary={aiSummary}
                onSummaryUpdated={(s) => setAiSummary(s)}
              />

              {/* AI Booking Assistant */}
              {aiBookingState && (
                <AiBookingPanel
                  conversationId={selected.id}
                  mode="book"
                  bookingState={aiBookingState}
                  onConfirmed={() => {
                    setAiBookingState(null);
                    if (customer) loadCustomerBookings(customer.id);
                  }}
                  onDismissed={() => setAiBookingState(null)}
                />
              )}

              {/* AI Cancel Assistant */}
              {aiCancelState && (
                <AiBookingPanel
                  conversationId={selected.id}
                  mode="cancel"
                  cancelState={aiCancelState}
                  onConfirmed={() => {
                    setAiCancelState(null);
                    if (customer) loadCustomerBookings(customer.id);
                  }}
                  onDismissed={() => setAiCancelState(null)}
                />
              )}

              {/* AI Reschedule Assistant */}
              {aiRescheduleState && (
                <AiBookingPanel
                  conversationId={selected.id}
                  mode="reschedule"
                  rescheduleState={aiRescheduleState}
                  onConfirmed={() => {
                    setAiRescheduleState(null);
                    if (customer) loadCustomerBookings(customer.id);
                  }}
                  onDismissed={() => setAiRescheduleState(null)}
                />
              )}

              <div className="p-4 border-b">
                <span className="text-xs font-semibold text-gray-500 uppercase">{t('inbox.conversation_tags')}</span>
                <div className="flex flex-wrap gap-1 mt-2">
                  {convTags.map((tg) => (
                    <span key={tg} className="inline-flex items-center gap-0.5 text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                      {tg} <button onClick={() => removeConvTag(tg)} className="hover:text-red-500"><X size={8} /></button>
                    </span>
                  ))}
                  <input value={newTag} onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addConvTag(newTag); } }}
                    placeholder={t('inbox.add_tag_placeholder')} className="text-[10px] border rounded px-1.5 py-0.5 w-14 focus:w-24 transition-all" />
                </div>
              </div>

              <div className="p-4 border-b">
                <span className="text-xs font-semibold text-gray-500 uppercase">{t('inbox.assigned_to')}</span>
                <div className="relative mt-1">
                  <button onClick={() => setShowAssignDropdown(!showAssignDropdown)} className="w-full flex items-center justify-between border rounded-md px-2.5 py-1.5 text-sm hover:bg-gray-50">
                    <span>{selected.assignedTo?.name || t('common.unassigned')}</span>
                    <ChevronDown size={14} className="text-gray-400" />
                  </button>
                  {showAssignDropdown && (
                    <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg">
                      <button onClick={() => assignConversation(null)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b">{t('inbox.unassign')}</button>
                      {staffList.map((s) => (
                        <button key={s.id} onClick={() => assignConversation(s.id)} className={cn('w-full text-left px-3 py-2 text-sm hover:bg-gray-50', selected.assignedTo?.id === s.id && 'bg-blue-50 text-blue-700')}>{s.name}</button>
                      ))}
                    </div>
                  )}
                </div>
                {!selected.assignedTo && (
                  <button onClick={() => assignConversation(staffList[0]?.id)} className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium">{t('inbox.assign_to_me')}</button>
                )}
              </div>

              {selected.status === 'SNOOZED' && selected.snoozedUntil && (
                <div className="p-4 border-b bg-purple-50">
                  <div className="flex items-center gap-1.5 text-purple-700 text-xs">
                    <AlarmClock size={12} />
                    <span>{t('inbox.snoozed_until', { datetime: new Date(selected.snoozedUntil).toLocaleString() })}</span>
                  </div>
                </div>
              )}

              <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase">{t('inbox.bookings_section')}</span>
                  <button onClick={() => setShowBookingForm(true)} className="text-xs text-blue-600 hover:text-blue-700">{t('inbox.bookings_new')}</button>
                </div>
                {customerBookings.filter((b: any) => ['PENDING', 'CONFIRMED'].includes(b.status)).slice(0, 3).map((b: any) => (
                  <div key={b.id} className="border rounded p-2 mb-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{b.service?.name}</p>
                      <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full', b.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700')}>{t(`status.${b.status.toLowerCase()}`)}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{new Date(b.startTime).toLocaleDateString()} at {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                ))}
                {customerBookings.filter((b: any) => ['PENDING', 'CONFIRMED'].includes(b.status)).length === 0 && (
                  <p className="text-xs text-gray-400">{t('inbox.no_upcoming_bookings')}</p>
                )}
              </div>
            </>
          )}

          {sidebarTab === 'notes' && (
            <div className="p-4">
              <div className="mb-4">
                <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder={t('inbox.add_note_placeholder')} rows={3} className="w-full border rounded-md px-3 py-2 text-sm resize-none" />
                <button onClick={addNote} disabled={!newNote.trim()} className="mt-1 bg-yellow-500 text-white px-3 py-1.5 rounded-md text-xs hover:bg-yellow-600 disabled:opacity-50 w-full">
                  <StickyNote size={12} className="inline mr-1" /> {t('inbox.add_note')}
                </button>
              </div>

              <div className="space-y-3">
                {notes.map((n) => (
                  <div key={n.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[10px] text-gray-400">
                        {n.staff?.name} · {new Date(n.createdAt).toLocaleString()}
                      </p>
                      <button onClick={() => deleteNote(n.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
                {notes.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">{t('inbox.no_notes')}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <BookingFormModal
        isOpen={showBookingForm}
        onClose={() => setShowBookingForm(false)}
        onCreated={() => { setShowBookingForm(false); if (customer) loadCustomerBookings(customer.id); }}
        customerId={customer?.id}
        customerName={customer?.name}
        conversationId={selected?.id}
      />
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString();
}
