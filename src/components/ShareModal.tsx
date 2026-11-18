import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Facebook,
  Film,
  Image as ImageIcon,
  Instagram,
  MessageCircle,
  Play,
  Share2,
  Sparkles,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import type { Language, MetaAuthStatus, Product } from '../types';
import { formatCurrency, translations } from '../i18n';
import {
  blobToDataUrl,
  buildAllProductPhotoFiles,
  buildDefaultHashtags,
  buildProductCardFile,
  buildShareText,
  generateProductReelVideo,
  isVideoMedia,
  photoDataToBlob,
  readVideoAsDataUrl,
  renderProductShareCardBlob,
} from '../utils/image';
import {
  canWebShareFiles,
  downloadBlobs,
  saveOrShareBlob,
  shareProductMediaAndText,
  tryCopyCardImageToClipboard,
} from '../utils/download';
import { publishFacebookApi, publishInstagramApi } from '../utils/api';
import { MetaAccountCard } from './MetaAccountCard';
import { CameraModal } from './CameraModal';

interface ShareModalProps {
  product: Product | null;
  lang: Language;
  currency: string;
  metaStatus: MetaAuthStatus;
  facebookHandle?: string;
  instagramHandle?: string;
  onRefreshMetaStatus: () => Promise<void>;
  onSaveHandles?: (next: { facebookHandle: string; instagramHandle: string }) => Promise<void>;
  onNotify?: (message: string) => void;
  onClose: () => void;
}

type ShareView = 'hub' | 'instagram' | 'facebook';

interface CustomReelClip {
  dataUrl: string;
  blob: Blob;
  filename: string;
  mimeType: string;
}

