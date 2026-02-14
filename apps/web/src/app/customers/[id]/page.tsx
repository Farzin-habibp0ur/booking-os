'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { usePack } from '@/lib/vertical-pack';
import { useI18n } from '@/lib/i18n';
import {
  ArrowLeft, Phone, Mail, Calendar, Tag, Pencil, X, Check, Plus,
  MessageSquare, Clock,
} from 'lucide-react';
import BookingFormModal from '@/components/booking-form-modal';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  CONFIRMED: { bg: 'bg-blue-100', text: 'text-blue-700' },
  IN_PROGRESS: { bg: 'bg-purple-100', text: 'text-purple-700' },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-700' },
  NO_SHOW: { bg: 'bg-red-100', text: 'text-red-700' },
  CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-700' },
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
  const [tab, setTab] = useState<'bookings' | 'info'>('bookings');

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

  useEffect(() => { loadCustomer(); }, [id]);

  const saveEdit = async () => {
    await api.patch(`/customers/${id}`, {
      name: editName,
      email: editEmail || undefined,
      tags: editTags.split(',').map((t: string) => t.trim()).filter(Boolean),
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

  if (loading) return <div className="p-6 flex items-center justify-center h-64"><p className="text-gray-400">{t('common.loading')}</p></div>;
  if (!customer) return <div className="p-6"><p className="text-red-500">{t('errors.not_found')}</p></div>;

  const upcomingBookings = bookings.filter((b) => new Date(b.startTime) >= new Date() && !['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(b.status));
  const pastBookings = bookings.filter((b) => new Date(b.startTime) < new Date() || ['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(b.status));
  const totalSpent = bookings.filter((b) => b.status === 'COMPLETED').reduce((sum, b) => sum + (b.service?.price || 0), 0);
  const noShows = bookings.filter((b) => b.status === 'NO_SHOW').length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/customers')} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{customer.name}</h1>
          <p className="text-sm text-gray-500">{t('customer_detail.since', { entity: pack.labels.customer, date: new Date(customer.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) })}</p>
        </div>
        <button onClick={() => setShowBookingForm(true)} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-2 rounded-md text-sm hover:bg-blue-700">
          <Plus size={14} /> {t('customer_detail.new_booking', { bookingEntity: pack.labels.booking })}
        </button>
        <button onClick={() => setEditing(true)} className="flex items-center gap-1 border px-3 py-2 rounded-md text-sm hover:bg-gray-50">
          <Pencil size={14} /> {t('customer_detail.edit')}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left Column: Profile + Stats */}
        <div className="space-y-4">
          {/* Contact Info */}
          <div className="bg-white border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase">{t('customer_detail.contact')}</h3>
            <div className="flex items-center gap-2 text-sm">
              <Phone size={14} className="text-gray-400" />
              <span>{customer.phone}</span>
            </div>
            {customer.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail size={14} className="text-gray-400" />
                <span>{customer.email}</span>
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="bg-white border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">{t('customer_detail.tags')}</h3>
            <div className="flex flex-wrap gap-1.5">
              {(customer.tags || []).map((t: string) => (
                <span key={t} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                  {t}
                  <button onClick={() => removeTag(t)} className="hover:text-red-500"><X size={10} /></button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(newTag); } }}
                  placeholder={t('customer_detail.add_tag_placeholder')}
                  className="text-xs border rounded px-2 py-0.5 w-20 focus:w-32 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-white border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">{t('customer_detail.summary')}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xl font-bold">{bookings.length}</p>
                <p className="text-xs text-gray-500">{t('customer_detail.total_bookings')}</p>
              </div>
              <div>
                <p className="text-xl font-bold text-green-600">${Math.round(totalSpent)}</p>
                <p className="text-xs text-gray-500">{t('customer_detail.total_spent')}</p>
              </div>
              <div>
                <p className="text-xl font-bold">{upcomingBookings.length}</p>
                <p className="text-xs text-gray-500">{t('customer_detail.upcoming')}</p>
              </div>
              <div>
                <p className={cn('text-xl font-bold', noShows > 0 ? 'text-red-600' : '')}>{noShows}</p>
                <p className="text-xs text-gray-500">{t('customer_detail.no_shows')}</p>
              </div>
            </div>
          </div>

          {/* Custom Fields — uses pack field definitions for labels + types */}
          {(pack.customerFields.length > 0 || (customer.customFields && Object.keys(customer.customFields).length > 0)) && (
            <div className="bg-white border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
                {t('customer_detail.custom_fields')}
              </h3>
              <div className="space-y-2">
                {pack.customerFields.length > 0
                  ? pack.customerFields.map((field) => {
                      const val = customer.customFields?.[field.key];
                      return (
                        <div key={field.key} className="flex justify-between text-sm">
                          <span className="text-gray-500">{field.label}</span>
                          <span className="font-medium">
                            {field.type === 'boolean'
                              ? (val ? t('common.yes') : t('common.no'))
                              : val || '—'}
                          </span>
                        </div>
                      );
                    })
                  : Object.entries(customer.customFields || {}).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-500">{key}</span>
                        <span className="font-medium">{String(value)}</span>
                      </div>
                    ))
                }
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Bookings */}
        <div className="col-span-2">
          <div className="bg-white border rounded-lg">
            <div className="flex items-center gap-4 p-4 border-b">
              <button onClick={() => setTab('bookings')} className={cn('text-sm font-medium pb-1', tab === 'bookings' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500')}>
                {t('customer_detail.bookings_tab', { count: bookings.length })}
              </button>
              <button onClick={() => setTab('info')} className={cn('text-sm font-medium pb-1', tab === 'info' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500')}>
                {t('customer_detail.details_tab')}
              </button>
            </div>

            {tab === 'bookings' && (
              <div className="p-4">
                {/* Upcoming */}
                {upcomingBookings.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">{t('customer_detail.upcoming_section')}</h4>
                    <div className="space-y-2">
                      {upcomingBookings.map((b) => (
                        <BookingRow key={b.id} booking={b} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Past */}
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">{t('customer_detail.history_section')}</h4>
                  {pastBookings.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">{t('customer_detail.no_booking_history')}</p>
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

            {tab === 'info' && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{t('customer_detail.full_name')}</p>
                    <p className="text-sm font-medium">{customer.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{t('common.phone')}</p>
                    <p className="text-sm font-medium">{customer.phone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{t('common.email')}</p>
                    <p className="text-sm font-medium">{customer.email || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{t('customer_detail.customer_since')}</p>
                    <p className="text-sm font-medium">{new Date(customer.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t('common.tags')}</p>
                  <div className="flex flex-wrap gap-1">
                    {(customer.tags || []).length > 0 ? customer.tags.map((t: string) => (
                      <span key={t} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{t}</span>
                    )) : <span className="text-sm text-gray-400">{t('customer_detail.no_tags')}</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">{t('customer_detail.edit_title', { entity: pack.labels.customer })}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">{t('customer_detail.name_label')}</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('customer_detail.email_label')}</label>
                <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} type="email" className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('customer_detail.tags_label')}</label>
                <input value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder={t('customer_detail.tags_placeholder')} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              {pack.customerFields.length > 0 && (
                <div className="border-t pt-3 mt-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{t('customer_detail.fields_label', { entity: pack.labels.customer })}</p>
                  <div className="space-y-2">
                    {pack.customerFields.map((field) => (
                      <div key={field.key}>
                        <label className="block text-sm font-medium mb-1">{field.label}</label>
                        {field.type === 'boolean' ? (
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={!!editCustomFields[field.key]}
                              onChange={(e) => setEditCustomFields({ ...editCustomFields, [field.key]: e.target.checked })}
                            />
                            {field.label}
                          </label>
                        ) : field.type === 'select' && field.options ? (
                          <select
                            value={editCustomFields[field.key] || ''}
                            onChange={(e) => setEditCustomFields({ ...editCustomFields, [field.key]: e.target.value })}
                            className="w-full border rounded px-3 py-2 text-sm"
                          >
                            <option value="">{t('customer_detail.select_placeholder')}</option>
                            {field.options.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            value={editCustomFields[field.key] || ''}
                            onChange={(e) => setEditCustomFields({ ...editCustomFields, [field.key]: e.target.value })}
                            className="w-full border rounded px-3 py-2 text-sm"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setEditing(false)} className="px-4 py-2 border rounded text-sm">{t('common.cancel')}</button>
                <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">{t('common.save')}</button>
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
        onCreated={() => { setShowBookingForm(false); loadCustomer(); }}
      />
    </div>
  );
}

function BookingRow({ booking: b }: { booking: any }) {
  const { t } = useI18n();
  const sc = STATUS_COLORS[b.status] || { bg: 'bg-gray-100', text: 'text-gray-700' };

  const getStatusLabel = (status: string) => {
    const statusKey = status.toLowerCase().replace('_', '_');
    return t(`status.${statusKey}` as any);
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
      <div className="flex items-center gap-3">
        <div className="text-center min-w-[64px]">
          <p className="text-xs text-gray-500">{new Date(b.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
          <p className="text-sm font-bold">{new Date(b.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
        </div>
        <div>
          <p className="text-sm font-medium">{b.service?.name}</p>
          <p className="text-xs text-gray-500">
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
