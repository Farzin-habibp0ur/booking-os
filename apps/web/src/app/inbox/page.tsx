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
  Instagram,
  Facebook,
  Mail,
  MessageCircle,
  Globe,
  Pin,
  PinOff,
  Check,
  Edit2,
  RefreshCw,
  Sparkles,
  Loader,
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
import { ChannelBadge } from '@/components/inbox/channel-badge';
import { getDefaultReplyChannel } from '@/components/inbox/reply-channel-switcher';
import { ChannelsOnFile } from '@/components/inbox/channels-on-file';
import { ConversationContextBar } from '@/components/inbox/conversation-context-bar';
import { InstagramContext } from '@/components/inbox/instagram-context';
import { FeatureDiscovery } from '@/components/feature-discovery';
import ScheduledMessage from '@/components/scheduled-message';
import { captureEvent } from '@/lib/posthog';
import { CHANNEL_STYLES } from '@/lib/design-tokens';
import { useAuth } from '@/lib/auth';
import { useDraftAutosave } from '@/hooks/use-draft-autosave';

// Channel icon map for message badges and conversation cards
const CHANNEL_ICONS: Record<string, any> = {
  WHATSAPP: MessageSquare,
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  SMS: MessageCircle,
  EMAIL: Mail,
  WEB_CHAT: Globe,
};

// SMS segment calculator
function smsSegmentInfo(text: string): { chars: number; segments: number } {
  const chars = text.length;
  // GSM-7: 160 chars per segment, 153 for multi; UCS-2: 70/67
  // eslint-disable-next-line no-control-regex
  const hasUnicode = /[^\u0000-\u007F]/.test(text);
  const singleLimit = hasUnicode ? 70 : 160;
  const multiLimit = hasUnicode ? 67 : 153;
  const segments = chars <= singleLimit ? 1 : Math.ceil(chars / multiLimit);
  return { chars, segments };
}

// Channel-specific file size limits (MB)
const CHANNEL_FILE_LIMITS: Record<string, number> = {
  WHATSAPP: 16,
  INSTAGRAM: 8,
  FACEBOOK: 25,
  SMS: 5,
  EMAIL: 25,
  WEB_CHAT: 10,
};

