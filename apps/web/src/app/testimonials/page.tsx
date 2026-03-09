'use client';

import { useEffect, useState, useCallback } from 'react';
import { MessageSquareQuote, Send, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/lib/toast';
import { TestimonialCard, type Testimonial } from '@/components/testimonial-card';
import { Skeleton, EmptyState } from '@/components/skeleton';

const STATUS_TABS = ['All', 'PENDING', 'APPROVED', 'FEATURED', 'REJECTED'] as const;
const TAB_LABELS: Record<string, string> = {
  All: 'All',
  PENDING: 'Pending',
  APPROVED: 'Approved',
  FEATURED: 'Featured',
  REJECTED: 'Rejected',
};

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone: string;
}

export default function TestimonialsPage() {
  const { t } = useI18n();
  const { toast } = useToast();

  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('All');
  const [total, setTotal] = useState(0);

  // Request modal
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [sending, setSending] = useState(false);

  const fetchTestimonials = useCallback(async () => {
    setLoading(true);
    try {
      const params = activeTab !== 'All' ? `?status=${activeTab}` : '';
      const res = await api.get<{ data: Testimonial[]; total: number }>(`/testimonials${params}`);
      setTestimonials(res.data);
      setTotal(res.total);
    } catch {
      toast('Failed to load testimonials', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, toast]);

  useEffect(() => {
    fetchTestimonials();
  }, [fetchTestimonials]);

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/testimonials/${id}/approve`, {});
      toast('Testimonial approved', 'success');
      fetchTestimonials();
    } catch {
      toast('Failed to approve', 'error');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.post(`/testimonials/${id}/reject`, {});
      toast('Testimonial rejected', 'success');
      fetchTestimonials();
    } catch {
      toast('Failed to reject', 'error');
    }
  };

  const handleFeature = async (id: string) => {
    try {
      await api.post(`/testimonials/${id}/feature`, {});
      toast('Testimonial featured', 'success');
      fetchTestimonials();
    } catch {
      toast('Failed to feature', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.del(`/testimonials/${id}`);
      toast('Testimonial deleted', 'success');
      fetchTestimonials();
    } catch {
      toast('Failed to delete', 'error');
    }
  };

  const openRequestModal = async () => {
    setShowRequestModal(true);
    setSelectedCustomer(null);
    setCustomerSearch('');
    try {
      const res = await api.get<{ data: Customer[] }>('/customers?take=50');
      setCustomers(res.data);
    } catch {
      setCustomers([]);
    }
  };

  const handleSendRequest = async () => {
    if (!selectedCustomer) return;
    setSending(true);
    try {
      await api.post('/testimonials/request', { customerId: selectedCustomer.id });
      toast('Testimonial request sent!', 'success');
      setShowRequestModal(false);
      fetchTestimonials();
    } catch {
      toast('Failed to send request', 'error');
    } finally {
      setSending(false);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(customerSearch.toLowerCase())),
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MessageSquareQuote size={24} className="text-sage-600" />
          <h1 className="text-2xl font-serif font-semibold text-slate-900">Testimonials</h1>
          {!loading && <span className="text-sm text-slate-400">({total})</span>}
        </div>
        <button
          onClick={openRequestModal}
          className="flex items-center gap-2 bg-lavender-600 hover:bg-lavender-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          data-testid="btn-request-testimonial"
        >
          <Send size={14} />
          Request Testimonial
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 mb-6" data-testid="status-tabs">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            data-testid={`tab-${tab.toLowerCase()}`}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-sage-100 text-sage-800'
                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl shadow-soft p-5 bg-white space-y-3">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : testimonials.length === 0 ? (
        <EmptyState
          title="No testimonials yet"
          description="Request testimonials from your customers to showcase their experience."
        />
      ) : (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          data-testid="testimonials-grid"
        >
          {testimonials.map((t) => (
            <TestimonialCard
              key={t.id}
              testimonial={t}
              onApprove={handleApprove}
              onReject={handleReject}
              onFeature={handleFeature}
              onDelete={handleDelete}
              showActions
            />
          ))}
        </div>
      )}

      {/* Request Modal */}
      {showRequestModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          data-testid="request-modal"
        >
          <div className="bg-white rounded-2xl shadow-soft p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Request Testimonial</h2>

            {/* Customer search */}
            <div className="relative mb-3">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search customers..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border-transparent rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-sage-500 outline-none"
                data-testid="customer-search"
              />
            </div>

            {/* Customer list */}
            <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-xl mb-4">
              {filteredCustomers.length === 0 ? (
                <p className="text-sm text-slate-400 p-3 text-center">No customers found</p>
              ) : (
                filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCustomer(c)}
                    data-testid={`customer-option-${c.id}`}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                      selectedCustomer?.id === c.id ? 'bg-sage-50 text-sage-800' : 'text-slate-700'
                    }`}
                  >
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-slate-400">{c.email || c.phone}</p>
                  </button>
                ))
              )}
            </div>

            {/* Preview */}
            {selectedCustomer && (
              <div className="bg-lavender-50 rounded-xl p-3 mb-4" data-testid="email-preview">
                <p className="text-xs font-medium text-lavender-700 mb-1">Email Preview</p>
                <p className="text-xs text-lavender-600">
                  Hi {selectedCustomer.name}, we&apos;d love to hear your feedback! Please take a
                  moment to share your experience with us.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowRequestModal(false)}
                className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-xl text-sm hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendRequest}
                disabled={!selectedCustomer || sending}
                className="flex-1 bg-lavender-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-lavender-700 transition-colors disabled:opacity-50"
                data-testid="btn-send-request"
              >
                {sending ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
