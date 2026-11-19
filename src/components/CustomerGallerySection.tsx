import { useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckSquare,
  Copy,
  Download,
  ExternalLink,
  Facebook,
  Globe,
  ImagePlus,
  Images,
  Instagram,
  Link2,
  Loader2,
  Maximize2,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  Customer,
  CustomerGalleryImage,
  CustomerGalleryPayload,
  CustomerImageSource,
  FetchedSourceImageCandidate,
  Language,
} from '../types';
import { formatNumber, translations } from '../i18n';
import { compressImageBlob, photoDataToBlob } from '../utils/image';
import { saveOrShareBlob } from '../utils/download';
import {
  formatSocialDisplayLabel,
  getCustomerFacebookUrl,
  getCustomerInstagramUrl,
  getCustomerWebsiteUrl,
} from '../utils/socialLinks';
import { fetchCustomerSourceImagesApi } from '../utils/api';

interface CustomerGallerySectionProps {
  customer: Customer;
  lang: Language;
  onEditProfile: (customer: Customer) => void;
  onSaveGalleryImages: (customerId: string, items: CustomerGalleryPayload[]) => Promise<void>;
  onDeleteGalleryImage: (customerId: string, imageId: string) => Promise<void>;
}

function inferSourceFromUrl(url: string): 'facebook' | 'instagram' | 'website' {
  const lower = url.toLowerCase();
  if (/facebook\.com|fb\.com|fb\.me|fbcdn\.net/.test(lower)) return 'facebook';
  if (/instagram\.com|instagr\.am|cdninstagram\.com/.test(lower)) return 'instagram';
  return 'website';
}

function getSourceBadgeLabel(source: CustomerImageSource, lang: Language): string {
  const t = translations[lang];
  if (source === 'facebook') return t.customerFacebookLabel;
  if (source === 'instagram') return t.customerInstagramLabel;
  if (source === 'website') return t.customerWebsiteLabel;
  return t.customerGallerySourceUpload;
}

