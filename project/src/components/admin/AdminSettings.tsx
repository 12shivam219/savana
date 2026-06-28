import { useEffect, useState } from 'react';
import { Save, Loader2, Settings, Globe, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToastStore } from '../../stores';
import { Button, Input, Card } from '../ui';

interface SiteSetting {
  id?: string;
  site_name: string;
  site_description: string;
  default_currency: string;
  default_country: string;
  tax_rate: number;
  free_shipping_threshold: number;
}

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SiteSetting>({
    site_name: 'SAVANA',
    site_description: 'Embrace Every Season in Style',
    default_currency: 'INR',
    default_country: 'India',
    tax_rate: 18.00,
    free_shipping_threshold: 999,
  });
  const { addToast } = useToastStore();

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('site_settings')
          .select('*')
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setSettings(data as SiteSetting);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        addToast({
          type: 'error',
          title: 'Error loading settings',
          message: 'Could not fetch site configuration from database.',
        });
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [addToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      let error;
      const payload = {
        site_name: settings.site_name,
        site_description: settings.site_description,
        default_currency: settings.default_currency,
        default_country: settings.default_country,
        tax_rate: Number(settings.tax_rate),
        free_shipping_threshold: Number(settings.free_shipping_threshold),
      };

      if (settings.id) {
        // Update existing row
        const { error: err } = await supabase
          .from('site_settings')
          .update(payload)
          .eq('id', settings.id);
        error = err;
      } else {
        // Insert new row
        const { data, error: err } = await supabase
          .from('site_settings')
          .insert([payload])
          .select()
          .single();
        error = err;
        if (data) {
          setSettings(data as SiteSetting);
        }
      }

      if (error) throw error;

      addToast({
        type: 'success',
        title: 'Settings updated',
        message: 'Global site configurations have been saved.',
      });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      addToast({
        type: 'error',
        title: 'Save failed',
        message: error.message || 'Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Settings</h1>
        <p className="text-neutral-500 mt-1">Configure global store constants, taxations, shipping, and SEO metadata.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-neutral-100 dark:border-neutral-800 pb-3 mb-2">
            <Settings className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white font-display">General Store Profile</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Site Brand Name"
              name="site_name"
              value={settings.site_name}
              onChange={handleInputChange}
              required
            />
            <Input
              label="Default Country Origin"
              name="default_country"
              value={settings.default_country}
              onChange={handleInputChange}
              required
            />
          </div>

          <div>
            <label className="label">Site Description / SEO Slogan</label>
            <textarea
              name="site_description"
              value={settings.site_description}
              onChange={handleInputChange}
              className="input min-h-[100px] resize-y"
              required
            />
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-neutral-100 dark:border-neutral-800 pb-3 mb-2">
            <Globe className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white font-display">Financials & Logistics</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Currency Code"
              name="default_currency"
              value={settings.default_currency}
              onChange={handleInputChange}
              required
            />
            <Input
              label="GST / Sales Tax Rate (%)"
              name="tax_rate"
              type="number"
              step="0.01"
              value={settings.tax_rate}
              onChange={handleInputChange}
              required
            />
            <Input
              label="Free Shipping Limit Amount"
              name="free_shipping_threshold"
              type="number"
              value={settings.free_shipping_threshold}
              onChange={handleInputChange}
              required
            />
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-neutral-100 dark:border-neutral-800 pb-3 mb-2">
            <ShieldCheck className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white font-display">System Integrity</h2>
          </div>
          <p className="text-sm text-neutral-500">
            Multi-tenant Row Level Security is currently active on the catalog. All writes and deletions are strictly monitored and isolated by tenant context.
          </p>
        </Card>

        <div className="flex justify-end pt-4">
          <Button type="submit" variant="primary" className="flex items-center gap-2" isLoading={saving}>
            <Save className="w-4 h-4" /> Save Store Settings
          </Button>
        </div>
      </form>
    </div>
  );
}
