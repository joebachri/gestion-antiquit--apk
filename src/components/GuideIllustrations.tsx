import {
  BookOpen,
  Camera,
  Check,
  Edit3,
  FileSpreadsheet,
  Film,
  Image as ImageIcon,
  Link2,
  MessageCircle,
  Moon,
  Plus,
  Search,
  Share2,
  Sparkles,
  Upload,
  Video,
} from 'lucide-react';
import type { Language } from '../types';
import { translations } from '../i18n';
import lanternImg from '../assets/images/antique_copper_lantern_1794787509666.jpg';
import ceramicImg from '../assets/images/antique_fez_ceramic_1794787509914.jpg';
import chestImg from '../assets/images/antique_berber_chest_1794787509355.jpg';

export type GuideSectionId =
  | 'add-product'
  | 'add-logo'
  | 'change-currency'
  | 'link-accounts'
  | 'post-whatsapp'
  | 'post-facebook'
  | 'post-instagram'
  | 'search-export';

interface ArrowDef {
  step: 1 | 2 | 3;
  fromX: number;
  fromY: number;
  ctrlX: number;
  ctrlY: number;
  toX: number;
  toY: number;
  badgeX: number;
  badgeY: number;
}

interface GuideIllustrationProps {
  sectionId: GuideSectionId;
  lang: Language;
  activeStep: number | null;
  onSelectStep: (step: number | null) => void;
}

const STEP_COLORS: Record<1 | 2 | 3, { stroke: string; fill: string; ring: string }> = {
  1: { stroke: '#DC2626', fill: '#DC2626', ring: 'rgba(220,38,38,0.22)' },
  2: { stroke: '#D97706', fill: '#D97706', ring: 'rgba(217,119,6,0.22)' },
  3: { stroke: '#059669', fill: '#059669', ring: 'rgba(5,150,105,0.22)' },
};

const SECTION_ARROWS: Record<GuideSectionId, ArrowDef[]> = {
  'add-product': [
    { step: 1, fromX: 84, fromY: 42, ctrlX: 118, ctrlY: 56, toX: 158, toY: 88, badgeX: 74, badgeY: 36 },
    { step: 2, fromX: 356, fromY: 44, ctrlX: 392, ctrlY: 74, toX: 422, toY: 120, badgeX: 344, badgeY: 38 },
    { step: 3, fromX: 356, fromY: 350, ctrlX: 430, ctrlY: 352, toX: 495, toY: 332, badgeX: 340, badgeY: 350 },
  ],
  'add-logo': [
    { step: 1, fromX: 416, fromY: 34, ctrlX: 472, ctrlY: 34, toX: 526, toY: 58, badgeX: 398, badgeY: 34 },
    { step: 2, fromX: 102, fromY: 222, ctrlX: 146, ctrlY: 235, toX: 204, toY: 256, badgeX: 88, badgeY: 220 },
    { step: 3, fromX: 280, fromY: 358, ctrlX: 360, ctrlY: 358, toX: 432, toY: 344, badgeX: 262, badgeY: 358 },
  ],
  'change-currency': [
    { step: 1, fromX: 416, fromY: 34, ctrlX: 472, ctrlY: 34, toX: 526, toY: 58, badgeX: 398, badgeY: 34 },
    { step: 2, fromX: 72, fromY: 170, ctrlX: 120, ctrlY: 185, toX: 168, toY: 210, badgeX: 58, badgeY: 164 },
    { step: 3, fromX: 420, fromY: 356, ctrlX: 468, ctrlY: 356, toX: 504, toY: 338, badgeX: 404, badgeY: 356 },
  ],
  'link-accounts': [
    { step: 1, fromX: 82, fromY: 42, ctrlX: 122, ctrlY: 54, toX: 162, toY: 78, badgeX: 68, badgeY: 36 },
    { step: 2, fromX: 98, fromY: 185, ctrlX: 150, ctrlY: 188, toX: 214, toY: 192, badgeX: 80, badgeY: 185 },
    { step: 3, fromX: 108, fromY: 318, ctrlX: 162, ctrlY: 312, toX: 228, toY: 294, badgeX: 92, badgeY: 318 },
  ],
  'post-whatsapp': [
    { step: 1, fromX: 126, fromY: 362, ctrlX: 162, ctrlY: 352, toX: 188, toY: 326, badgeX: 110, badgeY: 362 },
    { step: 2, fromX: 314, fromY: 186, ctrlX: 348, ctrlY: 205, toX: 392, toY: 222, badgeX: 298, badgeY: 182 },
    { step: 3, fromX: 340, fromY: 348, ctrlX: 382, ctrlY: 342, toX: 432, toY: 320, badgeX: 324, badgeY: 348 },
  ],
  'post-facebook': [
    { step: 1, fromX: 74, fromY: 182, ctrlX: 102, ctrlY: 208, toX: 132, toY: 238, badgeX: 60, badgeY: 174 },
    { step: 2, fromX: 322, fromY: 64, ctrlX: 358, ctrlY: 88, toX: 394, toY: 120, badgeX: 306, badgeY: 58 },
    { step: 3, fromX: 316, fromY: 352, ctrlX: 374, ctrlY: 350, toX: 428, toY: 332, badgeX: 300, badgeY: 352 },
  ],
  'post-instagram': [
    { step: 1, fromX: 74, fromY: 222, ctrlX: 102, ctrlY: 248, toX: 132, toY: 278, badgeX: 60, badgeY: 214 },
    { step: 2, fromX: 322, fromY: 74, ctrlX: 362, ctrlY: 102, toX: 404, toY: 124, badgeX: 306, badgeY: 68 },
    { step: 3, fromX: 316, fromY: 352, ctrlX: 374, ctrlY: 350, toX: 428, toY: 332, badgeX: 300, badgeY: 352 },
  ],
  'search-export': [
    { step: 1, fromX: 66, fromY: 136, ctrlX: 82, ctrlY: 112, toX: 104, toY: 84, badgeX: 56, badgeY: 148 },
    { step: 2, fromX: 178, fromY: 258, ctrlX: 188, ctrlY: 222, toX: 205, toY: 188, badgeX: 174, badgeY: 274 },
    { step: 3, fromX: 468, fromY: 256, ctrlX: 486, ctrlY: 220, toX: 500, toY: 188, badgeX: 464, badgeY: 272 },
  ],
};

