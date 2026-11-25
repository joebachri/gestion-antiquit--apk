import {
  BookOpen,
  Calculator,
  Camera,
  CheckCircle2,
  Moon,
  QrCode,
  Settings,
  Store,
  Sun,
} from 'lucide-react';
import type { Language } from '../types';
import { translations } from '../i18n';
import { AppAntiqueLogo } from './AppLogo';

interface HeaderProps {
  lang: Language;
  onChangeLang: (lang: Language) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  customLogo: string;
  storeName?: string;
  linkedAccountLabel?: string;
  onOpenLogoSettings: () => void;
  onOpenGuide: () => void;
  onOpenCalculator: () => void;
  onOpenQrScanner: () => void;
}

export function Header({
  lang,
  onChangeLang,
  isDark,
  onToggleTheme,
  customLogo,
  storeName,
  linkedAccountLabel,
  onOpenLogoSettings,
  onOpenGuide,
  onOpenCalculator,
  onOpenQrScanner,
}: HeaderProps) {
  const t = translations[lang];
  const cleanStoreName = (storeName || '').trim();

  return (
    <header
      dir="ltr"
      className="pt-safe-compact z-30 border-b border-[#DCE7E0] bg-white/95 backdrop-blur-md sm:sticky sm:top-0 dark:border-[#1E3A2D] dark:bg-[#0A1812]/95"
    >
      {/* Top Tier: App's Antique GA Logo on the Left | User's Logo & Optional Store Name on the Right */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-2.5 sm:px-6">
        {/* Left: App's Own Antique "GA" Logo + App Name */}
        <div className="flex min-w-0 items-center gap-2.5">
          <AppAntiqueLogo size="md" />
          <div className="min-w-0">
            <span className="block truncate font-display text-sm font-bold tracking-tight text-[#0B1F16] sm:text-lg dark:text-[#F2F9F5]">
              {t.brandName}
            </span>
            <span className="hidden truncate text-[11px] font-medium text-[#335947] sm:block dark:text-[#9EC0AE]">
              {t.brandSubtitle}
            </span>
          </div>
        </div>

        {/* Right: User's Customizable Store Logo + Optional Store Name */}
        <button
          type="button"
          onClick={onOpenLogoSettings}
          title={t.customizeLogo}
          aria-label={t.customizeLogo}
          className="group flex min-h-[44px] min-w-0 items-center gap-2 rounded-xl px-1.5 py-1 text-right transition-colors hover:bg-[#ECF7F1]/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#115E3B] sm:gap-2.5 sm:px-2 dark:hover:bg-[#162E23]"
        >
          <div className="min-w-0 text-right">
            {cleanStoreName ? (
              <span className="block truncate font-display text-sm font-bold tracking-tight text-[#0B1F16] sm:text-base dark:text-[#F2F9F5]">
                {cleanStoreName}
              </span>
            ) : !customLogo ? (
              <span className="block truncate text-xs font-semibold text-[#335947] sm:text-sm dark:text-[#9EC0AE]">
                {t.yourStoreFallback}
              </span>
            ) : null}

            {linkedAccountLabel && (
              <span className="flex items-center justify-end gap-1 truncate text-[11px] font-semibold text-[#115E3B] dark:text-[#34D399]">
                <CheckCircle2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{linkedAccountLabel}</span>
              </span>
            )}
          </div>

          <div className="relative shrink-0">
            {customLogo ? (
              <img
                src={customLogo}
                alt={cleanStoreName || t.yourStoreFallback}
                referrerPolicy="no-referrer"
                className="h-11 w-11 rounded-xl border border-[#DCE7E0] object-cover dark:border-[#1E3A2D]"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-dashed border-[#115E3B]/40 bg-[#ECF7F1]/75 text-[#115E3B] transition-colors group-hover:border-[#115E3B] dark:border-[#34D399]/40 dark:bg-[#132B20]/80 dark:text-[#34D399]">
                <Store className="h-5 w-5" />
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-[#115E3B] text-white dark:border-[#0A1812] dark:bg-[#10B981] dark:text-[#052E1C]">
              <Camera className="h-2.5 w-2.5" />
            </span>
          </div>
        </button>
      </div>

      {/* Bottom Tier: Arranged Utility Controls Below the Logos */}
      <div className="border-t border-[#DCE7E0]/75 bg-[#F7FAF8]/70 dark:border-[#1E3A2D]/75 dark:bg-[#08140F]/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-1.5 sm:px-6">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? t.toggleLight : t.toggleDark}
              title={isDark ? t.toggleLight : t.toggleDark}
              className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-[#DCE7E0] bg-white text-[#115E3B] transition-colors hover:bg-[#ECF7F1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#115E3B] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#34D399] dark:hover:bg-[#162E23]"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <div
              role="group"
              aria-label="Language"
              className="flex min-h-[40px] items-center rounded-xl border border-[#DCE7E0] bg-white p-0.5 dark:border-[#1E3A2D] dark:bg-[#102119]"
            >
              <button
                type="button"
                onClick={() => onChangeLang('fr')}
                className={`min-h-[34px] rounded-lg px-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  lang === 'fr'
                    ? 'bg-[#115E3B] text-white dark:bg-[#10B981] dark:text-[#052E1C]'
                    : 'text-[#335947] hover:text-[#0B1F16] dark:text-[#9EC0AE] dark:hover:text-white'
                }`}
              >
                FR
              </button>
              <button
                type="button"
                onClick={() => onChangeLang('ar')}
                className={`min-h-[34px] rounded-lg px-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  lang === 'ar'
                    ? 'bg-[#115E3B] text-white dark:bg-[#10B981] dark:text-[#052E1C]'
                    : 'text-[#335947] hover:text-[#0B1F16] dark:text-[#9EC0AE] dark:hover:text-white'
                }`}
              >
                العربية
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={onOpenQrScanner}
              aria-label={t.qrScanButtonLabel}
              title={t.qrScanButtonLabel}
              className="flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-xl bg-[#115E3B] px-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#0D4A2E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#115E3B] whitespace-nowrap shrink-0 sm:px-3 dark:bg-[#10B981] dark:text-[#052E1C] dark:hover:bg-[#059669]"
            >
              <QrCode className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{t.qrScanButtonLabel}</span>
            </button>

            <button
              type="button"
              onClick={onOpenCalculator}
              aria-label={t.calculatorTitle}
              title={t.calculatorTitle}
              className="flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-white px-2.5 text-xs font-semibold text-[#115E3B] transition-colors hover:bg-[#ECF7F1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#115E3B] whitespace-nowrap shrink-0 sm:px-3 dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#34D399] dark:hover:bg-[#162E23]"
            >
              <Calculator className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{t.calculatorButtonLabel}</span>
            </button>

            <button
              type="button"
              onClick={onOpenGuide}
              aria-label={t.guideTitle}
              title={t.guideTitle}
              className="flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-[#ECF7F1] px-2.5 text-xs font-semibold text-[#115E3B] transition-colors hover:bg-[#DCF0E4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#115E3B] whitespace-nowrap shrink-0 sm:px-3 dark:border-[#1E3A2D] dark:bg-[#132B20] dark:text-[#34D399] dark:hover:bg-[#1A392B]"
            >
              <BookOpen className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{t.guideButtonLabel}</span>
            </button>

            <button
              type="button"
              onClick={onOpenLogoSettings}
              aria-label={t.logoModalTitle}
              title={t.logoModalTitle}
              className="flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-white px-2.5 text-xs font-semibold text-[#115E3B] transition-colors hover:bg-[#ECF7F1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#115E3B] whitespace-nowrap shrink-0 sm:px-3 dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#34D399] dark:hover:bg-[#162E23]"
            >
              <Settings className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{t.settingsButtonLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
