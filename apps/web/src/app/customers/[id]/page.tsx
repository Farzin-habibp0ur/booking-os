'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { usePack } from '@/lib/vertical-pack';
import { useI18n } from '@/lib/i18n';
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
} from 'lucide-react';
import BookingFormModal from '@/components/booking-form-modal';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: 'bg-lavender-50', text: 'text-lavender-900' },
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
  const [tab, setTab] = useState<'chat' | 'bookings' | 'info'>('chat');

  // AI Chat state
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'ai'; text: string }>>(
    [],
  );
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadCustomer = async () => {
    try {
      const [cust, bkgs] = await Promise.all([
        api.get<any>(`/customers/${id}`),
        api.get<any[]>(`/customers/${id}/bookings`),
      ]);
      setCustomer(cust);
      setBookings(bkgs || []);
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
        <button
          onClick={() => setShowBookingForm(true)}
          className="flex items-center gap-1 bg-sage-600 text-white px-3 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors"
        >
          <Plus size={14} />{' '}
          {t('customer_detail.new_booking', { bookingEntity: pack.labels.booking })}
        </button>
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
