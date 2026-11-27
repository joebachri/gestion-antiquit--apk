import { Camera, Store } from 'lucide-react';
import type { Language } from '../types';
import { translations } from '../i18n';
import { AppAntiqueLogo } from './AppLogo';

interface HeaderProps {
  lang: Language;
  customLogo: string;
  storeName?: string;
  onGoHome: () => void;
  onOpenLogoSettings: () => void;
}

export function Header({
  lang,
  customLogo,
  storeName,
  onGoHome,
  onOpenLogoSettings,
}: HeaderProps) {
  const t = translations[lang];
  const cleanStoreName = (storeName || '').trim();

  return (
    <header
      dir="ltr"
      className="pt-safe-compact sticky top-0 z-30 border-b border-[#DCE7E0] bg-white/95 backdrop-blur-md dark:border-[#1E3A2D] dark:bg-[#0A1812]/95"
    >
      <div className="mx-auto flex min-h-[64px] max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
        {/* Application Logo & Name */}
        <button
          type="button"
          onClick={onGoHome}
          aria-label={t.launcherBackHome}
          className="flex min-h-[44px] min-w-0 items-center gap-2.5 rounded-xl px-1.5 py-1 text-left transition-colors hover:bg-[#ECF7F1]/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#115E3B] dark:hover:bg-[#162E23]"
        >
          <AppAntiqueLogo size="md" />
          <span className="truncate font-display text-base font-bold tracking-tight text-[#0B1F16] sm:text-lg dark:text-[#F2F9F5]">
            {t.brandName}
          </span>
        </button>

        {/* User Name & Logo */}
        <button
          type="button"
          onClick={onOpenLogoSettings}
          title={t.customizeLogo}
          aria-label={t.customizeLogo}
          className="group flex min-h-[44px] min-w-0 items-center gap-2.5 rounded-xl px-1.5 py-1 text-right transition-colors hover:bg-[#ECF7F1]/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#115E3B] dark:hover:bg-[#162E23]"
        >
          <span className="max-w-[140px] truncate font-display text-sm font-bold tracking-tight text-[#0B1F16] sm:max-w-[240px] sm:text-base dark:text-[#F2F9F5]">
            {cleanStoreName || t.yourStoreFallback}
          </span>

          <div className="relative shrink-0">
            {customLogo ? (
              <img
                src={customLogo}
                alt={cleanStoreName || t.yourStoreFallback}
                referrerPolicy="no-referrer"
                className="h-10 w-10 rounded-xl border border-[#DCE7E0] object-cover sm:h-11 sm:w-11 dark:border-[#1E3A2D]"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-[#115E3B]/40 bg-[#ECF7F1]/75 text-[#115E3B] transition-colors group-hover:border-[#115E3B] sm:h-11 sm:w-11 dark:border-[#34D399]/40 dark:bg-[#132B20]/80 dark:text-[#34D399]">
                <Store className="h-5 w-5" />
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-[#115E3B] text-white dark:border-[#0A1812] dark:bg-[#10B981] dark:text-[#052E1C]">
              <Camera className="h-2.5 w-2.5" />
            </span>
          </div>
        </button>
      </div>
    </header>
  );
}
