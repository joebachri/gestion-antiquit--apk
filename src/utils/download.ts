import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { ShareableMediaFile } from './image';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to encode blob'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function tryCopyText(text: string): Promise<boolean> {
  if (!text || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function saveOrShareBlob(
  blob: Blob,
  filename: string,
  shareTitle?: string,
  shareText?: string
): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const base64Data = await blobToBase64(blob);
    const saved = await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Cache,
      recursive: true,
    });
    await Share.share({
      title: shareTitle || filename,
      text: shareText,
      files: [saved.uri],
      dialogTitle: shareTitle || filename,
    });
    return;
  }

  triggerBrowserDownload(blob, filename);
}

export async function downloadBlobs(
  files: Array<{ blob: Blob; filename: string }>,
  shareTitle?: string,
  shareText?: string
): Promise<void> {
  if (files.length === 0) return;

  if (Capacitor.isNativePlatform()) {
    await shareProductMediaAndText({
      files: files.map((f) => ({
        blob: f.blob,
        filename: f.filename,
        mimeType: f.blob.type || 'image/jpeg',
      })),
      title: shareTitle || files[0].filename,
      text: shareText || '',
      dialogTitle: shareTitle,
    });
    return;
  }

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
    triggerBrowserDownload(file.blob, file.filename);
  }
}

export type ShareOutcome = 'shared' | 'downloaded' | 'copied' | 'canceled';

export function canWebShareFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false;
  }
  if (typeof navigator.canShare !== 'function') {
    return false;
  }
  try {
    const probe = new File([new Uint8Array([0])], 'probe.jpg', { type: 'image/jpeg' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export async function shareProductMediaAndText(options: {
  files: ShareableMediaFile[];
  title: string;
  text: string;
  dialogTitle?: string;
}): Promise<{ outcome: ShareOutcome; copiedText: boolean }> {
  const { files, title, text, dialogTitle } = options;

  // Always place caption on clipboard best-effort so apps like Facebook
  // (which strip EXTRA_TEXT when receiving images) let the merchant paste immediately.
  const copiedText = await tryCopyText(text);

  if (Capacitor.isNativePlatform()) {
    const batchId = Date.now();
    const uris: string[] = [];

    for (let i = 0; i < files.length; i += 1) {
      const f = files[i];
      const base64Data = await blobToBase64(f.blob);
      const saved = await Filesystem.writeFile({
        path: `share/${batchId}/${i + 1}-${f.filename}`,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true,
      });
      uris.push(saved.uri);
    }

    try {
      await Share.share({
        title,
        text,
        ...(uris.length > 0 ? { files: uris } : {}),
        dialogTitle: dialogTitle || title,
      });
      return { outcome: 'shared', copiedText };
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (msg.includes('cancel') || msg.includes('abort')) {
        return { outcome: 'canceled', copiedText };
      }
      throw err;
    }
  }

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const webFiles = files.map(
      (f) => new File([f.blob], f.filename, { type: f.mimeType || f.blob.type || 'image/jpeg' })
    );

    if (webFiles.length > 0 && navigator.canShare?.({ files: webFiles })) {
      try {
        await navigator.share({ title, text, files: webFiles });
        return { outcome: 'shared', copiedText };
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return { outcome: 'canceled', copiedText };
        }
        // Some browsers disallow >1 file even when canShare({ files }) returns true:
        // try at least primary photo before falling back to downloads.
        if (webFiles.length > 1 && navigator.canShare?.({ files: [webFiles[0]] })) {
          try {
            await navigator.share({ title, text, files: [webFiles[0]] });
            return { outcome: 'shared', copiedText };
          } catch (singleErr) {
            if (singleErr instanceof DOMException && singleErr.name === 'AbortError') {
              return { outcome: 'canceled', copiedText };
            }
          }
        }
      }
    }
  }

  // Fallback (e.g. desktop browsers without navigator.share({ files })):
  // download every product photo and keep text copied to clipboard.
  if (files.length > 0) {
    await downloadBlobs(files, title, text);
    return { outcome: 'downloaded', copiedText };
  }

  return { outcome: copiedText ? 'copied' : 'canceled', copiedText };
}
