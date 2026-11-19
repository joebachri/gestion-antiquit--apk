import { useEffect, useState } from 'react';
import {
  Calendar,
  Check,
  Edit3,
  ExternalLink,
  Facebook,
  FileSpreadsheet,
  Globe,
  Images,
  Instagram,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import type {
  Customer,
  CustomerGalleryPayload,
  CustomerPurchase,
  CustomerPurchasePayload,
  Language,
  Product,
  PurchasePaymentMethod,
} from '../types';
import { formatCurrency, formatNumber, translations } from '../i18n';
import { convertFromMad, convertToMad } from '../utils/currency';
import { getCustomerWhatsAppUrl, getPhoneTelHref } from '../utils/phone';
import {
  formatSocialDisplayLabel,
  getCustomerFacebookUrl,
  getCustomerInstagramUrl,
  getCustomerWebsiteUrl,
} from '../utils/socialLinks';
import { getCustomerCategoryLabel } from './CustomerFormModal';
import { CustomerGallerySection } from './CustomerGallerySection';

interface CustomerDetailModalProps {
  customer: Customer | null;
  lang: Language;
  currency: string;
  products: Product[];
  initialAddPurchase?: boolean;
  initialTab?: 'purchases' | 'gallery';
  onClose: () => void;
  onEditProfile: (customer: Customer) => void;
  onExportCustomerExcel: (customer: Customer) => void;
  onSavePurchase: (
    customerId: string,
    payload: CustomerPurchasePayload,
    editingPurchaseId?: string
  ) => Promise<void>;
  onDeletePurchase: (customerId: string, purchaseId: string) => Promise<void>;
  onSaveGalleryImages: (customerId: string, items: CustomerGalleryPayload[]) => Promise<void>;
  onDeleteGalleryImage: (customerId: string, imageId: string) => Promise<void>;
}

const PAYMENT_METHODS: PurchasePaymentMethod[] = ['cash', 'transfer', 'check', 'card', 'other'];

export function getPaymentMethodLabel(method: PurchasePaymentMethod, lang: Language): string {
  const t = translations[lang];
  if (method === 'cash') return t.paymentCash;
  if (method === 'transfer') return t.paymentTransfer;
  if (method === 'check') return t.paymentCheck;
  if (method === 'card') return t.paymentCard;
  return t.paymentOther;
}

export function CustomerDetailModal({
  customer,
  lang,
  currency,
  products,
  initialAddPurchase = false,
  initialTab = 'purchases',
  onClose,
  onEditProfile,
  onExportCustomerExcel,
  onSavePurchase,
  onDeletePurchase,
  onSaveGalleryImages,
  onDeleteGalleryImage,
}: CustomerDetailModalProps) {
  const t = translations[lang];
  const [activeSection, setActiveSection] = useState<'purchases' | 'gallery'>(initialTab);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<CustomerPurchase | null>(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productCode, setProductCode] = useState('');
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PurchasePaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pendingDeletePurchaseId, setPendingDeletePurchaseId] = useState<string | null>(null);

  const resetPurchaseForm = () => {
    setEditingPurchase(null);
    setSelectedProductId('');
    setProductCode('');
    setProductName('');
    setQuantity('1');
    setUnitPrice('');
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod('cash');
    setNotes('');
    setError('');
  };

  useEffect(() => {
    if (!customer) {
      setFormOpen(false);
      setPendingDeletePurchaseId(null);
      return;
    }
    setPendingDeletePurchaseId(null);
    resetPurchaseForm();
    const shouldOpenPurchase = Boolean(initialAddPurchase);
    setFormOpen(shouldOpenPurchase);
    setActiveSection(shouldOpenPurchase ? 'purchases' : initialTab);
  }, [customer?.id, initialAddPurchase, initialTab]);

  if (!customer) return null;

  const purchases = customer.purchases || [];
  const gallery = customer.gallery || [];
  const totalSpentMad = purchases.reduce((sum, p) => sum + (Number(p.totalPrice) || 0), 0);

  const handleSelectInventoryProduct = (prodId: string) => {
    setSelectedProductId(prodId);
    if (!prodId) return;
    const match = products.find((p) => p.id === prodId);
    if (!match) return;
    setProductCode(match.code);
    setProductName(match.name);
    setUnitPrice(String(convertFromMad(match.sellingPrice, currency)));
  };

  const handleStartEditPurchase = (purchase: CustomerPurchase) => {
    setEditingPurchase(purchase);
    setSelectedProductId(purchase.productId || '');
    setProductCode(purchase.productCode || '');
    setProductName(purchase.productName);
    setQuantity(String(purchase.quantity || 1));
    setUnitPrice(String(convertFromMad(purchase.unitPrice, currency)));
    setPurchaseDate(purchase.purchaseDate || new Date().toISOString().slice(0, 10));
    setPaymentMethod(purchase.paymentMethod || 'cash');
    setNotes(purchase.notes || '');
    setError('');
    setFormOpen(true);
  };

  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) {
      setError(t.purchaseValidationNameRequired);
      return;
    }
    const qtyNum = Math.max(1, Math.floor(Number(quantity) || 1));
    const displayUnitPrice = Math.max(0, Number(unitPrice) || 0);
    const madUnitPrice = convertToMad(displayUnitPrice, currency);

    setSaving(true);
    setError('');
    try {
      await onSavePurchase(
        customer.id,
        {
          productId: selectedProductId,
          productCode: productCode.trim(),
          productName: productName.trim(),
          quantity: qtyNum,
          unitPrice: madUnitPrice,
          purchaseDate: purchaseDate || new Date().toISOString().slice(0, 10),
          paymentMethod,
          notes: notes.trim(),
        },
        editingPurchase?.id
      );
      resetPurchaseForm();
      setFormOpen(false);
    } catch {
      setError(t.errorSave);
    } finally {
      setSaving(false);
    }
  };

  const liveLineTotalDisplay =
    Math.max(1, Math.floor(Number(quantity) || 1)) * Math.max(0, Number(unitPrice) || 0);

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-[#DCE7E0] bg-white shadow-2xl sm:rounded-3xl dark:border-[#1E3A2D] dark:bg-[#0F2119]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#DCE7E0] px-5 py-4 dark:border-[#1E3A2D]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono-code text-xs font-bold tracking-wider text-[#115E3B] dark:text-[#34D399]">
                {customer.code}
              </span>
              <span className="text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                · {getCustomerCategoryLabel(customer.category, lang)}
              </span>
            </div>
            <h2 className="mt-0.5 truncate font-display text-lg font-bold text-[#0B1F16] sm:text-xl dark:text-[#F2F9F5]">
              {customer.name}
            </h2>
            <p className="text-xs text-[#335947] dark:text-[#9EC0AE]">{t.customerHistoryTitle}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Customer Profile & Totals Card */}
          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-4 sm:grid-cols-3 dark:border-[#1E3A2D] dark:bg-[#091611]">
            <div className="space-y-1.5 sm:col-span-2">
              {customer.phone && (() => {
                const whatsappUrl = getCustomerWhatsAppUrl(customer.phone);
                const telHref = getPhoneTelHref(customer.phone);
                return (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#0B1F16] dark:text-[#F2F9F5]">
                    {whatsappUrl ? (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={t.customerOpenWhatsApp}
                        aria-label={`${t.customerOpenWhatsApp}: ${customer.phone}`}
                        className="group inline-flex min-h-[40px] items-center gap-2 rounded-lg py-1 font-semibold transition-colors hover:text-[#115E3B] focus-visible:outline-2 focus-visible:outline-[#115E3B] dark:hover:text-[#34D399]"
                      >
                        <MessageCircle className="h-4 w-4 shrink-0 text-[#115E3B] dark:text-[#34D399]" />
                        <span
                          dir="ltr"
                          className="tabular-nums underline decoration-[#115E3B]/35 underline-offset-2 group-hover:decoration-[#115E3B] dark:decoration-[#34D399]/35 dark:group-hover:decoration-[#34D399]"
                        >
                          {customer.phone}
                        </span>
                        <span className="text-[11px] font-medium text-[#115E3B] dark:text-[#34D399]">
                          · {t.customerWhatsAppBadge}
                        </span>
                      </a>
                    ) : (
                      <a
                        href={telHref}
                        dir="ltr"
                        className="inline-flex min-h-[40px] items-center gap-2 font-semibold hover:underline"
                      >
                        <Phone className="h-3.5 w-3.5 shrink-0 text-[#115E3B] dark:text-[#34D399]" />
                        <span className="tabular-nums">{customer.phone}</span>
                      </a>
                    )}

                    {whatsappUrl && (
                      <a
                        href={telHref}
                        title={t.customerCallPhone}
                        aria-label={`${t.customerCallPhone}: ${customer.phone}`}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#DCE7E0] bg-white text-[#335947] transition-colors hover:bg-[#ECF7F1] hover:text-[#115E3B] dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#9EC0AE] dark:hover:bg-[#162E23] dark:hover:text-[#34D399]"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                );
              })()}
              {(customer.city || customer.address) && (
                <div className="flex items-start gap-2 text-xs text-[#335947] dark:text-[#9EC0AE]">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#115E3B] dark:text-[#34D399]" />
                  <span>
                    {[customer.address, customer.city].filter(Boolean).join(' · ')}
                  </span>
                </div>
              )}
              {(() => {
                const fbHref = getCustomerFacebookUrl(customer.facebookUrl || '');
                const igHref = getCustomerInstagramUrl(customer.instagramUrl || '');
                const webHref = getCustomerWebsiteUrl(customer.websiteUrl || '');
                if (!fbHref && !igHref && !webHref) return null;
                return (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs">
                    {fbHref && (
                      <a
                        href={fbHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[36px] items-center gap-1.5 font-semibold text-[#1877F2] hover:underline dark:text-[#60A5FA]"
                      >
                        <Facebook className="h-3.5 w-3.5 shrink-0" />
                        <span dir="ltr">
                          {formatSocialDisplayLabel(customer.facebookUrl || '', 'facebook')}
                        </span>
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-75" />
                      </a>
                    )}
                    {igHref && (
                      <a
                        href={igHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[36px] items-center gap-1.5 font-semibold text-[#C13584] hover:underline dark:text-[#F472B6]"
                      >
                        <Instagram className="h-3.5 w-3.5 shrink-0" />
                        <span dir="ltr">
                          {formatSocialDisplayLabel(customer.instagramUrl || '', 'instagram')}
                        </span>
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-75" />
                      </a>
                    )}
                    {webHref && (
                      <a
                        href={webHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[36px] items-center gap-1.5 font-semibold text-[#115E3B] hover:underline dark:text-[#34D399]"
                      >
                        <Globe className="h-3.5 w-3.5 shrink-0" />
                        <span dir="ltr">
                          {formatSocialDisplayLabel(customer.websiteUrl || '', 'website')}
                        </span>
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-75" />
                      </a>
                    )}
                  </div>
                );
              })()}
              {customer.notes && (
                <p className="text-xs leading-relaxed text-[#335947] dark:text-[#9EC0AE]">
                  {customer.notes}
                </p>
              )}
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-[#DCE7E0] bg-white p-3 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
              <div>
                <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                  {t.customerTotalSpent}
                </span>
                <span className="tabular-nums font-display text-lg font-bold text-[#115E3B] dark:text-[#34D399]">
                  {formatCurrency(totalSpentMad, currency, lang)}
                </span>
              </div>
              <span className="tabular-nums mt-1 text-xs font-medium text-[#335947] dark:text-[#9EC0AE]">
                {formatNumber(purchases.length, lang)} {t.customerPurchasesCount}
              </span>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (activeSection !== 'purchases') {
                    resetPurchaseForm();
                    setActiveSection('purchases');
                    setFormOpen(true);
                  } else if (formOpen) {
                    resetPurchaseForm();
                    setFormOpen(false);
                  } else {
                    resetPurchaseForm();
                    setFormOpen(true);
                  }
                }}
                className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#115E3B] px-4 text-xs font-semibold text-white hover:bg-[#0D4A2E] whitespace-nowrap dark:bg-[#10B981] dark:text-[#052E1C]"
              >
                <Plus className="h-4 w-4" />
                <span>{t.customerAddPurchase}</span>
              </button>

              <button
                type="button"
                onClick={() => onExportCustomerExcel(customer)}
                className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-white px-3.5 text-xs font-semibold text-[#115E3B] hover:bg-[#ECF7F1] whitespace-nowrap dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#34D399]"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>{t.exportCustomerExcel}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => onEditProfile(customer)}
              className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-white px-3.5 text-xs font-semibold text-[#0B1F16] hover:bg-[#F7FAF8] whitespace-nowrap dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#F2F9F5]"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>{t.edit}</span>
            </button>
          </div>

          {/* Section Switcher: Purchases vs Client Gallery */}
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-1 dark:border-[#1E3A2D] dark:bg-[#091611]">
            <button
              type="button"
              onClick={() => setActiveSection('purchases')}
              className={`flex min-h-[42px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition-colors ${
                activeSection === 'purchases'
                  ? 'bg-[#115E3B] text-white shadow-xs dark:bg-[#10B981] dark:text-[#052E1C]'
                  : 'text-[#335947] hover:bg-white/70 dark:text-[#9EC0AE] dark:hover:bg-[#132B20]'
              }`}
            >
              <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
              <span>
                {t.customerTabPurchases} ({formatNumber(purchases.length, lang)})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('gallery')}
              className={`flex min-h-[42px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition-colors ${
                activeSection === 'gallery'
                  ? 'bg-[#115E3B] text-white shadow-xs dark:bg-[#10B981] dark:text-[#052E1C]'
                  : 'text-[#335947] hover:bg-white/70 dark:text-[#9EC0AE] dark:hover:bg-[#132B20]'
              }`}
            >
              <Images className="h-3.5 w-3.5 shrink-0" />
              <span>
                {t.customerTabGallery} ({formatNumber(gallery.length, lang)})
              </span>
            </button>
          </div>

          {activeSection === 'gallery' ? (
            <CustomerGallerySection
              customer={customer}
              lang={lang}
              onSaveGalleryImages={onSaveGalleryImages}
              onDeleteGalleryImage={onDeleteGalleryImage}
            />
          ) : (
            <>
              {/* Add / Edit Purchase Form */}
              {formOpen && (
                <form
                  onSubmit={(e) => void handleSubmitPurchase(e)}
                  className="space-y-3 rounded-2xl border border-[#115E3B]/35 bg-[#ECF7F1]/55 p-4 dark:border-[#10B981]/30 dark:bg-[#132B20]/50"
                >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                  {editingPurchase ? t.customerEditPurchase : t.customerAddPurchase}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    resetPurchaseForm();
                    setFormOpen(false);
                  }}
                  className="text-xs font-semibold text-[#335947] hover:underline dark:text-[#9EC0AE]"
                >
                  {t.cancel}
                </button>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </div>
              )}

              {/* Pick from inventory */}
              {products.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.purchaseProductPickLabel}
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => handleSelectInventoryProduct(e.target.value)}
                    className="min-h-[42px] w-full rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#5F8370] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16]"
                  >
                    <option value="">{t.purchaseCustomItemOption}</option>
                    {products.map((prod) => (
                      <option key={prod.id} value={prod.id}>
                        {prod.code} — {prod.name} ({formatCurrency(prod.sellingPrice, currency, lang)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.purchaseProductCodeLabel}
                  </label>
                  <input
                    type="text"
                    value={productCode}
                    onChange={(e) => setProductCode(e.target.value)}
                    placeholder={t.purchaseProductCodePlaceholder}
                    className="font-mono-code min-h-[42px] w-full rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#5F8370] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.purchaseProductNameLabel} *
                  </label>
                  <input
                    type="text"
                    required
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder={t.purchaseProductNamePlaceholder}
                    className="min-h-[42px] w-full rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#5F8370] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.purchaseQuantityLabel}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="tabular-nums min-h-[42px] w-full rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#5F8370] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.purchaseUnitPriceLabel} ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="tabular-nums min-h-[42px] w-full rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#5F8370] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.purchaseDateLabel}
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="min-h-[42px] w-full rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#5F8370] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.purchasePaymentLabel}
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PurchasePaymentMethod)}
                    className="min-h-[42px] w-full rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#5F8370] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16]"
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm} value={pm}>
                        {getPaymentMethodLabel(pm, lang)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.purchaseNotesLabel}
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t.purchaseNotesPlaceholder}
                    className="min-h-[42px] w-full rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#5F8370] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16]"
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[#DCE7E0] bg-white px-3 py-2 text-xs dark:border-[#1E3A2D] dark:bg-[#091611]">
                  <span className="text-[#335947] dark:text-[#9EC0AE]">{t.purchaseTotalLabel}</span>
                  <span className="tabular-nums font-bold text-[#115E3B] dark:text-[#34D399]">
                    {formatNumber(liveLineTotalDisplay, lang)} {currency}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#115E3B] text-xs font-semibold text-white hover:bg-[#0D4A2E] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#052E1C]"
              >
                <Check className="h-4 w-4" />
                <span>{saving ? t.saving : t.save}</span>
              </button>
            </form>
          )}

          {/* Purchase History List */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
              <ShoppingBag className="h-4 w-4 text-[#115E3B] dark:text-[#34D399]" />
              <span>
                {t.customerHistoryTitle} ({formatNumber(purchases.length, lang)})
              </span>
            </h3>

            {purchases.length === 0 ? (
              <div className="rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] px-4 py-8 text-center text-xs text-[#335947] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#9EC0AE]">
                {t.customerNoPurchases}
              </div>
            ) : (
              <div className="space-y-2.5">
                {purchases.map((p) => {
                  const isDeleting = pendingDeletePurchaseId === p.id;
                  return (
                    <div
                      key={p.id}
                      className="rounded-2xl border border-[#DCE7E0] bg-white p-3.5 dark:border-[#1E3A2D] dark:bg-[#091611]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {p.productCode && (
                              <span className="font-mono-code text-xs font-bold text-[#115E3B] dark:text-[#34D399]">
                                {p.productCode}
                              </span>
                            )}
                            <span className="text-sm font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                              {p.productName}
                            </span>
                          </div>

                          <div className="tabular-nums mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#335947] dark:text-[#9EC0AE]">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {p.purchaseDate}
                            </span>
                            <span>·</span>
                            <span>
                              {formatNumber(p.quantity, lang)} ×{' '}
                              {formatCurrency(p.unitPrice, currency, lang)}
                            </span>
                            <span>·</span>
                            <span>{getPaymentMethodLabel(p.paymentMethod, lang)}</span>
                          </div>

                          {p.notes && (
                            <p className="mt-1 text-xs text-[#335947] dark:text-[#9EC0AE]">
                              {p.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="tabular-nums font-display text-sm font-bold text-[#115E3B] dark:text-[#34D399]">
                            {formatCurrency(p.totalPrice, currency, lang)}
                          </span>

                          {!isDeleting && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStartEditPurchase(p)}
                                aria-label={t.edit}
                                title={t.edit}
                                className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-[#DCE7E0] text-[#0B1F16] hover:bg-[#F7FAF8] dark:border-[#1E3A2D] dark:text-[#F2F9F5]"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDeletePurchaseId(p.id)}
                                aria-label={t.delete}
                                title={t.delete}
                                className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-[#DCE7E0] text-red-600 hover:bg-red-50 dark:border-[#1E3A2D] dark:text-red-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {isDeleting && (
                        <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-2 dark:border-red-900/60 dark:bg-red-950/40">
                          <button
                            type="button"
                            onClick={() => setPendingDeletePurchaseId(null)}
                            className="min-h-[36px] flex-1 rounded-lg bg-white text-xs font-semibold text-[#0B1F16] dark:bg-[#0F2119] dark:text-[#F2F9F5]"
                          >
                            {t.cancel}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPendingDeletePurchaseId(null);
                              void onDeletePurchase(customer.id, p.id);
                            }}
                            className="min-h-[36px] flex-1 rounded-lg bg-red-600 text-xs font-semibold text-white"
                          >
                            {t.delete}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
