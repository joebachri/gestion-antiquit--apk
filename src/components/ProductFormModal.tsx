import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2, X, Check, Star, RefreshCw, Video, Languages, ChevronDown, ChevronUp } from 'lucide-react';
import type { Language, Product, ProductPayload, Supplier, Warehouse } from '../types';
import { translations } from '../i18n';
import {
  compressImageBlob,
  extractPrefixLetter,
  isVideoMedia,
  readVideoAsDataUrl,
} from '../utils/image';
import { convertFromMad, convertToMad } from '../utils/currency';
import { fetchNextCodeApi } from '../utils/api';
import { populateBilingualProductFields, translateTextAuto } from '../utils/productTranslation';
import { CameraModal } from './CameraModal';

interface ProductFormModalProps {
  isOpen: boolean;
  lang: Language;
  currency: string;
  editingProduct: Product | null;
  warehouses: Warehouse[];
  suppliers: Supplier[];
  existingCategories?: string[];
  onClose: () => void;
  onSubmit: (payload: ProductPayload, editingId?: string) => Promise<void>;
}

interface DraftPhoto {
  id?: string;
  imageData: string;
}

export function ProductFormModal({
  isOpen,
  lang,
  currency,
  editingProduct,
  warehouses,
  suppliers,
  existingCategories = [],
  onClose,
  onSubmit,
}: ProductFormModalProps) {
  const t = translations[lang];
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [nameFr, setNameFr] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [descriptionFr, setDescriptionFr] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [categoryFr, setCategoryFr] = useState('');
  const [categoryAr, setCategoryAr] = useState('');
  const [colorFr, setColorFr] = useState('');
  const [colorAr, setColorAr] = useState('');
  const [showBilingualFields, setShowBilingualFields] = useState(false);

  const [warehouseId, setWarehouseId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [supplier, setSupplier] = useState('');
  const [lengthCm, setLengthCm] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [thicknessCm, setThicknessCm] = useState('');
  const [piecesCount, setPiecesCount] = useState('1');
  const [quantity, setQuantity] = useState('1');
  const [referencePrice, setReferencePrice] = useState('');
  const [expenses, setExpenses] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [addedDate, setAddedDate] = useState('');
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);

  const [previewCode, setPreviewCode] = useState('A0001');
  const [regenerateCode, setRegenerateCode] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const initialPriceStringsRef = useRef<{
    referencePrice: string;
    expenses: string;
    sellingPrice: string;
  }>({ referencePrice: '', expenses: '', sellingPrice: '' });

  const name = lang === 'ar' ? nameAr : nameFr;
  const description = lang === 'ar' ? descriptionAr : descriptionFr;
  const category = lang === 'ar' ? categoryAr : categoryFr;
  const color = lang === 'ar' ? colorAr : colorFr;

  const setActiveName = (val: string) => {
    if (lang === 'ar') setNameAr(val);
    else setNameFr(val);
  };
  const setActiveDescription = (val: string) => {
    if (lang === 'ar') setDescriptionAr(val);
    else setDescriptionFr(val);
  };
  const setActiveCategory = (val: string) => {
    if (lang === 'ar') setCategoryAr(val);
    else setCategoryFr(val);
  };
  const setActiveColor = (val: string) => {
    if (lang === 'ar') setColorAr(val);
    else setColorFr(val);
  };

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setShowBilingualFields(false);
    const defaultWh = warehouses.find((w) => w.isDefault) || warehouses[0];
    if (editingProduct) {
      const refStr = editingProduct.referencePrice
        ? String(convertFromMad(editingProduct.referencePrice, currency))
        : '';
      const expStr = editingProduct.expenses
        ? String(convertFromMad(editingProduct.expenses, currency))
        : '';
      const sellStr = editingProduct.sellingPrice
        ? String(convertFromMad(editingProduct.sellingPrice, currency))
        : '';
      initialPriceStringsRef.current = {
        referencePrice: refStr,
        expenses: expStr,
        sellingPrice: sellStr,
      };
      const populated = populateBilingualProductFields(editingProduct);
      setNameFr(populated.nameFr || '');
      setNameAr(populated.nameAr || '');
      setDescriptionFr(populated.descriptionFr || '');
      setDescriptionAr(populated.descriptionAr || '');
      setCategoryFr(populated.categoryFr || '');
      setCategoryAr(populated.categoryAr || '');
      setColorFr(populated.colorFr || '');
      setColorAr(populated.colorAr || '');
      setWarehouseId(editingProduct.warehouseId || defaultWh?.id || '');
      const matchedSup =
        suppliers.find((s) => s.id === editingProduct.supplierId) ||
        suppliers.find(
          (s) => s.name.trim().toLowerCase() === (editingProduct.supplier || '').trim().toLowerCase()
        );
      setSupplierId(matchedSup?.id || editingProduct.supplierId || '');
      setSupplier(editingProduct.supplier || matchedSup?.name || '');
      setLengthCm(String(editingProduct.lengthCm || ''));
      setWidthCm(String(editingProduct.widthCm || ''));
      setHeightCm(String(editingProduct.heightCm || ''));
      setThicknessCm(String(editingProduct.thicknessCm || ''));
      setPiecesCount(String(editingProduct.piecesCount || 1));
      setQuantity(String(editingProduct.quantity ?? 1));
      setReferencePrice(refStr);
      setExpenses(expStr);
      setSellingPrice(sellStr);
      setAddedDate(editingProduct.addedDate || new Date().toISOString().slice(0, 10));
      setPhotos(
        editingProduct.photos.map((p) => ({
          id: p.id,
          imageData: p.imageData,
        }))
      );
      setPreviewCode(editingProduct.code);
      setRegenerateCode(false);
    } else {
      initialPriceStringsRef.current = {
        referencePrice: '',
        expenses: '',
        sellingPrice: '',
      };
      setNameFr('');
      setNameAr('');
      setDescriptionFr('');
      setDescriptionAr('');
      setCategoryFr('');
      setCategoryAr('');
      setColorFr('');
      setColorAr('');
      setWarehouseId(defaultWh?.id || '');
      setSupplierId('');
      setSupplier('');
      setLengthCm('');
      setWidthCm('');
      setHeightCm('');
      setThicknessCm('');
      setPiecesCount('1');
      setQuantity('1');
      setReferencePrice('');
      setExpenses('');
      setSellingPrice('');
      setAddedDate(new Date().toISOString().slice(0, 10));
      setPhotos([]);
      setPreviewCode('A0001');
      setRegenerateCode(false);
    }
  }, [isOpen, editingProduct, currency, warehouses, suppliers]);

  // Live preview automatic code based on first letter of product name
  useEffect(() => {
    if (!isOpen) return;
    const codeNameSource = nameFr.trim() || nameAr.trim();
    const isAutoFormat = editingProduct ? /^[A-Z]\d{4}$/.test(editingProduct.code) : true;
    const shouldQuery =
      !editingProduct ||
      regenerateCode ||
      (isAutoFormat && extractPrefixLetter(codeNameSource) !== extractPrefixLetter(editingProduct.name));

    if (!shouldQuery && editingProduct) {
      setPreviewCode(editingProduct.code);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const nextCode = await fetchNextCodeApi(codeNameSource || 'A', editingProduct?.id);
        if (!cancelled) {
          setPreviewCode(nextCode);
        }
      } catch {
        // ignore abort
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, nameFr, nameAr, editingProduct, regenerateCode]);

  if (!isOpen) return null;

  const handleImportFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMsg('');
    const maxVideoBytes = 60 * 1024 * 1024;
    const added: DraftPhoto[] = [];
    for (const file of Array.from(files)) {
      const isVideoFile =
        file.type.startsWith('video/') ||
        /\.(mp4|webm|mov|m4v|3gp|mkv|avi)$/i.test(file.name);
      try {
        if (isVideoFile) {
          if (file.size === 0) continue;
          if (file.size > maxVideoBytes) {
            setErrorMsg(t.videoTooLargeError);
            continue;
          }
          const fallbackMime = file.type.startsWith('video/') ? file.type : 'video/mp4';
          const videoData = await readVideoAsDataUrl(file, fallbackMime);
          if (videoData) added.push({ imageData: videoData });
        } else {
          const compressed = await compressImageBlob(file);
          added.push({ imageData: compressed });
        }
      } catch {
        // skip unreadable media
      }
    }
    if (added.length > 0) {
      setPhotos((prev) => [...prev, ...added]);
    }
  };

  const handleSetPrimary = (index: number) => {
    if (index === 0) return;
    setPhotos((prev) => {
      const next = [...prev];
      const [picked] = next.splice(index, 1);
      next.unshift(picked);
      return next;
    });
  };

  const handleAutoTranslatePair = () => {
    if (lang === 'ar') {
      if (nameAr.trim()) setNameFr(translateTextAuto(nameAr, 'fr'));
      if (descriptionAr.trim()) setDescriptionFr(translateTextAuto(descriptionAr, 'fr'));
      if (categoryAr.trim()) setCategoryFr(translateTextAuto(categoryAr, 'fr'));
      if (colorAr.trim()) setColorFr(translateTextAuto(colorAr, 'fr'));
    } else {
      if (nameFr.trim()) setNameAr(translateTextAuto(nameFr, 'ar'));
      if (descriptionFr.trim()) setDescriptionAr(translateTextAuto(descriptionFr, 'ar'));
      if (categoryFr.trim()) setCategoryAr(translateTextAuto(categoryFr, 'ar'));
      if (colorFr.trim()) setColorAr(translateTextAuto(colorFr, 'ar'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedActiveName = (name.trim() || nameFr.trim() || nameAr.trim()).trim();
    if (!trimmedActiveName) {
      setErrorMsg(t.validationNameRequired);
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const nextRefMad =
        editingProduct && referencePrice === initialPriceStringsRef.current.referencePrice
          ? editingProduct.referencePrice
          : convertToMad(Number(referencePrice) || 0, currency);
      const nextExpMad =
        editingProduct && expenses === initialPriceStringsRef.current.expenses
          ? editingProduct.expenses
          : convertToMad(Number(expenses) || 0, currency);
      const nextSellMad =
        editingProduct && sellingPrice === initialPriceStringsRef.current.sellingPrice
          ? editingProduct.sellingPrice
          : convertToMad(Number(sellingPrice) || 0, currency);

      const selectedWh = warehouses.find((w) => w.id === warehouseId);
      const selectedSup = suppliers.find((s) => s.id === supplierId);

      const bilingualPayload = populateBilingualProductFields(
        {
          name: trimmedActiveName,
          nameFr: nameFr.trim(),
          nameAr: nameAr.trim(),
          description: description.trim() || descriptionFr.trim() || descriptionAr.trim(),
          descriptionFr: descriptionFr.trim(),
          descriptionAr: descriptionAr.trim(),
          category: category.trim() || categoryFr.trim() || categoryAr.trim(),
          categoryFr: categoryFr.trim(),
          categoryAr: categoryAr.trim(),
          color: color.trim() || colorFr.trim() || colorAr.trim(),
          colorFr: colorFr.trim(),
          colorAr: colorAr.trim(),
          warehouseId: selectedWh?.id || warehouseId || '',
          warehouseName: selectedWh?.name || editingProduct?.warehouseName || '',
          supplierId: selectedSup?.id || '',
          supplier: (selectedSup ? selectedSup.name : supplier).trim(),
          lengthCm: Number(lengthCm) || 0,
          widthCm: Number(widthCm) || 0,
          heightCm: Number(heightCm) || 0,
          thicknessCm: Number(thicknessCm) || 0,
          piecesCount: Math.max(1, Math.floor(Number(piecesCount) || 1)),
          quantity: Math.max(0, Math.floor(Number(quantity) || 0)),
          referencePrice: nextRefMad,
          expenses: nextExpMad,
          sellingPrice: nextSellMad,
          addedDate: addedDate || new Date().toISOString().slice(0, 10),
          photos,
          regenerateCode,
        },
        lang
      );

      await onSubmit(bilingualPayload, editingProduct?.id);
      onClose();
    } catch {
      setErrorMsg(t.errorSave);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'min-h-[44px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3.5 py-2.5 text-sm text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#8FB39E] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16]';

  return (
    <>
      <div
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
        onClick={onClose}
      >
        <div
          className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-[#DCE7E0] bg-white shadow-xl sm:rounded-3xl dark:border-[#1E3A2D] dark:bg-[#0F2119]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-[#DCE7E0] px-5 py-4 dark:border-[#1E3A2D]">
            <div>
              <h2 className="font-display text-xl font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                {editingProduct ? t.editProductTitle : t.newProductTitle}
              </h2>
              <p className="mt-0.5 text-xs text-[#335947] dark:text-[#9EC0AE]">
                {t.autoCodeLabel} :{' '}
                <span className="font-mono-code font-semibold text-[#115E3B] dark:text-[#34D399]">
                  {previewCode}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.close}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto p-5">
            {errorMsg && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                {errorMsg}
              </div>
            )}

            {/* 1. Photos Section */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                  {t.photosSection}
                </label>
                {editingProduct && (
                  <button
                    type="button"
                    onClick={() => setRegenerateCode((v) => !v)}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                      regenerateCode
                        ? 'bg-[#115E3B] text-white dark:bg-[#10B981] dark:text-[#052E1C]'
                        : 'text-[#115E3B] hover:bg-[#ECF7F1] dark:text-[#34D399] dark:hover:bg-[#162E23]'
                    }`}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>{t.regenerateCodeHint}</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setCameraOpen(true)}
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0D4A2E] dark:bg-[#10B981] dark:text-[#052E1C] dark:hover:bg-[#059669]"
                >
                  <Camera className="h-4 w-4" />
                  <span>{t.takePhotoCamera}</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-4 py-2.5 text-sm font-semibold text-[#115E3B] transition-colors hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#34D399] dark:hover:bg-[#162E23]"
                >
                  <ImagePlus className="h-4 w-4" />
                  <span>{t.importFromPhone}</span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void handleImportFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>

              {photos.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#DCE7E0] bg-[#F7FAF8] p-5 text-center dark:border-[#1E3A2D] dark:bg-[#091611]">
                  <p className="font-mono-code mb-1 text-xs font-semibold text-[#115E3B] dark:text-[#34D399]">
                    {previewCode}
                  </p>
                  <p className="text-xs text-[#335947] dark:text-[#9EC0AE]">{t.noPhotoHint}</p>
                  <p className="mt-1 text-[11px] text-[#6B8A79] dark:text-[#8FB39E]">{t.productAddVideoHint}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photos.map((photo, index) => {
                    const photoCode = index === 0 ? previewCode : `${previewCode}-${index + 1}`;
                    return (
                      <div
                        key={index}
                        className="overflow-hidden rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] dark:border-[#1E3A2D] dark:bg-[#091611]"
                      >
                        {/* Code displayed directly above the image */}
                        <div className="flex items-center justify-between border-b border-[#DCE7E0] bg-white px-2.5 py-1.5 dark:border-[#1E3A2D] dark:bg-[#102119]">
                          <span className="font-mono-code text-xs font-semibold text-[#115E3B] dark:text-[#34D399]">
                            {photoCode}
                          </span>
                          <div className="flex items-center gap-1">
                            {index > 0 && (
                              <button
                                type="button"
                                onClick={() => handleSetPrimary(index)}
                                title={lang === 'ar' ? 'رئيسية' : 'Principale'}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]"
                              >
                                <Star className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setPhotos((prev) => prev.filter((_, i) => i !== index))
                              }
                              aria-label={t.removePhoto}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-black">
                          {isVideoMedia(photo.imageData) ? (
                            <>
                              <video
                                src={photo.imageData}
                                controls
                                playsInline
                                muted
                                preload="auto"
                                onLoadedData={(e) => {
                                  const v = e.currentTarget;
                                  if (v.paused && v.currentTime === 0) {
                                    try {
                                      v.currentTime = 0.05;
                                    } catch {
                                      // ignore
                                    }
                                  }
                                }}
                                className="h-full w-full object-cover"
                              />
                              <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                <Video className="h-3 w-3" />
                                <span>{t.videoLabel}</span>
                              </span>
                            </>
                          ) : (
                            <img
                              src={photo.imageData}
                              alt={photoCode}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 2. Name */}
            <div>
              <label
                htmlFor="product-name"
                className="mb-1.5 block text-sm font-semibold text-[#0B1F16] dark:text-[#F2F9F5]"
              >
                {t.nameLabel} *
              </label>
              <input
                id="product-name"
                type="text"
                required
                value={name}
                onChange={(e) => setActiveName(e.target.value)}
                placeholder={t.namePlaceholder}
                className={inputClass}
              />
            </div>

            {/* Category, Color & Warehouse */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="product-category"
                  className="mb-1.5 block text-sm font-semibold text-[#0B1F16] dark:text-[#F2F9F5]"
                >
                  {t.productCategoryLabel}
                </label>
                <input
                  id="product-category"
                  type="text"
                  list="product-categories-list"
                  value={category}
                  onChange={(e) => setActiveCategory(e.target.value)}
                  placeholder={t.productCategoryPlaceholder}
                  className={inputClass}
                />
                {existingCategories.length > 0 && (
                  <datalist id="product-categories-list">
                    {existingCategories.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                )}
              </div>

              <div>
                <label
                  htmlFor="product-color"
                  className="mb-1.5 block text-sm font-semibold text-[#0B1F16] dark:text-[#F2F9F5]"
                >
                  {t.productColorLabel}
                </label>
                <input
                  id="product-color"
                  type="text"
                  value={color}
                  onChange={(e) => setActiveColor(e.target.value)}
                  placeholder={t.productColorPlaceholder}
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="product-warehouse"
                  className="mb-1.5 block text-sm font-semibold text-[#0B1F16] dark:text-[#F2F9F5]"
                >
                  {t.productWarehouseLabel}
                </label>
                <select
                  id="product-warehouse"
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className={inputClass}
                >
                  {warehouses.length === 0 && (
                    <option value="">{t.defaultWarehouseName}</option>
                  )}
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.location ? `(${w.location})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3. Description */}
            <div>
              <label
                htmlFor="product-description"
                className="mb-1.5 block text-sm font-semibold text-[#0B1F16] dark:text-[#F2F9F5]"
              >
                {t.descriptionLabel}
              </label>
              <textarea
                id="product-description"
                rows={3}
                value={description}
                onChange={(e) => setActiveDescription(e.target.value)}
                placeholder={t.descriptionPlaceholder}
                className={inputClass}
              />
            </div>

            {/* Bilingual Translations FR / AR Section */}
            <div className="rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-3.5 dark:border-[#1E3A2D] dark:bg-[#091611]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowBilingualFields((v) => !v)}
                  className="flex items-center gap-2 text-xs font-bold text-[#115E3B] dark:text-[#34D399]"
                >
                  <Languages className="h-4 w-4" />
                  <span>{t.bilingualSectionTitle}</span>
                  {showBilingualFields ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleAutoTranslatePair();
                    setShowBilingualFields(true);
                  }}
                  className="flex min-h-[34px] items-center gap-1.5 rounded-lg border border-[#115E3B]/30 bg-white px-2.5 text-[11px] font-semibold text-[#115E3B] hover:bg-[#ECF7F1] dark:border-[#10B981]/30 dark:bg-[#102119] dark:text-[#34D399]"
                >
                  <Languages className="h-3.5 w-3.5" />
                  <span>{t.autoTranslateButton}</span>
                </button>
              </div>
              <p className="mt-1 text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                {t.bilingualSectionHint}
              </p>

              {showBilingualFields && (
                <div className="mt-3 space-y-3 border-t border-[#DCE7E0] pt-3 dark:border-[#1E3A2D]">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                        {t.productNameFrLabel}
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={nameFr}
                        onChange={(e) => setNameFr(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                        {t.productNameArLabel}
                      </label>
                      <input
                        type="text"
                        dir="rtl"
                        value={nameAr}
                        onChange={(e) => setNameAr(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                        {t.productCategoryFrLabel}
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={categoryFr}
                        onChange={(e) => setCategoryFr(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                        {t.productCategoryArLabel}
                      </label>
                      <input
                        type="text"
                        dir="rtl"
                        value={categoryAr}
                        onChange={(e) => setCategoryAr(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                        {t.productColorFrLabel}
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={colorFr}
                        onChange={(e) => setColorFr(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                        {t.productColorArLabel}
                      </label>
                      <input
                        type="text"
                        dir="rtl"
                        value={colorAr}
                        onChange={(e) => setColorAr(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                        {t.productDescFrLabel}
                      </label>
                      <textarea
                        rows={2}
                        dir="ltr"
                        value={descriptionFr}
                        onChange={(e) => setDescriptionFr(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                        {t.productDescArLabel}
                      </label>
                      <textarea
                        rows={2}
                        dir="rtl"
                        value={descriptionAr}
                        onChange={(e) => setDescriptionAr(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Supplier: linked profile OR custom text */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="product-supplier-select"
                  className="mb-1.5 block text-sm font-semibold text-[#0B1F16] dark:text-[#F2F9F5]"
                >
                  {t.supplierSelectLabel}
                </label>
                <select
                  id="product-supplier-select"
                  value={supplierId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSupplierId(nextId);
                    const found = suppliers.find((s) => s.id === nextId);
                    if (found) setSupplier(found.name);
                  }}
                  className={inputClass}
                >
                  <option value="">{t.supplierNoSupplierOption}</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="product-supplier"
                  className="mb-1.5 block text-sm font-semibold text-[#0B1F16] dark:text-[#F2F9F5]"
                >
                  {t.supplierLabel}
                </label>
                <input
                  id="product-supplier"
                  type="text"
                  value={supplier}
                  onChange={(e) => {
                    setSupplier(e.target.value);
                    if (supplierId) setSupplierId('');
                  }}
                  placeholder={t.supplierPlaceholder}
                  className={inputClass}
                />
              </div>
            </div>

            {/* 4. Dimensions */}
            <fieldset className="space-y-2.5 rounded-2xl border border-[#DCE7E0] p-4 dark:border-[#1E3A2D]">
              <legend className="px-1.5 text-sm font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                {t.dimensionsSection}
              </legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#335947] dark:text-[#9EC0AE]">
                    {t.lengthLabel}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    inputMode="decimal"
                    value={lengthCm}
                    onChange={(e) => setLengthCm(e.target.value)}
                    placeholder="0"
                    className={`${inputClass} tabular-nums`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#335947] dark:text-[#9EC0AE]">
                    {t.widthLabel}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    inputMode="decimal"
                    value={widthCm}
                    onChange={(e) => setWidthCm(e.target.value)}
                    placeholder="0"
                    className={`${inputClass} tabular-nums`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#335947] dark:text-[#9EC0AE]">
                    {t.heightLabel}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    inputMode="decimal"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    placeholder="0"
                    className={`${inputClass} tabular-nums`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#335947] dark:text-[#9EC0AE]">
                    {t.thicknessLabel}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    inputMode="decimal"
                    value={thicknessCm}
                    onChange={(e) => setThicknessCm(e.target.value)}
                    placeholder="0"
                    className={`${inputClass} tabular-nums`}
                  />
                </div>
                <div className="col-span-2 sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-[#335947] dark:text-[#9EC0AE]">
                    {t.piecesCountLabel}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={piecesCount}
                    onChange={(e) => setPiecesCount(e.target.value)}
                    placeholder="1"
                    className={`${inputClass} tabular-nums`}
                  />
                </div>
              </div>
            </fieldset>

            {/* 5-9. Quantity, Prices & Date */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                  {t.quantityLabel}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={`${inputClass} tabular-nums`}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                  {t.referencePriceLabel} ({currency})
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={referencePrice}
                  onChange={(e) => setReferencePrice(e.target.value)}
                  placeholder="0"
                  className={`${inputClass} tabular-nums`}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                  {t.expensesLabel} ({currency})
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={expenses}
                  onChange={(e) => setExpenses(e.target.value)}
                  placeholder="0"
                  className={`${inputClass} tabular-nums`}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#115E3B] dark:text-[#34D399]">
                  {t.sellingPriceLabel} ({currency})
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  placeholder="0"
                  className={`${inputClass} tabular-nums font-semibold`}
                />
              </div>

              <div className="col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                  {t.addedDateLabel}
                </label>
                <input
                  type="date"
                  value={addedDate}
                  onChange={(e) => setAddedDate(e.target.value)}
                  className={`${inputClass} tabular-nums`}
                />
              </div>
            </div>

            {/* Footer actions */}
            <div className="pb-safe flex items-center gap-3 border-t border-[#DCE7E0] pt-4 dark:border-[#1E3A2D]">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[48px] flex-1 rounded-xl border border-[#DCE7E0] text-sm font-semibold text-[#335947] hover:bg-[#F7FAF8] dark:border-[#1E3A2D] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#115E3B] text-sm font-semibold text-white hover:bg-[#0D4A2E] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#052E1C] dark:hover:bg-[#059669]"
              >
                <Check className="h-4 w-4" />
                <span>{submitting ? t.saving : t.save}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <CameraModal
        isOpen={cameraOpen}
        lang={lang}
        allowVideo
        onClose={() => setCameraOpen(false)}
        onConfirmPhotos={(capturedPhotos) => {
          setPhotos((prev) => [
            ...prev,
            ...capturedPhotos.map((imageData) => ({ imageData })),
          ]);
        }}
      />
    </>
  );
}
