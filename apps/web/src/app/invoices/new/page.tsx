'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  serviceId?: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export default function NewInvoicePage() {
  return (
    <Suspense>
      <NewInvoiceContent />
    </Suspense>
  );
}

function NewInvoiceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  const quoteId = searchParams.get('quoteId');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0 },
  ]);
  const [taxRate, setTaxRate] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Default due date: 30 days from now
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setDueDate(d.toISOString().split('T')[0]);

    loadCustomers();
  }, []);

  useEffect(() => {
    if (bookingId) createFromBooking();
    else if (quoteId) createFromQuote();
  }, [bookingId, quoteId]);

  const loadCustomers = async () => {
    try {
      const res = await api.get<{ data: Customer[] }>('/customers?take=200');
      setCustomers(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const createFromBooking = async () => {
    setSubmitting(true);
    try {
      const inv = await api.post(`/invoices/from-booking/${bookingId}`, {});
      router.replace(`/invoices/${(inv as any).id}`);
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  const createFromQuote = async () => {
    setSubmitting(true);
    try {
      const inv = await api.post(`/invoices/from-quote/${quoteId}`, {});
      router.replace(`/invoices/${(inv as any).id}`);
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems];
    (updated[index] as any)[field] = value;
    setLineItems(updated);
  };

  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
  const discount = parseFloat(discountAmount) || 0;
  const taxRateNum = parseFloat(taxRate) || 0;
  const taxAmt = (subtotal - discount) * (taxRateNum / 100);
  const total = subtotal - discount + taxAmt;

  const handleSubmit = async () => {
    if (!customerId) {
      setError('Select a customer');
      return;
    }
    if (lineItems.some((li) => !li.description || li.unitPrice <= 0)) {
      setError('Fill in all line items');
      return;
    }
    if (!dueDate) {
      setError('Set a due date');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const inv = await api.post('/invoices', {
        customerId,
        lineItems: lineItems.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          serviceId: li.serviceId,
        })),
        taxRate: taxRateNum ? taxRateNum / 100 : undefined,
        discountAmount: discount || undefined,
        dueDate: new Date(dueDate).toISOString(),
        notes: notes || undefined,
        terms: terms || undefined,
      });
      router.push(`/invoices/${(inv as any).id}`);
    } catch (e: any) {
      setError(e.message || 'Failed to create invoice');
      setSubmitting(false);
    }
  };

  const filteredCustomers = customerSearch
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
          c.email?.toLowerCase().includes(customerSearch.toLowerCase()),
      )
    : customers;

  if (bookingId || quoteId) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <p className="text-sm text-slate-500">
          {submitting ? 'Creating invoice...' : error || 'Redirecting...'}
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-auto">
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/invoices')}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={18} className="text-slate-600" />
          </button>
          <h1 className="text-xl font-serif font-semibold text-slate-900">New Invoice</h1>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-xs px-4 py-2 rounded-xl">{error}</div>
        )}

        {/* Customer selector */}
        <div className="bg-white rounded-2xl shadow-soft p-5">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-2">
            Customer
          </label>
          <input
            type="text"
            placeholder="Search customers..."
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm p-2.5 mb-2"
          />
          {!customerId && (
            <div className="max-h-40 overflow-auto space-y-1">
              {filteredCustomers.slice(0, 10).map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setCustomerId(c.id);
                    setCustomerSearch(c.name);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <span className="font-medium text-slate-900">{c.name}</span>
                  {c.email && <span className="text-xs text-slate-400 ml-2">{c.email}</span>}
                </button>
              ))}
            </div>
          )}
          {customerId && (
            <div className="flex items-center justify-between bg-sage-50 rounded-xl px-3 py-2">
              <span className="text-sm text-sage-800">{customerSearch}</span>
              <button
                onClick={() => {
                  setCustomerId('');
                  setCustomerSearch('');
                }}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Change
              </button>
            </div>
          )}
        </div>

        {/* Line items */}
        <div className="bg-white rounded-2xl shadow-soft p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Line Items
            </h3>
            <button
              onClick={addLineItem}
              className="flex items-center gap-1 text-xs text-sage-600 hover:text-sage-700"
            >
              <Plus size={14} />
              Add Item
            </button>
          </div>
          <div className="space-y-3">
            {lineItems.map((li, i) => (
              <div key={i} className="flex items-start gap-2">
                <input
                  type="text"
                  placeholder="Description"
                  value={li.description}
                  onChange={(e) => updateLineItem(i, 'description', e.target.value)}
                  className="flex-1 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm p-2.5"
                />
                <input
                  type="number"
                  min="1"
                  value={li.quantity}
                  onChange={(e) => updateLineItem(i, 'quantity', parseInt(e.target.value) || 1)}
                  className="w-16 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm p-2.5 text-center"
                  aria-label="Quantity"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Price"
                  value={li.unitPrice || ''}
                  onChange={(e) => updateLineItem(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                  className="w-24 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm p-2.5 text-right"
                  aria-label="Unit price"
                />
                <span className="w-20 text-sm text-right py-2.5 text-slate-600">
                  ${(li.quantity * li.unitPrice).toFixed(2)}
                </span>
                <button
                  onClick={() => removeLineItem(i)}
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  disabled={lineItems.length <= 1}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Tax, discount, due date */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl shadow-soft p-5">
            <label className="text-xs text-slate-500 block mb-1">Tax Rate (%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              placeholder="0"
              className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm p-2.5"
            />
          </div>
          <div className="bg-white rounded-2xl shadow-soft p-5">
            <label className="text-xs text-slate-500 block mb-1">Discount ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm p-2.5"
            />
          </div>
          <div className="bg-white rounded-2xl shadow-soft p-5">
            <label className="text-xs text-slate-500 block mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm p-2.5"
            />
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-2xl shadow-soft p-5 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Discount</span>
              <span className="text-red-600">-${discount.toFixed(2)}</span>
            </div>
          )}
          {taxAmt > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Tax ({taxRateNum}%)</span>
              <span>${taxAmt.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold pt-2 border-t border-slate-100">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Notes & Terms */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow-soft p-5">
            <label className="text-xs text-slate-500 block mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm p-2.5 resize-none"
              placeholder="Additional notes for the customer..."
            />
          </div>
          <div className="bg-white rounded-2xl shadow-soft p-5">
            <label className="text-xs text-slate-500 block mb-1">Terms (optional)</label>
            <textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              rows={3}
              className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm p-2.5 resize-none"
              placeholder="Payment terms..."
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pb-6">
          <button
            onClick={() => router.push('/invoices')}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2 text-sm bg-sage-600 hover:bg-sage-700 text-white rounded-xl transition-colors disabled:opacity-50 btn-press"
          >
            {submitting ? 'Creating...' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}
