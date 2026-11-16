import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, X, Check, Upload } from 'lucide-react';
import type { Language } from '../types';
import { translations } from '../i18n';
import { compressImageBlob } from '../utils/image';

interface CameraModalProps {
  isOpen: boolean;
  lang: Language;
  singleShot?: boolean;
  onClose: () => void;
  onConfirmPhotos: (photos: string[]) => void;
}

export function CameraModal({
  isOpen,
  lang,
  singleShot = false,
  onClose,
  onConfirmPhotos,
}: CameraModalProps) {
  const t = translations[lang];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeInputRef = useRef<HTMLInputElement | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState(false);
  const [captured, setCaptured] = useState<string[]>([]);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setCaptured([]);
      setCameraError(false);
      return;
    }

    let cancelled = false;

    async function startStream() {
      setCameraError(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(true);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        if (!cancelled) setCameraError(true);
      }
    }

    startStream();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, facingMode]);

  if (!isOpen) return null;

  const handleCaptureFrame = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const maxDim = 1280;
    let w = video.videoWidth;
    let h = video.videoHeight;
    if (w > maxDim || h > maxDim) {
      if (w >= h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.84);

    setFlash(true);
    setTimeout(() => setFlash(false), 160);

    if (singleShot) {
      onConfirmPhotos([dataUrl]);
      onClose();
      return;
    }
    setCaptured((prev) => [...prev, dataUrl]);
  };

  const handleNativeFileCapture = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const results: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const compressed = await compressImageBlob(file);
        results.push(compressed);
      } catch {
        // skip unreadable file
      }
    }
    if (results.length > 0) {
      if (singleShot) {
        onConfirmPhotos([results[0]]);
        onClose();
      } else {
        setCaptured((prev) => [...prev, ...results]);
      }
    }
  };

  const handleFinish = () => {
    if (captured.length > 0) {
      onConfirmPhotos(captured);
    }
    onClose();
  };

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex flex-col bg-[#06110C] text-white"
      role="dialog"
      aria-modal="true"
      aria-label={t.cameraTitle}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20"
          aria-label={t.close}
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-sm font-semibold tracking-wide">{t.cameraTitle}</h2>

        <button
          type="button"
          onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20"
          aria-label={t.switchCamera}
          title={t.switchCamera}
        >
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      {/* Viewfinder */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
        {cameraError ? (
          <div className="max-w-sm px-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#115E3B]/40 text-[#34D399]">
              <Camera className="h-7 w-7" />
            </div>
            <p className="mb-5 text-sm leading-relaxed text-white/80">{t.cameraFallbackHint}</p>
            <button
              type="button"
              onClick={() => nativeInputRef.current?.click()}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#10B981] px-5 py-3 text-sm font-semibold text-[#052E1C] transition-transform active:scale-95"
            >
              <Upload className="h-4 w-4" />
              <span>{t.openNativeCamera}</span>
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="h-full w-full object-cover"
            />
            {flash && <div className="pointer-events-none absolute inset-0 bg-white/70" />}
          </>
        )}

        <input
          ref={nativeInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple={!singleShot}
          className="hidden"
          onChange={(e) => {
            void handleNativeFileCapture(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* Captured thumbnails strip */}
      {captured.length > 0 && (
        <div className="flex items-center gap-2.5 overflow-x-auto border-t border-white/10 bg-[#0A1812] px-4 py-2.5">
          {captured.map((img, index) => (
            <div key={index} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[#34D399]/50">
              <img src={img} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setCaptured((prev) => prev.filter((_, i) => i !== index))}
                className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/75 text-white"
                aria-label={t.removePhoto}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Shutter Controls */}
      <div className="pb-safe flex items-center justify-between gap-4 border-t border-white/10 bg-[#0A1812] px-6 py-4">
        <button
          type="button"
          onClick={() => nativeInputRef.current?.click()}
          className="flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 px-3.5 py-2 text-xs font-medium text-white/90 hover:bg-white/10"
        >
          <Upload className="h-4 w-4" />
          <span className="whitespace-nowrap">{t.photoLabel}</span>
        </button>

        {!cameraError && (
          <button
            type="button"
            onClick={handleCaptureFrame}
            aria-label={t.cameraCapture}
            className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-[#10B981] text-[#052E1C] shadow-lg transition-transform active:scale-90"
          >
            <Camera className="h-7 w-7" />
          </button>
        )}

        <button
          type="button"
          onClick={handleFinish}
          disabled={captured.length === 0}
          className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#115E3B] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0D4A2E] disabled:opacity-40"
        >
          <Check className="h-4 w-4" />
          <span className="whitespace-nowrap">
            {t.cameraDone} {captured.length > 0 ? `(${captured.length})` : ''}
          </span>
        </button>
      </div>
    </div>
  );
}
