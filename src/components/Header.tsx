import { BookOpen, Moon, Sun, Camera } from 'lucide-react';
import type { Language } from '../types';
import { translations } from '../i18n';

interface HeaderProps {
  lang: Language;
  onChangeLang: (lang: Language) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  customLogo: string;
  onOpenLogoSettings: () => void;
  onOpenGuide: () => void;
}

export function DefaultBabSaidaLogo() {
  return (
    <svg
      viewBox="0 0 40 40"
      className="h-9 w-9 shrink-0 text-[#115E3B] dark:text-[#34D399]"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="1.5"
        y="1.5"
        width="37"
        height="37"
        rx="10"
        className="fill-[#ECF7F1] stroke-[#115E3B]/30 dark:fill-[#0F2A1E] dark:stroke-[#34D399]/35"
        strokeWidth="1.5"
      />
      <path
        d="M12 31V18.5C12 13.5 15.5 9.5 20 8C24.5 9.5 28 13.5 28 18.5V31"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 31V19.5C15.5 16.2 17.5 13.7 20 12.6C22.5 13.7 24.5 16.2 24.5 19.5V31"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M9.5 31H30.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="20" cy="21" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function Header({
  lang,
  onChangeLang,
  isDark,
  onToggleTheme,
  customLogo,
  onOpenLogoSettings,
  onOpenGuide,
}: HeaderProps) {
  const t = translations[lang];

  return (
    <header
      dir="ltr"
      className="sticky top-0 z-30 border-b border-[#DCE7E0] bg-white/90 backdrop-blur-md dark:border-[#1E3A2D] dark:bg-[#0A1812]/90"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:gap-3 sm:px-6">
        {/* Left side ("Côté opposé"): Theme Toggle + Language Switcher + Guide */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? t.toggleLight : t.toggleDark}
            title={isDark ? t.toggleLight : t.toggleDark}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] text-[#115E3B] transition-colors hover:bg-[#ECF7F1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#115E3B] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#34D399] dark:hover:bg-[#162E23]"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <div
            role="group"
            aria-label="Language"
            className="flex min-h-[44px] items-center rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] p-1 dark:border-[#1E3A2D] dark:bg-[#102119]"
          >
            <button
              type="button"
              onClick={() => onChangeLang('fr')}
              className={`min-h-[36px] rounded-lg px-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 sm:px-2.5 ${
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
              className={`min-h-[36px] rounded-lg px-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 sm:px-2.5 ${
                lang === 'ar'
                  ? 'bg-[#115E3B] text-white dark:bg-[#10B981] dark:text-[#052E1C]'
                  : 'text-[#335947] hover:text-[#0B1F16] dark:text-[#9EC0AE] dark:hover:text-white'
              }`}
            >
              العربية
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenGuide}
            aria-label={t.guideTitle}
            title={t.guideTitle}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-[#ECF7F1] px-2.5 text-xs font-semibold text-[#115E3B] transition-colors hover:bg-[#DCF0E4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#115E3B] whitespace-nowrap shrink-0 sm:px-3 dark:border-[#1E3A2D] dark:bg-[#132B20] dark:text-[#34D399] dark:hover:bg-[#1A392B]"
          >
            <BookOpen className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{t.guideButtonLabel}</span>
          </button>
        </div>

        {/* Right side ("Côté droit"): Brand Name + Customizable Logo slot */}
        <button
          type="button"
          onClick={onOpenLogoSettings}
          title={t.customizeLogo}
          aria-label={t.customizeLogo}
          className="group flex min-h-[44px] min-w-0 items-center gap-2 rounded-xl px-1.5 py-1 text-right transition-colors hover:bg-[#ECF7F1]/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#115E3B] sm:gap-2.5 sm:px-2 dark:hover:bg-[#162E23]"
        >
          <div className="min-w-0 text-right">
            <span className="block truncate font-display text-base font-bold tracking-tight text-[#0B1F16] sm:text-lg dark:text-[#F2F9F5]">
              {t.brandName}
            </span>
          </div>

          <div className="relative shrink-0">
            {customLogo ? (
              <img
                src={customLogo}
                alt={t.brandName}
                referrerPolicy="no-referrer"
                className="h-10 w-10 rounded-xl border border-[#DCE7E0] object-cover dark:border-[#1E3A2D]"
              />
            ) : (
              <DefaultBabSaidaLogo />
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
