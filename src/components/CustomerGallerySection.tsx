import { useRef, useState } from 'react';
import {
  Camera,
  Download,
  ImagePlus,
  Images,
  Loader2,
  Maximize2,
  Play,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import type {
  Customer,
  CustomerGalleryImage,
  CustomerGalleryPayload,
  Language,
} from '../types';
import { formatNumber, translations } from '../i18n';
import {
  compressImageBlob,
  isVideoMedia,
  photoDataToBlob,
  readVideoAsDataUrl,
} from '../utils/image';
import { saveOrShareBlob } from '../utils/download';
import { CameraModal } from './CameraModal';

interface CustomerGallerySectionProps {
  customer: Customer;
  lang: Language;
  onSaveGalleryImages: (customerId: string, items: CustomerGalleryPayload[]) => Promise<void>;
  onDeleteGalleryImage: (customerId: string, imageId: string) => Promise<void>;
}

const MAX_VIDEO_BYTES = 60 * 1024 * 1024;

export function CustomerGallerySection({
  customer,
  lang,
  onSaveGalleryImages,
  onDeleteGalleryImage,
}: CustomerGallerySectionProps) {
  const t = translations[lang];
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [savingMedia, setSavingMedia] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [lightboxItem, setLightboxItem] = useState<CustomerGalleryImage | null>(null);

  const gallery = customer.gallery || [];

  const saveMediaFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setSavingMedia(true);
    setErrorMsg('');

    try {
      const items: CustomerGalleryPayload[] = [];
      for (const file of files.slice(0, 12)) {
        const isVideoFile =
          file.type.startsWith('video/') ||
          /\.(mp4|webm|mov|m4v|3gp|mkv|avi)$/i.test(file.name);

        try {
          if (isVideoFile) {
            if (file.size === 0) continue;
            if (file.size > MAX_VIDEO_BYTES) {
              setErrorMsg(t.videoTooLargeError);
              continue;
            }
            const fallbackMime = file.type.startsWith('video/') ? file.type : 'video/mp4';
            const videoData = await readVideoAsDataUrl(file, fallbackMime);
            if (videoData.startsWith('data:video/')) {
              items.push({
                title: file.name ? file.name.replace(/\.[^.]+$/, '') : customer.name,
                source: 'upload',
                sourceUrl: '',
                imageData: videoData,
              });
            }
          } else if (file.type.startsWith('image/')) {
            const dataUrl = await compressImageBlob(file, 1280, 0.85);
            if (dataUrl.startsWith('data:image/')) {
              items.push({
                title: file.name ? file.name.replace(/\.[^.]+$/, '') : customer.name,
                source: 'upload',
                sourceUrl: '',
                imageData: dataUrl,
              });
            }
          }
        } catch {
          // skip unreadable file
        }
      }

      if (items.length > 0) {
        await onSaveGalleryImages(customer.id, items);
      }
    } catch {
      setErrorMsg(t.errorSave);
    } finally {
      setSavingMedia(false);
    }
  };

  const handleDeviceFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    e.target.value = '';
    await saveMediaFiles(fileList);
  };

  const handleCameraConfirmed = async (capturedMedia: string[]) => {
    if (capturedMedia.length === 0) return;
    setSavingMedia(true);
    setErrorMsg('');
    try {
      const items: CustomerGalleryPayload[] = capturedMedia
        .filter((m) => m.startsWith('data:image/') || m.startsWith('data:video/'))
        .map((m) => ({
          title: customer.name,
          source: 'upload',
          sourceUrl: '',
          imageData: m,
        }));
      if (items.length > 0) {
        await onSaveGalleryImages(customer.id, items);
      }
    } catch {
      setErrorMsg(t.errorSave);
    } finally {
      setSavingMedia(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData?.items || []);
    const mediaFiles: File[] = [];
    for (const item of items) {
      if (
        item.kind === 'file' &&
        (item.type.startsWith('image/') || item.type.startsWith('video/'))
      ) {
        const f = item.getAsFile();
        if (f) mediaFiles.push(f);
      }
    }
    if (mediaFiles.length > 0) {
      e.preventDefault();
      await saveMediaFiles(mediaFiles);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer?.files || []).filter(
      (f) =>
        f.type.startsWith('image/') ||
        f.type.startsWith('video/') ||
        /\.(mp4|webm|mov|m4v|3gp|mkv|avi)$/i.test(f.name)
    );
    if (files.length > 0) {
      await saveMediaFiles(files);
    }
  };

  const handleDownloadGalleryItem = async (item: CustomerGalleryImage) => {
    const converted = await photoDataToBlob(item.imageData);
    if (!converted) return;
    const safeCode = (customer.code || 'client').replace(/[^A-Za-z0-9_-]/g, '');
    const safeId = item.id.slice(0, 8);
    const filename = `${safeCode}-${safeId}.${converted.ext}`;
    await saveOrShareBlob(converted.blob, filename, item.title || customer.name);
  };

  return (
    <div className="space-y-5" onPaste={(e) => void handlePaste(e)}>
      {/* Upload Photos & Videos from Phone or Camera */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(e) => void handleDrop(e)}
        className={`space-y-3.5 rounded-2xl border p-4 transition-colors ${
          isDraggingOver
            ? 'border-[#115E3B] bg-[#ECF7F1] dark:border-[#10B981] dark:bg-[#132B20]'
            : 'border-[#DCE7E0] bg-[#F7FAF8] dark:border-[#1E3A2D] dark:bg-[#091611]'
        }`}
      >
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
            <ImagePlus className="h-4 w-4 text-[#115E3B] dark:text-[#34D399]" />
            <span>{t.customerGalleryFetchFromAccounts}</span>
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-[#335947] dark:text-[#9EC0AE]">
            {t.customerGallerySubtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            disabled={savingMedia}
            onClick={() => setCameraOpen(true)}
            className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#0D4A2E] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#052E1C] dark:hover:bg-[#059669]"
          >
            <Camera className="h-4 w-4 shrink-0" />
            <span>{t.takePhotoCamera}</span>
          </button>

          <button
            type="button"
            disabled={savingMedia}
            onClick={() => fileInputRef.current?.click()}
            className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-white px-4 text-xs font-semibold text-[#115E3B] transition-colors hover:bg-[#ECF7F1] disabled:opacity-60 dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#34D399] dark:hover:bg-[#162E23]"
          >
            {savingMedia ? (
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            ) : (
              <Upload className="h-4 w-4 shrink-0" />
            )}
            <span>{t.customerGalleryUploadDevice}</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => void handleDeviceFilesSelected(e)}
          />
        </div>

        <p className="text-[11px] text-[#335947] dark:text-[#9EC0AE]">
          {t.customerGalleryPasteBoxHint}
        </p>

        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {errorMsg}
          </div>
        )}
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
            {gallery.map((item) => {
              const isDeleting = pendingDeleteId === item.id;
              const isVideo = isVideoMedia(item.imageData);

              return (
                <div
                  key={item.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-[#DCE7E0] bg-white dark:border-[#1E3A2D] dark:bg-[#091611]"
                >
                  <button
                    type="button"
                    onClick={() => setLightboxItem(item)}
                    className="group relative aspect-square w-full overflow-hidden bg-[#F7FAF8] focus:outline-none dark:bg-[#08130E]"
                  >
                    {isVideo ? (
                      <>
                        <video
                          src={item.imageData}
                          muted
                          playsInline
                          preload="metadata"
                          className="h-full w-full bg-black object-cover"
                        />
                        <span
                          className={`absolute top-2 inline-flex items-center gap-1 rounded-lg bg-[#0B1F16]/85 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs ${
                            lang === 'ar' ? 'right-2' : 'left-2'
                          }`}
                        >
                          <Video className="h-3 w-3 text-[#34D399]" />
                          <span>{t.videoLabel}</span>
                        </span>
                        <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#115E3B] shadow-md">
                            <Play className="h-4 w-4 fill-current" />
                          </span>
                        </span>
                      </>
                    ) : (
                      <>
                        <img
                          src={item.imageData}
                          alt={item.title || customer.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <span
                          className={`absolute bottom-2 flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-[#0B1F16] opacity-0 shadow-sm transition-opacity group-hover:opacity-100 dark:bg-[#0F2119]/90 dark:text-[#F2F9F5] ${
                            lang === 'ar' ? 'left-2' : 'right-2'
                          }`}
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                        </span>
                      </>
                    )}
                  </button>

                  <div className="flex flex-col gap-1.5 p-2.5">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                      <span className="truncate font-medium text-[#0B1F16] dark:text-[#F2F9F5]">
                        {item.title || customer.name}
                      </span>
                      <span className="tabular-nums shrink-0">{item.createdAt.slice(0, 10)}</span>
                    </div>

                    {isDeleting ? (
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(null)}
                          className="min-h-[34px] flex-1 rounded-lg border border-[#DCE7E0] bg-white text-[11px] font-semibold text-[#0B1F16] dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5]"
                        >
                          {t.cancel}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPendingDeleteId(null);
                            void onDeleteGalleryImage(customer.id, item.id);
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
                          onClick={() => void handleDownloadGalleryItem(item)}
                          title={t.customerGalleryDownloadDevice}
                          aria-label={t.customerGalleryDownloadDevice}
                          className="flex min-h-[34px] flex-1 items-center justify-center gap-1 rounded-lg border border-[#DCE7E0] text-[11px] font-semibold text-[#115E3B] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:text-[#34D399] dark:hover:bg-[#162E23]"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(item.id)}
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

      {/* Camera Photo & Video Capture Modal */}
      <CameraModal
        isOpen={cameraOpen}
        lang={lang}
        allowVideo
        onClose={() => setCameraOpen(false)}
        onConfirmPhotos={(media) => void handleCameraConfirmed(media)}
      />

      {/* Lightbox Preview (Photo or Video) */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#1E3A2D] bg-[#08130E] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#1E3A2D] px-4 py-3 text-white">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{lightboxItem.title || customer.name}</p>
                <p className="text-[11px] text-[#9EC0AE]">
                  {isVideoMedia(lightboxItem.imageData) ? t.videoLabel : t.customerGallerySourceUpload} ·{' '}
                  {lightboxItem.createdAt.slice(0, 10)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleDownloadGalleryItem(lightboxItem)}
                  className="flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#10B981] px-3 text-xs font-semibold text-[#052E1C]"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{t.customerGalleryDownloadDevice}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxItem(null)}
                  aria-label={t.close}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-[#9EC0AE] hover:bg-[#162E23] hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-center overflow-auto p-3">
              {isVideoMedia(lightboxItem.imageData) ? (
                <video
                  src={lightboxItem.imageData}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[75vh] w-full rounded-lg bg-black object-contain"
                />
              ) : (
                <img
                  src={lightboxItem.imageData}
                  alt={lightboxItem.title || customer.name}
                  className="max-h-[75vh] w-auto rounded-lg object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