export function CustomerGallerySection({
  customer,
  lang,
  onEditProfile,
  onSaveGalleryImages,
  onDeleteGalleryImage,
}: CustomerGallerySectionProps) {
  const t = translations[lang];
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const feedbackRef = useRef<HTMLDivElement | null>(null);

  const [fetchingSource, setFetchingSource] = useState<'facebook' | 'instagram' | 'website' | 'custom' | null>(null);
  const [activeExtractSource, setActiveExtractSource] = useState<CustomerImageSource>('upload');
  const [customUrl, setCustomUrl] = useState('');
  const [fetchError, setFetchError] = useState('');
  const [fetchHint, setFetchHint] = useState('');
  const [lastFetchedTargetUrl, setLastFetchedTargetUrl] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);

  const [candidates, setCandidates] = useState<FetchedSourceImageCandidate[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [savingCandidates, setSavingCandidates] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const [pendingDeleteImageId, setPendingDeleteImageId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<CustomerGalleryImage | null>(null);

  const gallery = customer.gallery || [];

  const fbHref = getCustomerFacebookUrl(customer.facebookUrl || '');
  const igHref = getCustomerInstagramUrl(customer.instagramUrl || '');
  const webHref = getCustomerWebsiteUrl(customer.websiteUrl || '');
  const hasAnyLinkedAccount = Boolean(fbHref || igHref || webHref);

  useEffect(() => {
    if (fetchingSource || fetchHint || fetchError || candidates.length > 0) {
      feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [fetchingSource, fetchHint, fetchError, candidates.length]);

  const handleFetchFromLinkedSource = async (
    source: 'facebook' | 'instagram' | 'website',
    overrideUrl?: string
  ) => {
    const linkedRaw =
      source === 'facebook'
        ? fbHref || customer.facebookUrl || ''
        : source === 'instagram'
          ? igHref || customer.instagramUrl || ''
          : webHref || customer.websiteUrl || '';

    setFetchingSource(overrideUrl ? 'custom' : source);
    setActiveExtractSource(source);
    setFetchError('');
    setFetchHint('');
    setCopiedUrl(false);
    setCandidates([]);
    setSelectedCandidateIds(new Set());
    setLastFetchedTargetUrl(overrideUrl || linkedRaw);

    try {
      const result = await fetchCustomerSourceImagesApi(customer.id, source, overrideUrl, {
        linkedUrl: linkedRaw,
        customerName: customer.name,
      });
      setLastFetchedTargetUrl(result.targetUrl || overrideUrl || linkedRaw);

      if (result.images.length > 0) {
        setCandidates(result.images);
        setSelectedCandidateIds(new Set(result.images.map((img) => img.id)));
      } else if (result.blockedOrEmptyReason === 'BLOCKED_OR_LOGIN_REQUIRED') {
        setFetchHint(t.customerGalleryFetchBlockedHint);
      } else {
        setFetchHint(t.customerGalleryNoImagesFound);
      }
    } catch {
      setFetchError(t.customerGalleryFetchError);
    } finally {
      setFetchingSource(null);
    }
  };

  const handleFetchCustomUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customUrl.trim();
    if (!trimmed) return;
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const detectedSource = inferSourceFromUrl(normalized);
    await handleFetchFromLinkedSource(detectedSource, normalized);
  };

  const toggleCandidate = (id: string) => {
    setSelectedCandidateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSaveSelectedCandidates = async () => {
    const chosen = candidates.filter((c) => selectedCandidateIds.has(c.id));
    if (chosen.length === 0) return;
    setSavingCandidates(true);
    setFetchError('');
    try {
      await onSaveGalleryImages(
        customer.id,
        chosen.map((item) => ({
          title: item.title || customer.name,
          source: item.source,
          sourceUrl: item.imageUrl,
          imageData: item.previewDataUrl,
        }))
      );
      setCandidates([]);
      setSelectedCandidateIds(new Set());
      setCustomUrl('');
      setFetchHint('');
    } catch {
      setFetchError(t.errorSave);
    } finally {
      setSavingCandidates(false);
    }
  };

  const saveImageFiles = async (
    files: File[],
    tagSource: CustomerImageSource = 'upload',
    tagUrl = ''
  ) => {
    if (files.length === 0) return;
    setSavingCandidates(true);
    setFetchError('');
    try {
      const items: CustomerGalleryPayload[] = [];
      for (const file of files.slice(0, 12)) {
        if (!file.type.startsWith('image/')) continue;
        try {
          const dataUrl = await compressImageBlob(file, 1280, 0.85);
          if (dataUrl.startsWith('data:image/')) {
            items.push({
              title: file.name ? file.name.replace(/\.[^.]+$/, '') : customer.name,
              source: tagSource,
              sourceUrl: tagUrl,
              imageData: dataUrl,
            });
          }
        } catch {
          // skip unreadable file
        }
      }
      if (items.length > 0) {
        await onSaveGalleryImages(customer.id, items);
      }
    } catch {
      setFetchError(t.errorSave);
    } finally {
      setSavingCandidates(false);
    }
  };

  const handleDeviceFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    e.target.value = '';
    await saveImageFiles(fileList, 'upload', '');
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageFiles: File[] = [];
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) imageFiles.push(f);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      const sourceTag: CustomerImageSource =
        activeExtractSource === 'facebook' ||
        activeExtractSource === 'instagram' ||
        activeExtractSource === 'website'
          ? activeExtractSource
          : 'upload';
      await saveImageFiles(imageFiles, sourceTag, lastFetchedTargetUrl);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer?.files || []).filter((f) => f.type.startsWith('image/'));
    if (files.length > 0) {
      const sourceTag: CustomerImageSource =
        activeExtractSource === 'facebook' ||
        activeExtractSource === 'instagram' ||
        activeExtractSource === 'website'
          ? activeExtractSource
          : 'upload';
      await saveImageFiles(files, sourceTag, lastFetchedTargetUrl);
    }
  };

  const handleCopyProfileLink = async (url: string) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleDownloadGalleryItem = async (img: CustomerGalleryImage) => {
    const converted = await photoDataToBlob(img.imageData);
    if (!converted) return;
    const safeCode = (customer.code || 'client').replace(/[^A-Za-z0-9_-]/g, '');
    const safeId = img.id.slice(0, 8);
    const filename = `${safeCode}-${img.source}-${safeId}.${converted.ext}`;
    await saveOrShareBlob(converted.blob, filename, img.title || customer.name);
  };

  return (
    <div className="space-y-5" onPaste={(e) => void handlePaste(e)}>
      {/* Import from Client Accounts & Device */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(e) => void handleDrop(e)}
        className={`rounded-2xl border p-4 space-y-3.5 transition-colors ${
          isDraggingOver
            ? 'border-[#115E3B] bg-[#ECF7F1] dark:border-[#10B981] dark:bg-[#132B20]'
            : 'border-[#DCE7E0] bg-[#F7FAF8] dark:border-[#1E3A2D] dark:bg-[#091611]'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
              <ImagePlus className="h-4 w-4 text-[#115E3B] dark:text-[#34D399]" />
              <span>{t.customerGalleryFetchFromAccounts}</span>
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[#335947] dark:text-[#9EC0AE]">
              {t.customerGallerySubtitle}
            </p>
          </div>

          <button
            type="button"
            disabled={savingCandidates}
            onClick={() => fileInputRef.current?.click()}
            className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-white px-3.5 text-xs font-semibold text-[#115E3B] hover:bg-[#ECF7F1] disabled:opacity-60 whitespace-nowrap dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#34D399] dark:hover:bg-[#162E23]"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>{t.customerGalleryUploadDevice}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void handleDeviceFilesSelected(e)}
          />
        </div>

        {/* Linked source quick extract buttons */}
        {hasAnyLinkedAccount ? (
          <div className="flex flex-wrap gap-2">
            {fbHref && (
              <button
                type="button"
                disabled={fetchingSource !== null}
                onClick={() => void handleFetchFromLinkedSource('facebook')}
                className="flex min-h-[42px] items-center gap-2 rounded-xl border border-[#1877F2]/35 bg-white px-3.5 text-xs font-semibold text-[#1877F2] transition-colors hover:bg-[#1877F2]/10 disabled:opacity-60 dark:border-[#60A5FA]/35 dark:bg-[#0F2119] dark:text-[#60A5FA]"
              >
                {fetchingSource === 'facebook' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Facebook className="h-4 w-4" />
                )}
                <span>
                  {t.customerGalleryFetchBtnPrefix}{' '}
                  <span dir="ltr">
                    {formatSocialDisplayLabel(customer.facebookUrl || '', 'facebook')}
                  </span>
                </span>
              </button>
            )}

            {igHref && (
              <button
                type="button"
                disabled={fetchingSource !== null}
                onClick={() => void handleFetchFromLinkedSource('instagram')}
                className="flex min-h-[42px] items-center gap-2 rounded-xl border border-[#C13584]/35 bg-white px-3.5 text-xs font-semibold text-[#C13584] transition-colors hover:bg-[#C13584]/10 disabled:opacity-60 dark:border-[#F472B6]/35 dark:bg-[#0F2119] dark:text-[#F472B6]"
              >
                {fetchingSource === 'instagram' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Instagram className="h-4 w-4" />
                )}
                <span>
                  {t.customerGalleryFetchBtnPrefix}{' '}
                  <span dir="ltr">
                    {formatSocialDisplayLabel(customer.instagramUrl || '', 'instagram')}
                  </span>
                </span>
              </button>
            )}

            {webHref && (
              <button
                type="button"
                disabled={fetchingSource !== null}
                onClick={() => void handleFetchFromLinkedSource('website')}
                className="flex min-h-[42px] items-center gap-2 rounded-xl border border-[#115E3B]/35 bg-white px-3.5 text-xs font-semibold text-[#115E3B] transition-colors hover:bg-[#ECF7F1] disabled:opacity-60 dark:border-[#10B981]/35 dark:bg-[#0F2119] dark:text-[#34D399]"
              >
                {fetchingSource === 'website' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
                <span>
                  {t.customerGalleryFetchBtnPrefix}{' '}
                  <span dir="ltr">
                    {formatSocialDisplayLabel(customer.websiteUrl || '', 'website')}
                  </span>
                </span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-[#CBE0D3] bg-white px-3.5 py-2.5 text-xs dark:border-[#1E3A2D] dark:bg-[#0F2119]">
            <span className="text-[#335947] dark:text-[#9EC0AE]">
              {t.customerGalleryNoLinkedAccounts}
            </span>
            <button
              type="button"
              onClick={() => onEditProfile(customer)}
              className="font-semibold text-[#115E3B] underline hover:opacity-80 dark:text-[#34D399]"
            >
              {t.customerGalleryLinkAccountsCta}
            </button>
          </div>
        )}

        {/* Immediate feedback & discovered candidates right below source buttons */}
        <div ref={feedbackRef} className="space-y-3">
          {fetchingSource && (
            <div className="flex items-center gap-2 rounded-xl border border-[#CBE0D3] bg-white px-3 py-2.5 text-xs font-semibold text-[#115E3B] dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#34D399]">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>{t.customerGalleryFetching}</span>
            </div>
          )}

          {fetchError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              {fetchError}
            </div>
          )}

          {fetchHint && (
            <div className="space-y-2.5 rounded-xl border border-amber-300/80 bg-amber-50 p-3.5 text-xs text-amber-950 dark:border-amber-700/40 dark:bg-amber-950/35 dark:text-amber-100">
              <p className="leading-relaxed font-medium">{fetchHint}</p>
              {lastFetchedTargetUrl && (
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={lastFetchedTargetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#115E3B] px-3.5 text-xs font-semibold text-white hover:bg-[#0D4A2E] dark:bg-[#10B981] dark:text-[#052E1C]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>{t.customerGalleryOpenProfile}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => void handleCopyProfileLink(lastFetchedTargetUrl)}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-amber-400/60 bg-white px-3 text-xs font-semibold text-[#0B1F16] hover:bg-amber-100/60 dark:border-amber-600/40 dark:bg-[#0F2119] dark:text-[#F2F9F5]"
                  >
                    {copiedUrl ? <Check className="h-3.5 w-3.5 text-[#115E3B] dark:text-[#34D399]" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedUrl ? t.customerGalleryLinkCopied : t.customerGalleryCopyProfileUrl}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Discovered Candidates Picker */}
          {candidates.length > 0 && (
            <div className="space-y-3 rounded-xl border border-[#115E3B]/35 bg-white p-3.5 dark:border-[#10B981]/35 dark:bg-[#0F2119]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                  {t.customerGalleryFoundTitle} ({formatNumber(candidates.length, lang)})
                </span>
                <div className="flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedCandidateIds.size === candidates.length) {
                        setSelectedCandidateIds(new Set());
                      } else {
                        setSelectedCandidateIds(new Set(candidates.map((c) => c.id)));
                      }
                    }}
                    className="font-semibold text-[#115E3B] hover:underline dark:text-[#34D399]"
                  >
                    {selectedCandidateIds.size === candidates.length
                      ? t.customerGalleryDeselectAll
                      : t.customerGallerySelectAll}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {candidates.map((cand) => {
                  const selected = selectedCandidateIds.has(cand.id);
                  return (
                    <button
                      key={cand.id}
                      type="button"
                      onClick={() => toggleCandidate(cand.id)}
                      className={`group relative overflow-hidden rounded-xl border-2 text-start transition-all ${
                        selected
                          ? 'border-[#115E3B] ring-2 ring-[#115E3B]/20 dark:border-[#10B981] dark:ring-[#10B981]/20'
                          : 'border-[#DCE7E0] opacity-75 hover:opacity-100 dark:border-[#1E3A2D]'
                      }`}
                    >
                      <img
                        src={cand.previewDataUrl}
                        alt={cand.title || customer.name}
                        className="aspect-square w-full bg-[#F7FAF8] object-cover dark:bg-[#091611]"
                      />
                      <span
                        className={`absolute top-2 flex h-6 w-6 items-center justify-center rounded-lg shadow-sm ${
                          lang === 'ar' ? 'left-2' : 'right-2'
                        } ${
                          selected
                            ? 'bg-[#115E3B] text-white dark:bg-[#10B981] dark:text-[#052E1C]'
                            : 'bg-white/90 text-[#335947] dark:bg-[#0F2119]/90 dark:text-[#9EC0AE]'
                        }`}
                      >
                        {selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={selectedCandidateIds.size === 0 || savingCandidates}
                onClick={() => void handleSaveSelectedCandidates()}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-4 text-xs font-semibold text-white hover:bg-[#0D4A2E] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#052E1C]"
              >
                {savingCandidates ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                <span>
                  {savingCandidates
                    ? t.customerGallerySavingSelected
                    : `${t.customerGallerySaveSelected} (${formatNumber(selectedCandidateIds.size, lang)})`}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Direct post / page / image URL input */}
        <form onSubmit={(e) => void handleFetchCustomUrl(e)} className="space-y-1.5">
          <label className="block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
            {t.customerGalleryCustomUrlLabel}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Link2
                className={`pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#335947] dark:text-[#9EC0AE] ${
                  lang === 'ar' ? 'right-3' : 'left-3'
                }`}
              />
              <input
                type="text"
                dir="ltr"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder={t.customerGalleryCustomUrlPlaceholder}
                className={`min-h-[42px] w-full rounded-xl border border-[#DCE7E0] bg-white py-2 text-xs text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:outline-none dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5] dark:placeholder:text-[#5F8370] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16] ${
                  lang === 'ar' ? 'pl-3 pr-8' : 'pl-8 pr-3'
                }`}
              />
            </div>
            <button
              type="submit"
              disabled={!customUrl.trim() || fetchingSource !== null}
              className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#115E3B] px-4 text-xs font-semibold text-white hover:bg-[#0D4A2E] disabled:opacity-60 whitespace-nowrap dark:bg-[#10B981] dark:text-[#052E1C]"
            >
              {fetchingSource === 'custom' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              <span>{t.customerGalleryCustomUrlFetch}</span>
            </button>
          </div>
          <p className="text-[11px] text-[#335947] dark:text-[#9EC0AE]">
            {t.customerGalleryPasteBoxHint}
          </p>
        </form>
      </div>

      {/* Saved Customer Gallery */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
          <Images className="h-4 w-4 text-[#115E3B] dark:text-[#34D399]" />
          <span>
            {t.customerGalleryTitle} ({formatNumber(gallery.length, lang)})
          </span>
        </h3>

        {gallery.length === 0 ? (
          <div className="rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] px-4 py-8 text-center text-xs text-[#335947] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#9EC0AE]">
            {t.customerGalleryEmpty}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {gallery.map((img) => {
              const isDeleting = pendingDeleteImageId === img.id;
              return (
                <div
                  key={img.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-[#DCE7E0] bg-white dark:border-[#1E3A2D] dark:bg-[#091611]"
                >
                  <button
                    type="button"
                    onClick={() => setLightboxImage(img)}
                    className="group relative aspect-square w-full overflow-hidden bg-[#F7FAF8] focus:outline-none dark:bg-[#08130E]"
                  >
                    <img
                      src={img.imageData}
                      alt={img.title || customer.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <span
                      className={`absolute top-2 rounded-lg bg-[#0B1F16]/80 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs ${
                        lang === 'ar' ? 'right-2' : 'left-2'
                      }`}
                    >
                      {getSourceBadgeLabel(img.source, lang)}
                    </span>
                    <span
                      className={`absolute bottom-2 flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-[#0B1F16] opacity-0 shadow-sm transition-opacity group-hover:opacity-100 dark:bg-[#0F2119]/90 dark:text-[#F2F9F5] ${
                        lang === 'ar' ? 'left-2' : 'right-2'
                      }`}
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </span>
                  </button>

                  <div className="flex flex-col gap-1.5 p-2.5">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                      <span className="truncate font-medium text-[#0B1F16] dark:text-[#F2F9F5]">
                        {img.title || customer.name}
                      </span>
                      <span className="tabular-nums shrink-0">{img.createdAt.slice(0, 10)}</span>
                    </div>

                    {isDeleting ? (
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setPendingDeleteImageId(null)}
                          className="min-h-[34px] flex-1 rounded-lg border border-[#DCE7E0] bg-white text-[11px] font-semibold text-[#0B1F16] dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5]"
                        >
                          {t.cancel}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPendingDeleteImageId(null);
                            void onDeleteGalleryImage(customer.id, img.id);
                          }}
                          className="min-h-[34px] flex-1 rounded-lg bg-red-600 text-[11px] font-semibold text-white"
                        >
                          {t.delete}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => void handleDownloadGalleryItem(img)}
                          title={t.customerGalleryDownloadDevice}
                          aria-label={t.customerGalleryDownloadDevice}
                          className="flex min-h-[34px] flex-1 items-center justify-center gap-1 rounded-lg border border-[#DCE7E0] text-[11px] font-semibold text-[#115E3B] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:text-[#34D399] dark:hover:bg-[#162E23]"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        {img.sourceUrl && (
                          <a
                            href={img.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={img.sourceUrl}
                            className="flex min-h-[34px] w-9 items-center justify-center rounded-lg border border-[#DCE7E0] text-[#335947] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => setPendingDeleteImageId(img.id)}
                          title={t.delete}
                          aria-label={t.delete}
                          className="flex min-h-[34px] w-9 items-center justify-center rounded-lg border border-[#DCE7E0] text-red-600 hover:bg-red-50 dark:border-[#1E3A2D] dark:text-red-400 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox Preview */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#1E3A2D] bg-[#08130E] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#1E3A2D] px-4 py-3 text-white">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{lightboxImage.title || customer.name}</p>
                <p className="text-[11px] text-[#9EC0AE]">
                  {getSourceBadgeLabel(lightboxImage.source, lang)} · {lightboxImage.createdAt.slice(0, 10)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleDownloadGalleryItem(lightboxImage)}
                  className="flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#10B981] px-3 text-xs font-semibold text-[#052E1C]"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{t.customerGalleryDownloadDevice}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxImage(null)}
                  aria-label={t.close}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-[#9EC0AE] hover:bg-[#162E23] hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-center overflow-auto p-3">
              <img
                src={lightboxImage.imageData}
                alt={lightboxImage.title || customer.name}
                className="max-h-[75vh] w-auto rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
