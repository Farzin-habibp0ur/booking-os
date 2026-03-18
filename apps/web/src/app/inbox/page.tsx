'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useSocket, getGlobalSocket } from '@/lib/use-socket';
import { useToast } from '@/lib/toast';
import { useI18n } from '@/lib/i18n';
import {
  Send,
  Plus,
  User,
  Phone,
  Tag,
  Search,
  MessageSquare,
  Clock,
  AlertCircle,
  UserCheck,
  Archive,
  Inbox as InboxIcon,
  ChevronDown,
  ChevronLeft,
  FileText,
  X,
  AlarmClock,
  StickyNote,
  Zap,
  Trash2,
  Info,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import BookingFormModal from '@/components/booking-form-modal';
import AiSuggestions from '@/components/ai-suggestions';
import AiBookingPanel from '@/components/ai-booking-panel';
import AiSummary from '@/components/ai-summary';
import IntakeCard from '@/components/intake-card';
import { usePack } from '@/lib/vertical-pack';
import { ViewPicker } from '@/components/saved-views';
import { ActionCardBadge } from '@/components/action-card';
import { OutboundCompose } from '@/components/outbound';
import { MediaComposer } from '@/components/inbox/media-composer';
import { MediaMessage } from '@/components/inbox/media-message';
import { DeliveryStatus } from '@/components/inbox/delivery-status';
import { ChannelFilterBar, type ChannelFilter } from '@/components/inbox/channel-filter';
import { InstagramChannelBadge, InstagramContext } from '@/components/inbox/instagram-context';
import { FeatureDiscovery } from '@/components/feature-discovery';
import ScheduledMessage from '@/components/scheduled-message';
import { captureEvent } from '@/lib/posthog';

type Filter = 'all' | 'unassigned' | 'mine' | 'overdue' | 'waiting' | 'snoozed' | 'closed';

interface FilterCounts {
  all: number;
  unassigned: number;
  mine: number;
  overdue: number;
  waiting: number;
  snoozed: number;
  closed: number;
}

const FILTER_ICONS: Record<Filter, any> = {
  all: InboxIcon,
  unassigned: UserCheck,
  mine: User,
  overdue: AlertCircle,
  waiting: Clock,
  snoozed: AlarmClock,
  closed: Archive,
};

const SNOOZE_HOURS = [
  { key: '1h', hours: 1 },
  { key: '3h', hours: 3 },
  { key: 'tomorrow', hours: -1 },
  { key: '1d', hours: 24 },
  { key: '3d', hours: 72 },
];

export default function InboxPageWrapper() {
  return (
    <Suspense fallback={null}>
      <InboxPage />
    </Suspense>
  );
}

function InboxPage() {
  const { t } = useI18n();
  const pack = usePack();
  const searchParams = useSearchParams();
  const router = useRouter();
  const conversationIdParam = searchParams.get('conversationId');
  const [conversations, setConversations] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [customer, setCustomer] = useState<any>(null);
  const [customerBookings, setCustomerBookings] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const [filterCounts, setFilterCounts] = useState<FilterCounts>({
    all: 0,
    unassigned: 0,
    mine: 0,
    overdue: 0,
    waiting: 0,
    snoozed: 0,
    closed: 0,
  });
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
  const [mobileView, setMobileView] = useState<'list' | 'thread' | 'info'>('list');
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [actionCardCount, setActionCardCount] = useState(0);
  const [showOutboundCompose, setShowOutboundCompose] = useState(false);
  const [viewers, setViewers] = useState<Array<{ staffId: string; staffName: string }>>([]);
  const [selectedConvoIds, setSelectedConvoIds] = useState<Set<string>>(new Set());
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null);
  const [scheduledMessages, setScheduledMessages] = useState<any[]>([]);
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [showBulkTagInput, setShowBulkTagInput] = useState(false);
  const [infoSidebarOpen, setInfoSidebarOpen] = useState(true);
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('ALL');
  const [swipingConvoId, setSwipingConvoId] = useState<string | null>(null);
  const [swipeDelta, setSwipeDelta] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentFilters = {
    predefined: activeFilter,
    search: searchQuery,
    locationId: selectedLocationId,
  };

  const handleApplyView = (filters: Record<string, unknown>, viewId: string) => {
    setActiveFilter((filters.predefined as Filter) || 'all');
    setSearchQuery((filters.search as string) || '');
    setSelectedLocationId((filters.locationId as string) || '');
    setActiveViewId(viewId);
    setSelected(null);
  };

  const handleClearView = () => {
    setActiveFilter('all');
    setSearchQuery('');
    setSelectedLocationId('');
    setActiveViewId(null);
    setSelected(null);
  };
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const msgPollRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const selectedRef = useRef<any>(null);
  const { toast } = useToast();

  const FILTER_KEYS: Filter[] = [
    'all',
    'unassigned',
    'mine',
    'overdue',
    'waiting',
    'snoozed',
    'closed',
  ];

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
    tomorrow: t('inbox.snooze_tomorrow'),
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
        setAiDraftText('');
        setAiIntent(undefined);
        setAiConfidence(undefined);
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
    'message:status': useCallback((data: any) => {
      if (selectedRef.current && data.conversationId === selectedRef.current.id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.messageId
              ? {
                  ...m,
                  deliveryStatus: data.deliveryStatus,
                  deliveredAt: data.deliveredAt || m.deliveredAt,
                  readAt: data.readAt || m.readAt,
                }
              : m,
          ),
        );
      }
    }, []),
    'presence:update': useCallback((data: any) => {
      if (selectedRef.current && data.conversationId === selectedRef.current.id) {
        setViewers(data.viewers || []);
      }
    }, []),
  });

  // Auto-select conversation from URL param
  useEffect(() => {
    if (conversationIdParam && conversations.length > 0 && !selected) {
      const conv = conversations.find((c) => c.id === conversationIdParam);
      if (conv) {
        setSelected(conv);
        setMobileView('thread');
      }
    }
  }, [conversationIdParam, conversations]);

  useEffect(() => {
    captureEvent('inbox_opened');
    loadFilterCounts();
    loadStaff();
    loadTemplates();
    loadLocations();
    loadActionCardCount();
  }, []);

  useEffect(() => {
    loadConversations();
    pollRef.current = setInterval(() => {
      loadConversations();
      loadFilterCounts();
    }, 15000);
    return () => clearInterval(pollRef.current);
  }, [activeFilter, searchQuery, selectedLocationId]);

  useEffect(() => {
    if (selected) {
      loadMessages(selected.id);
      loadCustomer(selected.customerId);
      loadCustomerBookings(selected.customerId);
      loadNotes(selected.id);
      loadScheduledMessages(selected.id);
      setConvTags(selected.tags || []);
      setSidebarTab('info');
      setViewers([]);
      // Emit viewing start
      const socket = getGlobalSocket();
      socket?.emit('viewing:start', { conversationId: selected.id });
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
    return () => {
      clearInterval(msgPollRef.current);
      // Emit viewing stop for previous conversation
      if (selected) {
        const socket = getGlobalSocket();
        socket?.emit('viewing:stop', { conversationId: selected.id });
      }
    };
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
          // Don't restore if an outbound message exists after this inbound
          // (means draft was already sent manually or auto-replied)
          const lastInboundIdx = messages.indexOf(lastInbound);
          const outboundAfter = messages
            .slice(lastInboundIdx + 1)
            .filter((m: any) => m.direction === 'OUTBOUND');
          const hasOutboundAfter = outboundAfter.length > 0;
          // Also check if any outbound message content matches the draft (auto-reply case)
          const draftAlreadySent = outboundAfter.some((m: any) => m.content === aiMeta.draftText);
          if (!hasOutboundAfter && !draftAlreadySent) {
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
      if (selectedLocationId) params.set('locationId', selectedLocationId);
      const res = await api.get<any>(`/conversations?${params}`);
      setConversations(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadFilterCounts = async () => {
    try {
      setFilterCounts(await api.get<FilterCounts>('/conversations/counts'));
    } catch (e) {
      console.error(e);
    }
  };

  const loadMessages = async (id: string) => {
    try {
      setMessages(await api.get<any[]>(`/conversations/${id}/messages`));
    } catch (e) {
      console.error(e);
    }
  };

  const loadCustomer = async (id: string) => {
    try {
      setCustomer(await api.get<any>(`/customers/${id}`));
    } catch (e) {
      console.error(e);
    }
  };

  const loadCustomerBookings = async (customerId: string) => {
    try {
      setCustomerBookings((await api.get<any[]>(`/customers/${customerId}/bookings`)) || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadStaff = async () => {
    try {
      setStaffList((await api.get<any[]>('/staff')) || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadTemplates = async () => {
    try {
      setTemplates((await api.get<any[]>('/templates')) || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadLocations = async () => {
    try {
      setLocations((await api.get<any[]>('/locations')) || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadActionCardCount = async () => {
    try {
      const res = await api.get<{ count: number }>('/action-cards/count');
      setActionCardCount(res.count || 0);
    } catch {
      // Action cards module may not be available
    }
  };

  const sendOutboundDraft = async (data: { customerId: string; content: string }) => {
    try {
      await api.post('/outbound/draft', data);
      toast(t('inbox.outbound_draft_created') || 'Draft created');
      setShowOutboundCompose(false);
    } catch (e: any) {
      toast(e?.message || 'Failed to create draft', 'error');
    }
  };

  const loadNotes = async (conversationId: string) => {
    try {
      setNotes((await api.get<any[]>(`/conversations/${conversationId}/notes`)) || []);
    } catch (e) {
      console.error(e);
    }
  };

  const sendMessage = async (content?: string) => {
    const text = content || newMessage.trim();
    if (!text || !selected) return;
    setSending(true);
    try {
      const payload: any = { content: text };
      if (scheduledFor) {
        payload.scheduledFor = scheduledFor.toISOString();
      }
      await api.post(`/conversations/${selected.id}/messages`, payload);
      captureEvent('message_sent', {
        channel: selected.channel || 'WHATSAPP',
        scheduled: !!scheduledFor,
      });
      setNewMessage('');
      setAiDraftText('');
      setAiIntent(undefined);
      setAiConfidence(undefined);
      setShowQuickReplies(false);
      if (scheduledFor) {
        setScheduledFor(null);
        toast('Message scheduled successfully');
        await loadScheduledMessages(selected.id);
      }
      await loadMessages(selected.id);
      await loadConversations();
      await loadFilterCounts();
    } catch (e) {
      toast(t('inbox.failed_to_send'), 'error');
      console.error(e);
    }
    setSending(false);
  };

  const loadScheduledMessages = async (conversationId: string) => {
    try {
      const msgs = await api.get<any[]>(`/conversations/${conversationId}/messages/scheduled`);
      setScheduledMessages(msgs || []);
    } catch {
      setScheduledMessages([]);
    }
  };

  const cancelScheduledMessage = async (messageId: string) => {
    if (!selected) return;
    try {
      await api.del(`/conversations/${selected.id}/messages/scheduled/${messageId}`);
      toast('Scheduled message cancelled');
      await loadScheduledMessages(selected.id);
    } catch {
      toast('Failed to cancel message', 'error');
    }
  };

  const assignConversation = async (staffId: string | null) => {
    if (!selected) return;
    try {
      const updated = await api.patch<any>(`/conversations/${selected.id}/assign`, { staffId });
      setSelected(updated);
      setShowAssignDropdown(false);
      toast(
        staffId
          ? t('inbox.assigned_success', { name: updated.assignedTo?.name || '' })
          : t('inbox.unassigned_success'),
      );
      await loadConversations();
      await loadFilterCounts();
    } catch (e) {
      toast(t('inbox.failed_to_assign'), 'error');
      console.error(e);
    }
  };

  const closeConversation = async () => {
    if (!selected) return;
    try {
      await api.patch(`/conversations/${selected.id}/status`, { status: 'RESOLVED' });
      toast(t('inbox.conversation_closed'));
      setSelected(null);
      await loadConversations();
      await loadFilterCounts();
    } catch (e) {
      toast(t('inbox.failed_to_close'), 'error');
      console.error(e);
    }
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
    } catch (e) {
      toast(t('inbox.failed_to_snooze'), 'error');
      console.error(e);
    }
  };

  const resolveConversation = async (conversationId: string) => {
    try {
      await api.patch(`/conversations/${conversationId}/status`, { status: 'RESOLVED' });
      toast(t('inbox.conversation_closed'));
      if (selected?.id === conversationId) setSelected(null);
      await loadConversations();
      await loadFilterCounts();
    } catch (e) {
      toast(t('inbox.failed_to_close'), 'error');
    }
  };

  const snoozeConversationById = async (conversationId: string) => {
    const until = new Date(Date.now() + 3 * 60 * 60 * 1000); // default 3h snooze
    try {
      await api.patch(`/conversations/${conversationId}/snooze`, { until: until.toISOString() });
      toast(t('inbox.conversation_snoozed'));
      if (selected?.id === conversationId) setSelected(null);
      await loadConversations();
      await loadFilterCounts();
    } catch (e) {
      toast(t('inbox.failed_to_snooze'), 'error');
    }
  };

  const addNote = async () => {
    if (!newNote.trim() || !selected) return;
    try {
      await api.post(`/conversations/${selected.id}/notes`, { content: newNote });
      setNewNote('');
      toast(t('inbox.note_added'));
      await loadNotes(selected.id);
    } catch (e) {
      toast(t('inbox.failed_to_add_note'), 'error');
      console.error(e);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!selected) return;
    try {
      await api.del(`/conversations/${selected.id}/notes/${noteId}`);
      toast(t('inbox.note_deleted'));
      await loadNotes(selected.id);
    } catch (e) {
      console.error(e);
    }
  };

  const addConvTag = async (tag: string) => {
    if (!tag || !selected) return;
    const tags = [...new Set([...convTags, tag])];
    try {
      await api.patch(`/conversations/${selected.id}/tags`, { tags });
      setConvTags(tags);
      setNewTag('');
      toast(t('inbox.tag_added', { tag }));
    } catch (e) {
      console.error(e);
    }
  };

  const removeConvTag = async (tag: string) => {
    if (!selected) return;
    const tags = convTags.filter((tg) => tg !== tag);
    try {
      await api.patch(`/conversations/${selected.id}/tags`, { tags });
      setConvTags(tags);
    } catch (e) {
      console.error(e);
    }
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
        text = text.replace(
          /\{\{time\}\}/g,
          new Date(next.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        );
      }
    }
    setNewMessage(text);
    setShowTemplates(false);
  };

  const toggleSelectConvo = (id: string) => {
    setSelectedConvoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllConvos = () => {
    if (selectedConvoIds.size === conversations.length) {
      setSelectedConvoIds(new Set());
    } else {
      setSelectedConvoIds(new Set(conversations.map((c: any) => c.id)));
    }
  };

  const handleBulkCloseConvos = async () => {
    try {
      const ids = Array.from(selectedConvoIds);
      await api.post('/conversations/bulk-close', { ids });
      setSelectedConvoIds(new Set());
      toast(t('inbox.bulk_closed_success'));
      await loadConversations();
      await loadFilterCounts();
    } catch (e) {
      toast(t('inbox.bulk_action_failed'));
      console.error(e);
    }
  };

  const handleBulkAssignConvos = async (staffId: string) => {
    try {
      const ids = Array.from(selectedConvoIds);
      await api.post('/conversations/bulk-assign', { ids, staffId });
      setSelectedConvoIds(new Set());
      toast(t('inbox.bulk_assigned_success'));
      await loadConversations();
      await loadFilterCounts();
    } catch (e) {
      toast(t('inbox.bulk_action_failed'));
      console.error(e);
    }
  };

  const handleBulkMarkRead = async () => {
    try {
      const ids = Array.from(selectedConvoIds);
      await api.post('/conversations/bulk-read', { ids });
      setSelectedConvoIds(new Set());
      toast(t('inbox.bulk_marked_read'));
      await loadConversations();
      await loadFilterCounts();
    } catch (e) {
      toast(t('inbox.bulk_action_failed'));
      console.error(e);
    }
  };

  const handleBulkTagConvos = async (tag: string) => {
    if (!tag.trim()) return;
    try {
      const ids = Array.from(selectedConvoIds);
      await api.post('/conversations/bulk-tag', { ids, tag: tag.trim() });
      setSelectedConvoIds(new Set());
      setBulkTagInput('');
      setShowBulkTagInput(false);
      toast('Tag applied to selected conversations');
      await loadConversations();
    } catch (e) {
      toast(t('inbox.bulk_action_failed'));
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0" data-tour-target="inbox-panel">
      <div className="px-3 pt-2">
        <FeatureDiscovery
          id="inbox-ai-replies"
          title="AI-powered inbox"
          description="AI can auto-detect customer intent and suggest replies. Enable AI auto-replies in Settings to handle routine inquiries automatically."
        />
      </div>
      {/* Horizontal filter chip bar — replaces sidebar */}
      <div className="flex gap-2 px-4 py-3 border-b border-slate-100 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          {FILTER_KEYS.map((key) => {
            const count = filterCounts[key] || 0;
            return (
              <button
                key={key}
                onClick={() => {
                  setActiveFilter(key);
                  setSelected(null);
                  setMobileView('list');
                }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors',
                  activeFilter === key
                    ? 'bg-sage-100 text-sage-800 font-medium dark:bg-sage-900/30 dark:text-sage-400'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700',
                )}
              >
                {FILTER_LABELS[key]}
                {(key === 'unassigned' || key === 'overdue') && count > 0 && (
                  <span className="text-[10px] bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 px-1.5 py-0.5 rounded-full min-w-[18px] text-center font-semibold">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main 3-panel layout */}
      <div className="flex flex-1 gap-0 min-h-0">
        {/* Conversation list */}
        <div
          className={cn(
            'border-r bg-white flex flex-col',
            'w-full md:w-80',
            mobileView !== 'list' && 'hidden md:flex',
          )}
        >
          <div className="p-3 border-b space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{t('inbox.title')}</h2>
              <input
                type="checkbox"
                checked={conversations.length > 0 && selectedConvoIds.size === conversations.length}
                onChange={toggleSelectAllConvos}
                className="rounded text-sage-600"
                aria-label="Select all conversations"
              />
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('inbox.search_placeholder')}
                aria-label="Search conversations"
                data-search-input
                className="w-full pl-8 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="px-3 pt-2">
            <ViewPicker
              page="inbox"
              currentFilters={currentFilters}
              activeViewId={activeViewId}
              onApplyView={handleApplyView}
              onClearView={handleClearView}
            />
          </div>
          <ChannelFilterBar selected={channelFilter} onChange={setChannelFilter} />
          <div className="flex-1 overflow-auto">
            {conversations
              .filter((c) => channelFilter === 'ALL' || c.channel === channelFilter)
              .map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    'relative overflow-hidden border-b',
                    selected?.id === c.id && 'bg-sage-50',
                    selectedConvoIds.has(c.id) && 'bg-sage-100',
                  )}
                >
                  {/* Swipe reveal backgrounds - mobile only */}
                  {swipingConvoId === c.id && swipeDelta !== 0 && (
                    <div
                      className={cn(
                        'absolute inset-0 flex items-center md:hidden',
                        swipeDelta > 0
                          ? 'bg-emerald-500 justify-start pl-6'
                          : 'bg-amber-500 justify-end pr-6',
                      )}
                    >
                      {swipeDelta > 0 ? (
                        <Archive size={20} className="text-white" />
                      ) : (
                        <AlarmClock size={20} className="text-white" />
                      )}
                    </div>
                  )}
                  <div
                    className={cn(
                      'p-3 bg-white hover:bg-slate-50 transition-colors relative z-10',
                      selected?.id === c.id && 'bg-sage-50',
                    )}
                    style={{
                      transform:
                        swipingConvoId === c.id ? `translateX(${swipeDelta}px)` : undefined,
                      transition: swipingConvoId === c.id ? 'none' : 'transform 0.2s ease-out',
                    }}
                    onTouchStart={(e) => {
                      const touch = e.touches[0];
                      (e.currentTarget as any)._touchStartX = touch.clientX;
                      (e.currentTarget as any)._touchStartY = touch.clientY;
                      (e.currentTarget as any)._isVertical = false;
                      setSwipingConvoId(c.id);
                    }}
                    onTouchMove={(e) => {
                      const touch = e.touches[0];
                      const target = e.currentTarget as any;
                      const dx = touch.clientX - (target._touchStartX || 0);
                      const dy = touch.clientY - (target._touchStartY || 0);
                      if (target._isVertical) return;
                      if (Math.abs(dy) > Math.abs(dx)) {
                        target._isVertical = true;
                        setSwipeDelta(0);
                        return;
                      }
                      setSwipeDelta(dx);
                    }}
                    onTouchEnd={() => {
                      if (Math.abs(swipeDelta) > 80) {
                        if (swipeDelta > 0) resolveConversation(c.id);
                        else snoozeConversationById(c.id);
                      }
                      setSwipeDelta(0);
                      setSwipingConvoId(null);
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selectedConvoIds.has(c.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelectConvo(c.id);
                        }}
                        className="rounded text-sage-600 mt-1 flex-shrink-0"
                      />
                      <div
                        onClick={() => {
                          captureEvent('conversation_selected');
                          setSelected(c);
                          setMobileView('thread');
                        }}
                        className="flex-1 cursor-pointer min-w-0"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {c.isOverdue && (
                              <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                            )}
                            <p className="text-sm font-medium truncate">
                              {c.customer?.name || t('common.unknown')}
                            </p>
                            {c.channel === 'INSTAGRAM' && <InstagramChannelBadge />}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {c.isNew && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sage-100 text-sage-700 font-medium">
                                {t('inbox.new_badge')}
                              </span>
                            )}
                            {c.status === 'SNOOZED' && (
                              <AlarmClock size={12} className="text-lavender-500" />
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {c.messages?.[0]?.content || t('dashboard.no_messages')}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={cn(
                                'text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0',
                                c.status === 'OPEN'
                                  ? 'bg-sage-50 text-sage-700'
                                  : c.status === 'WAITING'
                                    ? 'bg-amber-50 text-amber-700'
                                    : c.status === 'SNOOZED'
                                      ? 'bg-lavender-100 text-lavender-700'
                                      : c.status === 'RESOLVED'
                                        ? 'bg-slate-100 text-slate-500'
                                        : 'bg-slate-100 text-slate-600',
                              )}
                            >
                              {t(`status.${c.status.toLowerCase()}`)}
                            </span>
                            {c.assignedTo && (
                              <span className="text-[9px] text-slate-400 truncate">
                                {c.assignedTo.name}
                              </span>
                            )}
                            {c.location && (
                              <span className="text-[9px] text-slate-400 flex items-center gap-0.5 flex-shrink-0">
                                <MapPin size={8} /> {c.location.name}
                              </span>
                            )}
                          </div>
                          {c.lastMessageAt && (
                            <span className="text-[9px] text-slate-400 flex-shrink-0">
                              {formatRelativeTime(c.lastMessageAt)}
                            </span>
                          )}
                        </div>
                        {c.tags?.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {c.tags.slice(0, 3).map((tg: string) => (
                              <span
                                key={tg}
                                className="text-[8px] bg-sage-50 text-sage-600 px-1 py-0.5 rounded"
                              >
                                {tg}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            {conversations.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <InboxIcon size={40} className="text-slate-300 mb-3" />
                <h3 className="text-sm font-medium text-slate-600 mb-1">
                  {searchQuery
                    ? t('inbox.no_search_results', { query: searchQuery })
                    : t('inbox.no_conversations')}
                </h3>
                <p className="text-xs text-slate-400 max-w-[200px]">
                  {searchQuery
                    ? 'Try a different search term.'
                    : 'Connect WhatsApp to start receiving client messages.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Message thread */}
        <div
          className={cn(
            'flex-1 flex flex-col bg-slate-50',
            mobileView !== 'thread' && 'hidden md:flex',
          )}
          style={{ minWidth: 0 }}
        >
          {selected ? (
            <>
              <div className="p-3 border-b bg-white flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <button
                    onClick={() => {
                      setSelected(null);
                      setMobileView('list');
                    }}
                    className="md:hidden text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
                    aria-label="Back to conversations"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{selected.customer?.name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-slate-500 truncate">{selected.customer?.phone}</p>
                      {selected.location && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-0.5 flex-shrink-0">
                          <MapPin size={10} /> {selected.location.name}
                        </span>
                      )}
                    </div>
                  </div>
                  {viewers.length > 0 && (
                    <div
                      className="flex items-center gap-1 ml-2 flex-shrink-0"
                      data-testid="presence-pills"
                    >
                      {viewers.map((v) => (
                        <span
                          key={v.staffId}
                          className="text-[10px] bg-lavender-50 text-lavender-700 px-2 py-0.5 rounded-full border border-lavender-200"
                        >
                          {v.staffName} is viewing
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <button
                    onClick={() => setInfoSidebarOpen(!infoSidebarOpen)}
                    className={cn(
                      'hidden md:block border px-2 py-1 rounded transition-colors',
                      infoSidebarOpen
                        ? 'text-sage-600 bg-sage-50 border-sage-200 hover:bg-sage-100'
                        : 'text-slate-400 hover:text-slate-600',
                    )}
                    aria-label="Toggle info sidebar"
                    title="Toggle customer info"
                  >
                    <Info size={14} />
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
                      aria-expanded={showSnoozeMenu}
                      className="text-xs text-slate-500 hover:text-lavender-600 border px-2 py-1 rounded flex items-center gap-1"
                    >
                      <AlarmClock size={12} /> {t('inbox.snooze')}
                    </button>
                    {showSnoozeMenu && (
                      <div className="absolute right-0 mt-1 w-40 bg-white border rounded-md shadow-lg z-20">
                        {SNOOZE_HOURS.map((opt) => (
                          <button
                            key={opt.key}
                            onClick={() => snoozeConversation(opt.hours)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b last:border-0"
                          >
                            {SNOOZE_LABELS[opt.key]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {transferredToHuman && (
                    <button
                      onClick={resumeAutoReply}
                      className="text-xs text-lavender-600 hover:text-lavender-700 border border-lavender-300 bg-lavender-50 px-2 py-1 rounded flex items-center gap-1"
                    >
                      <Zap size={12} /> {t('ai.resume_auto_reply')}
                    </button>
                  )}
                  <button
                    onClick={closeConversation}
                    className="text-xs text-slate-500 hover:text-slate-700 border px-2 py-1 rounded"
                  >
                    {t('inbox.close_conversation')}
                  </button>
                  {customer && (
                    <button
                      onClick={() => setShowOutboundCompose(true)}
                      className="text-xs text-slate-500 hover:text-sage-600 border px-2 py-1 rounded flex items-center gap-1"
                      data-testid="inbox-new-outbound"
                    >
                      <Send size={12} /> {t('inbox.new_outbound') || 'New Message'}
                    </button>
                  )}
                  <button
                    onClick={() => setShowBookingForm(!showBookingForm)}
                    className="flex items-center gap-1 bg-sage-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-sage-700"
                  >
                    <Plus size={14} />{' '}
                    <span className="hidden sm:inline">{t('inbox.new_booking')}</span>
                  </button>
                  {customer && (
                    <button
                      onClick={() => setMobileView(mobileView === 'info' ? 'thread' : 'info')}
                      className="md:hidden text-slate-500 hover:text-slate-700 border px-2 py-1 rounded"
                      aria-label="Toggle customer info"
                    >
                      <Info size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-auto p-4 space-y-3" aria-live="polite">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      'flex',
                      m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start',
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[70%] p-3 rounded-lg text-sm',
                        m.direction === 'OUTBOUND'
                          ? 'bg-sage-600 text-white rounded-br-none'
                          : 'bg-white shadow-soft-sm rounded-xl rounded-bl-none',
                      )}
                    >
                      {m.senderStaff && (
                        <p
                          className={cn(
                            'text-[10px] mb-1',
                            m.direction === 'OUTBOUND' ? 'text-sage-200' : 'text-slate-400',
                          )}
                        >
                          {m.senderStaff.name}
                        </p>
                      )}
                      {m.direction === 'INBOUND' &&
                        m.metadata &&
                        selected?.channel === 'INSTAGRAM' && (
                          <InstagramContext metadata={m.metadata} className="mb-1.5" />
                        )}
                      {m.attachments?.length > 0 && (
                        <MediaMessage attachments={m.attachments} direction={m.direction} />
                      )}
                      {m.contentType === 'TEXT' && (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      )}
                      {m.contentType !== 'TEXT' && !m.attachments?.length && (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      )}
                      <div
                        className={cn(
                          'flex items-center gap-1 mt-1',
                          m.direction === 'OUTBOUND'
                            ? 'text-sage-200 justify-end'
                            : 'text-slate-400',
                        )}
                      >
                        <span className="text-[10px]">
                          {new Date(m.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {m.direction === 'OUTBOUND' && m.deliveryStatus && (
                          <DeliveryStatus status={m.deliveryStatus} />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick replies */}
              {showQuickReplies && (
                <div className="px-3 pb-1 bg-white border-t">
                  <div className="flex flex-wrap gap-1.5 py-2">
                    {QUICK_REPLIES.map((qr) => (
                      <button
                        key={qr}
                        onClick={() => sendMessage(qr)}
                        className="text-xs bg-slate-100 hover:bg-sage-50 hover:text-sage-700 px-2.5 py-1.5 rounded-full transition-colors"
                      >
                        {qr}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Suggestions Ghost Bubble — above composer */}
              {aiDraftText && (
                <AiSuggestions
                  intent={aiIntent}
                  confidence={aiConfidence}
                  draftText={aiDraftText}
                  onSendDraft={(text) => sendMessage(text)}
                  onDismiss={() => setAiDraftText('')}
                />
              )}

              {/* Instagram messaging window indicator */}
              {selected?.channel === 'INSTAGRAM' &&
                (() => {
                  const lastInbound = messages?.filter((m: any) => m.direction === 'INBOUND').pop();
                  if (!lastInbound) return null;
                  const elapsed = Date.now() - new Date(lastInbound.createdAt).getTime();
                  const hoursLeft = Math.max(0, 24 - elapsed / (1000 * 60 * 60));
                  const windowOpen = hoursLeft > 0;
                  return (
                    <div
                      className={cn(
                        'mx-3 mt-1 flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg',
                        windowOpen
                          ? hoursLeft < 2
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-sage-50 text-sage-600'
                          : 'bg-red-50 text-red-600',
                      )}
                    >
                      <Clock size={12} />
                      {windowOpen
                        ? `${Math.floor(hoursLeft)}h ${Math.floor((hoursLeft % 1) * 60)}m remaining in messaging window`
                        : 'Window expired — replies will use HUMAN_AGENT tag (7-day extension)'}
                    </div>
                  );
                })()}

              {/* Composer */}
              <div className="p-3 border-t bg-white">
                {showTemplates && (
                  <div className="mb-2 border rounded-md bg-white shadow-lg max-h-48 overflow-auto">
                    <div className="px-3 py-2 border-b bg-slate-50 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600">
                        {t('inbox.templates')}
                      </span>
                      <button
                        onClick={() => setShowTemplates(false)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {templates.map((tpl) => (
                      <button
                        key={tpl.id}
                        onClick={() => insertTemplate(tpl)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b last:border-0"
                      >
                        <p className="text-sm font-medium">{tpl.name}</p>
                        <p className="text-xs text-slate-500 truncate">{tpl.body}</p>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 items-end">
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => setShowTemplates(!showTemplates)}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                      title={t('inbox.templates')}
                    >
                      <FileText size={18} />
                    </button>
                    <MediaComposer
                      conversationId={selected.id}
                      onUploadComplete={() => loadMessages(selected.id)}
                      channel={selected.channel}
                    />
                    <button
                      onClick={() => setShowQuickReplies(!showQuickReplies)}
                      className={cn(
                        'p-2 rounded',
                        showQuickReplies
                          ? 'text-sage-600 bg-sage-50'
                          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100',
                      )}
                      title={t('inbox.quick_replies')}
                    >
                      <Zap size={18} />
                    </button>
                  </div>
                  <div className="flex-1 relative">
                    <textarea
                      value={newMessage}
                      onChange={(e) => {
                        const val =
                          selected?.channel === 'INSTAGRAM'
                            ? e.target.value.slice(0, 1000)
                            : e.target.value;
                        setNewMessage(val);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder={t('inbox.type_message')}
                      rows={1}
                      maxLength={selected?.channel === 'INSTAGRAM' ? 1000 : undefined}
                      className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 resize-none min-h-[38px] max-h-24"
                      style={{ height: 'auto' }}
                      onInput={(e) => {
                        const el = e.currentTarget;
                        el.style.height = 'auto';
                        el.style.height = Math.min(el.scrollHeight, 96) + 'px';
                      }}
                    />
                    {selected?.channel === 'INSTAGRAM' && newMessage.length > 0 && (
                      <span
                        className={cn(
                          'absolute right-2 bottom-1 text-[10px]',
                          newMessage.length > 900 ? 'text-amber-500' : 'text-slate-400',
                        )}
                      >
                        {newMessage.length}/1000
                      </span>
                    )}
                  </div>
                  <ScheduledMessage
                    onSchedule={(date) => setScheduledFor(date)}
                    onClear={() => setScheduledFor(null)}
                    scheduledAt={scheduledFor}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={sending || !newMessage.trim()}
                    className="bg-sage-600 text-white p-2 rounded-md hover:bg-sage-700 disabled:opacity-50 flex-shrink-0"
                  >
                    {scheduledFor ? <Clock size={18} /> : <Send size={18} />}
                  </button>
                </div>
                {/* Scheduled messages indicator */}
                {scheduledMessages.length > 0 && (
                  <div
                    className="bg-amber-50 border border-amber-100 rounded-lg p-2 space-y-1"
                    data-testid="scheduled-messages-list"
                  >
                    <p className="text-xs font-medium text-amber-700 flex items-center gap-1">
                      <Clock size={12} />
                      {scheduledMessages.length} scheduled message
                      {scheduledMessages.length !== 1 ? 's' : ''}
                    </p>
                    {scheduledMessages.map((msg: any) => (
                      <div
                        key={msg.id}
                        className="flex items-center justify-between text-xs text-amber-600"
                      >
                        <span className="truncate flex-1 mr-2">{msg.content}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span>
                            {new Date(msg.scheduledFor).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </span>
                          <button
                            onClick={() => cancelScheduledMessage(msg.id)}
                            className="text-amber-500 hover:text-red-600"
                            aria-label="Cancel scheduled message"
                            data-testid={`cancel-scheduled-${msg.id}`}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <MessageSquare size={48} className="mb-3 text-slate-300" />
              <p className="font-medium">{t('inbox.select_conversation')}</p>
              <p className="text-sm">{t('inbox.select_conversation_hint')}</p>
            </div>
          )}
        </div>

        {/* Customer sidebar */}
        {selected && customer && (
          <div
            className={cn(
              'border-l bg-white overflow-auto flex-shrink-0',
              'w-full md:w-72',
              mobileView === 'info' ? '' : !infoSidebarOpen ? 'hidden' : 'hidden md:block',
            )}
          >
            <div className="flex border-b">
              <button
                onClick={() => setSidebarTab('info')}
                className={cn(
                  'flex-1 py-2.5 text-xs font-medium text-center',
                  sidebarTab === 'info'
                    ? 'text-sage-600 border-b-2 border-sage-600'
                    : 'text-slate-500',
                )}
              >
                {t('inbox.info_tab')}
              </button>
              <button
                onClick={() => setSidebarTab('notes')}
                className={cn(
                  'flex-1 py-2.5 text-xs font-medium text-center relative',
                  sidebarTab === 'notes'
                    ? 'text-sage-600 border-b-2 border-sage-600'
                    : 'text-slate-500',
                )}
              >
                {t('inbox.notes_tab')}{' '}
                {notes.length > 0 && (
                  <span className="ml-1 text-[9px] bg-amber-50 text-amber-700 px-1 py-0.5 rounded-full">
                    {notes.length}
                  </span>
                )}
              </button>
            </div>

            {sidebarTab === 'info' && (
              <>
                <div className="p-4 border-b">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center text-sage-600 font-semibold text-sm">
                      {(customer.name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <button
                        onClick={() => router.push(`/customers/${customer.id}`)}
                        className="font-semibold text-sm hover:text-sage-600 transition-colors text-left"
                        data-testid="customer-name-link"
                      >
                        {customer.name}
                      </button>
                      <p className="text-xs text-slate-500">
                        {selected?.channel === 'INSTAGRAM' && customer.instagramUserId
                          ? `@${customer.instagramUserId}`
                          : customer.phone}
                      </p>
                    </div>
                  </div>
                  {customer.email && (
                    <p className="text-xs text-slate-500 mb-2">{customer.email}</p>
                  )}
                  {customer.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {customer.tags.map((tg: string) => (
                        <span
                          key={tg}
                          className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full"
                        >
                          {tg}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Card Badge */}
                {actionCardCount > 0 && (
                  <div className="px-4 py-2 border-b" data-testid="inbox-action-card-badge">
                    <ActionCardBadge count={actionCardCount} />
                  </div>
                )}

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
                  <span className="text-xs font-semibold text-slate-500 uppercase">
                    {t('inbox.conversation_tags')}
                  </span>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {convTags.map((tg) => (
                      <span
                        key={tg}
                        className="inline-flex items-center gap-0.5 text-[10px] bg-sage-50 text-sage-700 px-2 py-0.5 rounded-full"
                      >
                        {tg}{' '}
                        <button onClick={() => removeConvTag(tg)} className="hover:text-red-500">
                          <X size={8} />
                        </button>
                      </span>
                    ))}
                    <input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addConvTag(newTag);
                        }
                      }}
                      placeholder={t('inbox.add_tag_placeholder')}
                      className="text-[10px] border rounded px-1.5 py-0.5 w-14 focus:w-24 transition-all"
                    />
                  </div>
                </div>

                <div className="p-4 border-b">
                  <span className="text-xs font-semibold text-slate-500 uppercase">
                    {t('inbox.assigned_to')}
                  </span>
                  <div className="relative mt-1">
                    <button
                      onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                      aria-expanded={showAssignDropdown}
                      className="w-full flex items-center justify-between border rounded-md px-2.5 py-1.5 text-sm hover:bg-slate-50"
                    >
                      <span>{selected.assignedTo?.name || t('common.unassigned')}</span>
                      <ChevronDown size={14} className="text-slate-400" />
                    </button>
                    {showAssignDropdown && (
                      <div
                        className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg"
                        role="listbox"
                      >
                        <button
                          role="option"
                          aria-selected={!selected.assignedTo}
                          onClick={() => assignConversation(null)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b"
                        >
                          {t('inbox.unassign')}
                        </button>
                        {staffList.map((s) => (
                          <button
                            key={s.id}
                            role="option"
                            aria-selected={selected.assignedTo?.id === s.id}
                            onClick={() => assignConversation(s.id)}
                            className={cn(
                              'w-full text-left px-3 py-2 text-sm hover:bg-slate-50',
                              selected.assignedTo?.id === s.id && 'bg-sage-50 text-sage-700',
                            )}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {!selected.assignedTo && (
                    <button
                      onClick={() => assignConversation(staffList[0]?.id)}
                      className="mt-2 text-xs text-sage-600 hover:text-sage-700 font-medium"
                    >
                      {t('inbox.assign_to_me')}
                    </button>
                  )}
                </div>

                {selected.status === 'SNOOZED' && selected.snoozedUntil && (
                  <div className="p-4 border-b bg-lavender-50">
                    <div className="flex items-center gap-1.5 text-lavender-700 text-xs">
                      <AlarmClock size={12} />
                      <span>
                        {t('inbox.snoozed_until', {
                          datetime: new Date(selected.snoozedUntil).toLocaleString(),
                        })}
                      </span>
                    </div>
                  </div>
                )}

                {customer && pack.customerFields.length > 0 && (
                  <IntakeCard
                    customer={customer}
                    fields={pack.customerFields}
                    onUpdated={(updated) => setCustomer(updated)}
                  />
                )}

                <div className="p-4 border-b">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase">
                      {t('inbox.bookings_section')}
                    </span>
                    <button
                      onClick={() => setShowBookingForm(true)}
                      className="text-xs text-sage-600 hover:text-sage-700"
                    >
                      {t('inbox.bookings_new')}
                    </button>
                  </div>
                  {customerBookings
                    .filter((b: any) =>
                      ['PENDING', 'PENDING_DEPOSIT', 'CONFIRMED'].includes(b.status),
                    )
                    .slice(0, 3)
                    .map((b: any) => (
                      <div key={b.id} className="border rounded p-2 mb-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">
                            {b.service?.name}
                            {b.service?.kind === 'CONSULT' && (
                              <span className="ml-1 text-[9px] bg-lavender-50 text-lavender-900 px-1 py-0 rounded-full">
                                C
                              </span>
                            )}
                            {b.service?.kind === 'TREATMENT' && (
                              <span className="ml-1 text-[9px] bg-sage-50 text-sage-900 px-1 py-0 rounded-full">
                                T
                              </span>
                            )}
                          </p>
                          <span
                            className={cn(
                              'text-[9px] px-1.5 py-0.5 rounded-full',
                              b.status === 'CONFIRMED'
                                ? 'bg-sage-50 text-sage-700'
                                : b.status === 'PENDING_DEPOSIT'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-lavender-50 text-lavender-700',
                            )}
                          >
                            {t(`status.${b.status.toLowerCase()}`)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Date(b.startTime).toLocaleDateString()} at{' '}
                          {new Date(b.startTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        {b.status === 'PENDING_DEPOSIT' && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await api.post(`/bookings/${b.id}/send-deposit-request`);
                                toast(t('booking.deposit_request_sent'));
                                if (customer) loadCustomerBookings(customer.id);
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                            className="mt-1 text-[10px] text-amber-700 hover:text-amber-800 font-medium flex items-center gap-1"
                          >
                            <Send size={10} /> {t('booking.send_deposit_request')}
                          </button>
                        )}
                      </div>
                    ))}
                  {customerBookings.filter((b: any) =>
                    ['PENDING', 'PENDING_DEPOSIT', 'CONFIRMED'].includes(b.status),
                  ).length === 0 && (
                    <p className="text-xs text-slate-400">{t('inbox.no_upcoming_bookings')}</p>
                  )}
                </div>
              </>
            )}

            {sidebarTab === 'notes' && (
              <div className="p-4">
                <div className="mb-4">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder={t('inbox.add_note_placeholder')}
                    rows={3}
                    className="w-full border rounded-md px-3 py-2 text-sm resize-none"
                  />
                  <button
                    onClick={addNote}
                    disabled={!newNote.trim()}
                    className="mt-1 bg-yellow-500 text-white px-3 py-1.5 rounded-md text-xs hover:bg-yellow-600 disabled:opacity-50 w-full"
                  >
                    <StickyNote size={12} className="inline mr-1" /> {t('inbox.add_note')}
                  </button>
                </div>

                <div className="space-y-3">
                  {notes.map((n) => (
                    <div
                      key={n.id}
                      className="bg-yellow-50 border border-yellow-200 rounded-lg p-3"
                    >
                      <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-[10px] text-slate-400">
                          {n.staff?.name} · {new Date(n.createdAt).toLocaleString()}
                        </p>
                        <button
                          onClick={() => deleteNote(n.id)}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {notes.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">{t('inbox.no_notes')}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <BookingFormModal
        isOpen={showBookingForm}
        onClose={() => setShowBookingForm(false)}
        onCreated={() => {
          setShowBookingForm(false);
          if (customer) loadCustomerBookings(customer.id);
        }}
        customerId={customer?.id}
        customerName={customer?.name}
        conversationId={selected?.id}
      />

      {showOutboundCompose && customer && (
        <OutboundCompose
          customerId={customer.id}
          customerName={customer.name}
          onSend={sendOutboundDraft}
          onClose={() => setShowOutboundCompose(false)}
        />
      )}

      {/* Bulk action bar for inbox */}
      {selectedConvoIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-soft border border-slate-200 p-4 z-40">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-slate-700">
              {selectedConvoIds.size} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkMarkRead}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Mark as Read
              </button>
              <div className="relative">
                <button
                  onClick={(e) => {
                    // Show dropdown for assign
                    const btn = e.currentTarget;
                    const dropdown = btn.parentElement?.querySelector(
                      '[data-dropdown]',
                    ) as HTMLElement;
                    if (dropdown) dropdown.classList.toggle('hidden');
                  }}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Assign to Me
                </button>
                <div
                  data-dropdown
                  className="hidden absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-soft z-50"
                >
                  {staffList.map((s) => (
                    <button
                      key={s.id}
                      onClick={(e) => {
                        handleBulkAssignConvos(s.id);
                        const dropdown = (e.currentTarget as HTMLElement).parentElement;
                        if (dropdown) dropdown.classList.add('hidden');
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 border-b last:border-0"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                {showBulkTagInput ? (
                  <div className="flex items-center gap-1">
                    <input
                      value={bulkTagInput}
                      onChange={(e) => setBulkTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleBulkTagConvos(bulkTagInput);
                        if (e.key === 'Escape') {
                          setShowBulkTagInput(false);
                          setBulkTagInput('');
                        }
                      }}
                      placeholder="Tag name"
                      className="w-24 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-500"
                      autoFocus
                      data-testid="bulk-tag-input"
                    />
                    <button
                      onClick={() => handleBulkTagConvos(bulkTagInput)}
                      disabled={!bulkTagInput.trim()}
                      className="px-2 py-1.5 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700 disabled:opacity-50"
                    >
                      Apply
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowBulkTagInput(true)}
                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1"
                    data-testid="bulk-tag-btn"
                  >
                    <Tag size={14} />
                    Tag
                  </button>
                )}
              </div>
              <button
                onClick={handleBulkCloseConvos}
                className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                data-testid="bulk-close-btn"
              >
                Close Selected
              </button>
              <button
                onClick={() => {
                  setSelectedConvoIds(new Set());
                  setShowBulkTagInput(false);
                  setBulkTagInput('');
                }}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
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