// Channel-specific accepted MIME types
const CHANNEL_ACCEPTED_TYPES: Record<string, string[]> = {
  WHATSAPP: ['image/*', 'video/*', 'audio/*', 'application/pdf', 'application/msword'],
  INSTAGRAM: ['image/*', 'video/mp4', 'audio/*'],
  FACEBOOK: ['image/*', 'video/*', 'audio/*', 'application/pdf'],
  SMS: ['image/*', 'video/*'],
  EMAIL: ['image/*', 'video/*', 'audio/*', 'application/pdf', 'application/msword', 'text/*'],
  WEB_CHAT: ['image/*', 'video/*', 'audio/*', 'application/pdf'],
};

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
  const { user } = useAuth();
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
  const [pendingDrafts, setPendingDrafts] = useState<any[]>([]);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [editingDraft, setEditingDraft] = useState<any>(null);
  const [regenerateContext, setRegenerateContext] = useState('');
  const [showRegenerateInput, setShowRegenerateInput] = useState(false);
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
  // Reply channel switcher state
  const [replyChannel, setReplyChannel] = useState<string>('');
  const [availableChannels, setAvailableChannels] = useState<string[]>([]);
  const [disabledChannels, setDisabledChannels] = useState<Record<string, string>>({});
  // Draft persistence per channel
  const [drafts, setDrafts] = useState<Record<string, { text: string; subject?: string }>>({});
  const [emailSubject, setEmailSubject] = useState('');
  // Channel pinning — persisted to localStorage
  const [pinnedChannel, setPinnedChannel] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bookingos:pinnedChannel') || null;
    }
    return null;
  });
  // Draft auto-save to backend
  const { save: autosaveDraft, load: loadDrafts, clear: clearDraft } = useDraftAutosave(selected?.id, user?.id);
  // Compact mode detection
  const [isCompact, setIsCompact] = useState(false);
  const [isNarrowComposer, setIsNarrowComposer] = useState(false);
  const composerRef = useRef<HTMLDivElement>(null);
  // Channel health
  const [channelHealth, setChannelHealth] = useState<Record<string, 'UP' | 'DEGRADED' | 'DOWN'>>(
    {},
  );
  // Smart suggestions
  const [smartSuggestions, setSmartSuggestions] = useState<
    Array<{ type: string; message: string; action?: string }>
  >([]);
  // Track dismissed suggestions per conversation (session-level)
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Record<string, Set<string>>>({});
  // Failed sends
  const [failedSends, setFailedSends] = useState<
    Array<{ id: string; content: string; channel: string; error: string }>
  >([]);
  // Discard draft confirmation
  const [pendingConversationSwitch, setPendingConversationSwitch] = useState<any>(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Compute whether the messaging window is expired (WA/IG/FB 24h rule)
  const isWindowExpired = (() => {
    const ch = (replyChannel || selected?.channel || '').toUpperCase();
    if (!['WHATSAPP', 'INSTAGRAM', 'FACEBOOK'].includes(ch)) return false;
    const lastInbound = messages?.filter((m: any) => m.direction === 'INBOUND').pop();
    if (!lastInbound) return true;
    const elapsed = Date.now() - new Date(lastInbound.createdAt).getTime();
    return elapsed >= 24 * 60 * 60 * 1000;
  })();

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
    'ai:processing': useCallback((data: any) => {
      if (selectedRef.current && data.conversationId === selectedRef.current.id) {
        setAiProcessing(true);
      }
    }, []),
    'ai:draft-ready': useCallback((data: any) => {
      if (selectedRef.current && data.conversationId === selectedRef.current.id) {
        setAiProcessing(false);
        loadMessages(selectedRef.current.id);
      }
    }, []),
    'ai:processing-failed': useCallback((data: any) => {
      if (selectedRef.current && data.conversationId === selectedRef.current.id) {
        setAiProcessing(false);
      }
    }, []),
    'ai:suggestions': useCallback((data: any) => {
      if (selectedRef.current && data.conversationId === selectedRef.current.id) {
        setAiProcessing(false);
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
    'draft:created': useCallback((data: any) => {
      if (selectedRef.current && data.conversationId === selectedRef.current.id) {
        loadMessages(selectedRef.current.id);
      }
    }, []),
    'draft:review-requested': useCallback(
      (data: any) => {
        // Auto-navigate to conversation with draft loaded
        if (data.conversationId) {
          const conv = conversations.find((c: any) => c.id === data.conversationId);
          if (conv) {
            setSelected(conv);
            loadMessages(conv.id);
          } else {
            // Conversation not in current list — reload and select
            loadConversations().then(() => {
              loadMessages(data.conversationId);
            });
          }
          const name = data.customerName || 'customer';
          toast(
            t('ai.draft_review_requested') || `Draft ready for ${name}. Review and send.`,
            'info',
          );
        }
      },
      [conversations],
    ),
    'conversation:focus': useCallback(
      (data: any) => {
        if (data.conversationId) {
          const conv = conversations.find((c: any) => c.id === data.conversationId);
          if (conv) {
            setSelected(conv);
            loadMessages(conv.id);
          }
        }
      },
      [conversations],
    ),
    'presence:update': useCallback((data: any) => {
      if (selectedRef.current && data.conversationId === selectedRef.current.id) {
        setViewers(data.viewers || []);
      }
    }, []),
  });

  // Compact mode: detect screen height < 800px
  useEffect(() => {
    const checkHeight = () => setIsCompact(window.innerHeight < 800);
    checkHeight();
    window.addEventListener('resize', checkHeight);
    return () => window.removeEventListener('resize', checkHeight);
  }, []);

  // Narrow composer: detect width < 640px for pill collapse to dropdown
  useEffect(() => {
    if (!composerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsNarrowComposer(entry.contentRect.width < 640);
      }
    });
    observer.observe(composerRef.current);
    return () => observer.disconnect();
  }, [selected?.id]);

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
      // Set reply channel: pinned > lastInboundChannel > conversation channel
      const convChannel = selected.channel || 'WHATSAPP';
      const lastInbound = selected.lastInboundChannel || meta.lastInboundChannel;
      const custChannels = selected.customer?.channels || [];
      const avail = custChannels.length > 0 ? custChannels : [convChannel];
      setAvailableChannels(avail);
      const defaultCh =
        pinnedChannel && avail.includes(pinnedChannel)
          ? pinnedChannel
          : getDefaultReplyChannel(convChannel, avail, lastInbound);
      setReplyChannel(defaultCh);
      // Restore draft for this channel: try local first, then load from backend
      const draftKey = `${selected.id}:${defaultCh}`;
      const saved = drafts[draftKey];
      if (saved) {
        setNewMessage(saved.text);
        if (defaultCh === 'EMAIL') setEmailSubject(saved.subject || '');
      } else {
        setNewMessage('');
        setEmailSubject('');
        // Load auto-saved drafts from backend
        loadDrafts().then((backendDrafts) => {
          if (Object.keys(backendDrafts).length > 0) {
            setDrafts((prev) => ({ ...prev, ...backendDrafts }));
            const backendSaved = backendDrafts[draftKey];
            if (backendSaved) {
              setNewMessage(backendSaved.text);
              if (defaultCh === 'EMAIL') setEmailSubject(backendSaved.subject || '');
            }
          }
        });
      }
      // Load smart suggestions
      loadSmartSuggestions(selected);
      // Reset failed sends
      setFailedSends([]);
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
      const result = await api.get<any>(`/conversations/${id}/messages`);
      // Support both old (array) and new ({ messages, pendingDrafts }) response shapes
      if (Array.isArray(result)) {
        setMessages(result);
        setPendingDrafts([]);
      } else {
        setMessages(result.messages || []);
        setPendingDrafts(result.pendingDrafts || []);
      }
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

  // --- AI Draft Actions ---
  const handleApproveDraft = async (draftId: string) => {
    if (!selected) return;
    try {
      await api.post(`/outbound/${draftId}/send`);
      toast(t('ai.draft_sent') || 'Draft sent successfully');
      loadMessages(selected.id);
      loadConversations();
    } catch (e: any) {
      toast(e?.message || 'Failed to send draft', 'error');
    }
  };

  const handleEditDraft = (draft: any) => {
    setNewMessage(draft.content || '');
    setEditingDraft(draft);
    if (draft.channel) setReplyChannel(draft.channel);
    if (draft.channel === 'EMAIL' && draft.metadata?.subject) {
      setEmailSubject(draft.metadata.subject);
    }
    composerRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleRejectDraft = async (draftId: string) => {
    if (!selected) return;
    try {
      await api.patch(`/outbound/${draftId}/reject`);
      setEditingDraft(null);
      loadMessages(selected.id);
    } catch (e: any) {
      toast(e?.message || 'Failed to reject draft', 'error');
    }
  };

  const handleRegenerateDraft = async (context?: string) => {
    if (!selected) return;
    try {
      setAiProcessing(true);
      setShowRegenerateInput(false);
      setRegenerateContext('');
      await api.post(`/ai/conversations/${selected.id}/regenerate-draft`, {
        ...(context ? { additionalContext: context } : {}),
      });
    } catch (e: any) {
      setAiProcessing(false);
      toast(e?.message || 'Failed to regenerate draft', 'error');
    }
  };

  // When staff switches channel while editing an AI draft, offer to regenerate
  const handleDraftChannelSwitch = (newChannel: string) => {
    if (editingDraft && editingDraft.channel !== newChannel) {
      const fromCh = editingDraft.channel;
      if (confirm(`AI generated this for ${fromCh}. Regenerate for ${newChannel}?`)) {
        setReplyChannel(newChannel);
        handleRegenerateDraft(`Reformat this message for ${newChannel} channel`);
        setEditingDraft(null);
      } else {
        setReplyChannel(newChannel);
      }
    } else {
      setReplyChannel(newChannel);
    }
  };

  const sendMessage = async (content?: string) => {
    const text = content || newMessage.trim();
    if (!text || !selected) return;
    setSending(true);
    try {
      const payload: any = { content: text, channel: replyChannel || selected.channel };
      if (replyChannel === 'EMAIL' && emailSubject) {
        payload.subject = emailSubject;
      }
      if (scheduledFor) {
        payload.scheduledFor = scheduledFor.toISOString();
      }
      await api.post(`/conversations/${selected.id}/messages`, payload);
      captureEvent('message_sent', {
        channel: replyChannel || selected.channel || 'WHATSAPP',
        scheduled: !!scheduledFor,
      });
      setNewMessage('');
      setEmailSubject('');
      setAiDraftText('');
      setAiIntent(undefined);
      setAiConfidence(undefined);
      setEditingDraft(null);
      setShowQuickReplies(false);
      // Clear draft for this channel (local + backend)
      if (selected) {
        const draftKey = `${selected.id}:${replyChannel}`;
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[draftKey];
          return next;
        });
        clearDraft(replyChannel || selected.channel);
      }
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

  // Smart suggestions based on conversation state
  const loadSmartSuggestions = (conv: any) => {
    const suggestions: Array<{ type: string; message: string; action?: string }> = [];
    const meta = conv.metadata || {};
    if (meta.smsOptOut) {
      suggestions.push({ type: 'opted-out', message: t('inbox.smart_suggest_opted_out') });
    }
    if (conv.channel === 'INSTAGRAM' || conv.channel === 'FACEBOOK') {
      const lastMsg = conv.lastCustomerMessageAt
        ? new Date(conv.lastCustomerMessageAt).getTime()
        : 0;
      const elapsed = Date.now() - lastMsg;
      const hoursLeft = 24 - elapsed / (1000 * 60 * 60);
      if (hoursLeft > 0 && hoursLeft < 4) {
        suggestions.push({ type: 'window', message: t('inbox.smart_suggest_window') });
      }
    }
    if (conv.lastMessageDirection === 'OUTBOUND' && conv.lastMessageAt) {
      const hoursSince = (Date.now() - new Date(conv.lastMessageAt).getTime()) / (1000 * 60 * 60);
      if (hoursSince > 24) {
        suggestions.push({
          type: 'no-reply',
          message: t('inbox.smart_suggest_no_reply', { hours: Math.floor(hoursSince).toString() }),
        });
      }
    }
    setSmartSuggestions(suggestions);
  };

  // Handle reply channel change with draft persistence + AI regenerate prompt
  const handleReplyChannelChange = (newChannel: string) => {
    if (!selected) return;

    // If editing an AI draft and switching channel, offer to regenerate
    if (editingDraft && editingDraft.channel && editingDraft.channel !== newChannel) {
      const fromLabel =
        CHANNEL_STYLES[editingDraft.channel as keyof typeof CHANNEL_STYLES]?.label ||
        editingDraft.channel;
      const toLabel =
        CHANNEL_STYLES[newChannel as keyof typeof CHANNEL_STYLES]?.label || newChannel;
      if (confirm(`AI generated this for ${fromLabel}. Regenerate for ${toLabel}?`)) {
        setReplyChannel(newChannel);
        setEditingDraft(null);
        handleRegenerateDraft(`Reformat this message for ${newChannel} channel`);
        return;
      }
    }

    // Save current draft (local + backend)
    const currentKey = `${selected.id}:${replyChannel}`;
    if (newMessage.trim() || emailSubject.trim()) {
      setDrafts((prev) => ({
        ...prev,
        [currentKey]: {
          text: newMessage,
          subject: replyChannel === 'EMAIL' ? emailSubject : undefined,
        },
      }));
      autosaveDraft(replyChannel, newMessage, replyChannel === 'EMAIL' ? emailSubject : undefined);
    }
    // Restore draft for new channel
    const newKey = `${selected.id}:${newChannel}`;
    const saved = drafts[newKey];
    setNewMessage(saved?.text || '');
    setEmailSubject(newChannel === 'EMAIL' ? saved?.subject || '' : '');
    setReplyChannel(newChannel);
    if (editingDraft) setEditingDraft(null);
    // Clear suggestion dismissals so new channel-specific suggestions can appear
    if (selected) {
      setDismissedSuggestions((prev) => {
        const next = { ...prev };
        delete next[selected.id];
        return next;
      });
    }
    toast(
      t('inbox.channel_switched', { channel: CHANNEL_STYLES[newChannel]?.label || newChannel }),
    );
  };

  // Handle conversation switch with draft discard confirmation
  const handleConversationSelect = (conv: any) => {
    if (selected && newMessage.trim() && selected.id !== conv.id) {
      setPendingConversationSwitch(conv);
      setShowDiscardDialog(true);
      return;
    }
    captureEvent('conversation_selected');
    setSelected(conv);
    setMobileView('thread');
  };

  // Pin/unpin channel — persisted to localStorage
  const togglePinChannel = () => {
    if (pinnedChannel === replyChannel) {
      setPinnedChannel(null);
      localStorage.removeItem('bookingos:pinnedChannel');
    } else {
      setPinnedChannel(replyChannel);
      localStorage.setItem('bookingos:pinnedChannel', replyChannel);
    }
  };

  // Add customer identifier (for ChannelsOnFile)
  const handleAddIdentifier = async (type: 'email' | 'phone', value: string) => {
    if (!customer) return;
    try {
      const updated = await api.patch<any>(`/customers/${customer.id}`, { [type]: value });
      setCustomer(updated);
      toast(`${type === 'email' ? 'Email' : 'Phone'} added successfully`);
    } catch (e: any) {
      toast(e?.message || `Failed to add ${type}`, 'error');
    }
  };

  const insertTemplate = (template: any) => {
    // Use channel-specific variant if available, fall back to base body
    let text = template.variants?.[replyChannel]?.body || template.body;
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
    // Warn if unresolved variables remain
    const unresolvedVars = text.match(/\{\{[^}]+\}\}/g);
    if (unresolvedVars && unresolvedVars.length > 0) {
      toast(`Template has unresolved variables: ${unresolvedVars.join(', ')}`, 'info');
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
              .sort((a, b) => {
                // Web Chat LIVE sessions sorted to top (Prompt 11)
                const aLive = a.channel === 'WEB_CHAT' && a.metadata?.sessionActive ? 1 : 0;
                const bLive = b.channel === 'WEB_CHAT' && b.metadata?.sessionActive ? 1 : 0;
                if (aLive !== bLive) return bLive - aLive;
                // High urgency (expiring windows) next
                const aUrgent =
                  (a.channel === 'INSTAGRAM' || a.channel === 'FACEBOOK') && a.lastCustomerMessageAt
                    ? Math.max(
                        0,
                        24 - (Date.now() - new Date(a.lastCustomerMessageAt).getTime()) / 3600000,
                      ) < 4
                      ? 1
                      : 0
                    : 0;
                const bUrgent =
                  (b.channel === 'INSTAGRAM' || b.channel === 'FACEBOOK') && b.lastCustomerMessageAt
                    ? Math.max(
                        0,
                        24 - (Date.now() - new Date(b.lastCustomerMessageAt).getTime()) / 3600000,
                      ) < 4
                      ? 1
                      : 0
                    : 0;
                if (aUrgent !== bUrgent) return bUrgent - aUrgent;
                return 0; // preserve server order otherwise
              })
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
                        onClick={() => handleConversationSelect(c)}
                        className="flex-1 cursor-pointer min-w-0"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {c.isOverdue && (
                              <span
                                className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"
                                title="Overdue"
                              />
                            )}
                            {/* Channel icon on conversation card (Prompt 1) */}
                            <ChannelBadge
                              channel={c.channel || 'WHATSAPP'}
                              size="sm"
                              showLabel={false}
                            />
                            <p className="text-sm font-medium truncate">
                              {c.customer?.name || t('common.unknown')}
                            </p>
                            {/* Multi-channel badge (Prompt 1) */}
                            {c.customer?.channels && c.customer.channels.length > 1 && (
                              <span className="text-[8px] px-1 py-0.5 rounded-full bg-slate-200 text-slate-600 font-medium flex-shrink-0">
                                +{c.customer.channels.length - 1}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {/* Web Chat LIVE badge (Prompt 1) */}
                            {c.channel === 'WEB_CHAT' && c.metadata?.sessionActive && (
                              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500 text-white font-bold animate-pulse">
                                {t('inbox.live')}
                              </span>
                            )}
                            {/* Urgency dot for expiring windows (Prompt 1) */}
                            {(c.channel === 'INSTAGRAM' || c.channel === 'FACEBOOK') &&
                              c.lastCustomerMessageAt &&
                              (() => {
                                const elapsed =
                                  Date.now() - new Date(c.lastCustomerMessageAt).getTime();
                                const hoursLeft = 24 - elapsed / (1000 * 60 * 60);
                                if (hoursLeft > 0 && hoursLeft < 4) {
                                  return (
                                    <span
                                      className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0 animate-pulse"
                                      title={`${Math.floor(hoursLeft)}h left`}
                                    />
                                  );
                                }
                                if (hoursLeft <= 0) {
                                  return (
                                    <span
                                      className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"
                                      title="Window expired"
                                    />
                                  );
                                }
                                return null;
                              })()}
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
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium truncate">{selected.customer?.name}</p>
                      {/* Channel badge for all channels (Prompt 1) */}
                      <ChannelBadge channel={selected.channel || 'WHATSAPP'} size="md" />
                      {/* Web Chat online/offline indicator (Prompt 3) */}
                      {selected.channel === 'WEB_CHAT' && (
                        <span
                          className={cn(
                            'text-[9px] px-1.5 py-0.5 rounded-full font-medium',
                            selected.metadata?.sessionActive
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-500',
                          )}
                        >
                          {selected.metadata?.sessionActive
                            ? t('inbox.online')
                            : t('inbox.offline')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-slate-500 truncate">
                        {selected.channel === 'INSTAGRAM' && selected.customer?.instagramUserId
                          ? `@${selected.customer.instagramUserId}`
                          : selected.customer?.phone}
                      </p>
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
                {messages.map((m, idx) => {
                  const prevMsg = idx > 0 ? messages[idx - 1] : null;
                  const msgChannel = m.channel || selected?.channel || 'WHATSAPP';
                  const prevChannel = prevMsg
                    ? prevMsg.channel || selected?.channel || 'WHATSAPP'
                    : null;
                  const channelChanged = prevChannel && prevChannel !== msgChannel;
                  const sameChannel = prevChannel === msgChannel;
                  const channelStyle = CHANNEL_STYLES[msgChannel];
                  const MsgChannelIcon = CHANNEL_ICONS[msgChannel];
                  const tooltipText =
                    m.direction === 'OUTBOUND'
                      ? `Sent via ${channelStyle?.label || msgChannel}`
                      : `Received via ${channelStyle?.label || msgChannel}`;

                  return (
                    <div key={m.id}>
                      {/* Channel transition divider (Prompt 2) */}
                      {channelChanged &&
                        (() => {
                          const newStyle = CHANNEL_STYLES[msgChannel];
                          const NewIcon = CHANNEL_ICONS[msgChannel];
                          return (
                            <div
                              className="flex items-center gap-2 py-2"
                              role="separator"
                              aria-label={`Conversation switched to ${newStyle?.label || msgChannel}`}
                            >
                              <div className="flex-1 h-px bg-slate-200" />
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full',
                                  newStyle?.bg,
                                  newStyle?.text,
                                )}
                              >
                                {NewIcon && <NewIcon size={10} />}
                                Switched to {newStyle?.label || msgChannel}
                              </span>
                              <div className="flex-1 h-px bg-slate-200" />
                            </div>
                          );
                        })()}
                      <div
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
                            {/* Channel icon next to timestamp (Prompt 2) */}
                            {MsgChannelIcon && (
                              <span
                                title={tooltipText}
                                className={cn(sameChannel ? 'opacity-40' : 'opacity-100')}
                              >
                                <MsgChannelIcon size={10} />
                              </span>
                            )}
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
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick replies */}
              {showQuickReplies && (
                <div className="px-3 pb-1 bg-white border-t">
                  <div className="flex flex-wrap gap-1.5 py-2">
                    {/* AI draft as first quick reply option */}
                    {pendingDrafts.length > 0 && (
                      <button
                        onClick={() => {
                          const draft = pendingDrafts[0];
                          setNewMessage(draft.content || '');
                          if (draft.channel) setReplyChannel(draft.channel);
                          setShowQuickReplies(false);
                        }}
                        className="text-xs bg-lavender-50 hover:bg-lavender-100 text-lavender-700 px-2.5 py-1.5 rounded-full transition-colors flex items-center gap-1"
                      >
                        <Sparkles size={10} />
                        {pendingDrafts[0].content?.slice(0, 50)}
                        {(pendingDrafts[0].content?.length || 0) > 50 ? '...' : ''}
                      </button>
                    )}
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

              {/* AI Processing Indicator */}
              {aiProcessing && (
                <div className="mx-3 my-2 px-3 py-2 bg-lavender-50 border border-lavender-100 rounded-xl flex items-center gap-2">
                  <Loader size={14} className="text-lavender-600 animate-spin" />
                  <span className="text-xs text-lavender-700 font-medium">
                    {t('ai.processing') || 'AI is drafting a response...'}
                  </span>
                </div>
              )}

              {/* OutboundDraft Bubbles (from AI or Agent) */}
              {pendingDrafts.length > 0 &&
                pendingDrafts.map((draft: any) => {
                  const conf = draft.confidence != null ? draft.confidence * 100 : null;
                  const confColor =
                    conf != null
                      ? conf > 85
                        ? 'bg-green-500'
                        : conf > 60
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      : '';
                  const confLabel =
                    conf != null
                      ? conf > 85
                        ? 'AI is confident'
                        : conf > 60
                          ? 'Review recommended'
                          : 'Significant editing recommended'
                      : '';
                  return (
                    <div
                      key={draft.id}
                      className="mx-3 my-2 px-3 py-3 bg-indigo-50 border border-dashed border-indigo-200 rounded-xl"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles size={14} className="text-indigo-600 flex-shrink-0" />
                        <span className="text-xs font-medium text-indigo-700">
                          {draft.source === 'AGENT' ? 'Agent Draft' : 'AI Draft'}
                        </span>
                        {draft.channel && (
                          <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">
                            {draft.channel}
                          </span>
                        )}
                        {draft.intent && (
                          <span className="text-[10px] text-indigo-500">
                            Intent: {draft.intent.replace(/_/g, ' ')}
                          </span>
                        )}
                        {conf != null && (
                          <span
                            className="flex items-center gap-1 text-[10px] text-indigo-400"
                            title={confLabel}
                          >
                            <span className={cn('w-1.5 h-1.5 rounded-full', confColor)} />
                            {Math.round(conf)}%
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-800 mb-3 whitespace-pre-wrap">
                        {draft.content}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleApproveDraft(draft.id)}
                          className="flex items-center gap-1 bg-sage-600 text-white px-2.5 py-1 rounded-lg text-xs hover:bg-sage-700 transition-colors"
                        >
                          <Check size={12} /> Approve & Send
                        </button>
                        <button
                          onClick={() => handleEditDraft(draft)}
                          className="flex items-center gap-1 text-slate-600 px-2.5 py-1 rounded-lg text-xs border border-slate-200 hover:bg-slate-50 transition-colors"
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                        <button
                          onClick={() => handleRejectDraft(draft.id)}
                          className="flex items-center gap-1 text-slate-400 px-2.5 py-1 rounded-lg text-xs hover:text-red-500 transition-colors"
                        >
                          <X size={12} /> Reject
                        </button>
                        <button
                          onClick={() => setShowRegenerateInput((v) => !v)}
                          className="flex items-center gap-1 text-indigo-500 px-2.5 py-1 rounded-lg text-xs hover:text-indigo-700 transition-colors"
                        >
                          <RefreshCw size={12} /> Regenerate
                        </button>
                      </div>
                      {/* Regenerate with context input */}
                      {showRegenerateInput && (
                        <div className="flex gap-2 mt-2">
                          <input
                            type="text"
                            value={regenerateContext}
                            onChange={(e) => setRegenerateContext(e.target.value)}
                            placeholder="Additional context (optional)"
                            className="flex-1 text-xs border border-indigo-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter')
                                handleRegenerateDraft(regenerateContext || undefined);
                            }}
                          />
                          <button
                            onClick={() => handleRegenerateDraft(regenerateContext || undefined)}
                            className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700 transition-colors"
                          >
                            Go
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

              {/* AI Suggestions Ghost Bubble (legacy metadata-based) — above composer */}
              {aiDraftText && pendingDrafts.length === 0 && (
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
                        'mx-3 mt-1 text-xs px-3 py-2 rounded-lg',
                        windowOpen
                          ? hoursLeft < 2
                            ? 'bg-amber-50 text-amber-700 border border-amber-100'
                            : 'bg-slate-50 text-slate-500'
                          : 'bg-red-50 text-red-700 border border-red-100',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Clock size={12} className="flex-shrink-0" />
                        {windowOpen ? (
                          <span>
                            <strong>
                              {Math.floor(hoursLeft)}h {Math.floor((hoursLeft % 1) * 60)}m
                            </strong>{' '}
                            left to reply — Instagram allows responses within 24 hours of the
                            customer&apos;s last message.
                          </span>
                        ) : (
                          <span>
                            The 24-hour reply window has closed. You can still send{' '}
                            <strong>one follow-up message</strong> within 7 days for customer
                            service purposes.
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}

              {/* Smart Suggestions (Prompt 8) */}
              {(() => {
                const convDismissed = selected ? dismissedSuggestions[selected.id] : undefined;
                const visible = smartSuggestions.filter(
                  (s) => !convDismissed?.has(s.message),
                );
                if (visible.length === 0) return null;
                return (
                  <div className="px-3 py-1.5 bg-amber-50 border-t border-amber-100">
                    {visible.map((s) => (
                      <div
                        key={s.message}
                        className="flex items-center justify-between text-xs text-amber-700 py-0.5"
                      >
                        <span>{s.message}</span>
                        <button
                          onClick={() => {
                            if (!selected) return;
                            setDismissedSuggestions((prev) => {
                              const existing = prev[selected.id] || new Set<string>();
                              const next = new Set(existing);
                              next.add(s.message);
                              return { ...prev, [selected.id]: next };
                            });
                          }}
                          className="text-amber-400 hover:text-amber-600 ml-2"
                          aria-label="Dismiss suggestion"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Failed Send Recovery (Prompt 8) */}
              {failedSends.length > 0 && (
                <div className="px-3 py-1.5 bg-red-50 border-t border-red-100" role="alert">
                  {failedSends.map((fs) => {
                    // Find an alternative channel to suggest
                    const altChannel = availableChannels.find(
                      (ch) =>
                        ch !== fs.channel && !disabledChannels[ch] && channelHealth[ch] !== 'DOWN',
                    );
                    return (
                      <div
                        key={fs.id}
                        className="flex items-center justify-between text-xs text-red-700 py-0.5"
                      >
                        <span className="truncate flex-1">{fs.error}</span>
                        <div className="flex gap-1 ml-2 flex-shrink-0">
                          <button
                            onClick={() => {
                              setNewMessage(fs.content);
                              setFailedSends((prev) => prev.filter((f) => f.id !== fs.id));
                            }}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 hover:bg-red-200"
                          >
                            {t('inbox.failed_send_retry')}
                          </button>
                          {altChannel && (
                            <button
                              onClick={() => {
                                setNewMessage(fs.content);
                                handleReplyChannelChange(altChannel);
                                setFailedSends((prev) => prev.filter((f) => f.id !== fs.id));
                              }}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 hover:bg-red-200"
                            >
                              {t('inbox.failed_send_alt', {
                                channel: CHANNEL_STYLES[altChannel]?.label || altChannel,
                              })}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Composer */}
              <div
                ref={composerRef}
                className={cn(
                  'border-t bg-white overflow-auto',
                  isCompact ? 'p-2 max-h-[35vh]' : 'p-3 max-h-[45vh]',
                )}
              >
                {/* Editing AI draft banner + confidence */}
                {editingDraft && (
                  <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-lavender-50 border border-lavender-100 rounded-lg">
                    <Sparkles size={12} className="text-lavender-600 flex-shrink-0" />
                    <span className="text-[11px] text-lavender-700 flex-1">
                      Editing AI draft
                      {editingDraft.intent && (
                        <>
                          {' '}
                          &mdash; intent: <strong>{editingDraft.intent.replace(/_/g, ' ')}</strong>
                        </>
                      )}
                    </span>
                    {editingDraft.confidence != null &&
                      (() => {
                        const c = editingDraft.confidence * 100;
                        const color =
                          c > 85 ? 'bg-green-500' : c > 60 ? 'bg-amber-500' : 'bg-red-500';
                        const label =
                          c > 85
                            ? 'AI is confident'
                            : c > 60
                              ? 'Review before sending'
                              : 'Significant editing recommended';
                        return (
                          <span
                            className="flex items-center gap-1 text-[10px] text-slate-500"
                            title={label}
                          >
                            <span className={cn('w-1.5 h-1.5 rounded-full', color)} />
                            {label}
                          </span>
                        );
                      })()}
                    <button
                      onClick={() => {
                        setEditingDraft(null);
                        setNewMessage('');
                      }}
                      className="text-lavender-400 hover:text-lavender-600"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {/* Reply channel pills with tablist (Prompt 3, 4, 12) */}
                {availableChannels.length > 1 && !isNarrowComposer && (
                  <div
                    className="flex items-center gap-1 mb-2 flex-wrap"
                    role="tablist"
                    aria-label="Reply channel"
                  >
                    {availableChannels.map((ch) => {
                      const style = CHANNEL_STYLES[ch];
                      const Icon = CHANNEL_ICONS[ch];
                      const isActive = ch === replyChannel;
                      const isDisabled = !!disabledChannels[ch] || channelHealth[ch] === 'DOWN';
                      const healthStatus = channelHealth[ch];
                      const draftKey = selected ? `${selected.id}:${ch}` : '';
                      const hasDraft = !!drafts[draftKey]?.text;
                      const disabledReason =
                        disabledChannels[ch] ||
                        (channelHealth[ch] === 'DOWN'
                          ? t('inbox.channel_down', { channel: style?.label || ch })
                          : '');

                      return (
                        <button
                          key={ch}
                          role="tab"
                          aria-selected={isActive}
                          aria-disabled={isDisabled}
                          tabIndex={isActive ? 0 : -1}
                          title={isDisabled ? disabledReason : style?.label || ch}
                          onClick={() => !isDisabled && handleReplyChannelChange(ch)}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                              e.preventDefault();
                              const dir = e.key === 'ArrowRight' ? 1 : -1;
                              const currentIdx = availableChannels.indexOf(ch);
                              const nextIdx =
                                (currentIdx + dir + availableChannels.length) %
                                availableChannels.length;
                              const nextCh = availableChannels[nextIdx];
                              if (!disabledChannels[nextCh] && channelHealth[nextCh] !== 'DOWN') {
                                handleReplyChannelChange(nextCh);
                              }
                            }
                          }}
                          className={cn(
                            'relative inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border transition-all',
                            isActive
                              ? `${style?.bg} ${style?.text} ${style?.border} ring-2 ring-offset-1 ring-current font-medium`
                              : isDisabled
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed grayscale'
                                : `bg-white ${style?.text} border-slate-200 hover:${style?.bg}`,
                          )}
                          data-testid={`reply-pill-${ch.toLowerCase()}`}
                        >
                          {Icon && <Icon size={11} />}
                          <span className="hidden sm:inline">{style?.label || ch}</span>
                          {/* Health dot (Prompt 8) */}
                          {healthStatus === 'DEGRADED' && (
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-amber-500"
                              aria-label="Degraded"
                            />
                          )}
                          {healthStatus === 'DOWN' && (
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-red-500"
                              aria-label="Down"
                            />
                          )}
                          {/* Draft dot (Prompt 5) */}
                          {hasDraft && !isActive && (
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-500" />
                          )}
                          {/* Pin icon (Prompt 11) */}
                          {isActive && pinnedChannel === ch && (
                            <Pin size={8} className="text-current" />
                          )}
                        </button>
                      );
                    })}
                    {/* Pin/unpin button */}
                    <button
                      onClick={togglePinChannel}
                      className="text-slate-400 hover:text-slate-600 p-0.5"
                      title={
                        pinnedChannel === replyChannel
                          ? t('inbox.unpin_channel')
                          : t('inbox.pin_channel')
                      }
                    >
                      {pinnedChannel === replyChannel ? <PinOff size={12} /> : <Pin size={12} />}
                    </button>
                    {/* Screen reader announcement for channel switch (Prompt 12) */}
                    <span className="sr-only" aria-live="assertive">
                      {replyChannel
                        ? `Replying via ${CHANNEL_STYLES[replyChannel]?.label || replyChannel}`
                        : ''}
                    </span>
                  </div>
                )}
                {/* Narrow mode: collapse pills to dropdown (Prompt 4) */}
                {availableChannels.length > 1 && isNarrowComposer && (
                  <div className="mb-2">
                    <select
                      value={replyChannel}
                      onChange={(e) => handleReplyChannelChange(e.target.value)}
                      className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-sage-500 focus:outline-none"
                      aria-label="Reply channel"
                    >
                      {availableChannels.map((ch) => {
                        const style = CHANNEL_STYLES[ch];
                        const isDisabled = !!disabledChannels[ch] || channelHealth[ch] === 'DOWN';
                        return (
                          <option key={ch} value={ch} disabled={isDisabled}>
                            {style?.label || ch}
                            {isDisabled ? ` (${disabledChannels[ch] || 'unavailable'})` : ''}
                            {pinnedChannel === ch ? ' (pinned)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {/* Context bar for current channel (Prompt 3) */}
                <ConversationContextBar
                  channel={replyChannel || selected?.channel || 'WHATSAPP'}
                  lastCustomerMessageAt={selected?.lastCustomerMessageAt}
                  conversationMetadata={selected?.metadata}
                  onUseTemplate={() => setShowTemplates(true)}
                />

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
                    {templates.map((tpl) => {
                      const hasVariant = tpl.variants?.[replyChannel];
                      const displayBody = hasVariant?.body || tpl.body;
                      return (
                        <button
                          key={tpl.id}
                          onClick={() => insertTemplate(tpl)}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b last:border-0"
                        >
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium">{tpl.name}</p>
                            {hasVariant && (
                              <span
                                className={cn(
                                  'text-[8px] px-1 py-0.5 rounded',
                                  CHANNEL_STYLES[replyChannel]?.bg,
                                  CHANNEL_STYLES[replyChannel]?.text,
                                )}
                              >
                                {CHANNEL_STYLES[replyChannel]?.label}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 truncate">{displayBody}</p>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Email subject line (Prompt 3) */}
                {replyChannel === 'EMAIL' && (
                  <div className="mb-2">
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Subject..."
                      className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                      data-testid="email-subject-input"
                    />
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
                      channel={replyChannel || selected.channel}
                      onSwitchToEmail={
                        availableChannels.includes('EMAIL')
                          ? () => handleReplyChannelChange('EMAIL')
                          : undefined
                      }
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
                        let val = e.target.value;
                        if (replyChannel === 'INSTAGRAM') val = val.slice(0, 1000);
                        setNewMessage(val);
                        autosaveDraft(replyChannel || selected?.channel || 'WHATSAPP', val, replyChannel === 'EMAIL' ? emailSubject : undefined);
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
                      placeholder={
                        isWindowExpired
                          ? 'Messaging window expired — use a template'
                          : t('inbox.type_message')
                      }
                      disabled={isWindowExpired}
                      rows={1}
                      maxLength={replyChannel === 'INSTAGRAM' ? 1000 : undefined}
                      className={cn(
                        'w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 resize-none min-h-[38px] max-h-24',
                        isWindowExpired && 'opacity-50 cursor-not-allowed bg-slate-50',
                      )}
                      style={{ height: 'auto' }}
                      onInput={(e) => {
                        const el = e.currentTarget;
                        el.style.height = 'auto';
                        el.style.height = Math.min(el.scrollHeight, 96) + 'px';
                      }}
                    />
                    {/* Instagram char counter (Prompt 3) */}
                    {replyChannel === 'INSTAGRAM' && newMessage.length > 0 && (
                      <span
                        className={cn(
                          'absolute right-2 bottom-1 text-[10px]',
                          newMessage.length > 900 ? 'text-amber-500' : 'text-slate-400',
                        )}
                      >
                        {newMessage.length}/1000
                      </span>
                    )}
                    {/* Unresolved template variables warning (Prompt 10) */}
                    {newMessage.includes('{{') &&
                      (() => {
                        const vars = newMessage.match(/\{\{[^}]+\}\}/g);
                        if (!vars || vars.length === 0) return null;
                        return (
                          <span className="absolute left-2 bottom-1 text-[10px] text-amber-500 flex items-center gap-0.5">
                            <AlertCircle size={9} />
                            {vars.length} unresolved variable{vars.length > 1 ? 's' : ''}
                          </span>
                        );
                      })()}
                    {/* SMS char counter + segment calculator (Prompt 3) */}
                    {replyChannel === 'SMS' &&
                      newMessage.length > 0 &&
                      (() => {
                        const info = smsSegmentInfo(newMessage);
                        return (
                          <span
                            className={cn(
                              'absolute right-2 bottom-1 text-[10px]',
                              info.segments > 1 ? 'text-amber-500' : 'text-slate-400',
                            )}
                          >
                            {info.chars} chars · {info.segments} segment
                            {info.segments !== 1 ? 's' : ''}
                          </span>
                        );
                      })()}
                  </div>
                  <ScheduledMessage
                    onSchedule={(date) => setScheduledFor(date)}
                    onClear={() => setScheduledFor(null)}
                    scheduledAt={scheduledFor}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={sending || !newMessage.trim() || isWindowExpired}
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

                {/* Channels on File (Prompt 9) */}
                <div className="px-4 py-3 border-b">
                  <ChannelsOnFile
                    channels={{
                      phone: customer.phone,
                      email: customer.email,
                      instagramUserId: customer.instagramUserId,
                      facebookPsid: customer.facebookPsid,
                      webChatSessionId: customer.webChatSessionId,
                    }}
                    onAddIdentifier={handleAddIdentifier}
                  />
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
      {/* Discard draft dialog (Prompt 5, 12) */}
      {showDiscardDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/30 animate-backdrop"
            onClick={() => setShowDiscardDialog(false)}
          />
          <div
            className="relative bg-white rounded-2xl shadow-soft-lg p-6 max-w-sm mx-4 animate-modal-enter"
            role="alertdialog"
            aria-labelledby="discard-title"
            aria-describedby="discard-desc"
          >
            <h3 id="discard-title" className="text-sm font-semibold text-slate-900 mb-1">
              {t('inbox.discard_draft_title')}
            </h3>
            <p id="discard-desc" className="text-xs text-slate-500 mb-4">
              {t('inbox.discard_draft_message')}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowDiscardDialog(false);
                  setPendingConversationSwitch(null);
                }}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                autoFocus
              >
                {t('inbox.keep_editing')}
              </button>
              <button
                onClick={() => {
                  setNewMessage('');
                  setEmailSubject('');
                  setShowDiscardDialog(false);
                  if (pendingConversationSwitch) {
                    captureEvent('conversation_selected');
                    setSelected(pendingConversationSwitch);
                    setMobileView('thread');
                    setPendingConversationSwitch(null);
                  }
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                {t('inbox.discard')}
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
