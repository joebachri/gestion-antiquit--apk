import { useState } from 'react';
import { CheckCircle2, Facebook, Instagram, Link2, LogOut } from 'lucide-react';
import type { Language, MetaAuthStatus } from '../types';
import { translations } from '../i18n';
import {
  disconnectMetaAuthApi,
  selectMetaTargetsApi,
  startMetaOAuthPopup,
} from '../utils/api';

interface MetaAccountCardProps {
  lang: Language;
  metaStatus: MetaAuthStatus;
  onRefreshMetaStatus: () => Promise<void>;
  facebookHandle?: string;
  instagramHandle?: string;
  onChangeHandles?: (next: { facebookHandle: string; instagramHandle: string }) => void;
  compact?: boolean;
}

export function MetaAccountCard({
  lang,
  metaStatus,
  onRefreshMetaStatus,
  facebookHandle = '',
  instagramHandle = '',
  onChangeHandles,
  compact = false,
}: MetaAccountCardProps) {
  const t = translations[lang];
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const igAccounts = metaStatus.pages
    .filter((p) => Boolean(p.igAccount))
    .map((p) => p.igAccount!);

  const handleConnect = async () => {
    setConnecting(true);
    setErrorMsg('');
    try {
      const result = await startMetaOAuthPopup();
      if (result.ok) {
        await onRefreshMetaStatus();
      } else if (result.error === 'POPUP_BLOCKED') {
        setErrorMsg(t.socialPopupBlockedError);
      } else if (result.error === 'META_OAUTH_NOT_CONFIGURED') {
        setErrorMsg(t.socialOAuthNotConfiguredHint);
      } else if (result.error && result.error !== 'CANCELED') {
        setErrorMsg(result.error);
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setConnecting(true);
    setErrorMsg('');
    try {
      await disconnectMetaAuthApi();
      await onRefreshMetaStatus();
    } finally {
      setConnecting(false);
    }
  };

  const handleSelectPage = async (pageId: string) => {
    const matchedPage = metaStatus.pages.find((p) => p.id === pageId);
    const nextIgId = matchedPage?.igAccount?.id || metaStatus.selectedIgId;
    await selectMetaTargetsApi(pageId, nextIgId);
    await onRefreshMetaStatus();
  };

  const handleSelectIg = async (igId: string) => {
    await selectMetaTargetsApi(metaStatus.selectedPageId, igId);
    await onRefreshMetaStatus();
  };

  return (
    <div className="rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-4 dark:border-[#1E3A2D] dark:bg-[#091611]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center -space-x-1">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1877F2] text-white">
              <Facebook className="h-3.5 w-3.5" />
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white">
              <Instagram className="h-3.5 w-3.5" />
            </span>
          </div>
          <h3 className="text-xs font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
            {t.socialAccountsSection}
          </h3>
        </div>

        {metaStatus.connected && (
          <button
            type="button"
            onClick={() => void handleDisconnect()}
            disabled={connecting}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            <LogOut className="h-3 w-3" />
            <span>{t.socialDisconnect}</span>
          </button>
        )}
      </div>

      {metaStatus.connected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-[#10B981]/30 bg-[#ECF7F1] px-3 py-2 text-xs text-[#115E3B] dark:border-[#10B981]/25 dark:bg-[#132B20] dark:text-[#6EE7B7]">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="truncate font-medium">
              {t.socialConnectedAs} <strong>{metaStatus.userName}</strong>
            </span>
          </div>

          {metaStatus.pages.length > 0 && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                {t.socialSelectPage}
              </label>
              <select
                value={metaStatus.selectedPageId || metaStatus.pages[0]?.id || ''}
                onChange={(e) => void handleSelectPage(e.target.value)}
                className="min-h-[40px] w-full rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs text-[#0B1F16] focus:border-[#115E3B] focus:outline-none dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#F2F9F5]"
              >
                {metaStatus.pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {igAccounts.length > 0 ? (
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                {t.socialSelectIg}
              </label>
              <select
                value={metaStatus.selectedIgId || igAccounts[0]?.id || ''}
                onChange={(e) => void handleSelectIg(e.target.value)}
                className="min-h-[40px] w-full rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs text-[#0B1F16] focus:border-[#115E3B] focus:outline-none dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#F2F9F5]"
              >
                {igAccounts.map((ig) => (
                  <option key={ig.id} value={ig.id}>
                    @{ig.username}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-[11px] leading-relaxed text-[#335947] dark:text-[#9EC0AE]">
              {t.socialNoIgBusiness}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => void handleConnect()}
            disabled={connecting}
            className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#0D4A2E] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#052E1C]"
          >
            <Link2 className="h-3.5 w-3.5" />
            <span>{connecting ? t.socialConnecting : t.socialConnectMeta}</span>
          </button>

          {errorMsg && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <p>{errorMsg}</p>
              {!metaStatus.configured && (
                <p className="mt-1.5 font-mono-code break-all text-[10px] opacity-85">
                  {t.socialOAuthCallbackLabel} {metaStatus.callbackUrl}
                </p>
              )}
            </div>
          )}

          {!compact && onChangeHandles && (
            <div className="space-y-2 border-t border-[#DCE7E0] pt-3 dark:border-[#1E3A2D]">
              <span className="block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                {t.socialHandlesOptionalLabel}
              </span>
              <input
                type="text"
                value={instagramHandle}
                onChange={(e) =>
                  onChangeHandles({
                    facebookHandle,
                    instagramHandle: e.target.value,
                  })
                }
                placeholder={t.socialInstagramHandlePlaceholder}
                className="min-h-[40px] w-full rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:outline-none dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#F2F9F5] dark:placeholder:text-[#5F8370]"
              />
              <input
                type="text"
                value={facebookHandle}
                onChange={(e) =>
                  onChangeHandles({
                    facebookHandle: e.target.value,
                    instagramHandle,
                  })
                }
                placeholder={t.socialFacebookHandlePlaceholder}
                className="min-h-[40px] w-full rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:outline-none dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#F2F9F5] dark:placeholder:text-[#5F8370]"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
