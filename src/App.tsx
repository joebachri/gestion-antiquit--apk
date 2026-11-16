import { useCallback, useEffect, useState } from 'react';
import {
  Edit3,
  FileSpreadsheet,
  Image as ImageIcon,
  Plus,
  Search,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import type {
  InventorySummary,
  Language,
  Product,
  ProductPayload,
  ShopSettings,
} from './types';
import { formatCurrency, formatNumber, translations } from './i18n';
import { buildExcelBlob } from './utils/excel';
import {
  deleteProductApi,
  fetchProductsApi,
  fetchSettingsApi,
  saveProductApi,
  saveSettingsApi,
} from './utils/api';
import { saveOrShareBlob } from './utils/download';
import { Header } from './components/Header';
import { ProductFormModal } from './components/ProductFormModal';
import { ProductDetailSheet } from './components/ProductDetailSheet';
import { ShareModal } from './components/ShareModal';
import { LogoModal } from './components/LogoModal';

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('babsaida_lang');
    return saved === 'ar' ? 'ar' : 'fr';
  });

  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('babsaida_theme');
    return saved === 'dark';
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<InventorySummary>({
    totalReferences: 0,
    totalUnits: 0,
    totalSellingValue: 0,
    totalReferenceCost: 0,
  });
  const [settings, setSettings] = useState<ShopSettings>({
    customLogo: '',
    currency: 'MAD',
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [shareProduct, setShareProduct] = useState<Product | null>(null);
  const [logoModalOpen, setLogoModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const t = translations[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem('babsaida_lang', lang);
  }, [lang]);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('babsaida_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('babsaida_theme', 'light');
    }
  }, [isDark]);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await fetchSettingsApi();
      setSettings(data);
    } catch {
      // keep defaults
    }
  }, []);

  const fetchProducts = useCallback(
    async (query: string) => {
      try {
        const data = await fetchProductsApi(query);
        setProducts(data.products);
        setSummary(data.summary);
        setError('');
      } catch {
        setError(translations[lang].errorLoad);
      } finally {
        setLoading(false);
      }
    },
    [lang]
  );

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchProducts(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchProducts]);

  const handleSaveProduct = async (payload: ProductPayload, editingId?: string) => {
    await saveProductApi(payload, editingId);
    await fetchProducts(searchQuery);
  };

  const handleDeleteProduct = async (productId: string) => {
    await deleteProductApi(productId);
    setPendingDeleteId(null);
    if (detailProduct?.id === productId) {
      setDetailProduct(null);
    }
    await fetchProducts(searchQuery);
  };

  const handleSaveSettings = async (nextSettings: ShopSettings) => {
    const updated = await saveSettingsApi(nextSettings);
    setSettings(updated);
  };

  const handleExportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const filename = `gestion-antiquites-${new Date().toISOString().slice(0, 10)}.xlsx`;
      let xlsxBlob: Blob | null = null;

      try {
        const res = await fetch(`/api/export/excel?lang=${lang}`, {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (res.ok) {
          const buf = await res.arrayBuffer();
          const bytes = new Uint8Array(buf);
          // Verify valid ZIP/XLSX magic signature ("PK")
          if (bytes.length > 100 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
            xlsxBlob = new Blob([buf], {
              type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
          }
        }
      } catch {
        // Fallback to client-side generation below
      }

      if (!xlsxBlob) {
        let allProducts = products;
        let allSummary = summary;
        if (searchQuery.trim()) {
          try {
            const fullData = await fetchProductsApi('');
            allProducts = fullData.products;
            allSummary = fullData.summary;
          } catch {
            // use current list
          }
        }
        xlsxBlob = buildExcelBlob(allProducts, allSummary, settings.currency, lang);
      }

      await saveOrShareBlob(xlsxBlob, filename, t.exportExcel);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7FAF8] text-[#0B1F16] dark:bg-[#08130E] dark:text-[#F2F9F5]">
      <Header
        lang={lang}
        onChangeLang={setLang}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        customLogo={settings.customLogo}
        onOpenLogoSettings={() => setLogoModalOpen(true)}
      />

      <main
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        className="mx-auto max-w-7xl px-4 pb-28 pt-5 sm:px-6 sm:pb-12"
      >
        {/* KPI Summary Strip: Total Items & Global Monetary Value */}
        <section className="mb-5 grid grid-cols-2 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-[#DCE7E0] bg-white p-4 sm:p-5 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
            <p className="text-xs font-medium text-[#335947] dark:text-[#9EC0AE]">
              {t.totalArticlesLabel}
            </p>
            <p className="tabular-nums mt-1.5 font-display text-2xl font-bold text-[#0B1F16] sm:text-3xl dark:text-[#F2F9F5]">
              {formatNumber(summary.totalUnits, lang)}
            </p>
            <p className="tabular-nums mt-1 text-xs text-[#335947] dark:text-[#9EC0AE]">
              {formatNumber(summary.totalReferences, lang)} {t.referencesUnit}
            </p>
          </div>

          <div className="rounded-2xl border border-[#DCE7E0] bg-white p-4 sm:p-5 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
            <p className="text-xs font-medium text-[#335947] dark:text-[#9EC0AE]">
              {t.globalValueLabel}
            </p>
            <p className="tabular-nums mt-1.5 font-display text-2xl font-bold text-[#115E3B] sm:text-3xl dark:text-[#34D399]">
              {formatCurrency(summary.totalSellingValue, settings.currency, lang)}
            </p>
            <p className="tabular-nums mt-1 text-xs text-[#335947] dark:text-[#9EC0AE]">
              {t.costBasisPrefix} {formatCurrency(summary.totalReferenceCost, settings.currency, lang)}
            </p>
          </div>
        </section>

        {/* Search & Action Toolbar */}
        <section className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[#335947] dark:text-[#9EC0AE] ${
                lang === 'ar' ? 'right-3.5' : 'left-3.5'
              }`}
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              aria-label={t.searchPlaceholder}
              className={`min-h-[48px] w-full rounded-2xl border border-[#DCE7E0] bg-white py-2.5 text-sm text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:outline-none dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5] dark:placeholder:text-[#5F8370] dark:focus:border-[#10B981] ${
                lang === 'ar' ? 'pl-11 pr-10' : 'pl-10 pr-11'
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
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
              onClick={() => void handleExportExcel()}
              disabled={exporting}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-[#DCE7E0] bg-white px-4 text-sm font-semibold text-[#115E3B] transition-colors hover:bg-[#ECF7F1] disabled:opacity-60 whitespace-nowrap shrink-0 dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#34D399] dark:hover:bg-[#162E23]"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>{t.exportExcel}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setFormOpen(true);
              }}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#115E3B] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0D4A2E] whitespace-nowrap shrink-0 dark:bg-[#10B981] dark:text-[#052E1C] dark:hover:bg-[#059669]"
            >
              <Plus className="h-4 w-4" />
              <span>{t.addProduct}</span>
            </button>
          </div>
        </section>

        {/* States */}
        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-80 animate-pulse rounded-2xl border border-[#DCE7E0] bg-white p-4 dark:border-[#1E3A2D] dark:bg-[#0F2119]"
              />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-3xl border border-[#DCE7E0] bg-white px-6 py-14 text-center dark:border-[#1E3A2D] dark:bg-[#0F2119]">
            <h2 className="font-display text-xl font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
              {t.emptyTitle}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#335947] dark:text-[#9EC0AE]">
              {t.emptyDescription}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="min-h-[44px] rounded-xl border border-[#DCE7E0] px-4 text-sm font-semibold text-[#115E3B] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:text-[#34D399]"
                >
                  {t.resetFilter}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setEditingProduct(null);
                  setFormOpen(true);
                }}
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#115E3B] px-5 text-sm font-semibold text-white hover:bg-[#0D4A2E] dark:bg-[#10B981] dark:text-[#052E1C]"
              >
                <Plus className="h-4 w-4" />
                <span>{t.addProduct}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Product Grid: Detailed Product Cards */
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => {
              const primaryPhoto = product.photos[0]?.imageData;
              const isDeletingThis = pendingDeleteId === product.id;

              return (
                <article
                  key={product.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-[#DCE7E0] bg-white transition-colors hover:border-[#115E3B]/40 dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:hover:border-[#10B981]/50"
                >
                  {/* Unique code displayed right ABOVE the image */}
                  <div className="flex items-center justify-between border-b border-[#DCE7E0] bg-[#F7FAF8] px-4 py-2 dark:border-[#1E3A2D] dark:bg-[#0B1913]">
                    <span className="font-mono-code text-sm font-bold tracking-wider text-[#115E3B] dark:text-[#34D399]">
                      {product.code}
                    </span>
                    <span className="tabular-nums text-xs text-[#335947] dark:text-[#9EC0AE]">
                      {product.photos.length > 0
                        ? `${product.photos.length} ${t.photoLabel}${product.photos.length > 1 && lang === 'fr' ? 's' : ''}`
                        : '0'}
                      {' · '}
                      {product.addedDate}
                    </span>
                  </div>

                  {/* Clickable Image area -> opens full detailed product sheet */}
                  <button
                    type="button"
                    onClick={() => setDetailProduct(product)}
                    className="group relative aspect-[4/3] w-full overflow-hidden bg-[#E8F2EC] text-left focus-visible:outline-2 focus-visible:outline-[#115E3B] dark:bg-[#091611]"
                  >
                    {primaryPhoto ? (
                      <img
                        src={primaryPhoto}
                        alt={product.name}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center text-[#335947] dark:text-[#9EC0AE]">
                        <ImageIcon className="mb-1.5 h-8 w-8 opacity-45" />
                        <span className="text-xs">{product.code}</span>
                      </div>
                    )}
                  </button>

                  {/* Product Summary Body */}
                  <div className="flex flex-1 flex-col p-4">
                    <button
                      type="button"
                      onClick={() => setDetailProduct(product)}
                      className="text-start focus:outline-none"
                    >
                      <h3 className="font-display text-lg font-bold leading-snug text-[#0B1F16] hover:text-[#115E3B] dark:text-[#F2F9F5] dark:hover:text-[#34D399]">
                        {product.name}
                      </h3>
                    </button>

                    {product.description && (
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#335947] dark:text-[#9EC0AE]">
                        {product.description}
                      </p>
                    )}

                    {/* Clean unboxed metadata separators */}
                    <div className="tabular-nums mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#335947] dark:text-[#9EC0AE]">
                      <span>
                        {formatNumber(product.lengthCm, lang)} × {formatNumber(product.widthCm, lang)} ×{' '}
                        {formatNumber(product.heightCm, lang)} {t.cmUnit}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {formatNumber(product.piecesCount, lang)} {t.piecesUnit}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {t.quantityLabel.replace(/^5\.\s*/, '')} : {formatNumber(product.quantity, lang)}
                      </span>
                    </div>

                    {/* Price row */}
                    <div className="mt-4 flex items-baseline justify-between border-t border-[#DCE7E0] pt-3 dark:border-[#1E3A2D]">
                      <div>
                        <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                          {t.sellingPriceLabel.replace(/^8\.\s*/, '')}
                        </span>
                        <span className="tabular-nums text-lg font-bold text-[#115E3B] dark:text-[#34D399]">
                          {formatCurrency(product.sellingPrice, settings.currency, lang)}
                        </span>
                      </div>

                      <div className="text-end">
                        <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                          {t.referencePriceLabel.replace(/^6\.\s*/, '')}
                        </span>
                        <span className="tabular-nums text-xs font-medium text-[#0B1F16] dark:text-[#D1E7DA]">
                          {formatCurrency(product.referencePrice, settings.currency, lang)}
                        </span>
                      </div>
                    </div>

                    {/* Inline Delete Confirm or Action Buttons */}
                    {isDeletingThis ? (
                      <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-2 dark:border-red-900/60 dark:bg-red-950/40">
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(null)}
                          className="min-h-[38px] flex-1 rounded-lg bg-white text-xs font-semibold text-[#0B1F16] dark:bg-[#0F2119] dark:text-[#F2F9F5]"
                        >
                          {t.cancel}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(product.id)}
                          className="min-h-[38px] flex-1 rounded-lg bg-red-600 text-xs font-semibold text-white"
                        >
                          {t.delete}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 grid grid-cols-4 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDetailProduct(product)}
                          className="col-span-1 flex min-h-[44px] items-center justify-center rounded-xl bg-[#ECF7F1] px-2 text-xs font-semibold text-[#115E3B] hover:bg-[#DCF0E4] dark:bg-[#132B20] dark:text-[#34D399]"
                          title={t.viewDetails}
                        >
                          <span className="truncate">{t.viewDetails.split(' ')[0]}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingProduct(product);
                            setFormOpen(true);
                          }}
                          aria-label={t.edit}
                          title={t.edit}
                          className="flex min-h-[44px] items-center justify-center rounded-xl border border-[#DCE7E0] text-[#0B1F16] hover:bg-[#F7FAF8] dark:border-[#1E3A2D] dark:text-[#F2F9F5] dark:hover:bg-[#162E23]"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setShareProduct(product)}
                          aria-label={t.share}
                          title={t.share}
                          className="flex min-h-[44px] items-center justify-center rounded-xl border border-[#DCE7E0] text-[#115E3B] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:text-[#34D399] dark:hover:bg-[#162E23]"
                        >
                          <Share2 className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(product.id)}
                          aria-label={t.delete}
                          title={t.delete}
                          className="flex min-h-[44px] items-center justify-center rounded-xl border border-[#DCE7E0] text-red-600 hover:bg-red-50 dark:border-[#1E3A2D] dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>

      {/* Mobile Sticky Bottom Action Bar (Thumb Zone) */}
      <div
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        className="pb-safe fixed bottom-0 left-0 right-0 z-30 border-t border-[#DCE7E0] bg-white/95 px-4 pt-2.5 backdrop-blur-md sm:hidden dark:border-[#1E3A2D] dark:bg-[#0A1812]/95"
      >
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void handleExportExcel()}
            disabled={exporting}
            className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-4 text-xs font-semibold text-[#115E3B] disabled:opacity-60 whitespace-nowrap shrink-0 dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#34D399]"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>{t.exportExcel}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingProduct(null);
              setFormOpen(true);
            }}
            className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-4 text-sm font-semibold text-white whitespace-nowrap dark:bg-[#10B981] dark:text-[#052E1C]"
          >
            <Plus className="h-4 w-4" />
            <span>{t.addProduct}</span>
          </button>
        </div>
      </div>

      {/* Modals */}
      <ProductFormModal
        isOpen={formOpen}
        lang={lang}
        currency={settings.currency}
        editingProduct={editingProduct}
        onClose={() => {
          setFormOpen(false);
          setEditingProduct(null);
        }}
        onSubmit={handleSaveProduct}
      />

      <ProductDetailSheet
        product={detailProduct}
        lang={lang}
        currency={settings.currency}
        onClose={() => setDetailProduct(null)}
        onEdit={(prod) => {
          setEditingProduct(prod);
          setFormOpen(true);
        }}
        onDelete={handleDeleteProduct}
        onShare={(prod) => setShareProduct(prod)}
      />

      <ShareModal
        product={shareProduct}
        lang={lang}
        currency={settings.currency}
        onClose={() => setShareProduct(null)}
      />

      <LogoModal
        isOpen={logoModalOpen}
        lang={lang}
        customLogo={settings.customLogo}
        currency={settings.currency}
        onClose={() => setLogoModalOpen(false)}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
