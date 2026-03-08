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
import { OutboundCompose } from '@/components/outbound';
import { BOOKING_STATUS_STYLES as STATUS_COLORS, ELEVATION, SPACING } from '@/lib/design-tokens';

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
  const [showSendMessage, setShowSendMessage] = useState(false);
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
    <div className="min-h-screen bg-slate-50">
      {/* Sticky Header */}
      <div className={cn('sticky top-0 z-40 bg-white border-b border-slate-200', ELEVATION.card)}>
        <div className={SPACING.page}>
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.push('/customers')}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-lavender-400 to-lavender-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-serif font-semibold text-slate-900 truncate">
                {customer.name}
              </h1>
            </div>
            <div className="flex items-center gap-6 text-xs text-slate-600">
              {lastBooking && (
                <div className="text-center">
                  <p className="text-slate-400 mb-0.5">{t('customer_detail.last_visit')}</p>
                  <p className="font-medium">
                    {new Date(lastBooking.startTime).toLocaleDateString()}
                  </p>
                </div>
              )}
              <div className="text-center">
                <p className="text-slate-400 mb-0.5">{t('customer_detail.total_spent')}</p>
                <p className="font-medium text-sage-600">${Math.round(totalSpent)}</p>
              </div>
              <div className="text-center">
                <p className="text-slate-400 mb-0.5">{t('customer_detail.total_bookings')}</p>
                <p className="font-medium">{bookings.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Bar */}
        <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center gap-2 justify-end">
          <button
            onClick={() => setShowBookingForm(true)}
            className="flex items-center gap-1.5 bg-sage-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors active:scale-95 btn-press"
          >
            <Plus size={14} />{' '}
            {t('customer_detail.new_booking', { bookingEntity: pack.labels.booking })}
          </button>
          <button
            onClick={handleMessageCustomer}
            className="flex items-center gap-1.5 border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm hover:bg-slate-50 transition-colors active:scale-95 btn-press"
            data-testid="message-customer-btn"
          >
            <MessageSquare size={14} /> {t('customer_detail.message')}
          </button>
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm hover:bg-slate-50 transition-colors active:scale-95 btn-press"
          >
            <Pencil size={14} /> {t('customer_detail.edit_profile')}
          </button>
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className={cn('max-w-6xl mx-auto', SPACING.page)}>
        {/* Upcoming Bookings Card */}
        {upcomingBookings.length > 0 && (
          <div className={cn(ELEVATION.card, 'bg-white p-5 mb-6')}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 uppercase">
                {t('customer_detail.upcoming_section')}
              </h2>
              <span className="text-xs bg-sage-50 text-sage-700 px-2 py-1 rounded-full font-medium">
                {upcomingBookings.length}
              </span>
            </div>
            <div className="space-y-2">
              {upcomingBookings.slice(0, 3).map((b) => (
                <BookingRow key={b.id} booking={b} />
              ))}
            </div>
          </div>
        )}

        {/* Activity Timeline */}
        <div className={cn(ELEVATION.card, 'bg-white p-5 mb-6')}>
          <h2 className="text-sm font-semibold text-slate-900 uppercase mb-4">
            {t('customer_detail.timeline_tab')}
          </h2>
          <CustomerTimeline customerId={id as string} />
        </div>

        {/* Profile Details Card */}
        <div className={cn(ELEVATION.card, 'bg-white p-5 mb-6')}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase">
              {t('customer_detail.contact')}
            </h2>
            <button
              onClick={() => setEditing(true)}
              className="text-slate-400 hover:text-sage-600 transition-colors"
            >
              <Pencil size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {customer.name && (
              <div>
                <p className="text-xs text-slate-500 mb-1">{t('customer_detail.full_name')}</p>
                <p className="text-sm font-medium text-slate-900">{customer.name}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500 mb-1">{t('common.phone')}</p>
              <p className="text-sm font-medium text-slate-900">{customer.phone}</p>
            </div>
            {customer.email && (
              <div>
                <p className="text-xs text-slate-500 mb-1">{t('common.email')}</p>
                <p className="text-sm font-medium text-slate-900">{customer.email}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500 mb-1">{t('customer_detail.customer_since')}</p>
              <p className="text-sm font-medium text-slate-900">
                {new Date(customer.createdAt).toLocaleDateString()}
              </p>
            </div>
            {customer.customFields?.address && (
              <div className="col-span-2">
                <p className="text-xs text-slate-500 mb-1">{t('common.address')}</p>
                <p className="text-sm font-medium text-slate-900">
                  {customer.customFields.address}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Tags Card */}
        {customer.tags && customer.tags.length > 0 && (
          <div className={cn(ELEVATION.card, 'bg-white p-5 mb-6')}>
            <h3 className="text-sm font-semibold text-slate-900 uppercase mb-3">
              {t('customer_detail.tags')}
            </h3>
            <div className="flex flex-wrap gap-2">
              {(customer.tags || []).map((tag: string) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 text-xs bg-sage-50 text-sage-700 px-3 py-1.5 rounded-full"
                >
                  <Tag size={12} />
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="hover:text-red-500 transition-colors"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notes Section */}
        {customerNotes.length > 0 && (
          <div className={cn(ELEVATION.card, 'bg-white p-5 mb-6')}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 uppercase">
                {t('customer_detail.notes_tab')}
              </h2>
              <span className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-full font-medium">
                {customerNotes.length}
              </span>
            </div>
            <div className="space-y-3">
              {customerNotes.slice(0, 5).map((note) => (
                <div
                  key={note.id}
                  className="bg-amber-50 border border-amber-200 rounded-lg p-3"
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
            </div>
          </div>
        )}

        {/* Vertical Modules */}
        {(pack.slug === 'aesthetic' || pack.slug === 'dealership') && (
          <div className="mb-6">
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
              <div className={cn(ELEVATION.card, 'bg-white')} data-testid="vertical-content">
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
      </div>

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

      {showSendMessage && customer && (
        <OutboundCompose
          customerId={customer.id}
          customerName={customer.name}
          onSend={async (data) => {
            try {
              const result = await api.post<any>('/outbound/send-direct', {
                customerId: data.customerId,
                content: data.content,
              });
              toast('Message sent successfully');
              setShowSendMessage(false);
              if (result.conversationId) {
                router.push(`/inbox?conversationId=${result.conversationId}`);
              }
            } catch (e: any) {
              toast(e?.message || 'Failed to send message', 'error');
            }
          }}
          onClose={() => setShowSendMessage(false)}
        />
      )}
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
