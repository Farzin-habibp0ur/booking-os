'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { usePack } from '@/lib/vertical-pack';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/lib/toast';
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  Tag,
  Pencil,
  X,
  Check,
  Plus,
  MessageSquare,
  Clock,
  Sparkles,
  Send,
  Loader2,
  User,
  MapPin,
  StickyNote,
  Trash2,
  Activity,
  ChevronDown,
  DollarSign,
} from 'lucide-react';
import BookingFormModal from '@/components/booking-form-modal';
import CustomerTimeline from '@/components/customer-timeline';
import IntakeCard from '@/components/intake-card';
import { RecentChangesPanel } from '@/components/action-history';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: 'bg-lavender-50', text: 'text-lavender-900' },
  PENDING_DEPOSIT: { bg: 'bg-amber-50', text: 'text-amber-700' },
  CONFIRMED: { bg: 'bg-sage-50', text: 'text-sage-900' },
  IN_PROGRESS: { bg: 'bg-amber-50', text: 'text-amber-700' },
  COMPLETED: { bg: 'bg-sage-50', text: 'text-sage-900' },
  NO_SHOW: { bg: 'bg-red-50', text: 'text-red-700' },
  CANCELLED: { bg: 'bg-slate-100', text: 'text-slate-600' },
};

export default function CustomerDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const pack = usePack();
  const { t } = useI18n();
  const [customer, setCustomer] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editCustomFields, setEditCustomFields] = useState<Record<string, any>>({});
  const [newTag, setNewTag] = useState('');
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [tab, setTab] = useState<'chat' | 'timeline' | 'bookings' | 'notes' | 'info'>('chat');
  const { toast } = useToast();

  // Notes state
  const [customerNotes, setCustomerNotes] = useState<any[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  // Conversations state
  const [conversations, setConversations] = useState<any[]>([]);

  // Waitlist state
  const [waitlistCount, setWaitlistCount] = useState(0);

  // Vertical modules state
  const [verticalOpen, setVerticalOpen] = useState(true);

  // Action history state
  const [recentChanges, setRecentChanges] = useState<any[]>([]);

  // AI Chat state
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'ai'; text: string }>>(
    [],
  );
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadCustomer = async () => {
    try {
      const [cust, bkgs, convs, notes, wlEntries, changes] = await Promise.all([
        api.get<any>(`/customers/${id}`),
        api.get<any[]>(`/customers/${id}/bookings`),
        api
          .get<any>(`/conversations?search=&pageSize=50`)
          .then((res: any) => {
            // Filter conversations for this customer client-side
            const data = res?.data || res || [];
            return Array.isArray(data) ? data.filter((c: any) => c.customerId === id) : [];
          })
          .catch(() => []),
        api.get<any[]>(`/customers/${id}/notes`).catch(() => []),
        api
          .get<any[]>('/waitlist')
          .then((entries: any[]) =>
            Array.isArray(entries)
              ? entries.filter((e: any) => e.customer?.id === id && e.status === 'ACTIVE')
              : [],
          )
          .catch(() => []),
        api.get<any[]>(`/action-history/entity/CUSTOMER/${id}`).catch(() => []),
      ]);
      setCustomer(cust);
      setBookings(bkgs || []);
      setConversations(convs || []);
      setCustomerNotes(notes || []);
      setWaitlistCount((wlEntries || []).length);
      setRecentChanges(changes || []);
      setEditName(cust.name);
      setEditEmail(cust.email || '');
      setEditTags((cust.tags || []).join(', '));
      setEditCustomFields(cust.customFields || {});
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCustomer();
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const saveEdit = async () => {
    await api.patch(`/customers/${id}`, {
      name: editName,
      email: editEmail || undefined,
      tags: editTags
        .split(',')
        .map((t: string) => t.trim())
        .filter(Boolean),
      ...(pack.customerFields.length > 0 ? { customFields: editCustomFields } : {}),
    });
    setEditing(false);
    loadCustomer();
  };

  const addTag = async (tag: string) => {
    if (!tag || !customer) return;
    const newTags = [...(customer.tags || []), tag];
    await api.patch(`/customers/${id}`, { tags: newTags });
    setNewTag('');
    loadCustomer();
  };

  const removeTag = async (tag: string) => {
    if (!customer) return;
    const newTags = (customer.tags || []).filter((t: string) => t !== tag);
    await api.patch(`/customers/${id}`, { tags: newTags });
    loadCustomer();
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const question = chatInput;
    setChatMessages((prev) => [...prev, { role: 'user', text: question }]);
    setChatInput('');
    setChatLoading(true);
    try {
      const { answer } = await api.post<{ answer: string }>(`/ai/customers/${id}/chat`, {
        question,
      });
      setChatMessages((prev) => [...prev, { role: 'ai', text: answer }]);
    } catch (e) {
      setChatMessages((prev) => [...prev, { role: 'ai', text: t('customer_detail.chat_error') }]);
    }
    setChatLoading(false);
  };

  const handlePromptChip = (prompt: string) => {
    setChatInput(prompt);
  };

  const createNote = async () => {
    if (!newNoteContent.trim() || noteSaving) return;
    setNoteSaving(true);
    try {
      await api.post(`/customers/${id}/notes`, { content: newNoteContent });
      setNewNoteContent('');
      toast(t('customer_detail.note_created'));
      const notes = await api.get<any[]>(`/customers/${id}/notes`);
      setCustomerNotes(notes || []);
    } catch (e: any) {
      toast(e?.message || t('customer_detail.note_create_error'), 'error');
    }
    setNoteSaving(false);
  };

  const updateNote = async (noteId: string) => {
    if (!editingNoteContent.trim() || noteSaving) return;
    setNoteSaving(true);
    try {
      await api.patch(`/customers/${id}/notes/${noteId}`, { content: editingNoteContent });
      setEditingNoteId(null);
      setEditingNoteContent('');
      toast(t('customer_detail.note_updated'));
      const notes = await api.get<any[]>(`/customers/${id}/notes`);
      setCustomerNotes(notes || []);
    } catch (e: any) {
      toast(e?.message || t('customer_detail.note_update_error'), 'error');
    }
    setNoteSaving(false);
  };

  const deleteNote = async (noteId: string) => {
    try {
      await api.del(`/customers/${id}/notes/${noteId}`);
      toast(t('customer_detail.note_deleted'));
      setCustomerNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (e: any) {
      toast(e?.message || t('customer_detail.note_delete_error'), 'error');
    }
  };

  const handleMessageCustomer = () => {
    const latestConv = conversations[0];
    if (latestConv) {
      router.push(`/inbox?conversationId=${latestConv.id}`);
    } else {
      router.push('/inbox');
    }
  };

  if (loading)
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <p className="text-slate-400">{t('common.loading')}</p>
      </div>
    );
  if (!customer)
    return (
      <div className="p-6">
        <p className="text-red-500">{t('errors.not_found')}</p>
      </div>
    );

  const upcomingBookings = bookings.filter(
    (b) =>
      new Date(b.startTime) >= new Date() &&
      !['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(b.status),
  );
  const pastBookings = bookings.filter(
    (b) =>
      new Date(b.startTime) < new Date() ||
      ['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(b.status),
  );
  const totalSpent = bookings
    .filter((b) => b.status === 'COMPLETED')
    .reduce((sum, b) => sum + (b.service?.price || 0), 0);
  const noShows = bookings.filter((b) => b.status === 'NO_SHOW').length;
  const nextBooking = upcomingBookings[0];

  const lastBooking = pastBookings[0];
  const lastConversation = conversations[0];

  const promptChips = [
    t('customer_detail.chip_summarize'),
    t('customer_detail.chip_treatments'),
    t('customer_detail.chip_upcoming'),
    t('customer_detail.chip_allergies'),
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/customers')}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-serif font-semibold text-slate-900">{customer.name}</h1>
          <p className="text-sm text-slate-500">
            {t('customer_detail.since', {
              entity: pack.labels.customer,
              date: new Date(customer.createdAt).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              }),
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleMessageCustomer}
            className="flex items-center gap-1 border border-slate-200 text-slate-700 px-3 py-2 rounded-xl text-sm hover:bg-slate-50 transition-colors"
            data-testid="message-customer-btn"
          >
            <MessageSquare size={14} /> {t('customer_detail.message')}
          </button>
          <button
            onClick={() => setShowBookingForm(true)}
            className="flex items-center gap-1 bg-sage-600 text-white px-3 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors"
          >
            <Plus size={14} />{' '}
            {t('customer_detail.new_booking', { bookingEntity: pack.labels.booking })}
          </button>
        </div>
      </div>

      {/* Context Row */}
      <div className="flex items-center gap-4 mb-6 text-xs text-slate-500">
        {lastBooking && (
          <div className="flex items-center gap-1">
            <Calendar size={12} />
            <span data-testid="last-booking-date">
              {t('customer_detail.last_booking')}:{' '}
              {new Date(lastBooking.startTime).toLocaleDateString()}
            </span>
          </div>
        )}
        {lastConversation && (
          <div className="flex items-center gap-1">
            <MessageSquare size={12} />
            <span data-testid="last-conversation-date">
              {t('customer_detail.last_conversation')}:{' '}
              {new Date(
                lastConversation.lastMessageAt || lastConversation.createdAt,
              ).toLocaleDateString()}
            </span>
          </div>
        )}
        {conversations.length > 0 && (
          <div className="flex items-center gap-1">
            <span data-testid="conversation-count">
              {conversations.length} {t('customer_detail.conversations_count')}
            </span>
          </div>
        )}
        {waitlistCount > 0 && (
          <div className="flex items-center gap-1">
            <Clock size={12} />
            <span data-testid="waitlist-count">
              {waitlistCount} {t('customer_detail.on_waitlist')}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left Column (1/3): Compact Profile */}
        <div className="space-y-4">
          {/* Contact Info */}
          <div className="bg-white rounded-2xl shadow-soft p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-500 uppercase">
                {t('customer_detail.contact')}
              </h3>
              <button
                onClick={() => setEditing(true)}
                className="text-slate-400 hover:text-sage-600 transition-colors"
              >
                <Pencil size={14} />
              </button>
            </div>
            {customer.name && (
              <div className="flex items-center gap-2 text-sm">
                <User size={14} className="text-slate-400" />
                <span>{customer.name}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Phone size={14} className="text-slate-400" />
              <span>{customer.phone}</span>
            </div>
            {customer.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail size={14} className="text-slate-400" />
                <span>{customer.email}</span>
              </div>
            )}
            {customer.customFields?.address && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin size={14} className="text-slate-400" />
                <span>{customer.customFields.address}</span>
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="bg-white rounded-2xl shadow-soft p-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase mb-2">
              {t('customer_detail.tags')}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {(customer.tags || []).map((tag: string) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-xs bg-sage-50 text-sage-700 px-2 py-0.5 rounded-full"
                >
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-red-500">
                    <X size={10} />
                  </button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag(newTag);
                    }
                  }}
                  placeholder={t('customer_detail.add_tag_placeholder')}
                  className="text-xs border border-slate-200 rounded-xl px-2 py-0.5 w-20 focus:w-32 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-2xl shadow-soft p-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">
              {t('customer_detail.summary')}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xl font-serif font-bold">{bookings.length}</p>
                <p className="text-xs text-slate-500">{t('customer_detail.total_bookings')}</p>
              </div>
              <div>
                <p className="text-xl font-serif font-bold text-sage-600">
                  ${Math.round(totalSpent)}
                </p>
                <p className="text-xs text-slate-500">{t('customer_detail.total_spent')}</p>
              </div>
              <div>
                <p className="text-xl font-serif font-bold">{upcomingBookings.length}</p>
                <p className="text-xs text-slate-500">{t('customer_detail.upcoming')}</p>
              </div>
              <div>
                <p
                  className={cn('text-xl font-serif font-bold', noShows > 0 ? 'text-red-600' : '')}
                >
                  {noShows}
                </p>
                <p className="text-xs text-slate-500">{t('customer_detail.no_shows')}</p>
              </div>
            </div>
          </div>

          {/* Next Appointment */}
          {nextBooking && (
            <div className="bg-white rounded-2xl shadow-soft p-4">
              <h3 className="text-sm font-semibold text-slate-500 uppercase mb-2">
                {t('customer_detail.next_appointment')}
              </h3>
              <div className="flex items-center gap-3">
                <div className="text-center min-w-[48px]">
                  <p className="text-xs text-slate-500">
                    {new Date(nextBooking.startTime).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <p className="text-sm font-bold">
                    {new Date(nextBooking.startTime).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">{nextBooking.service?.name}</p>
                  <p className="text-xs text-slate-500">
                    {nextBooking.staff?.name || t('common.unassigned')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Recent Changes */}
          {recentChanges.length > 0 && (
            <RecentChangesPanel
              entries={recentChanges}
              entityType="CUSTOMER"
              entityId={id as string}
            />
          )}
        </div>

        {/* Right Column (2/3): AI Chat + Tabs */}
        <div className="col-span-2">
          <div
            className="bg-white rounded-2xl shadow-soft flex flex-col"
            style={{ height: 'calc(100vh - 180px)' }}
          >
            {/* Tabs */}
            <div className="flex items-center gap-4 p-4 border-b shrink-0">
              <button
                onClick={() => setTab('chat')}
                className={cn(
                  'flex items-center gap-1.5 text-sm font-medium pb-1 transition-colors',
                  tab === 'chat'
                    ? 'text-lavender-600 border-b-2 border-lavender-600'
                    : 'text-slate-500',
                )}
              >
                <Sparkles size={14} /> {t('customer_detail.ai_chat_tab')}
              </button>
              <button
                onClick={() => setTab('timeline')}
                className={cn(
                  'flex items-center gap-1.5 text-sm font-medium pb-1 transition-colors',
                  tab === 'timeline'
                    ? 'text-sage-600 border-b-2 border-sage-600'
                    : 'text-slate-500',
                )}
              >
                <Activity size={14} /> {t('customer_detail.timeline_tab')}
              </button>
              <button
                onClick={() => setTab('bookings')}
                className={cn(
                  'text-sm font-medium pb-1 transition-colors',
                  tab === 'bookings'
                    ? 'text-sage-600 border-b-2 border-sage-600'
                    : 'text-slate-500',
                )}
              >
                {t('customer_detail.bookings_tab', { count: bookings.length })}
              </button>
              <button
                onClick={() => setTab('notes')}
                className={cn(
                  'flex items-center gap-1.5 text-sm font-medium pb-1 transition-colors',
                  tab === 'notes' ? 'text-amber-600 border-b-2 border-amber-600' : 'text-slate-500',
                )}
              >
                <StickyNote size={14} /> {t('customer_detail.notes_tab')}{' '}
                {customerNotes.length > 0 && (
                  <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">
                    {customerNotes.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setTab('info')}
                className={cn(
                  'text-sm font-medium pb-1 transition-colors',
                  tab === 'info' ? 'text-sage-600 border-b-2 border-sage-600' : 'text-slate-500',
                )}
              >
                {t('customer_detail.details_tab')}
              </button>
            </div>

            {/* AI Chat Tab */}
            {tab === 'chat' && (
              <div className="flex flex-col flex-1 min-h-0">
                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {/* Welcome message */}
                  {chatMessages.length === 0 && (
                    <div className="flex justify-start">
                      <div className="max-w-[80%] bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-2.5">
                        <p className="text-sm text-slate-700">
                          {t('customer_detail.chat_welcome', { name: customer.name })}
                        </p>
                      </div>
                    </div>
                  )}

                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={cn(
                          'max-w-[80%] rounded-2xl px-4 py-2.5',
                          msg.role === 'user'
                            ? 'bg-sage-600 text-white rounded-tr-sm'
                            : 'bg-slate-100 text-slate-700 rounded-tl-sm',
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                      </div>
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-2.5">
                        <Loader2 size={16} className="animate-spin text-slate-400" />
                      </div>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                {/* Prompt chips */}
                {chatMessages.length === 0 && (
                  <div className="px-4 pb-2 flex flex-wrap gap-2">
                    {promptChips.map((chip) => (
                      <button
                        key={chip}
                        onClick={() => handlePromptChip(chip)}
                        className="text-xs bg-lavender-50 text-lavender-700 px-3 py-1.5 rounded-full hover:bg-lavender-100 transition-colors"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}

                {/* Chat input */}
                <div className="p-4 border-t shrink-0">
                  <div className="flex items-center gap-2">
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendChat();
                        }
                      }}
                      placeholder={t('customer_detail.chat_placeholder')}
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lavender-500 focus:border-transparent"
                      disabled={chatLoading}
                    />
                    <button
                      onClick={sendChat}
                      disabled={!chatInput.trim() || chatLoading}
                      className="bg-lavender-600 text-white p-2 rounded-xl hover:bg-lavender-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Bookings Tab */}
            {tab === 'bookings' && (
              <div className="p-4 flex-1 overflow-y-auto">
                {upcomingBookings.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-xs font-medium text-slate-500 uppercase mb-2">
                      {t('customer_detail.upcoming_section')}
                    </h4>
                    <div className="space-y-2">
                      {upcomingBookings.map((b) => (
                        <BookingRow key={b.id} booking={b} />
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-medium text-slate-500 uppercase mb-2">
                    {t('customer_detail.history_section')}
                  </h4>
                  {pastBookings.length === 0 ? (
                    <p className="text-sm text-slate-400 py-4 text-center">
                      {t('customer_detail.no_booking_history')}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {pastBookings.map((b) => (
                        <BookingRow key={b.id} booking={b} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Timeline Tab */}
            {tab === 'timeline' && <CustomerTimeline customerId={id as string} />}

            {/* Notes Tab */}
            {tab === 'notes' && (
              <div className="p-4 flex-1 overflow-y-auto">
                {/* Note Composer */}
                <div className="mb-4">
                  <textarea
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder={t('customer_detail.add_note_placeholder')}
                    rows={3}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    data-testid="note-composer"
                  />
                  <button
                    onClick={createNote}
                    disabled={!newNoteContent.trim() || noteSaving}
                    className="mt-1 bg-amber-500 text-white px-4 py-2 rounded-xl text-sm hover:bg-amber-600 disabled:opacity-50 transition-colors flex items-center gap-1"
                    data-testid="add-note-btn"
                  >
                    <StickyNote size={14} /> {t('customer_detail.add_note')}
                  </button>
                </div>

                {/* Note Cards */}
                <div className="space-y-3">
                  {customerNotes.map((note) => (
                    <div
                      key={note.id}
                      className="bg-amber-50 border border-amber-200 rounded-xl p-4"
                      data-testid="note-card"
                    >
                      {editingNoteId === note.id ? (
                        <div>
                          <textarea
                            value={editingNoteContent}
                            onChange={(e) => setEditingNoteContent(e.target.value)}
                            rows={3}
                            className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm resize-none"
                            data-testid="note-edit-textarea"
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => updateNote(note.id)}
                              disabled={noteSaving}
                              className="text-xs bg-amber-500 text-white px-3 py-1 rounded-lg hover:bg-amber-600 disabled:opacity-50"
                            >
                              {t('common.save')}
                            </button>
                            <button
                              onClick={() => {
                                setEditingNoteId(null);
                                setEditingNoteContent('');
                              }}
                              className="text-xs text-slate-500 px-3 py-1 rounded-lg hover:bg-slate-100"
                            >
                              {t('common.cancel')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-[10px] text-slate-400">
                              {note.staff?.name} · {new Date(note.createdAt).toLocaleString()}
                            </p>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingNoteId(note.id);
                                  setEditingNoteContent(note.content);
                                }}
                                className="text-slate-400 hover:text-amber-600 transition-colors"
                                data-testid="edit-note-btn"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={() => deleteNote(note.id)}
                                className="text-slate-400 hover:text-red-500 transition-colors"
                                data-testid="delete-note-btn"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {customerNotes.length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                      <StickyNote size={32} className="mx-auto mb-2 text-slate-300" />
                      <p className="text-sm">{t('customer_detail.no_notes')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Info Tab */}
            {tab === 'info' && (
              <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">{t('customer_detail.full_name')}</p>
                    <p className="text-sm font-medium">{customer.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">{t('common.phone')}</p>
                    <p className="text-sm font-medium">{customer.phone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">{t('common.email')}</p>
                    <p className="text-sm font-medium">{customer.email || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">
                      {t('customer_detail.customer_since')}
                    </p>
                    <p className="text-sm font-medium">
                      {new Date(customer.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">{t('common.tags')}</p>
                  <div className="flex flex-wrap gap-1">
                    {(customer.tags || []).length > 0 ? (
                      customer.tags.map((tag: string) => (
                        <span
                          key={tag}
                          className="text-xs bg-sage-50 text-sage-700 px-2 py-0.5 rounded-full"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">{t('customer_detail.no_tags')}</span>
                    )}
                  </div>
                </div>
                {/* Custom Fields */}
                {(pack.customerFields.length > 0 ||
                  (customer.customFields && Object.keys(customer.customFields).length > 0)) && (
                  <div>
                    <p className="text-xs text-slate-500 mb-2 font-semibold uppercase">
                      {t('customer_detail.custom_fields')}
                    </p>
                    <div className="space-y-2">
                      {pack.customerFields.length > 0
                        ? pack.customerFields.map((field) => {
                            const val = customer.customFields?.[field.key];
                            return (
                              <div key={field.key} className="flex justify-between text-sm">
                                <span className="text-slate-500">{field.label}</span>
                                <span className="font-medium">
                                  {field.type === 'boolean'
                                    ? val
                                      ? t('common.yes')
                                      : t('common.no')
                                    : val || '—'}
                                </span>
                              </div>
                            );
                          })
                        : Object.entries(customer.customFields || {}).map(([key, value]) => (
                            <div key={key} className="flex justify-between text-sm">
                              <span className="text-slate-500">{key}</span>
                              <span className="font-medium">{String(value)}</span>
                            </div>
                          ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Vertical Modules */}
      {(pack.slug === 'aesthetic' || pack.slug === 'dealership') && (
        <div className="mt-6" data-testid="vertical-modules">
          <button
            onClick={() => setVerticalOpen(!verticalOpen)}
            className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-500 uppercase hover:text-slate-700 transition-colors"
            data-testid="vertical-toggle"
          >
            <ChevronDown
              size={14}
              className={cn('transition-transform', verticalOpen ? '' : '-rotate-90')}
            />
            {pack.slug === 'aesthetic'
              ? t('customer_detail.clinic_intake')
              : t('customer_detail.quotes_summary')}
          </button>
          {verticalOpen && (
            <div className="bg-white rounded-2xl shadow-soft" data-testid="vertical-content">
              {pack.slug === 'aesthetic' && pack.customerFields.length > 0 && (
                <IntakeCard
                  customer={customer}
                  fields={pack.customerFields}
                  onUpdated={(updated) => {
                    setCustomer(updated);
                  }}
                />
              )}
              {pack.slug === 'dealership' && (
                <div className="p-5" data-testid="quotes-summary">
                  {(() => {
                    const allQuotes = bookings.flatMap((b: any) => b.quotes || []);
                    const pending = allQuotes.filter((q: any) => q.status === 'PENDING');
                    const approved = allQuotes.filter((q: any) => q.status === 'APPROVED');
                    const totalAmount = allQuotes.reduce(
                      (sum: number, q: any) => sum + (Number(q.totalAmount) || 0),
                      0,
                    );
                    return (
                      <div>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div className="bg-lavender-50 rounded-xl p-3 text-center">
                            <p className="text-2xl font-serif font-bold text-lavender-600">
                              {pending.length}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {t('customer_detail.pending_quotes')}
                            </p>
                          </div>
                          <div className="bg-sage-50 rounded-xl p-3 text-center">
                            <p className="text-2xl font-serif font-bold text-sage-600">
                              {approved.length}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {t('customer_detail.approved_quotes')}
                            </p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-3 text-center">
                            <p className="text-2xl font-serif font-bold text-slate-800">
                              ${Math.round(totalAmount).toLocaleString()}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {t('customer_detail.total_quoted')}
                            </p>
                          </div>
                        </div>
                        {allQuotes.length === 0 && (
                          <div className="text-center py-6">
                            <DollarSign size={28} className="mx-auto mb-2 text-slate-300" />
                            <p className="text-sm text-slate-400">
                              {t('customer_detail.no_quotes')}
                            </p>
                          </div>
                        )}
                        {allQuotes.length > 0 && (
                          <div className="space-y-2">
                            {allQuotes.slice(0, 5).map((q: any) => (
                              <div
                                key={q.id}
                                className="flex items-center justify-between text-sm p-3 rounded-xl bg-slate-50/80 hover:bg-slate-50 transition-colors"
                                data-testid="quote-row"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-lavender-50 flex items-center justify-center">
                                    <DollarSign size={14} className="text-lavender-600" />
                                  </div>
                                  <span className="font-medium">
                                    $
                                    {Number(q.totalAmount).toLocaleString(undefined, {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 0,
                                    })}
                                  </span>
                                </div>
                                <span
                                  className={cn(
                                    'text-[10px] px-2.5 py-1 rounded-full font-medium',
                                    q.status === 'APPROVED'
                                      ? 'bg-sage-50 text-sage-700'
                                      : q.status === 'PENDING'
                                        ? 'bg-lavender-50 text-lavender-700'
                                        : 'bg-slate-100 text-slate-600',
                                  )}
                                >
                                  {q.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-soft-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-serif font-semibold text-slate-900 mb-4">
              {t('customer_detail.edit_title', { entity: pack.labels.customer })}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('customer_detail.name_label')}
                </label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('customer_detail.email_label')}
                </label>
                <input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  type="email"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('customer_detail.tags_label')}
                </label>
                <input
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder={t('customer_detail.tags_placeholder')}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              {pack.customerFields.length > 0 && (
                <div className="border-t pt-3 mt-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
                    {t('customer_detail.fields_label', { entity: pack.labels.customer })}
                  </p>
                  <div className="space-y-2">
                    {pack.customerFields.map((field) => (
                      <div key={field.key}>
                        <label className="block text-sm font-medium mb-1">{field.label}</label>
                        {field.type === 'boolean' ? (
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={!!editCustomFields[field.key]}
                              onChange={(e) =>
                                setEditCustomFields({
                                  ...editCustomFields,
                                  [field.key]: e.target.checked,
                                })
                              }
                            />
                            {field.label}
                          </label>
                        ) : field.type === 'select' && field.options ? (
                          <select
                            value={editCustomFields[field.key] || ''}
                            onChange={(e) =>
                              setEditCustomFields({
                                ...editCustomFields,
                                [field.key]: e.target.value,
                              })
                            }
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                          >
                            <option value="">{t('customer_detail.select_placeholder')}</option>
                            {field.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            value={editCustomFields[field.key] || ''}
                            onChange={(e) =>
                              setEditCustomFields({
                                ...editCustomFields,
                                [field.key]: e.target.value,
                              })
                            }
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 border rounded-xl text-sm transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={saveEdit}
                  className="px-4 py-2 bg-sage-600 text-white rounded-xl text-sm hover:bg-sage-700 transition-colors"
                >
                  {t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BookingFormModal
        isOpen={showBookingForm}
        customerId={customer?.id}
        customerName={customer?.name}
        onClose={() => setShowBookingForm(false)}
        onCreated={() => {
          setShowBookingForm(false);
          loadCustomer();
        }}
      />
    </div>
  );
}

function BookingRow({ booking: b }: { booking: any }) {
  const { t } = useI18n();
  const sc = STATUS_COLORS[b.status] || { bg: 'bg-slate-100', text: 'text-slate-700' };

  const getStatusLabel = (status: string) => {
    const statusKey = status.toLowerCase().replace('_', '_');
    return t(`status.${statusKey}` as any);
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50/60 hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="text-center min-w-[64px]">
          <p className="text-xs text-slate-500">
            {new Date(b.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
          <p className="text-sm font-bold">
            {new Date(b.startTime).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium">{b.service?.name}</p>
          <p className="text-xs text-slate-500">
            {b.staff?.name || t('common.unassigned')}
            {b.service?.price > 0 ? ` · $${b.service.price}` : ''}
          </p>
        </div>
      </div>
      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', sc.bg, sc.text)}>
        {getStatusLabel(b.status)}
      </span>
    </div>
  );
}