export function ShareModal({
  product,
  lang,
  currency,
  metaStatus,
  facebookHandle = '',
  instagramHandle = '',
  onRefreshMetaStatus,
  onSaveHandles,
  onNotify,
  onClose,
}: ShareModalProps) {
  const t = translations[lang];
  const reelFileInputRef = useRef<HTMLInputElement | null>(null);
  const [draftFbHandle, setDraftFbHandle] = useState(facebookHandle);
  const [draftIgHandle, setDraftIgHandle] = useState(instagramHandle);

  const [view, setView] = useState<ShareView>('hub');
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [downloadingPhotos, setDownloadingPhotos] = useState(false);
  const [downloadingCard, setDownloadingCard] = useState(false);
  const [cardPreviewUrl, setCardPreviewUrl] = useState<string | null>(null);
  const [cardBlob, setCardBlob] = useState<Blob | null>(null);

  const [feedback, setFeedback] = useState<{
    message: string;
    channel?: 'whatsapp' | 'facebook' | 'instagram';
    permalink?: string;
    isError?: boolean;
  } | null>(null);

  // Instagram composer state
  const [igFormat, setIgFormat] = useState<'post' | 'reel'>('post');
  const [igSelectedImageSource, setIgSelectedImageSource] = useState<'card' | number>('card');
  const [igSelectedVideoIndex, setIgSelectedVideoIndex] = useState<number>(0);
  const [customReelClip, setCustomReelClip] = useState<CustomReelClip | null>(null);
  const [creatingReel, setCreatingReel] = useState(false);
  const [reelCameraOpen, setReelCameraOpen] = useState(false);
  const [igCaption, setIgCaption] = useState('');
  const [igHashtags, setIgHashtags] = useState('');
  const [igLocation, setIgLocation] = useState('');
  const [igShareToFeed, setIgShareToFeed] = useState(true);

  // Facebook composer state
  const [fbFormat, setFbFormat] = useState<'card' | 'photo' | 'video' | 'text'>('card');
  const [fbPhotoIndex, setFbPhotoIndex] = useState(0);
  const [fbVideoIndex, setFbVideoIndex] = useState(0);
  const [fbMessage, setFbMessage] = useState('');
  const [fbHashtags, setFbHashtags] = useState('');
  const [fbCta, setFbCta] = useState('');

  useEffect(() => {
    setView('hub');
    setCopied(false);
    setPublishing(false);
    setDownloadingPhotos(false);
    setDownloadingCard(false);
    setFeedback(null);
    setDraftFbHandle(facebookHandle);
    setDraftIgHandle(instagramHandle);
    setCustomReelClip(null);
    setCreatingReel(false);
    setReelCameraOpen(false);

    if (!product) {
      setCardPreviewUrl(null);
      setCardBlob(null);
      return;
    }

    const baseText = buildShareText(product, currency, lang);
    const defaultTags = buildDefaultHashtags(product, lang);
    setIgFormat('post');
    setIgSelectedImageSource('card');
    setIgSelectedVideoIndex(0);
    setIgCaption(baseText);
    setIgHashtags(defaultTags);
    setIgLocation('');
    setIgShareToFeed(true);

    setFbFormat('card');
    setFbPhotoIndex(0);
    setFbVideoIndex(0);
    setFbMessage(baseText);
    setFbHashtags(defaultTags);
    setFbCta('');

    let canceled = false;
    let objectUrl: string | null = null;

    renderProductShareCardBlob(product, currency, lang).then((blob) => {
      if (canceled || !blob) return;
      setCardBlob(blob);
      objectUrl = URL.createObjectURL(blob);
      setCardPreviewUrl(objectUrl);
    });

    return () => {
      canceled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [product, currency, lang]);

  if (!product) return null;

  const photos = [...(product.photos || [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );
  const imagePhotos = photos.filter((p) => !isVideoMedia(p.imageData));
  const videoItems = photos.filter((p) => isVideoMedia(p.imageData));
  const primaryPhoto = photos[0];
  const shareText = buildShareText(product, currency, lang);
  const shareTitle = `${product.code} — ${product.name}`;

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
    window.location.href
  )}&quote=${encodeURIComponent(shareText)}`;
  const cleanIgUsername = (draftIgHandle || instagramHandle || '').trim().replace(/^@+/, '');
  const instagramUrl = cleanIgUsername
    ? `https://www.instagram.com/${encodeURIComponent(cleanIgUsername)}/`
    : 'https://www.instagram.com/';

  const activePage =
    metaStatus.pages.find((p) => p.id === metaStatus.selectedPageId) || metaStatus.pages[0];
  const igAccounts = metaStatus.pages
    .filter((p) => Boolean(p.igAccount))
    .map((p) => p.igAccount!);
  const activeIgAccount =
    igAccounts.find((ig) => ig.id === metaStatus.selectedIgId) || igAccounts[0];

  const handleCopy = async (textToCopy = shareText) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard restriction
    }
  };

  const handlePublishCard = async (channel?: 'whatsapp' | 'facebook') => {
    setPublishing(true);
    setFeedback(null);
    try {
      const cardFile = await buildProductCardFile(product, currency, lang);
      const files = cardFile ? [cardFile] : await buildAllProductPhotoFiles(product);

      const supportsNativeOrWebFiles = Capacitor.isNativePlatform() || canWebShareFiles();

      if (supportsNativeOrWebFiles) {
        const result = await shareProductMediaAndText({
          files,
          title: shareTitle,
          text: shareText,
          dialogTitle: shareTitle,
        });

        if (result.copiedText) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        }

        if (result.outcome === 'shared') {
          setFeedback({ message: t.shareCaptionCopiedHint });
          return;
        }
        if (result.outcome === 'canceled') {
          return;
        }
      }

      if (cardFile) {
        await downloadBlobs([cardFile], shareTitle, shareText);
        const copiedImg = await tryCopyCardImageToClipboard(cardFile.blob);
        if (!copiedImg) {
          await handleCopy(shareText);
        }
      } else {
        await handleCopy(shareText);
      }

      setFeedback({
        message: t.desktopShareFallbackHint,
        channel,
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleDownloadAllPhotos = async () => {
    setDownloadingPhotos(true);
    try {
      const files = await buildAllProductPhotoFiles(product);
      if (files.length === 0) return;
      await downloadBlobs(files, shareTitle, shareText);
    } finally {
      setDownloadingPhotos(false);
    }
  };

  const handleShareVideos = async () => {
    if (videoItems.length === 0) return;
    setPublishing(true);
    setFeedback(null);
    try {
      const allFiles = await buildAllProductPhotoFiles(product);
      const videoFiles = allFiles.filter((f) => f.mimeType.startsWith('video/'));
      if (videoFiles.length === 0) return;
      const result = await shareProductMediaAndText({
        files: videoFiles,
        title: shareTitle,
        text: shareText,
        dialogTitle: shareTitle,
      });
      if (result.copiedText) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
      if (result.outcome === 'shared') {
        setFeedback({ message: t.shareCaptionCopiedHint });
      } else if (result.outcome === 'downloaded') {
        setFeedback({ message: t.desktopShareFallbackHint });
      }
    } finally {
      setPublishing(false);
    }
  };

  const handleDownloadCard = async () => {
    setDownloadingCard(true);
    try {
      const blob = cardBlob || (await renderProductShareCardBlob(product, currency, lang));
      if (!blob) return;
      const filename = `${product.code}-${product.name.slice(0, 24).replace(/\s+/g, '-')}.png`;
      await saveOrShareBlob(blob, filename, shareTitle, shareText);
    } finally {
      setDownloadingCard(false);
    }
  };

  const openInstagramComposer = (format: 'post' | 'reel') => {
    setFeedback(null);
    setIgFormat(format);
    setView('instagram');
  };

  const openFacebookComposer = () => {
    setFeedback(null);
    setView('facebook');
  };

  const handleGenerateReelFromPhotos = async () => {
    setCreatingReel(true);
    setFeedback(null);
    try {
      const clip = await generateProductReelVideo(product, currency, lang);
      if (clip) {
        setCustomReelClip(clip);
        setIgSelectedVideoIndex(-1);
      }
    } finally {
      setCreatingReel(false);
    }
  };

  const handleImportReelFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const isVid =
      file.type.startsWith('video/') ||
      /\.(mp4|webm|mov|m4v|3gp|mkv|avi)$/i.test(file.name);
    if (!isVid) return;
    if (file.size > 60 * 1024 * 1024) {
      setFeedback({ message: t.videoTooLargeError, isError: true });
      return;
    }
    const fallbackMime = file.type.startsWith('video/') ? file.type : 'video/mp4';
    const dataUrl = await readVideoAsDataUrl(file, fallbackMime);
    if (!dataUrl) return;
    setCustomReelClip({
      dataUrl,
      blob: file,
      filename: file.name || `${product.code}-reel.mp4`,
      mimeType: fallbackMime.split(';')[0] || 'video/mp4',
    });
    setIgSelectedVideoIndex(-1);
  };

  const getComposedInstagramText = () => {
    return [
      igCaption.trim(),
      igLocation.trim() ? `📍 ${igLocation.trim()}` : '',
      igHashtags.trim(),
    ]
      .filter(Boolean)
      .join('\n\n');
  };

  const getComposedFacebookText = () => {
    return [fbMessage.trim(), fbCta.trim(), fbHashtags.trim()].filter(Boolean).join('\n\n');
  };

  const handleSubmitInstagram = async () => {
    setPublishing(true);
    setFeedback(null);
    const fullCaption = getComposedInstagramText();

    try {
      let mediaDataUrl = '';
      let shareFile: { blob: Blob; filename: string; mimeType: string } | null = null;

      if (igFormat === 'reel') {
        if (igSelectedVideoIndex === -1 && customReelClip) {
          mediaDataUrl = customReelClip.dataUrl;
          shareFile = {
            blob: customReelClip.blob,
            filename: customReelClip.filename,
            mimeType: customReelClip.mimeType,
          };
        } else {
          const pickedVid = videoItems[igSelectedVideoIndex] || videoItems[0];
          if (pickedVid) {
            mediaDataUrl = pickedVid.imageData;
            const converted = await photoDataToBlob(pickedVid.imageData);
            if (converted) {
              shareFile = {
                blob: converted.blob,
                filename: `${product.code}-reel.${converted.ext}`,
                mimeType: converted.mimeType,
              };
            }
          } else {
            // Auto-create a Reel video from photos if user didn't pick one yet
            const autoClip = await generateProductReelVideo(product, currency, lang);
            if (autoClip) {
              setCustomReelClip(autoClip);
              setIgSelectedVideoIndex(-1);
              mediaDataUrl = autoClip.dataUrl;
              shareFile = {
                blob: autoClip.blob,
                filename: autoClip.filename,
                mimeType: autoClip.mimeType,
              };
            }
          }
        }
      } else if (igSelectedImageSource === 'card') {
        const cardFile = await buildProductCardFile(product, currency, lang);
        if (cardFile) {
          shareFile = cardFile;
          mediaDataUrl = await blobToDataUrl(cardFile.blob);
        }
      } else {
        const pickedPhoto = imagePhotos[igSelectedImageSource] || imagePhotos[0];
        if (pickedPhoto) {
          const converted = await photoDataToBlob(pickedPhoto.imageData);
          if (converted) {
            shareFile = {
              blob: converted.blob,
              filename: `${pickedPhoto.photoCode || product.code}.${converted.ext}`,
              mimeType: converted.mimeType,
            };
            mediaDataUrl = await blobToDataUrl(converted.blob);
          }
        }
      }

      if (metaStatus.connected && activeIgAccount && mediaDataUrl) {
        const apiRes = await publishInstagramApi({
          caption: fullCaption,
          mediaDataUrl,
          publishMode: igFormat,
          shareToFeed: igShareToFeed,
          location: igLocation.trim(),
          igAccountId: activeIgAccount.id,
        });

        if (apiRes.ok) {
          setFeedback({
            message: t.igPublishedSuccess,
            channel: 'instagram',
            permalink: apiRes.permalink || instagramUrl,
          });
          return;
        }
        setFeedback({
          message: apiRes.error || t.socialPreparedFallbackHint,
          channel: 'instagram',
          permalink: instagramUrl,
          isError: true,
        });
        return;
      }

      // Device share / clipboard + download fallback
      await handleCopy(fullCaption);
      if (shareFile) {
        const supportsNativeOrWebFiles = Capacitor.isNativePlatform() || canWebShareFiles();
        if (supportsNativeOrWebFiles) {
          const res = await shareProductMediaAndText({
            files: [shareFile],
            title: shareTitle,
            text: fullCaption,
            dialogTitle: t.igComposerTitle,
          });
          if (res.outcome === 'canceled') return;
        } else {
          await downloadBlobs([shareFile], shareTitle, fullCaption);
          if (shareFile.mimeType === 'image/png') {
            await tryCopyCardImageToClipboard(shareFile.blob);
          }
        }
      }

      setFeedback({
        message: t.socialPreparedFallbackHint,
        channel: 'instagram',
        permalink: instagramUrl,
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleSubmitFacebook = async () => {
    setPublishing(true);
    setFeedback(null);
    const fullMessage = getComposedFacebookText();

    try {
      let mediaDataUrl = '';
      let mediaType: 'image' | 'video' | 'none' = 'none';
      let shareFile: { blob: Blob; filename: string; mimeType: string } | null = null;

      if (fbFormat === 'card') {
        const cardFile = await buildProductCardFile(product, currency, lang);
        if (cardFile) {
          shareFile = cardFile;
          mediaDataUrl = await blobToDataUrl(cardFile.blob);
          mediaType = 'image';
        }
      } else if (fbFormat === 'photo') {
        const pickedPhoto = imagePhotos[fbPhotoIndex] || imagePhotos[0];
        if (pickedPhoto) {
          const converted = await photoDataToBlob(pickedPhoto.imageData);
          if (converted) {
            shareFile = {
              blob: converted.blob,
              filename: `${pickedPhoto.photoCode || product.code}.${converted.ext}`,
              mimeType: converted.mimeType,
            };
            mediaDataUrl = await blobToDataUrl(converted.blob);
            mediaType = 'image';
          }
        }
      } else if (fbFormat === 'video') {
        const pickedVideo = videoItems[fbVideoIndex] || videoItems[0];
        if (pickedVideo) {
          const converted = await photoDataToBlob(pickedVideo.imageData);
          if (converted) {
            shareFile = {
              blob: converted.blob,
              filename: `${pickedVideo.photoCode || product.code}.${converted.ext}`,
              mimeType: converted.mimeType,
            };
            mediaDataUrl = pickedVideo.imageData.startsWith('data:')
              ? pickedVideo.imageData
              : await blobToDataUrl(converted.blob);
            mediaType = 'video';
          }
        }
      }

      if (metaStatus.connected && activePage) {
        const apiRes = await publishFacebookApi({
          message: fullMessage,
          mediaDataUrl: mediaDataUrl || undefined,
          mediaType,
          pageId: activePage.id,
        });

        if (apiRes.ok) {
          setFeedback({
            message: t.fbPublishedSuccess,
            channel: 'facebook',
            permalink: apiRes.postUrl || facebookUrl,
          });
          return;
        }

        setFeedback({
          message: apiRes.error || t.socialPreparedFallbackHint,
          channel: 'facebook',
          permalink: facebookUrl,
          isError: true,
        });
        return;
      }

      // Device share / clipboard + download fallback
      await handleCopy(fullMessage);
      if (shareFile) {
        const supportsNativeOrWebFiles = Capacitor.isNativePlatform() || canWebShareFiles();
        if (supportsNativeOrWebFiles) {
          const res = await shareProductMediaAndText({
            files: [shareFile],
            title: shareTitle,
            text: fullMessage,
            dialogTitle: t.fbComposerTitle,
          });
          if (res.outcome === 'canceled') return;
        } else {
          await downloadBlobs([shareFile], shareTitle, fullMessage);
          if (shareFile.mimeType === 'image/png') {
            await tryCopyCardImageToClipboard(shareFile.blob);
          }
        }
      }

      setFeedback({
        message: t.socialPreparedFallbackHint,
        channel: 'facebook',
        permalink: facebookUrl,
      });
    } finally {
      setPublishing(false);
    }
  };

  const activeReelSrc =
    igSelectedVideoIndex === -1 && customReelClip
      ? customReelClip.dataUrl
      : videoItems[igSelectedVideoIndex]?.imageData || '';

  return (
    <>
      <div
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
        onClick={onClose}
      >
        <div
          className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[#DCE7E0] bg-white p-6 shadow-xl sm:rounded-3xl dark:border-[#1E3A2D] dark:bg-[#0F2119]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#DCE7E0] sm:hidden dark:bg-[#1E3A2D]" />

          {/* Modal Header */}
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {view !== 'hub' && (
                <button
                  type="button"
                  onClick={() => {
                    setFeedback(null);
                    setView('hub');
                  }}
                  aria-label={t.socialBack}
                  className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-[#DCE7E0] text-[#115E3B] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:text-[#34D399] dark:hover:bg-[#162E23]"
                >
                  <ArrowLeft className={`h-4 w-4 ${lang === 'ar' ? 'rotate-180' : ''}`} />
                </button>
              )}
              <div>
                <h2 className="font-display text-xl font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                  {view === 'instagram'
                    ? t.igComposerTitle
                    : view === 'facebook'
                      ? t.fbComposerTitle
                      : t.shareTitle}
                </h2>
                <p className="mt-0.5 text-xs text-[#335947] dark:text-[#9EC0AE]">
                  {view === 'hub' ? t.shareDescription : `${product.code} — ${product.name}`}
                </p>
              </div>
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

          {/* VIEW 1: HUB */}
          {view === 'hub' && (
            <>
              {cardPreviewUrl ? (
                <div className="mb-5 overflow-hidden rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] shadow-xs dark:border-[#1E3A2D] dark:bg-[#091611]">
                  <img
                    src={cardPreviewUrl}
                    alt={shareTitle}
                    className="block max-h-[380px] w-full object-contain"
                  />
                </div>
              ) : (
                <div className="mb-5 overflow-hidden rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] dark:border-[#1E3A2D] dark:bg-[#091611]">
                  <div className="flex items-center justify-between border-b border-[#DCE7E0] bg-[#115E3B] px-4 py-2 text-xs font-semibold text-white dark:border-[#1E3A2D]">
                    <span>{t.brandName}</span>
                    <div className="flex items-center gap-2">
                      {photos.length > 0 && (
                        <span className="tabular-nums rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-medium">
                          {photos.length} {t.photosIncluded}
                        </span>
                      )}
                      <span className="font-mono-code tracking-wider">{product.code}</span>
                    </div>
                  </div>

                  {primaryPhoto ? (
                    <div className="space-y-2 bg-[#E8F2EC] p-2 dark:bg-[#102119]">
                      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-black">
                        {isVideoMedia(primaryPhoto.imageData) ? (
                          <>
                            <video
                              src={primaryPhoto.imageData}
                              muted
                              playsInline
                              preload="auto"
                              className="h-full w-full object-cover"
                            />
                            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
                              <Play className="h-10 w-10 fill-white text-white" />
                            </span>
                          </>
                        ) : (
                          <img
                            src={primaryPhoto.imageData}
                            alt={primaryPhoto.photoCode || product.name}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex aspect-[16/7] w-full flex-col items-center justify-center bg-[#E8F2EC] text-[#335947] dark:bg-[#102119] dark:text-[#9EC0AE]">
                      <ImageIcon className="mb-1.5 h-8 w-8 opacity-50" />
                      <span className="text-xs">{t.noPhotoHint}</span>
                    </div>
                  )}

                  <div className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-lg font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                        {product.name}
                      </h3>
                      <span className="tabular-nums shrink-0 text-base font-bold text-[#115E3B] dark:text-[#34D399]">
                        {formatCurrency(product.sellingPrice, currency, lang)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {feedback && (
                <div className="mb-4 flex flex-col gap-2 rounded-xl border border-[#DCE7E0] bg-[#ECF7F1] px-3.5 py-2.5 text-xs text-[#115E3B] dark:border-[#1E3A2D] dark:bg-[#132B20] dark:text-[#6EE7B7]">
                  <span>{feedback.message}</span>
                  {feedback.channel === 'whatsapp' && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-fit items-center gap-1.5 font-semibold underline underline-offset-2"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>{t.shareWhatsapp}</span>
                    </a>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handlePublishCard()}
                  disabled={publishing}
                  className="col-span-2 flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-4 text-sm font-semibold text-white hover:bg-[#0D4A2E] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#052E1C]"
                >
                  <Share2 className="h-4 w-4" />
                  <span>
                    {publishing
                      ? t.publishing
                      : photos.length > 0
                        ? `${t.nativeShare} (${photos.length})`
                        : t.nativeShare}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => void handlePublishCard('whatsapp')}
                  disabled={publishing}
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-[#ECF7F1] px-4 text-sm font-semibold text-[#115E3B] hover:bg-[#DCF0E4] disabled:opacity-60 dark:border-[#1E3A2D] dark:bg-[#132B20] dark:text-[#34D399]"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>{t.shareWhatsapp}</span>
                </button>

                <button
                  type="button"
                  onClick={openFacebookComposer}
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-white px-4 text-sm font-semibold text-[#1877F2] hover:bg-[#F7FAF8] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#60A5FA]"
                >
                  <Facebook className="h-4 w-4" />
                  <span>{t.shareFacebook}</span>
                </button>

                <button
                  type="button"
                  onClick={() => openInstagramComposer('post')}
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-white px-4 text-sm font-semibold text-[#C13584] hover:bg-[#F7FAF8] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#F472B6]"
                >
                  <Instagram className="h-4 w-4" />
                  <span>{t.shareInstagram}</span>
                </button>

                <button
                  type="button"
                  onClick={() => openInstagramComposer('reel')}
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-white px-4 text-sm font-semibold text-[#9333EA] hover:bg-[#F7FAF8] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#C084FC]"
                >
                  <Film className="h-4 w-4" />
                  <span>{t.shareInstagramReel}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-white px-4 text-xs font-semibold text-[#0B1F16] hover:bg-[#F7FAF8] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#F2F9F5]"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-[#10B981]" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  <span>{copied ? t.copied : t.copyText}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadCard}
                  disabled={downloadingCard}
                  className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-white px-4 text-xs font-semibold text-[#0B1F16] hover:bg-[#F7FAF8] disabled:opacity-50 dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#F2F9F5]"
                >
                  <Download className="h-4 w-4" />
                  <span>{t.downloadCardImage}</span>
                </button>

                {videoItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleShareVideos}
                    disabled={publishing}
                    className="col-span-2 flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-[#ECF7F1] px-4 text-xs font-semibold text-[#115E3B] hover:bg-[#DCF0E4] disabled:opacity-50 dark:border-[#1E3A2D] dark:bg-[#132B20] dark:text-[#34D399]"
                  >
                    <Video className="h-4 w-4" />
                    <span>
                      {t.shareVideos} ({videoItems.length})
                    </span>
                  </button>
                )}

                {photos.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadAllPhotos}
                    disabled={downloadingPhotos}
                    className="col-span-2 flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-4 text-xs font-medium text-[#335947] hover:bg-[#ECF7F1] disabled:opacity-50 dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#9EC0AE]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>
                      {t.downloadAllPhotos} ({photos.length})
                    </span>
                  </button>
                )}
              </div>
            </>
          )}

          {/* VIEW 2: INSTAGRAM POST & REEL COMPOSER */}
          {view === 'instagram' && (
            <div className="space-y-4">
              {/* Post vs Reel toggle */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                  {t.igFormatLabel}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIgFormat('post')}
                    className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                      igFormat === 'post'
                        ? 'border-[#C13584] bg-[#C13584] text-white'
                        : 'border-[#DCE7E0] bg-[#F7FAF8] text-[#0B1F16] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]'
                    }`}
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    <span>{t.igFormatPost}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIgFormat('reel')}
                    className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                      igFormat === 'reel'
                        ? 'border-[#9333EA] bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] text-white'
                        : 'border-[#DCE7E0] bg-[#F7FAF8] text-[#0B1F16] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]'
                    }`}
                  >
                    <Film className="h-3.5 w-3.5" />
                    <span>{t.igFormatReel}</span>
                  </button>
                </div>
              </div>

              {/* Media selection */}
              {igFormat === 'post' ? (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                    {t.igPostMediaHint}
                  </label>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {cardPreviewUrl && (
                      <button
                        type="button"
                        onClick={() => setIgSelectedImageSource('card')}
                        className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${
                          igSelectedImageSource === 'card'
                            ? 'border-[#115E3B] dark:border-[#10B981]'
                            : 'border-[#DCE7E0] dark:border-[#1E3A2D]'
                        }`}
                      >
                        <img
                          src={cardPreviewUrl}
                          alt="Card"
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute bottom-0 left-0 right-0 bg-black/65 py-0.5 text-center text-[9px] font-semibold text-white">
                          PNG
                        </span>
                      </button>
                    )}
                    {imagePhotos.map((ph, idx) => (
                      <button
                        key={ph.id}
                        type="button"
                        onClick={() => setIgSelectedImageSource(idx)}
                        className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${
                          igSelectedImageSource === idx
                            ? 'border-[#115E3B] dark:border-[#10B981]'
                            : 'border-[#DCE7E0] dark:border-[#1E3A2D]'
                        }`}
                      >
                        <img
                          src={ph.imageData}
                          alt={ph.photoCode}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-3.5 dark:border-[#1E3A2D] dark:bg-[#091611]">
                  <span className="block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.igReelMediaHint}
                  </span>

                  {(videoItems.length > 0 || customReelClip) && (
                    <div className="flex flex-wrap gap-2">
                      {videoItems.map((vid, idx) => (
                        <button
                          key={vid.id}
                          type="button"
                          onClick={() => setIgSelectedVideoIndex(idx)}
                          className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                            igSelectedVideoIndex === idx
                              ? 'border-[#9333EA] bg-[#9333EA] text-white'
                              : 'border-[#DCE7E0] bg-white text-[#0B1F16] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#F2F9F5]'
                          }`}
                        >
                          {vid.photoCode || `${t.videoLabel} ${idx + 1}`}
                        </button>
                      ))}
                      {customReelClip && (
                        <button
                          type="button"
                          onClick={() => setIgSelectedVideoIndex(-1)}
                          className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                            igSelectedVideoIndex === -1
                              ? 'border-[#9333EA] bg-[#9333EA] text-white'
                              : 'border-[#DCE7E0] bg-white text-[#0B1F16] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#F2F9F5]'
                          }`}
                        >
                          Reel Clip
                        </button>
                      )}
                    </div>
                  )}

                  {activeReelSrc ? (
                    <div className="overflow-hidden rounded-xl bg-black">
                      <video
                        key={activeReelSrc}
                        src={activeReelSrc}
                        controls
                        playsInline
                        muted
                        preload="auto"
                        className="max-h-56 w-full object-contain"
                      />
                    </div>
                  ) : (
                    <p className="text-xs leading-relaxed text-[#335947] dark:text-[#9EC0AE]">
                      {t.igNoVideoYet}
                    </p>
                  )}

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void handleGenerateReelFromPhotos()}
                      disabled={creatingReel}
                      className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-[#115E3B] px-3 text-xs font-semibold text-white hover:bg-[#0D4A2E] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#052E1C]"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>{creatingReel ? t.igCreatingReel : t.igCreateReelFromPhotos}</span>
                    </button>

                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setReelCameraOpen(true)}
                        className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-white px-2.5 text-xs font-semibold text-[#0B1F16] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#F2F9F5]"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        <span>{t.cameraModeVideo}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => reelFileInputRef.current?.click()}
                        className="flex min-h-[40px] items-center justify-center gap-1 rounded-xl border border-[#DCE7E0] bg-white px-2.5 text-xs font-semibold text-[#0B1F16] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#F2F9F5]"
                        title={t.igFilmReelVideo}
                      >
                        <Upload className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <input
                      ref={reelFileInputRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => {
                        void handleImportReelFile(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Caption */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                  {t.igCaptionLabel}
                </label>
                <textarea
                  rows={4}
                  value={igCaption}
                  onChange={(e) => setIgCaption(e.target.value)}
                  className="w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] p-3 text-xs leading-relaxed text-[#0B1F16] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]"
                />
              </div>

              {/* Hashtags & Location */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.igHashtagsLabel}
                  </label>
                  <input
                    type="text"
                    value={igHashtags}
                    onChange={(e) => setIgHashtags(e.target.value)}
                    className="min-h-[42px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3 text-xs text-[#0B1F16] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.igLocationLabel}
                  </label>
                  <input
                    type="text"
                    value={igLocation}
                    onChange={(e) => setIgLocation(e.target.value)}
                    placeholder={t.igLocationPlaceholder}
                    className="min-h-[42px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3 text-xs text-[#0B1F16] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]"
                  />
                </div>
              </div>

              {igFormat === 'reel' && (
                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3.5 py-2.5 text-xs font-medium text-[#0B1F16] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]">
                  <input
                    type="checkbox"
                    checked={igShareToFeed}
                    onChange={(e) => setIgShareToFeed(e.target.checked)}
                    className="h-4 w-4 accent-[#115E3B]"
                  />
                  <span>{t.igShareToFeedLabel}</span>
                </label>
              )}

              {/* Account Linking Card */}
              <MetaAccountCard
                compact={Boolean(metaStatus.connected || instagramHandle || facebookHandle)}
                lang={lang}
                metaStatus={metaStatus}
                onRefreshMetaStatus={onRefreshMetaStatus}
                facebookHandle={draftFbHandle}
                instagramHandle={draftIgHandle}
                savedFacebookHandle={facebookHandle}
                savedInstagramHandle={instagramHandle}
                onChangeHandles={(next) => {
                  setDraftFbHandle(next.facebookHandle);
                  setDraftIgHandle(next.instagramHandle);
                }}
                onSaveHandles={onSaveHandles}
                onNotify={onNotify}
              />

              {!(metaStatus.connected && activeIgAccount) && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                  {t.socialManualPublishNotice}
                </p>
              )}

              {feedback && (
                <div
                  className={`flex flex-col gap-2 rounded-xl border px-3.5 py-2.5 text-xs ${
                    feedback.isError
                      ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300'
                      : 'border-[#DCE7E0] bg-[#ECF7F1] text-[#115E3B] dark:border-[#1E3A2D] dark:bg-[#132B20] dark:text-[#6EE7B7]'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!feedback.isError && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
                    <span>{feedback.message}</span>
                  </div>
                  {feedback.permalink && (
                    <a
                      href={feedback.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-fit items-center gap-1.5 font-semibold underline underline-offset-2"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>
                        {cleanIgUsername
                          ? `${t.igOpenInstagram} (@${cleanIgUsername})`
                          : t.igOpenInstagram}
                      </span>
                    </a>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleSubmitInstagram()}
                disabled={publishing || creatingReel}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#833AB4] via-[#DD2A7B] to-[#F77737] px-4 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-60"
              >
                {igFormat === 'reel' ? <Film className="h-4 w-4" /> : <Instagram className="h-4 w-4" />}
                <span>
                  {publishing
                    ? t.igPublishing
                    : metaStatus.connected && activeIgAccount
                      ? igFormat === 'reel'
                        ? t.igPublishReelApiButton
                        : t.igPublishApiButton
                      : igFormat === 'reel'
                        ? t.igPrepareReelButton
                        : t.igPrepareShareButton}
                </span>
              </button>
            </div>
          )}

          {/* VIEW 3: FACEBOOK POST COMPOSER */}
          {view === 'facebook' && (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                  {t.fbFormatLabel}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFbFormat('card')}
                    className={`min-h-[40px] rounded-xl border px-3 text-xs font-semibold ${
                      fbFormat === 'card'
                        ? 'border-[#1877F2] bg-[#1877F2] text-white'
                        : 'border-[#DCE7E0] bg-[#F7FAF8] text-[#0B1F16] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]'
                    }`}
                  >
                    {t.fbFormatCard}
                  </button>
                  {imagePhotos.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFbFormat('photo')}
                      className={`min-h-[40px] rounded-xl border px-3 text-xs font-semibold ${
                        fbFormat === 'photo'
                          ? 'border-[#1877F2] bg-[#1877F2] text-white'
                          : 'border-[#DCE7E0] bg-[#F7FAF8] text-[#0B1F16] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]'
                      }`}
                    >
                      {t.fbFormatPhotos} ({imagePhotos.length})
                    </button>
                  )}
                  {videoItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFbFormat('video')}
                      className={`min-h-[40px] rounded-xl border px-3 text-xs font-semibold ${
                        fbFormat === 'video'
                          ? 'border-[#1877F2] bg-[#1877F2] text-white'
                          : 'border-[#DCE7E0] bg-[#F7FAF8] text-[#0B1F16] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]'
                      }`}
                    >
                      {t.fbFormatVideo} ({videoItems.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setFbFormat('text')}
                    className={`min-h-[40px] rounded-xl border px-3 text-xs font-semibold ${
                      fbFormat === 'text'
                        ? 'border-[#1877F2] bg-[#1877F2] text-white'
                        : 'border-[#DCE7E0] bg-[#F7FAF8] text-[#0B1F16] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]'
                    }`}
                  >
                    {t.fbFormatText}
                  </button>
                </div>
              </div>

              {/* Media preview for Facebook */}
              {fbFormat === 'card' && cardPreviewUrl && (
                <div className="overflow-hidden rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] dark:border-[#1E3A2D] dark:bg-[#091611]">
                  <img
                    src={cardPreviewUrl}
                    alt={shareTitle}
                    className="max-h-48 w-full object-contain"
                  />
                </div>
              )}

              {fbFormat === 'photo' && imagePhotos.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {imagePhotos.map((ph, idx) => (
                    <button
                      key={ph.id}
                      type="button"
                      onClick={() => setFbPhotoIndex(idx)}
                      className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${
                        fbPhotoIndex === idx
                          ? 'border-[#1877F2]'
                          : 'border-[#DCE7E0] dark:border-[#1E3A2D]'
                      }`}
                    >
                      <img
                        src={ph.imageData}
                        alt={ph.photoCode}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {fbFormat === 'video' && videoItems.length > 0 && (
                <div className="space-y-2">
                  {videoItems.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      {videoItems.map((v, idx) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setFbVideoIndex(idx)}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                            fbVideoIndex === idx
                              ? 'border-[#1877F2] bg-[#1877F2] text-white'
                              : 'border-[#DCE7E0] bg-[#F7FAF8] text-[#0B1F16] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]'
                          }`}
                        >
                          {v.photoCode || `${t.videoLabel} ${idx + 1}`}
                        </button>
                      ))}
                    </div>
                  )}
                  <video
                    key={videoItems[fbVideoIndex]?.id}
                    src={videoItems[fbVideoIndex]?.imageData}
                    controls
                    playsInline
                    muted
                    preload="auto"
                    className="max-h-48 w-full rounded-xl bg-black object-contain"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                  {t.fbMessageLabel}
                </label>
                <textarea
                  rows={4}
                  value={fbMessage}
                  onChange={(e) => setFbMessage(e.target.value)}
                  className="w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] p-3 text-xs leading-relaxed text-[#0B1F16] focus:border-[#1877F2] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.fbHashtagsLabel}
                  </label>
                  <input
                    type="text"
                    value={fbHashtags}
                    onChange={(e) => setFbHashtags(e.target.value)}
                    className="min-h-[42px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3 text-xs text-[#0B1F16] focus:border-[#1877F2] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.fbCtaLabel}
                  </label>
                  <input
                    type="text"
                    value={fbCta}
                    onChange={(e) => setFbCta(e.target.value)}
                    placeholder={t.fbCtaPlaceholder}
                    className="min-h-[42px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3 text-xs text-[#0B1F16] focus:border-[#1877F2] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]"
                  />
                </div>
              </div>

              {/* Account Linking Card */}
              <MetaAccountCard
                compact={Boolean(metaStatus.connected || instagramHandle || facebookHandle)}
                lang={lang}
                metaStatus={metaStatus}
                onRefreshMetaStatus={onRefreshMetaStatus}
                facebookHandle={draftFbHandle}
                instagramHandle={draftIgHandle}
                savedFacebookHandle={facebookHandle}
                savedInstagramHandle={instagramHandle}
                onChangeHandles={(next) => {
                  setDraftFbHandle(next.facebookHandle);
                  setDraftIgHandle(next.instagramHandle);
                }}
                onSaveHandles={onSaveHandles}
                onNotify={onNotify}
              />

              {!(metaStatus.connected && activePage) && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                  {t.socialManualPublishNotice}
                </p>
              )}

              {feedback && (
                <div
                  className={`flex flex-col gap-2 rounded-xl border px-3.5 py-2.5 text-xs ${
                    feedback.isError
                      ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300'
                      : 'border-[#DCE7E0] bg-[#ECF7F1] text-[#115E3B] dark:border-[#1E3A2D] dark:bg-[#132B20] dark:text-[#6EE7B7]'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!feedback.isError && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
                    <span>{feedback.message}</span>
                  </div>
                  {feedback.permalink && (
                    <a
                      href={feedback.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-fit items-center gap-1.5 font-semibold underline underline-offset-2"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>{t.fbOpenPost}</span>
                    </a>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleSubmitFacebook()}
                disabled={publishing}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#1877F2] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#1565D8] disabled:opacity-60"
              >
                <Facebook className="h-4 w-4" />
                <span>
                  {publishing
                    ? t.fbPublishing
                    : metaStatus.connected && activePage
                      ? t.fbPublishApiButton
                      : t.fbPrepareShareButton}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Inline CameraModal for filming a Reel video right from Instagram Reel composer */}
      <CameraModal
        isOpen={reelCameraOpen}
        lang={lang}
        allowVideo
        onClose={() => setReelCameraOpen(false)}
        onConfirmPhotos={async (capturedMedia) => {
          const vid = capturedMedia.find((m) => isVideoMedia(m));
          if (!vid) return;
          const converted = await photoDataToBlob(vid);
          if (!converted) return;
          setCustomReelClip({
            dataUrl: vid,
            blob: converted.blob,
            filename: `${product.code}-reel.${converted.ext}`,
            mimeType: converted.mimeType,
          });
          setIgSelectedVideoIndex(-1);
        }}
      />
    </>
  );
}