function renderCanvasContent(sectionId: GuideSectionId, lang: Language, activeStep: number | null) {
  const t = translations[lang];
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const hi = (step: number) =>
    activeStep === step
      ? 'ring-2 ring-amber-400 shadow-md scale-[1.02]'
      : '';

  switch (sectionId) {
    case 'add-product':
      return (
        <div className="grid h-full grid-cols-12 gap-2.5 p-3 sm:gap-3.5 sm:p-4">
          {/* Left: Inventory toolbar mockup */}
          <div className="col-span-5 flex flex-col justify-between rounded-xl border border-[#DCE7E0] bg-white p-2.5 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
            <div>
              <div className="mb-2 flex items-center justify-between border-b border-[#DCE7E0] pb-1.5 dark:border-[#1E3A2D]">
                <span className="text-[9px] font-bold text-[#0B1F16] sm:text-[10px] dark:text-[#F2F9F5]">
                  {t.brandName}
                </span>
                <span className="h-2 w-2 rounded-full bg-[#10B981]" />
              </div>

              <div className="mb-2.5 flex items-center gap-1 rounded-lg border border-[#DCE7E0] bg-[#F7FAF8] px-2 py-1.5 text-[9px] text-[#6B8A79] dark:border-[#1E3A2D] dark:bg-[#091611]">
                <Search className="h-3 w-3 shrink-0" />
                <span className="truncate">L0001...</span>
              </div>

              <div
                dir={dir}
                className={`flex items-center justify-center gap-1.5 rounded-lg bg-[#115E3B] px-2 py-2 text-[9px] font-bold text-white transition-all sm:text-[11px] dark:bg-[#10B981] dark:text-[#052E1C] ${hi(1)}`}
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{t.addProduct}</span>
              </div>
            </div>

            <div className="mt-2 overflow-hidden rounded-lg border border-[#DCE7E0] bg-[#F7FAF8] dark:border-[#1E3A2D] dark:bg-[#091611]">
              <div className="flex items-center justify-between px-2 py-1 text-[8px] font-bold text-[#115E3B] dark:text-[#34D399]">
                <span>L0001</span>
                <span>1 200 MAD</span>
              </div>
              <img
                src={lanternImg}
                alt={t.brandName}
                referrerPolicy="no-referrer"
                className="h-16 w-full object-cover sm:h-20"
              />
            </div>
          </div>

          {/* Right: Product form mockup */}
          <div className="col-span-7 flex flex-col justify-between rounded-xl border border-[#DCE7E0] bg-white p-2.5 sm:p-3 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
            <div dir={dir} className="space-y-2">
              <div className="flex items-center justify-between border-b border-[#DCE7E0] pb-1 dark:border-[#1E3A2D]">
                <span className="text-[10px] font-bold text-[#0B1F16] sm:text-xs dark:text-[#F2F9F5]">
                  {t.newProductTitle}
                </span>
                <span className="font-mono-code text-[9px] font-bold text-[#115E3B] dark:text-[#34D399]">
                  L0005
                </span>
              </div>

              {/* Camera & Import */}
              <div className={`grid grid-cols-2 gap-1.5 rounded-lg p-0.5 transition-all ${hi(2)}`}>
                <div className="flex items-center justify-center gap-1 rounded-lg bg-[#115E3B] px-1.5 py-1.5 text-[8px] font-semibold text-white sm:text-[9px] dark:bg-[#10B981] dark:text-[#052E1C]">
                  <Camera className="h-3 w-3 shrink-0" />
                  <span className="truncate">{t.cameraModePhoto} / {t.cameraModeVideo}</span>
                </div>
                <div className="flex items-center justify-center gap-1 rounded-lg border border-[#DCE7E0] bg-[#F7FAF8] px-1.5 py-1.5 text-[8px] font-semibold text-[#115E3B] sm:text-[9px] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#34D399]">
                  <Upload className="h-3 w-3 shrink-0" />
                  <span className="truncate">{t.importFromPhone.split(' ')[0]}</span>
                </div>
              </div>

              {/* Photo strip */}
              <div className="flex items-center gap-1.5">
                <img
                  src={lanternImg}
                  alt="Preview 1"
                  referrerPolicy="no-referrer"
                  className="h-9 w-11 rounded-md border border-[#DCE7E0] object-cover dark:border-[#1E3A2D]"
                />
                <img
                  src={ceramicImg}
                  alt="Preview 2"
                  referrerPolicy="no-referrer"
                  className="h-9 w-11 rounded-md border border-[#DCE7E0] object-cover dark:border-[#1E3A2D]"
                />
                <div className="flex h-9 w-11 items-center justify-center rounded-md border border-[#DCE7E0] bg-[#0B1F16] text-white dark:border-[#1E3A2D]">
                  <Video className="h-3.5 w-3.5 text-[#34D399]" />
                </div>
              </div>

              {/* Fields preview */}
              <div className="grid grid-cols-2 gap-1.5 text-[8px] sm:text-[9px]">
                <div className="rounded-lg border border-[#DCE7E0] bg-[#F7FAF8] px-2 py-1 text-[#0B1F16] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]">
                  <span className="block text-[7px] text-[#335947] dark:text-[#9EC0AE]">
                    {t.nameLabel.replace(/^2\.\s*/, '')}
                  </span>
                  <span className="truncate font-semibold">Lanterne Fassi</span>
                </div>
                <div className="rounded-lg border border-[#DCE7E0] bg-[#F7FAF8] px-2 py-1 text-[#0B1F16] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]">
                  <span className="block text-[7px] text-[#335947] dark:text-[#9EC0AE]">
                    {t.sellingPriceLabel.replace(/^8\.\s*/, '')}
                  </span>
                  <span className="font-bold text-[#115E3B] dark:text-[#34D399]">1 200 MAD</span>
                </div>
              </div>
            </div>

            <div className="mt-2 flex justify-end gap-1.5">
              <div className="rounded-lg border border-[#DCE7E0] px-2.5 py-1 text-[9px] font-medium text-[#335947] dark:border-[#1E3A2D] dark:text-[#9EC0AE]">
                {t.cancel}
              </div>
              <div
                className={`flex items-center gap-1 rounded-lg bg-[#115E3B] px-3 py-1 text-[9px] font-bold text-white transition-all sm:text-[10px] dark:bg-[#10B981] dark:text-[#052E1C] ${hi(3)}`}
              >
                <Check className="h-3 w-3" />
                <span>{t.save}</span>
              </div>
            </div>
          </div>
        </div>
      );

    case 'add-logo':
      return (
        <div className="flex h-full flex-col justify-between gap-2.5 p-3 sm:p-4">
          {/* Top Header Mockup */}
          <div className="flex items-center justify-between rounded-xl border border-[#DCE7E0] bg-white px-3 py-2 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
            <div className="flex items-center gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md border border-[#DCE7E0] bg-[#F7FAF8] text-[#115E3B] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#34D399]">
                <Moon className="h-3 w-3" />
              </span>
              <span className="rounded-md bg-[#115E3B] px-1.5 py-0.5 text-[8px] font-bold text-white dark:bg-[#10B981] dark:text-[#052E1C]">
                FR | العربية
              </span>
            </div>

            <div
              className={`flex items-center gap-2 rounded-lg px-2 py-1 transition-all ${hi(1)}`}
            >
              <span className="text-[10px] font-bold text-[#0B1F16] sm:text-xs dark:text-[#F2F9F5]">
                {t.brandName}
              </span>
              <div className="relative">
                <img
                  src={lanternImg}
                  alt={t.brandName}
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 rounded-lg border border-[#DCE7E0] object-cover dark:border-[#1E3A2D]"
                />
                <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#115E3B] text-white dark:bg-[#10B981] dark:text-[#052E1C]">
                  <Camera className="h-2 w-2" />
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Logo Modal Mockup */}
          <div
            dir={dir}
            className="flex flex-1 flex-col justify-between rounded-xl border border-[#DCE7E0] bg-white p-3 dark:border-[#1E3A2D] dark:bg-[#0F2119]"
          >
            <div className="text-[10px] font-bold text-[#0B1F16] sm:text-xs dark:text-[#F2F9F5]">
              {t.logoModalTitle}
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] p-2.5 dark:border-[#1E3A2D] dark:bg-[#091611]">
              <img
                src={lanternImg}
                alt={t.brandName}
                referrerPolicy="no-referrer"
                className="h-14 w-14 shrink-0 rounded-xl border border-[#DCE7E0] object-cover dark:border-[#1E3A2D]"
              />
              <div className={`flex flex-1 flex-wrap gap-1.5 rounded-lg p-1 transition-all ${hi(2)}`}>
                <div className="flex items-center gap-1 rounded-lg bg-[#115E3B] px-2.5 py-1.5 text-[9px] font-semibold text-white dark:bg-[#10B981] dark:text-[#052E1C]">
                  <Upload className="h-3 w-3" />
                  <span>{t.logoUploadButton}</span>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-[#DCE7E0] bg-white px-2.5 py-1.5 text-[9px] font-semibold text-[#115E3B] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#34D399]">
                  <Camera className="h-3 w-3" />
                  <span>{t.logoCameraButton}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <div
                className={`flex items-center gap-1 rounded-lg bg-[#115E3B] px-3 py-1.5 text-[9px] font-bold text-white transition-all sm:text-[10px] dark:bg-[#10B981] dark:text-[#052E1C] ${hi(3)}`}
              >
                <Check className="h-3 w-3" />
                <span>{t.saveSettings}</span>
              </div>
            </div>
          </div>
        </div>
      );

    case 'change-currency':
      return (
        <div className="flex h-full flex-col justify-between gap-2.5 p-3 sm:p-4">
          {/* Header target */}
          <div className="flex items-center justify-between rounded-xl border border-[#DCE7E0] bg-white px-3 py-2 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
            <span className="text-[9px] font-medium text-[#335947] dark:text-[#9EC0AE]">
              100 MAD = 100 DH = 10 USD = 10 EUR
            </span>
            <div
              className={`flex items-center gap-2 rounded-lg px-2 py-0.5 transition-all ${hi(1)}`}
            >
              <span className="text-[10px] font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                {t.brandName}
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ECF7F1] text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]">
                <Camera className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-12 gap-2.5">
            {/* Currency selector box */}
            <div
              dir={dir}
              className="col-span-7 flex flex-col justify-between rounded-xl border border-[#DCE7E0] bg-white p-2.5 dark:border-[#1E3A2D] dark:bg-[#0F2119]"
            >
              <span className="text-[9px] font-bold text-[#335947] dark:text-[#9EC0AE]">
                {t.currencyLabel}
              </span>
              <div className={`grid grid-cols-3 gap-1.5 rounded-lg p-1 transition-all ${hi(2)}`}>
                {['MAD', 'DH', 'EUR', 'USD', 'TND', 'DZD'].map((code) => (
                  <div
                    key={code}
                    className={`rounded-lg border py-1.5 text-center text-[9px] font-bold ${
                      code === 'USD'
                        ? 'border-[#115E3B] bg-[#115E3B] text-white dark:border-[#10B981] dark:bg-[#10B981] dark:text-[#052E1C]'
                        : 'border-[#DCE7E0] bg-[#F7FAF8] text-[#0B1F16] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]'
                    }`}
                  >
                    {code}
                  </div>
                ))}
              </div>
              <p className="tabular-nums text-[9px] font-semibold text-[#115E3B] dark:text-[#34D399]">
                100 MAD = 10 USD
              </p>
            </div>

            {/* Converted Result + Save */}
            <div
              dir={dir}
              className="col-span-5 flex flex-col justify-between rounded-xl border border-[#DCE7E0] bg-white p-2.5 dark:border-[#1E3A2D] dark:bg-[#0F2119]"
            >
              <div className="rounded-lg border border-[#DCE7E0] bg-[#F7FAF8] p-2 dark:border-[#1E3A2D] dark:bg-[#091611]">
                <span className="block text-[8px] text-[#335947] dark:text-[#9EC0AE]">
                  {t.globalValueLabel}
                </span>
                <span className="tabular-nums block text-[10px] text-[#6B8A79] line-through">
                  1 000 MAD
                </span>
                <span className="tabular-nums block text-xs font-bold text-[#115E3B] sm:text-sm dark:text-[#34D399]">
                  100 USD
                </span>
              </div>

              <div
                className={`flex items-center justify-center gap-1 rounded-lg bg-[#115E3B] py-1.5 text-[9px] font-bold text-white transition-all dark:bg-[#10B981] dark:text-[#052E1C] ${hi(3)}`}
              >
                <Check className="h-3 w-3" />
                <span className="truncate">{t.saveSettings}</span>
              </div>
            </div>
          </div>
        </div>
      );

    case 'link-accounts':
      return (
        <div className="flex h-full flex-col justify-between gap-2 p-3 sm:p-4">
          {/* Entry bar */}
          <div className="flex items-center justify-between rounded-xl border border-[#DCE7E0] bg-white px-3 py-2 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
            <div
              className={`flex items-center gap-1.5 rounded-lg bg-[#ECF7F1] px-2.5 py-1 text-[9px] font-bold text-[#115E3B] transition-all dark:bg-[#132B20] dark:text-[#34D399] ${hi(1)}`}
            >
              <Sparkles className="h-3 w-3" />
              <span>{t.setupTitle} / {t.logoModalTitle}</span>
            </div>
            <span className="text-[9px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
              Meta OAuth
            </span>
          </div>

          {/* Meta Account Card */}
          <div
            dir={dir}
            className="flex flex-1 flex-col justify-between rounded-xl border border-[#DCE7E0] bg-white p-3 dark:border-[#1E3A2D] dark:bg-[#0F2119]"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
              <Link2 className="h-3.5 w-3.5 text-[#115E3B] dark:text-[#34D399]" />
              <span>{t.socialAccountsSection}</span>
            </div>

            <div
              className={`flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1877F2] to-[#C13584] px-3 py-2 text-[10px] font-bold text-white transition-all ${hi(2)}`}
            >
              <Link2 className="h-3.5 w-3.5" />
              <span>{t.socialConnectMeta}</span>
            </div>

            <div
              className={`grid grid-cols-2 gap-2 rounded-lg border border-[#DCE7E0] bg-[#F7FAF8] p-2 text-[8px] sm:text-[9px] dark:border-[#1E3A2D] dark:bg-[#091611] ${hi(3)}`}
            >
              <div>
                <span className="block font-semibold text-[#335947] dark:text-[#9EC0AE]">
                  {t.socialSelectPage}
                </span>
                <span className="block truncate font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                  Atelier Bab Saida
                </span>
              </div>
              <div>
                <span className="block font-semibold text-[#335947] dark:text-[#9EC0AE]">
                  {t.socialSelectIg}
                </span>
                <span className="block truncate font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                  @atelier_babsaida
                </span>
              </div>
            </div>
          </div>
        </div>
      );

    case 'post-whatsapp':
      return (
        <div className="grid h-full grid-cols-12 gap-2.5 p-3 sm:p-4">
          {/* Left: Product card with Share icon */}
          <div className="col-span-5 flex flex-col justify-between rounded-xl border border-[#DCE7E0] bg-white p-2 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
            <div className="flex items-center justify-between text-[9px] font-bold text-[#115E3B] dark:text-[#34D399]">
              <span>L0001</span>
              <span>1 200 MAD</span>
            </div>
            <img
              src={lanternImg}
              alt="L0001"
              referrerPolicy="no-referrer"
              className="my-1.5 h-24 w-full rounded-lg object-cover sm:h-28"
            />
            <div className="grid grid-cols-4 gap-1">
              <div className="col-span-1 rounded-md bg-[#ECF7F1] py-1.5 text-center text-[8px] font-bold text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]">
                ···
              </div>
              <div className="flex items-center justify-center rounded-md border border-[#DCE7E0] py-1 dark:border-[#1E3A2D]">
                <Edit3 className="h-3 w-3 text-[#335947] dark:text-[#9EC0AE]" />
              </div>
              <div
                className={`flex items-center justify-center rounded-md border border-[#115E3B] bg-[#ECF7F1] py-1 text-[#115E3B] transition-all dark:border-[#10B981] dark:bg-[#132B20] dark:text-[#34D399] ${hi(1)}`}
              >
                <Share2 className="h-3.5 w-3.5" />
              </div>
              <div className="rounded-md border border-[#DCE7E0] py-1 dark:border-[#1E3A2D]" />
            </div>
          </div>

          {/* Right: Share Modal -> WhatsApp -> Sent PNG Card */}
          <div
            dir={dir}
            className="col-span-7 flex flex-col justify-between rounded-xl border border-[#DCE7E0] bg-white p-2.5 dark:border-[#1E3A2D] dark:bg-[#0F2119]"
          >
            <div className="text-[10px] font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
              {t.shareTitle}
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div
                className={`flex items-center justify-center gap-1.5 rounded-lg bg-[#16A34A] px-2 py-2 text-[10px] font-bold text-white transition-all ${hi(2)}`}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>{t.shareWhatsapp}</span>
              </div>
              <div className="flex items-center justify-center rounded-lg border border-[#DCE7E0] bg-[#F7FAF8] px-2 py-2 text-[9px] font-semibold text-[#335947] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#9EC0AE]">
                {t.shareFacebook}
              </div>
            </div>

            {/* Sent WhatsApp card preview */}
            <div
              className={`rounded-xl border border-[#16A34A]/40 bg-[#ECFDF5] p-2 transition-all dark:border-[#16A34A]/40 dark:bg-[#0B2318] ${hi(3)}`}
            >
              <div className="flex items-center gap-2">
                <img
                  src={chestImg}
                  alt="Card PNG"
                  referrerPolicy="no-referrer"
                  className="h-11 w-14 shrink-0 rounded-md object-cover"
                />
                <div className="min-w-0 text-[8px] leading-tight text-[#0B1F16] dark:text-[#F2F9F5]">
                  <span className="block font-bold text-[#16A34A]">PNG + Caption</span>
                  <span className="block truncate">L0001 · Lanterne Fassi</span>
                  <span className="block font-semibold">1 200 MAD</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );

    case 'post-facebook':
      return (
        <div className="grid h-full grid-cols-12 gap-2.5 p-3 sm:p-4">
          {/* Left: Share sheet */}
          <div
            dir={dir}
            className="col-span-5 flex flex-col justify-between rounded-xl border border-[#DCE7E0] bg-white p-2.5 dark:border-[#1E3A2D] dark:bg-[#0F2119]"
          >
            <div className="text-[9px] font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
              {t.shareTitle}
            </div>
            <div className="space-y-1.5">
              <div className="rounded-lg bg-[#16A34A]/15 py-1.5 text-center text-[9px] font-semibold text-[#16A34A]">
                {t.shareWhatsapp}
              </div>
              <div
                className={`rounded-lg bg-[#1877F2] py-2 text-center text-[10px] font-bold text-white transition-all ${hi(1)}`}
              >
                {t.shareFacebook}
              </div>
              <div className="rounded-lg border border-[#DCE7E0] py-1.5 text-center text-[9px] font-semibold text-[#335947] dark:border-[#1E3A2D] dark:text-[#9EC0AE]">
                {t.shareInstagram}
              </div>
            </div>
            <div className="text-[8px] text-[#335947] dark:text-[#9EC0AE]">L0002 · 850 MAD</div>
          </div>

          {/* Right: Facebook Composer */}
          <div
            dir={dir}
            className="col-span-7 flex flex-col justify-between rounded-xl border border-[#DCE7E0] bg-white p-2.5 dark:border-[#1E3A2D] dark:bg-[#0F2119]"
          >
            <div className="flex items-center justify-between border-b border-[#DCE7E0] pb-1 dark:border-[#1E3A2D]">
              <span className="text-[10px] font-bold text-[#1877F2]">{t.fbComposerTitle}</span>
            </div>

            <div className={`grid grid-cols-2 gap-1 rounded-lg p-0.5 transition-all ${hi(2)}`}>
              <div className="rounded-md bg-[#1877F2] px-1.5 py-1 text-center text-[8px] font-bold text-white">
                {t.fbFormatCard}
              </div>
              <div className="rounded-md border border-[#DCE7E0] px-1.5 py-1 text-center text-[8px] text-[#335947] dark:border-[#1E3A2D] dark:text-[#9EC0AE]">
                {t.fbFormatPhotos}
              </div>
              <div className="rounded-md border border-[#DCE7E0] px-1.5 py-1 text-center text-[8px] text-[#335947] dark:border-[#1E3A2D] dark:text-[#9EC0AE]">
                {t.fbFormatVideo}
              </div>
              <div className="rounded-md border border-[#DCE7E0] px-1.5 py-1 text-center text-[8px] text-[#335947] dark:border-[#1E3A2D] dark:text-[#9EC0AE]">
                {t.fbFormatText}
              </div>
            </div>

            <div className="rounded-lg border border-[#DCE7E0] bg-[#F7FAF8] px-2 py-1.5 text-[8px] text-[#335947] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#9EC0AE]">
              <span className="block font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                {t.fbMessageLabel} + Hashtags
              </span>
              <span className="block truncate">#antiquites #artisanat #maroc</span>
            </div>

            <div
              className={`rounded-lg bg-[#1877F2] py-1.5 text-center text-[9px] font-bold text-white transition-all sm:text-[10px] ${hi(3)}`}
            >
              {t.fbPublishApiButton}
            </div>
          </div>
        </div>
      );

    case 'post-instagram':
      return (
        <div className="grid h-full grid-cols-12 gap-2.5 p-3 sm:p-4">
          {/* Left: Share sheet */}
          <div
            dir={dir}
            className="col-span-5 flex flex-col justify-between rounded-xl border border-[#DCE7E0] bg-white p-2.5 dark:border-[#1E3A2D] dark:bg-[#0F2119]"
          >
            <div className="text-[9px] font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
              {t.shareTitle}
            </div>
            <div className="space-y-1.5">
              <div className="rounded-lg border border-[#DCE7E0] py-1.5 text-center text-[9px] font-semibold text-[#335947] dark:border-[#1E3A2D] dark:text-[#9EC0AE]">
                {t.shareFacebook}
              </div>
              <div
                className={`space-y-1 rounded-lg p-0.5 transition-all ${hi(1)}`}
              >
                <div className="rounded-md bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] py-1.5 text-center text-[9px] font-bold text-white">
                  {t.shareInstagram}
                </div>
                <div className="flex items-center justify-center gap-1 rounded-md border border-[#C13584] py-1.5 text-[9px] font-bold text-[#C13584]">
                  <Film className="h-3 w-3" />
                  <span>{t.shareInstagramReel}</span>
                </div>
              </div>
            </div>
            <img
              src={ceramicImg}
              alt="IG Preview"
              referrerPolicy="no-referrer"
              className="h-10 w-full rounded-lg object-cover"
            />
          </div>

          {/* Right: Instagram Post / Reel Composer */}
          <div
            dir={dir}
            className="col-span-7 flex flex-col justify-between rounded-xl border border-[#DCE7E0] bg-white p-2.5 dark:border-[#1E3A2D] dark:bg-[#0F2119]"
          >
            <div className="text-[10px] font-bold text-[#C13584]">{t.igComposerTitle}</div>

            <div className={`grid grid-cols-2 gap-1.5 rounded-lg p-0.5 transition-all ${hi(2)}`}>
              <div className="flex items-center justify-center gap-1 rounded-md border border-[#DCE7E0] py-1.5 text-[8px] font-semibold text-[#335947] dark:border-[#1E3A2D] dark:text-[#9EC0AE]">
                <ImageIcon className="h-3 w-3" />
                <span className="truncate">{t.igFormatPost}</span>
              </div>
              <div className="flex items-center justify-center gap-1 rounded-md bg-gradient-to-r from-[#833AB4] to-[#C13584] py-1.5 text-[8px] font-bold text-white">
                <Film className="h-3 w-3" />
                <span className="truncate">{t.igFormatReel}</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-dashed border-[#C13584]/50 bg-[#FDF2F8] px-2 py-1.5 text-[8px] font-semibold text-[#9D174D] dark:bg-[#2A101E] dark:text-[#F9A8D4]">
              <span className="truncate">{t.igCreateReelFromPhotos}</span>
              <span className="shrink-0 font-bold">9:16</span>
            </div>

            <div className="rounded-lg border border-[#DCE7E0] bg-[#F7FAF8] px-2 py-1 text-[8px] text-[#335947] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#9EC0AE]">
              {t.igCaptionLabel} · {t.igHashtagsLabel} · {t.igLocationLabel}
            </div>

            <div
              className={`rounded-lg bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] py-1.5 text-center text-[9px] font-bold text-white transition-all sm:text-[10px] ${hi(3)}`}
            >
              {t.igPublishReelApiButton}
            </div>
          </div>
        </div>
      );

    case 'search-export':
      return (
        <div className="flex h-full flex-col justify-between gap-2.5 p-3 sm:p-4">
          {/* Header Left controls highlighted */}
          <div className="flex items-center justify-between rounded-xl border border-[#DCE7E0] bg-white px-3 py-2 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
            <div className={`flex items-center gap-1.5 rounded-lg p-1 transition-all ${hi(1)}`}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#DCE7E0] bg-[#F7FAF8] text-[#115E3B] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#34D399]">
                <Moon className="h-3.5 w-3.5" />
              </span>
              <div className="flex rounded-lg border border-[#DCE7E0] bg-[#F7FAF8] p-0.5 text-[9px] font-bold dark:border-[#1E3A2D] dark:bg-[#102119]">
                <span className="rounded bg-[#115E3B] px-1.5 py-0.5 text-white dark:bg-[#10B981] dark:text-[#052E1C]">
                  FR
                </span>
                <span className="px-1.5 py-0.5 text-[#335947] dark:text-[#9EC0AE]">العربية</span>
              </div>
              <span className="flex items-center gap-1 rounded-lg border border-[#115E3B]/30 bg-[#ECF7F1] px-2 py-1 text-[9px] font-bold text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]">
                <BookOpen className="h-3 w-3" />
                {t.guideButtonLabel}
              </span>
            </div>

            <span className="text-[10px] font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
              {t.brandName}
            </span>
          </div>

          {/* Search & Export Toolbar */}
          <div
            dir={dir}
            className="flex items-center gap-2 rounded-xl border border-[#DCE7E0] bg-white p-2.5 dark:border-[#1E3A2D] dark:bg-[#0F2119]"
          >
            <div
              className={`flex flex-1 items-center gap-2 rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-2.5 py-2 text-[9px] text-[#0B1F16] transition-all sm:text-[10px] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] ${hi(2)}`}
            >
              <Search className="h-3.5 w-3.5 shrink-0 text-[#115E3B] dark:text-[#34D399]" />
              <span className="truncate font-medium">L0001 · Lanterne</span>
            </div>

            <div
              className={`flex items-center gap-1.5 rounded-xl border border-[#115E3B] bg-[#ECF7F1] px-3 py-2 text-[9px] font-bold text-[#115E3B] transition-all sm:text-[10px] dark:border-[#10B981] dark:bg-[#132B20] dark:text-[#34D399] ${hi(3)}`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-nowrap">{t.exportExcel}</span>
            </div>
          </div>

          {/* Excel Sheet Output Summary */}
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-[#DCE7E0] bg-white p-2.5 text-[8px] sm:text-[9px] dark:border-[#1E3A2D] dark:bg-[#0F2119]">
            <div className="rounded-lg bg-[#F7FAF8] p-2 dark:bg-[#091611]">
              <span className="block font-bold text-[#115E3B] dark:text-[#34D399]">Code</span>
              <span>L0001, C0002...</span>
            </div>
            <div className="rounded-lg bg-[#F7FAF8] p-2 dark:bg-[#091611]">
              <span className="block font-bold text-[#115E3B] dark:text-[#34D399]">Dimensions</span>
              <span>35 × 20 × 45 cm</span>
            </div>
            <div className="rounded-lg bg-[#F7FAF8] p-2 dark:bg-[#091611]">
              <span className="block font-bold text-[#115E3B] dark:text-[#34D399]">.XLSX</span>
              <span>Excel Ready</span>
            </div>
          </div>
        </div>
      );
  }
}

export function GuideIllustration({
  sectionId,
  lang,
  activeStep,
  onSelectStep,
}: GuideIllustrationProps) {
  const arrows = SECTION_ARROWS[sectionId];

  return (
    <div
      dir="ltr"
      className="relative mx-auto w-full aspect-[16/10] min-h-[220px] overflow-hidden rounded-2xl border border-[#DCE7E0] bg-[#ECF3EE] shadow-inner dark:border-[#1E3A2D] dark:bg-[#07120D]"
    >
      {/* Faithful Miniature UI Canvas */}
      <div className="h-full w-full">{renderCanvasContent(sectionId, lang, activeStep)}</div>

      {/* Precision SVG Overlay with Numbered Pointing Arrows */}
      <svg
        viewBox="0 0 640 400"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          {([1, 2, 3] as const).map((step) => (
            <marker
              key={step}
              id={`guide-arrow-head-${sectionId}-${step}`}
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="4"
              orient="auto"
            >
              <path d="M 0 1 L 7 4 L 0 7 z" fill={STEP_COLORS[step].stroke} />
            </marker>
          ))}
        </defs>

        {arrows.map((arrow) => {
          const colors = STEP_COLORS[arrow.step];
          const isHighlighted = activeStep === arrow.step;
          const isDimmed = activeStep !== null && activeStep !== arrow.step;

          return (
            <g
              key={arrow.step}
              opacity={isDimmed ? 0.35 : 1}
              style={{ transition: 'opacity 180ms ease' }}
            >
              {/* Soft halo under arrow for legibility over photos/text */}
              <path
                d={`M ${arrow.fromX} ${arrow.fromY} Q ${arrow.ctrlX} ${arrow.ctrlY} ${arrow.toX} ${arrow.toY}`}
                fill="none"
                stroke="#FFFFFF"
                strokeOpacity="0.85"
                strokeWidth={isHighlighted ? 7 : 5.5}
                strokeLinecap="round"
              />
              {/* Colored arrow shaft */}
              <path
                d={`M ${arrow.fromX} ${arrow.fromY} Q ${arrow.ctrlX} ${arrow.ctrlY} ${arrow.toX} ${arrow.toY}`}
                fill="none"
                stroke={colors.stroke}
                strokeWidth={isHighlighted ? 3.8 : 2.8}
                strokeLinecap="round"
                markerEnd={`url(#guide-arrow-head-${sectionId}-${arrow.step})`}
              />
              {/* Target dot pulse ring */}
              <circle
                cx={arrow.toX}
                cy={arrow.toY}
                r={isHighlighted ? 9 : 6}
                fill={colors.ring}
              />
              {/* Numbered step circle */}
              <circle
                cx={arrow.badgeX}
                cy={arrow.badgeY}
                r={isHighlighted ? 17 : 14}
                fill={colors.fill}
                stroke="#FFFFFF"
                strokeWidth="2.5"
              />
              <text
                x={arrow.badgeX}
                y={arrow.badgeY + 5}
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="14"
                fontWeight="800"
                fontFamily="system-ui, sans-serif"
              >
                {arrow.step}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Interactive clickable hotspots over the numbered badges */}
      {arrows.map((arrow) => (
        <button
          key={`btn-${arrow.step}`}
          type="button"
          onClick={() => onSelectStep(activeStep === arrow.step ? null : arrow.step)}
          aria-label={`${translations[lang].guideStepLabel} ${arrow.step}`}
          style={{
            left: `${(arrow.badgeX / 640) * 100}%`,
            top: `${(arrow.badgeY / 400) * 100}%`,
          }}
          className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-2 focus-visible:outline-amber-400"
        />
      ))}
    </div>
  );
}
