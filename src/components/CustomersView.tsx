import { useState } from 'react';
import {
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
  Search,
  ShoppingBag,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { Customer, CustomerCategory, CustomerSummary, Language } from '../types';
import { formatCurrency, formatNumber, translations } from '../i18n';
import { getCustomerWhatsAppUrl, getPhoneTelHref } from '../utils/phone';
import {
  formatSocialDisplayLabel,
  getCustomerFacebookUrl,
  getCustomerInstagramUrl,
  getCustomerWebsiteUrl,
} from '../utils/socialLinks';
import { getCustomerCategoryLabel } from './CustomerFormModal';

interface CustomersViewProps {
  lang: Language;
  currency: string;
  customers: Customer[];
  summary: CustomerSummary;
  loading: boolean;
  searchQuery: string;
  onChangeSearch: (q: string) => void;
  selectedCategory: 'all' | CustomerCategory;
  onChangeCategory: (cat: 'all' | CustomerCategory) => void;
  exporting: boolean;
  onExportAllExcel: () => void;
  onExportSingleExcel: (customer: Customer) => void;
  onAddCustomer: () => void;
  onEditCustomer: (customer: Customer) => void;
  onViewCustomer: (
    customer: Customer,
    startAddPurchase?: boolean,
    initialTab?: 'purchases' | 'gallery'
  ) => void;
  onDeleteCustomer: (customerId: string) => Promise<void>;
}

const CATEGORY_FILTERS: Array<'all' | CustomerCategory> = [
  'all',
  'seller',
  'hobbyist',
  'regular',
  'other',
];

export function CustomersView({
  lang,
  currency,
  customers,
  summary,
  loading,
  searchQuery,
  onChangeSearch,
  selectedCategory,
  onChangeCategory,
  exporting,
  onExportAllExcel,
  onExportSingleExcel,
  onAddCustomer,
  onEditCustomer,
  onViewCustomer,
  onDeleteCustomer,
}: CustomersViewProps) {
  const t = translations[lang];
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  return (
    <>
      {/* KPI Summary Strip */}
      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="rounded-2xl border border-[#DCE7E0] bg-white p-4 sm:p-5 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
          <p className="text-xs font-medium text-[#335947] dark:text-[#9EC0AE]">
            {t.totalCustomersLabel}
          </p>
          <p className="tabular-nums mt-1.5 font-display text-2xl font-bold text-[#0B1F16] sm:text-3xl dark:text-[#F2F9F5]">
            {formatNumber(summary.totalCustomers, lang)}
          </p>
        </div>

        <div className="rounded-2xl border border-[#DCE7E0] bg-white p-4 sm:p-5 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
          <p className="text-xs font-medium text-[#335947] dark:text-[#9EC0AE]">
            {t.totalPurchasesLabel}
          </p>
          <p className="tabular-nums mt-1.5 font-display text-2xl font-bold text-[#0B1F16] sm:text-3xl dark:text-[#F2F9F5]">
            {formatNumber(summary.totalPurchases, lang)}
          </p>
        </div>

        <div className="rounded-2xl border border-[#DCE7E0] bg-white p-4 sm:p-5 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
          <p className="text-xs font-medium text-[#335947] dark:text-[#9EC0AE]">
            {t.totalCustomerRevenueLabel}
          </p>
          <p className="tabular-nums mt-1.5 font-display text-2xl font-bold text-[#115E3B] sm:text-3xl dark:text-[#34D399]">
            {formatCurrency(summary.totalRevenueMad, currency, lang)}
          </p>
        </div>
      </section>

      {/* Search & Admin Actions Toolbar */}
      <section className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[#335947] dark:text-[#9EC0AE] ${
              lang === 'ar' ? 'right-3.5' : 'left-3.5'
            }`}
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onChangeSearch(e.target.value)}
            placeholder={t.customerSearchPlaceholder}
            aria-label={t.customerSearchPlaceholder}
            className={`min-h-[48px] w-full rounded-2xl border border-[#DCE7E0] bg-white py-2.5 text-sm text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:outline-none dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5] dark:placeholder:text-[#5F8370] dark:focus:border-[#10B981] ${
              lang === 'ar' ? 'pl-11 pr-10' : 'pl-10 pr-11'
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onChangeSearch('')}
              aria-label={t.clearSearch}
              className={`absolute top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23] ${
                lang === 'ar' ? 'left-2' : 'right-2'
              }`}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="hidden items-center gap-2.5 sm:flex">
          <button
            type="button"
            onClick={onExportAllExcel}
            disabled={exporting || summary.totalCustomers === 0}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-[#DCE7E0] bg-white px-4 text-sm font-semibold text-[#115E3B] transition-colors hover:bg-[#ECF7F1] disabled:opacity-60 whitespace-nowrap shrink-0 dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#34D399] dark:hover:bg-[#162E23]"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>{t.exportAllCustomersExcel}</span>
          </button>

          <button
            type="button"
            onClick={onAddCustomer}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#115E3B] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0D4A2E] whitespace-nowrap shrink-0 dark:bg-[#10B981] dark:text-[#052E1C] dark:hover:bg-[#059669]"
          >
            <UserPlus className="h-4 w-4" />
            <span>{t.addCustomer}</span>
          </button>
        </div>
      </section>

      {/* Category Filter Strip */}
      <section className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {CATEGORY_FILTERS.map((cat) => {
          const active = selectedCategory === cat;
          const label =
            cat === 'all' ? t.customerCategoryAll : getCustomerCategoryLabel(cat, lang);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onChangeCategory(cat)}
              className={`min-h-[40px] rounded-xl border px-3.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'border-[#115E3B] bg-[#115E3B] text-white dark:border-[#10B981] dark:bg-[#10B981] dark:text-[#052E1C]'
                  : 'border-[#DCE7E0] bg-white text-[#335947] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#9EC0AE]'
              }`}
            >
              {label}
            </button>
          );
        })}
      </section>

      {/* Customer Cards List */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-56 animate-pulse rounded-2xl border border-[#DCE7E0] bg-white p-4 dark:border-[#1E3A2D] dark:bg-[#0F2119]"
            />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="rounded-3xl border border-[#DCE7E0] bg-white px-6 py-14 text-center dark:border-[#1E3A2D] dark:bg-[#0F2119]">
          <Users className="mx-auto mb-3 h-10 w-10 text-[#115E3B]/50 dark:text-[#34D399]/50" />
          <h2 className="font-display text-xl font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
            {t.customersEmptyTitle}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#335947] dark:text-[#9EC0AE]">
            {t.customersEmptyDescription}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {(searchQuery || selectedCategory !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  onChangeSearch('');
                  onChangeCategory('all');
                }}
                className="min-h-[44px] rounded-xl border border-[#DCE7E0] px-4 text-sm font-semibold text-[#115E3B] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:text-[#34D399]"
              >
                {t.customerResetFilter}
              </button>
            )}
            <button
              type="button"
              onClick={onAddCustomer}
              className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#115E3B] px-5 text-sm font-semibold text-white hover:bg-[#0D4A2E] dark:bg-[#10B981] dark:text-[#052E1C]"
            >
              <UserPlus className="h-4 w-4" />
              <span>{t.addCustomer}</span>
            </button>
          </div>
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {customers.map((customer) => {
            const purchases = customer.purchases || [];
            const gallery = customer.gallery || [];
            const totalSpentMad = purchases.reduce((sum, p) => sum + (Number(p.totalPrice) || 0), 0);
            const lastPurchaseDate =
              purchases
                .map((p) => p.purchaseDate)
                .filter(Boolean)
                .sort()
                .pop() || '';
            const isDeletingThis = pendingDeleteId === customer.id;

            return (
              <article
                key={customer.id}
                className="flex flex-col justify-between overflow-hidden rounded-2xl border border-[#DCE7E0] bg-white transition-colors hover:border-[#115E3B]/40 dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:hover:border-[#10B981]/50"
              >
                <div>
                  {/* Top Strip: Code + Category */}
                  <div className="flex items-center justify-between border-b border-[#DCE7E0] bg-[#F7FAF8] px-4 py-2 dark:border-[#1E3A2D] dark:bg-[#0B1913]">
                    <span className="font-mono-code text-sm font-bold tracking-wider text-[#115E3B] dark:text-[#34D399]">
                      {customer.code}
                    </span>
                    <span className="text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                      {getCustomerCategoryLabel(customer.category, lang)}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="p-4">
                    <button
                      type="button"
                      onClick={() => onViewCustomer(customer, false)}
                      className="text-start focus:outline-none"
                    >
                      <h3 className="font-display text-lg font-bold text-[#0B1F16] hover:text-[#115E3B] dark:text-[#F2F9F5] dark:hover:text-[#34D399]">
                        {customer.name}
                      </h3>
                    </button>

                    <div className="mt-2.5 space-y-1.5 text-xs text-[#335947] dark:text-[#9EC0AE]">
                      {customer.phone && (() => {
                        const whatsappUrl = getCustomerWhatsAppUrl(customer.phone);
                        const telHref = getPhoneTelHref(customer.phone);
                        return (
                          <div className="flex items-center justify-between gap-2">
                            {whatsappUrl ? (
                              <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={t.customerOpenWhatsApp}
                                aria-label={`${t.customerOpenWhatsApp}: ${customer.phone}`}
                                className="group inline-flex min-h-[36px] items-center gap-2 rounded-lg py-1 text-[#0B1F16] transition-colors hover:text-[#115E3B] focus-visible:outline-2 focus-visible:outline-[#115E3B] dark:text-[#F2F9F5] dark:hover:text-[#34D399]"
                              >
                                <MessageCircle className="h-4 w-4 shrink-0 text-[#115E3B] dark:text-[#34D399]" />
                                <span
                                  dir="ltr"
                                  className="tabular-nums font-semibold underline decoration-[#115E3B]/35 underline-offset-2 group-hover:decoration-[#115E3B] dark:decoration-[#34D399]/35 dark:group-hover:decoration-[#34D399]"
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
                                className="inline-flex min-h-[36px] items-center gap-2 font-medium text-[#0B1F16] hover:underline dark:text-[#F2F9F5]"
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
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#DCE7E0] text-[#335947] transition-colors hover:bg-[#ECF7F1] hover:text-[#115E3B] dark:border-[#1E3A2D] dark:text-[#9EC0AE] dark:hover:bg-[#162E23] dark:hover:text-[#34D399]"
                              >
                                <Phone className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        );
                      })()}
                      {(customer.city || customer.address) && (
                        <div className="flex items-start gap-2">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#115E3B] dark:text-[#34D399]" />
                          <span className="line-clamp-2">
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
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                            {fbHref && (
                              <a
                                href={fbHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={fbHref}
                                className="inline-flex min-h-[32px] max-w-full items-center gap-1.5 font-medium text-[#1877F2] hover:underline dark:text-[#60A5FA]"
                              >
                                <Facebook className="h-3.5 w-3.5 shrink-0" />
                                <span dir="ltr" className="max-w-[140px] truncate">
                                  {formatSocialDisplayLabel(customer.facebookUrl || '', 'facebook')}
                                </span>
                                <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                              </a>
                            )}
                            {igHref && (
                              <a
                                href={igHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={igHref}
                                className="inline-flex min-h-[32px] max-w-full items-center gap-1.5 font-medium text-[#C13584] hover:underline dark:text-[#F472B6]"
                              >
                                <Instagram className="h-3.5 w-3.5 shrink-0" />
                                <span dir="ltr" className="max-w-[140px] truncate">
                                  {formatSocialDisplayLabel(customer.instagramUrl || '', 'instagram')}
                                </span>
                                <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                              </a>
                            )}
                            {webHref && (
                              <a
                                href={webHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={webHref}
                                className="inline-flex min-h-[32px] max-w-full items-center gap-1.5 font-medium text-[#115E3B] hover:underline dark:text-[#34D399]"
                              >
                                <Globe className="h-3.5 w-3.5 shrink-0" />
                                <span dir="ltr" className="max-w-[160px] truncate">
                                  {formatSocialDisplayLabel(customer.websiteUrl || '', 'website')}
                                </span>
                                <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                              </a>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Purchase stats row */}
                    <div className="mt-4 flex items-baseline justify-between border-t border-[#DCE7E0] pt-3 dark:border-[#1E3A2D]">
                      <div>
                        <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                          {t.customerTotalSpent}
                        </span>
                        <span className="tabular-nums text-base font-bold text-[#115E3B] dark:text-[#34D399]">
                          {formatCurrency(totalSpentMad, currency, lang)}
                        </span>
                      </div>

                      <div className="text-end">
                        <span className="tabular-nums block text-xs font-semibold text-[#0B1F16] dark:text-[#D1E7DA]">
                          {formatNumber(purchases.length, lang)} {t.customerPurchasesCount}
                        </span>
                        {lastPurchaseDate && (
                          <span className="tabular-nums block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                            {lastPurchaseDate}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Row */}
                <div className="px-4 pb-4">
                  {isDeletingThis ? (
                    <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-2 dark:border-red-900/60 dark:bg-red-950/40">
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(null)}
                        className="min-h-[38px] flex-1 rounded-lg bg-white text-xs font-semibold text-[#0B1F16] dark:bg-[#0F2119] dark:text-[#F2F9F5]"
                      >
                        {t.cancel}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingDeleteId(null);
                          void onDeleteCustomer(customer.id);
                        }}
                        className="min-h-[38px] flex-1 rounded-lg bg-red-600 text-xs font-semibold text-white"
                      >
                        {t.delete}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-6 gap-1.5">
                      <button
                        type="button"
                        onClick={() => onViewCustomer(customer, false, 'purchases')}
                        title={t.customerHistoryTitle}
                        className="flex min-h-[42px] items-center justify-center gap-1 rounded-xl bg-[#ECF7F1] px-1.5 text-xs font-semibold text-[#115E3B] hover:bg-[#DCF0E4] dark:bg-[#132B20] dark:text-[#34D399]"
                      >
                        <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
                        <span className="tabular-nums truncate">{purchases.length}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onViewCustomer(customer, false, 'gallery')}
                        title={t.customerGalleryTitle}
                        aria-label={`${t.customerGalleryTitle}: ${gallery.length}`}
                        className="flex min-h-[42px] items-center justify-center gap-1 rounded-xl border border-[#DCE7E0] bg-white px-1.5 text-xs font-semibold text-[#115E3B] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#0B1913] dark:text-[#34D399]"
                      >
                        <Images className="h-3.5 w-3.5 shrink-0" />
                        <span className="tabular-nums truncate">{gallery.length}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onViewCustomer(customer, true, 'purchases')}
                        aria-label={t.customerAddPurchase}
                        title={t.customerAddPurchase}
                        className="flex min-h-[42px] items-center justify-center rounded-xl bg-[#115E3B] text-white hover:bg-[#0D4A2E] dark:bg-[#10B981] dark:text-[#052E1C]"
                      >
                        <Plus className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onExportSingleExcel(customer)}
                        aria-label={t.exportCustomerExcel}
                        title={t.exportCustomerExcel}
                        className="flex min-h-[42px] items-center justify-center rounded-xl border border-[#DCE7E0] text-[#115E3B] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:text-[#34D399]"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onEditCustomer(customer)}
                        aria-label={t.edit}
                        title={t.edit}
                        className="flex min-h-[42px] items-center justify-center rounded-xl border border-[#DCE7E0] text-[#0B1F16] hover:bg-[#F7FAF8] dark:border-[#1E3A2D] dark:text-[#F2F9F5]"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(customer.id)}
                        aria-label={t.delete}
                        title={t.delete}
                        className="flex min-h-[42px] items-center justify-center rounded-xl border border-[#DCE7E0] text-red-600 hover:bg-red-50 dark:border-[#1E3A2D] dark:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}
