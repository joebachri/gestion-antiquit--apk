import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Play, RefreshCw, Square, Upload, Video, X } from 'lucide-react';
import type { Language } from '../types';
import { translations } from '../i18n';
import { compressImageBlob, isVideoMedia, readVideoAsDataUrl } from '../utils/image';
import { isIosDevice } from '../utils/download';

interface CameraModalProps {
  isOpen: boolean;
  lang: Language;
  singleShot?: boolean;
  allowVideo?: boolean;
  onClose: () => void;
  onConfirmPhotos: (photos: string[]) => void;
}

const MAX_VIDEO_BYTES = 60 * 1024 * 1024;

function pickRecorderMimeType(hasAudio: boolean): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const preferMp4 = isIosDevice();
  const webmCandidates = hasAudio
    ? ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm']
    : ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'];
  const mp4Candidates = hasAudio
    ? ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4']
    : ['video/mp4;codecs=avc1', 'video/mp4'];
  const candidates = preferMp4
    ? [...mp4Candidates, ...webmCandidates]
    : [...webmCandidates, ...mp4Candidates];
  for (const type of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(type)) return type;
    } catch {
      // ignore unsupported check
    }
  }
  return '';
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function CameraModal({
  isOpen,
  lang,
  singleShot = false,
  allowVideo = false,
  onClose,
  onConfirmPhotos,
}: CameraModalProps) {
  const t = translations[lang];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const discardOnStopRef = useRef(false);
  const finishAfterStopRef = useRef(false);
  const pendingPosterRef = useRef<string>('');
  const capturedRef = useRef<string[]>([]);
  const nativeInputRef = useRef<HTMLInputElement | null>(null);
  const nativeVideoInputRef = useRef<HTMLInputElement | null>(null);

  const canUseVideo = allowVideo && !singleShot;
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [captured, setCaptured] = useState<string[]>([]);
  const [videoPosters, setVideoPosters] = useState<Record<number, string>>({});
  const [flash, setFlash] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [sizeError, setSizeError] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    capturedRef.current = captured;
  }, [captured]);

  const stopRecordingTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startLiveStream = async (fromUserTap = false) => {
    setCameraError(false);
    setNeedsTap(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(true);
      return;
    }

    const wantAudio = canUseVideo && mode === 'video';
    const constraintsList: MediaStreamConstraints[] = wantAudio
      ? [
          {
            video: {
              facingMode,
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: true,
          },
          {
            video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          },
          { video: { facingMode }, audio: false },
          { video: true, audio: false },
        ]
      : [
          {
            video: {
              facingMode,
              width: { ideal: 1280 },
              height: { ideal: 960 },
            },
            audio: false,
          },
          { video: { facingMode }, audio: false },
          { video: true, audio: false },
        ];

    let stream: MediaStream | null = null;
    let lastErrorName = '';
    for (const constraints of constraintsList) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (err) {
        lastErrorName = err instanceof Error ? err.name : '';
      }
    }

    if (!stream) {
      if (!mountedRef.current) return;
      if (!fromUserTap && (lastErrorName === 'NotAllowedError' || lastErrorName === 'AbortError')) {
        setNeedsTap(true);
      } else {
        setCameraError(true);
      }
      return;
    }

    if (!mountedRef.current || !isOpen) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    streamRef.current = stream;
    const video = videoRef.current;
    if (video) {
      // Essential iOS Safari inline playback attributes
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.setAttribute('muted', '');
      video.defaultMuted = true;
      video.muted = true;
      video.autoplay = true;
      video.srcObject = stream;

      if (video.readyState < 1) {
        await new Promise<void>((resolve) => {
          const onMeta = () => {
            video.removeEventListener('loadedmetadata', onMeta);
            resolve();
          };
          video.addEventListener('loadedmetadata', onMeta);
          setTimeout(resolve, 1200);
        });
      }

      try {
        await video.play();
        if (video.paused && !fromUserTap && mountedRef.current) {
          setNeedsTap(true);
        }
      } catch {
        if (!fromUserTap && mountedRef.current) {
          setNeedsTap(true);
        }
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      discardOnStopRef.current = true;
      finishAfterStopRef.current = false;
      pendingPosterRef.current = '';
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      recorderRef.current = null;
      stopRecordingTimer();
      setIsRecording(false);
      setIsProcessingVideo(false);
      setRecordSeconds(0);
      setSizeError('');
      setMode('photo');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setCaptured([]);
      setVideoPosters({});
      setCameraError(false);
      setNeedsTap(false);
      return;
    }

    discardOnStopRef.current = false;
    finishAfterStopRef.current = false;
    void startLiveStream(false);

    return () => {
      discardOnStopRef.current = true;
      finishAfterStopRef.current = false;
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      recorderRef.current = null;
      stopRecordingTimer();
      setIsRecording(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, facingMode, mode, canUseVideo]);

  if (!isOpen) return null;

  const captureVideoFrameAsJpeg = (maxDim: number, quality: number): string => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return '';

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
    if (!ctx) return '';
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  };

  const handleCaptureFrame = () => {
    const dataUrl = captureVideoFrameAsJpeg(1280, 0.84);
    if (!dataUrl) return;

    setFlash(true);
    setTimeout(() => setFlash(false), 160);

    if (singleShot) {
      onConfirmPhotos([dataUrl]);
      onClose();
      return;
    }
    setCaptured((prev) => [...prev, dataUrl]);
  };

  const handleStartRecording = () => {
    const stream = streamRef.current;
    const hasLiveVideo = stream?.getVideoTracks().some((track) => track.readyState === 'live');
    if (!stream || !hasLiveVideo || typeof MediaRecorder === 'undefined') {
      nativeVideoInputRef.current?.click();
      return;
    }

    setSizeError('');
    chunksRef.current = [];
    discardOnStopRef.current = false;
    finishAfterStopRef.current = false;
    pendingPosterRef.current = captureVideoFrameAsJpeg(360, 0.72);

    const hasAudio = stream.getAudioTracks().some((track) => track.readyState === 'live');
    const mimeType = pickRecorderMimeType(hasAudio);

    let recorder: MediaRecorder | null = null;
    let started = false;

    // Try preferred codec + 250ms chunks first; fall back cleanly if options or timeslice fail
    const attempts: Array<() => MediaRecorder> = [
      () => {
        const r = mimeType
          ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_500_000 })
          : new MediaRecorder(stream, { videoBitsPerSecond: 1_500_000 });
        return r;
      },
      () => (mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)),
      () => new MediaRecorder(stream),
    ];

    for (let i = 0; i < attempts.length; i += 1) {
      try {
        const candidate = attempts[i]();
        candidate.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };
        if (i === 0) {
          candidate.start(250);
        } else {
          candidate.start();
        }
        recorder = candidate;
        started = true;
        break;
      } catch {
        chunksRef.current = [];
      }
    }

    if (!started || !recorder) {
      nativeVideoInputRef.current?.click();
      return;
    }

    recorder.onerror = () => {
      stopRecordingTimer();
      setIsRecording(false);
      setRecordSeconds(0);
      finishAfterStopRef.current = false;
      setSizeError(t.videoRecordEmptyError);
    };

    recorder.onstop = async () => {
      stopRecordingTimer();
      setIsRecording(false);
      setRecordSeconds(0);
      recorderRef.current = null;

      if (discardOnStopRef.current) {
        chunksRef.current = [];
        finishAfterStopRef.current = false;
        pendingPosterRef.current = '';
        return;
      }

      // Allow any late WebView ondataavailable flush tick before checking chunks
      if (chunksRef.current.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 80));
      }

      if (chunksRef.current.length === 0) {
        finishAfterStopRef.current = false;
        pendingPosterRef.current = '';
        setSizeError(t.videoRecordEmptyError);
        return;
      }

      const rawType = recorder?.mimeType || mimeType || 'video/webm';
      const cleanMime = (rawType.split(';')[0] || 'video/webm').trim();
      const videoBlob = new Blob(chunksRef.current, { type: cleanMime });
      chunksRef.current = [];

      if (videoBlob.size === 0) {
        finishAfterStopRef.current = false;
        pendingPosterRef.current = '';
        setSizeError(t.videoRecordEmptyError);
        return;
      }

      if (videoBlob.size > MAX_VIDEO_BYTES) {
        finishAfterStopRef.current = false;
        pendingPosterRef.current = '';
        setSizeError(t.videoTooLargeError);
        return;
      }

      setIsProcessingVideo(true);
      try {
        const dataUrl = await readVideoAsDataUrl(videoBlob, cleanMime);
        if (!dataUrl) {
          finishAfterStopRef.current = false;
          setSizeError(t.videoRecordEmptyError);
          return;
        }
        const poster = pendingPosterRef.current;
        pendingPosterRef.current = '';
        const nextIndex = capturedRef.current.length;
        const nextList = [...capturedRef.current, dataUrl];
        capturedRef.current = nextList;
        setCaptured(nextList);
        if (poster) {
          setVideoPosters((prev) => ({ ...prev, [nextIndex]: poster }));
        }

        if (finishAfterStopRef.current) {
          finishAfterStopRef.current = false;
          onConfirmPhotos(nextList);
          onClose();
        }
      } catch {
        finishAfterStopRef.current = false;
        setSizeError(t.videoRecordEmptyError);
      } finally {
        setIsProcessingVideo(false);
      }
    };

    recorderRef.current = recorder;
    setIsRecording(true);
    setRecordSeconds(0);
    stopRecordingTimer();
    timerRef.current = setInterval(() => {
      setRecordSeconds((s) => s + 1);
    }, 1000);
  };

  const handleStopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        if (recorder.state === 'recording' && typeof recorder.requestData === 'function') {
          recorder.requestData();
        }
      } catch {
        // ignore requestData errors on browsers that disallow it
      }
      try {
        recorder.stop();
      } catch {
        stopRecordingTimer();
        setIsRecording(false);
      }
    }
  };

  const handleNativeFileCapture = async (
    files: FileList | null,
    expectedKind: 'photo' | 'video' = 'photo'
  ) => {
    if (!files || files.length === 0) return;
    setSizeError('');
    let sawTooLarge = false;
    const results: string[] = [];

    for (const file of Array.from(files)) {
      const isVideoFile =
        expectedKind === 'video' ||
        file.type.startsWith('video/') ||
        /\.(mp4|webm|mov|m4v|3gp|mkv|avi)$/i.test(file.name);

      try {
        if (isVideoFile) {
          if (!canUseVideo) continue;
          if (file.size === 0) continue;
          if (file.size > MAX_VIDEO_BYTES) {
            sawTooLarge = true;
            setSizeError(t.videoTooLargeError);
            continue;
          }
          const fallbackMime = file.type.startsWith('video/') ? file.type : 'video/mp4';
          const videoUrl = await readVideoAsDataUrl(file, fallbackMime);
          if (videoUrl) results.push(videoUrl);
        } else {
          const compressed = await compressImageBlob(file);
          results.push(compressed);
        }
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
    } else if (expectedKind === 'video' && !sawTooLarge) {
      setSizeError(t.videoRecordEmptyError);
    }
  };

  const handleFinish = () => {
    if (isRecording) {
      finishAfterStopRef.current = true;
      handleStopRecording();
      return;
    }
    if (isProcessingVideo) return;
    if (captured.length > 0) {
      onConfirmPhotos(captured);
    }
    onClose();
  };

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex h-dvh flex-col bg-[#06110C] text-white"
      role="dialog"
      aria-modal="true"
      aria-label={t.cameraTitle}
    >
      {/* Top Bar */}
      <div className="pt-safe-compact flex items-center justify-between border-b border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20"
          aria-label={t.close}
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center">
          <h2 className="text-sm font-semibold tracking-wide">{t.cameraTitle}</h2>
          {isRecording && (
            <span className="tabular-nums mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-red-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              REC {formatDuration(recordSeconds)}
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={isRecording || isProcessingVideo}
          onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 disabled:opacity-40"
          aria-label={t.switchCamera}
          title={t.switchCamera}
        >
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      {/* Photo / Video mode switch */}
      {canUseVideo && !cameraError && (
        <div className="flex justify-center border-b border-white/10 bg-[#0A1812] px-4 py-2">
          <div className="inline-flex rounded-xl bg-white/10 p-1">
            <button
              type="button"
              disabled={isRecording || isProcessingVideo}
              onClick={() => setMode('photo')}
              className={`flex min-h-[36px] items-center gap-1.5 rounded-lg px-4 text-xs font-semibold transition-colors disabled:opacity-50 ${
                mode === 'photo' ? 'bg-[#10B981] text-[#052E1C]' : 'text-white/80 hover:text-white'
              }`}
            >
              <Camera className="h-3.5 w-3.5" />
              <span>{t.cameraModePhoto}</span>
            </button>
            <button
              type="button"
              disabled={isRecording || isProcessingVideo}
              onClick={() => setMode('video')}
              className={`flex min-h-[36px] items-center gap-1.5 rounded-lg px-4 text-xs font-semibold transition-colors disabled:opacity-50 ${
                mode === 'video' ? 'bg-red-500 text-white' : 'text-white/80 hover:text-white'
              }`}
            >
              <Video className="h-3.5 w-3.5" />
              <span>{t.cameraModeVideo}</span>
            </button>
          </div>
        </div>
      )}

      {/* Viewfinder */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
        {sizeError && (
          <div className="absolute left-4 right-4 top-4 z-10 rounded-xl border border-red-400/40 bg-red-950/90 px-4 py-2.5 text-center text-xs font-medium text-red-100">
            {sizeError}
          </div>
        )}

        {cameraError ? (
          <div className="max-w-sm px-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#115E3B]/40 text-[#34D399]">
              <Camera className="h-7 w-7" />
            </div>
            <p className="mb-5 text-sm leading-relaxed text-white/80">{t.cameraFallbackHint}</p>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => nativeInputRef.current?.click()}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#10B981] px-5 py-3 text-sm font-semibold text-[#052E1C] transition-transform active:scale-95"
              >
                <Camera className="h-4 w-4" />
                <span>{t.openNativeCamera}</span>
              </button>

              {canUseVideo && (
                <button
                  type="button"
                  onClick={() => nativeVideoInputRef.current?.click()}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-transform active:scale-95"
                >
                  <Video className="h-4 w-4" />
                  <span>{t.openNativeVideoCamera}</span>
                </button>
              )}
            </div>
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
            {needsTap && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/75 px-6 text-center">
                <p className="max-w-xs text-xs leading-relaxed text-white/85">
                  {t.qrScannerCameraTapHint}
                </p>
                <button
                  type="button"
                  onClick={() => void startLiveStream(true)}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#10B981] px-5 py-3 text-sm font-semibold text-[#052E1C] transition-transform active:scale-95"
                >
                  <Camera className="h-4 w-4" />
                  <span>{t.qrScannerEnableCamera}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    mode === 'video' && canUseVideo
                      ? nativeVideoInputRef.current?.click()
                      : nativeInputRef.current?.click()
                  }
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white"
                >
                  <Upload className="h-4 w-4" />
                  <span>
                    {mode === 'video' && canUseVideo ? t.openNativeVideoCamera : t.openNativeCamera}
                  </span>
                </button>
              </div>
            )}
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
            void handleNativeFileCapture(e.target.files, 'photo');
            e.target.value = '';
          }}
        />

        {canUseVideo && (
          <input
            ref={nativeVideoInputRef}
            type="file"
            accept="video/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              void handleNativeFileCapture(e.target.files, 'video');
              e.target.value = '';
            }}
          />
        )}
      </div>

      {/* Captured thumbnails strip */}
      {captured.length > 0 && (
        <div className="flex items-center gap-2.5 overflow-x-auto border-t border-white/10 bg-[#0A1812] px-4 py-2.5">
          {captured.map((media, index) => {
            const isVid = isVideoMedia(media);
            const poster = videoPosters[index];
            return (
              <div
                key={index}
                className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[#34D399]/50 bg-black"
              >
                {isVid ? (
                  <>
                    <video
                      src={media}
                      poster={poster || undefined}
                      muted
                      playsInline
                      preload="auto"
                      onLoadedData={(e) => {
                        const v = e.currentTarget;
                        if (v.currentTime === 0) {
                          try {
                            v.currentTime = 0.05;
                          } catch {
                            // ignore seek errors
                          }
                        }
                      }}
                      className="h-full w-full object-cover"
                    />
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
                      <Play className="h-4 w-4 fill-white text-white" />
                    </span>
                  </>
                ) : (
                  <img src={media} alt="" className="h-full w-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => {
                    setCaptured((prev) => prev.filter((_, i) => i !== index));
                    setVideoPosters((prev) => {
                      const next: Record<number, string> = {};
                      Object.entries(prev).forEach(([k, val]) => {
                        const num = Number(k);
                        if (num < index) next[num] = val;
                        else if (num > index) next[num - 1] = val;
                      });
                      return next;
                    });
                  }}
                  className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/75 text-white"
                  aria-label={t.removePhoto}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Shutter Controls */}
      <div className="pb-safe flex items-center justify-between gap-4 border-t border-white/10 bg-[#0A1812] px-6 py-4">
        <button
          type="button"
          disabled={isRecording || isProcessingVideo}
          onClick={() =>
            mode === 'video' && canUseVideo
              ? nativeVideoInputRef.current?.click()
              : nativeInputRef.current?.click()
          }
          className="flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 px-3.5 py-2 text-xs font-medium text-white/90 hover:bg-white/10 disabled:opacity-40"
        >
          <Upload className="h-4 w-4" />
          <span className="whitespace-nowrap">
            {mode === 'video' && canUseVideo ? t.videoLabel : t.photoLabel}
          </span>
        </button>

        {!cameraError &&
          (mode === 'video' && canUseVideo ? (
            <button
              type="button"
              disabled={isProcessingVideo}
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              aria-label={isRecording ? t.cameraRecordStop : t.cameraRecordStart}
              className={`flex h-16 w-16 items-center justify-center rounded-full border-4 border-white shadow-lg transition-transform active:scale-90 disabled:opacity-50 ${
                isRecording ? 'bg-red-600 text-white' : 'bg-red-500 text-white'
              }`}
            >
              {isRecording ? (
                <Square className="h-6 w-6 fill-white" />
              ) : (
                <Video className="h-7 w-7" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCaptureFrame}
              aria-label={t.cameraCapture}
              className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-[#10B981] text-[#052E1C] shadow-lg transition-transform active:scale-90"
            >
              <Camera className="h-7 w-7" />
            </button>
          ))}

        <button
          type="button"
          onClick={handleFinish}
          disabled={isProcessingVideo || (!isRecording && captured.length === 0)}
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
