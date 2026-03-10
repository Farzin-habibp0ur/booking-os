'use client';

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Upload, Palette, Type, Eye, Loader2, Check } from 'lucide-react';

interface Branding {
  logoUrl: string | null;
  brandPrimaryColor: string;
  brandTagline: string;
  brandFaviconUrl: string | null;
}

export default function BrandingPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [color, setColor] = useState('#71907C');
  const [tagline, setTagline] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [businessName, setBusinessName] = useState('');

  useEffect(() => {
    api.get<Branding>('/business/branding').then((b) => {
      setBranding(b);
      setColor(b.brandPrimaryColor || '#71907C');
      setTagline(b.brandTagline || '');
      if (b.logoUrl) setLogoPreview(`/api/v1/uploads/${b.logoUrl}`);
    });
    api.get<any>('/business').then((b) => setBusinessName(b.name || 'Your Business'));
  }, []);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) {
      toast('Logo must be PNG, JPG, or SVG', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast('Logo must be under 2MB', 'error');
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('brandPrimaryColor', color);
      formData.append('brandTagline', tagline);
      if (logoFile) formData.append('logo', logoFile);

      await api.patchFormData('/business/branding', formData);
      setSaved(true);
      toast('Branding updated. Your portal now shows your brand.');
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      toast(err.message || 'Failed to update branding', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!branding) {
    return (
      <div className="p-6 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-100 rounded w-48" />
          <div className="h-64 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-serif font-semibold text-slate-900 mb-6">Branding</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="bg-white rounded-2xl shadow-soft p-6 space-y-6">
          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Upload size={14} className="inline mr-1" />
              Logo
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 hover:border-sage-500 rounded-xl p-6 text-center cursor-pointer transition-colors"
              data-testid="logo-dropzone"
            >
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="mx-auto max-h-24 object-contain"
                  data-testid="logo-preview"
                />
              ) : (
                <div className="text-slate-400">
                  <Upload size={24} className="mx-auto mb-2" />
                  <p className="text-sm">Click to upload logo</p>
                  <p className="text-xs mt-1">PNG, JPG, or SVG (max 2MB)</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              onChange={handleLogoSelect}
              className="hidden"
              data-testid="logo-input"
            />
          </div>

          {/* Primary Color */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Palette size={14} className="inline mr-1" />
              Primary Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer"
                data-testid="color-picker"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) setColor(val);
                }}
                className="flex-1 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm font-mono"
                maxLength={7}
                data-testid="color-input"
              />
            </div>
          </div>

          {/* Tagline */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Type size={14} className="inline mr-1" />
              Tagline
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value.slice(0, 120))}
              placeholder="e.g. Where beauty meets confidence"
              className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
              maxLength={120}
              data-testid="tagline-input"
            />
            <p className="text-xs text-slate-400 mt-1 text-right">{tagline.length}/120</p>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-sage-600 text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-sage-700 disabled:opacity-50 transition-colors"
            data-testid="save-branding"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : saved ? (
              <Check size={16} />
            ) : null}
            {saved ? 'Saved' : 'Save Branding'}
          </button>
        </div>

        {/* Live Preview */}
        <div>
          <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
            <Eye size={14} />
            Portal Preview
          </h3>
          <div
            className="bg-white rounded-2xl shadow-soft overflow-hidden"
            data-testid="brand-preview"
          >
            <div className="p-6 text-center" style={{ backgroundColor: `${color}10` }}>
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="mx-auto h-12 object-contain mb-3" />
              ) : (
                <h2 className="text-xl font-serif font-semibold" style={{ color }}>
                  {businessName}
                </h2>
              )}
              {tagline && <p className="text-sm text-slate-500 mt-1">{tagline}</p>}
            </div>
            <div className="p-4 space-y-3">
              <div className="h-8 bg-slate-100 rounded-lg" />
              <div className="h-8 bg-slate-100 rounded-lg w-3/4" />
              <button
                className="w-full rounded-xl py-2.5 text-white text-sm font-medium"
                style={{ backgroundColor: color }}
              >
                Book Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
