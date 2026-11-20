import {
  BookOpen,
  Calculator,
  Camera,
  Check,
  Copy,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  Film,
  Globe,
  History,
  Image as ImageIcon,
  Images,
  Link2,
  Maximize2,
  MessageCircle,
  Moon,
  Plus,
  QrCode,
  Receipt,
  Search,
  Share2,
  ShoppingBag,
  Sparkles,
  Upload,
  UserPlus,
  Users,
  Video,
} from 'lucide-react';
import type { Language } from '../types';
import { translations } from '../i18n';
import { AppAntiqueLogo } from './AppLogo';
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
  | 'search-export'
  | 'calculator'
  | 'customers'
  | 'customer-gallery'
  | 'qr-pos';

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
    { step: 1, fromX: 416, fromY: 36, ctrlX: 472, ctrlY: 36, toX: 526, toY: 58, badgeX: 398, badgeY: 36 },
    { step: 2, fromX: 102, fromY: 214, ctrlX: 146, ctrlY: 224, toX: 204, toY: 238, badgeX: 88, badgeY: 212 },
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
    { step: 1, fromX: 66, fromY: 148, ctrlX: 84, ctrlY: 120, toX: 106, toY: 90, badgeX: 56, badgeY: 160 },
    { step: 2, fromX: 178, fromY: 258, ctrlX: 188, ctrlY: 222, toX: 205, toY: 188, badgeX: 174, badgeY: 274 },
    { step: 3, fromX: 468, fromY: 256, ctrlX: 486, ctrlY: 220, toX: 500, toY: 188, badgeX: 464, badgeY: 272 },
  ],
  calculator: [
    { step: 1, fromX: 374, fromY: 34, ctrlX: 418, ctrlY: 42, toX: 454, toY: 66, badgeX: 356, badgeY: 34 },
    { step: 2, fromX: 72, fromY: 208, ctrlX: 112, ctrlY: 224, toX: 158, toY: 238, badgeX: 56, badgeY: 206 },
    { step: 3, fromX: 352, fromY: 352, ctrlX: 416, ctrlY: 348, toX: 472, toY: 324, badgeX: 336, badgeY: 352 },
  ],
  customers: [
    { step: 1, fromX: 134, fromY: 42, ctrlX: 172, ctrlY: 54, toX: 210, toY: 74, badgeX: 118, badgeY: 36 },
    { step: 2, fromX: 280, fromY: 210, ctrlX: 332, ctrlY: 218, toX: 382, toY: 226, badgeX: 264, badgeY: 208 },
    { step: 3, fromX: 454, fromY: 348, ctrlX: 492, ctrlY: 332, toX: 522, toY: 296, badgeX: 438, badgeY: 352 },
  ],
  'customer-gallery': [
    { step: 1, fromX: 256, fromY: 36, ctrlX: 274, ctrlY: 46, toX: 288, toY: 66, badgeX: 238, badgeY: 36 },
    { step: 2, fromX: 98, fromY: 222, ctrlX: 146, ctrlY: 228, toX: 204, toY: 234, badgeX: 82, badgeY: 222 },
    { step: 3, fromX: 396, fromY: 352, ctrlX: 452, ctrlY: 344, toX: 506, toY: 320, badgeX: 380, badgeY: 352 },
  ],
  'qr-pos': [
    { step: 1, fromX: 120, fromY: 34, ctrlX: 175, ctrlY: 44, toX: 230, toY: 66, badgeX: 102, badgeY: 34 },
    { step: 2, fromX: 100, fromY: 214, ctrlX: 150, ctrlY: 222, toX: 204, toY: 230, badgeX: 82, badgeY: 214 },
    { step: 3, fromX: 392, fromY: 348, ctrlX: 450, ctrlY: 340, toX: 504, toY: 312, badgeX: 374, badgeY: 348 },
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
        <div className="flex h-full flex-col justify-between gap-2 p-3 sm:p-4">
          {/* Top Header Mockup: GA antique logo on left | User's logo & optional store name on right */}
          <div className="overflow-hidden rounded-xl border border-[#DCE7E0] bg-white dark:border-[#1E3A2D] dark:bg-[#0F2119]">
            <div className="flex items-center justify-between px-3 py-1.5">
              {/* Left: Antique "GA" App Crest */}
              <div className="flex items-center gap-2">
                <AppAntiqueLogo size="sm" />
                <div>
                  <span className="block text-[9px] font-bold text-[#0B1F16] sm:text-[10px] dark:text-[#F2F9F5]">
                    {t.brandName}
                  </span>
                  <span className="block text-[7px] text-[#335947] dark:text-[#9EC0AE]">
                    GA Antique
                  </span>
                </div>
              </div>

              {/* Right: User's Custom Logo + Optional Store Name */}
              <div
                className={`flex items-center gap-2 rounded-lg px-2 py-0.5 transition-all ${hi(1)}`}
              >
                <div className="text-right">
                  <span className="block text-[9px] font-bold text-[#0B1F16] sm:text-[10px] dark:text-[#F2F9F5]">
                    Galerie Bab Saida
                  </span>
                  <span className="block text-[7px] font-semibold text-[#115E3B] dark:text-[#34D399]">
                    {t.storeNameLabel.split('(')[0].trim()}
                  </span>
                </div>
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

            {/* Bottom Utility Tier */}
            <div className="flex items-center justify-between border-t border-[#DCE7E0]/75 bg-[#F7FAF8] px-3 py-1 text-[8px] dark:border-[#1E3A2D]/75 dark:bg-[#08140F]">
              <div className="flex items-center gap-1">
                <Moon className="h-3 w-3 text-[#115E3B] dark:text-[#34D399]" />
                <span className="font-bold text-[#115E3B] dark:text-[#34D399]">FR | العربية</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#335947] dark:text-[#9EC0AE]">
                <span>{t.calculatorButtonLabel}</span>
                <span>·</span>
                <span>{t.guideButtonLabel}</span>
              </div>
            </div>
          </div>

          {/* Bottom Logo & Store Name Modal Mockup */}
          <div
            dir={dir}
            className="flex flex-1 flex-col justify-between rounded-xl border border-[#DCE7E0] bg-white p-2.5 sm:p-3 dark:border-[#1E3A2D] dark:bg-[#0F2119]"
          >
            <div className="text-[10px] font-bold text-[#0B1F16] sm:text-xs dark:text-[#F2F9F5]">
              {t.logoModalTitle}
            </div>

            <div className={`space-y-1.5 rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] p-2 transition-all dark:border-[#1E3A2D] dark:bg-[#091611] ${hi(2)}`}>
              {/* Store Name Input */}
              <div className="flex items-center justify-between rounded-lg border border-[#DCE7E0] bg-white px-2.5 py-1 text-[8px] dark:border-[#1E3A2D] dark:bg-[#102119]">
                <span className="text-[#335947] dark:text-[#9EC0AE]">{t.storeNameLabel}</span>
                <span className="font-bold text-[#0B1F16] dark:text-[#F2F9F5]">Galerie Bab Saida</span>
              </div>

              {/* Logo upload & camera */}
              <div className="flex items-center justify-between gap-2.5">
                <img
                  src={lanternImg}
                  alt={t.brandName}
                  referrerPolicy="no-referrer"
                  className="h-10 w-10 shrink-0 rounded-lg border border-[#DCE7E0] object-cover dark:border-[#1E3A2D]"
                />
                <div className="flex flex-1 flex-wrap gap-1.5">
                  <div className="flex items-center gap-1 rounded-lg bg-[#115E3B] px-2 py-1 text-[8px] font-semibold text-white dark:bg-[#10B981] dark:text-[#052E1C]">
                    <Upload className="h-3 w-3" />
                    <span>{t.logoUploadButton}</span>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg border border-[#DCE7E0] bg-white px-2 py-1 text-[8px] font-semibold text-[#115E3B] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#34D399]">
                    <Camera className="h-3 w-3" />
                    <span>{t.logoCameraButton}</span>
                  </div>
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
            <div className="flex items-center gap-2">
              <AppAntiqueLogo size="sm" />
              <span className="text-[9px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                100 MAD = 100 DH = 10 USD = 10 EUR
              </span>
            </div>
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
        <div className="flex h-full flex-col justify-between gap-2 p-3 sm:p-4">
          {/* Two-tier Header Utility Bar Highlighted */}
          <div className="overflow-hidden rounded-xl border border-[#DCE7E0] bg-white dark:border-[#1E3A2D] dark:bg-[#0F2119]">
            <div className="flex items-center justify-between px-3 py-1">
              <div className="flex items-center gap-1.5">
                <AppAntiqueLogo size="sm" />
                <span className="text-[9px] font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                  {t.brandName}
                </span>
              </div>
              <span className="text-[9px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                {t.yourStoreFallback}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-[#DCE7E0]/75 bg-[#F7FAF8] px-2.5 py-1.5 dark:border-[#1E3A2D]/75 dark:bg-[#08140F]">
              <div className={`flex items-center gap-1.5 rounded-lg p-0.5 transition-all ${hi(1)}`}>
                <span className="flex h-6 w-6 items-center justify-center rounded-md border border-[#DCE7E0] bg-white text-[#115E3B] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#34D399]">
                  <Moon className="h-3 w-3" />
                </span>
                <div className="flex rounded-md border border-[#DCE7E0] bg-white p-0.5 text-[8px] font-bold dark:border-[#1E3A2D] dark:bg-[#102119]">
                  <span className="rounded bg-[#115E3B] px-1.5 py-0.5 text-white dark:bg-[#10B981] dark:text-[#052E1C]">
                    FR
                  </span>
                  <span className="px-1.5 py-0.5 text-[#335947] dark:text-[#9EC0AE]">العربية</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1 rounded-md border border-[#DCE7E0] bg-white px-2 py-0.5 text-[8px] font-bold text-[#115E3B] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#34D399]">
                  <Calculator className="h-2.5 w-2.5" />
                  <span>{t.calculatorButtonLabel}</span>
                </span>
                <span className="flex items-center gap-1 rounded-md border border-[#115E3B]/30 bg-[#ECF7F1] px-2 py-0.5 text-[8px] font-bold text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]">
                  <BookOpen className="h-2.5 w-2.5" />
                  <span>{t.guideButtonLabel}</span>
                </span>
              </div>
            </div>
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
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-[#DCE7E0] bg-white p-2 text-[8px] sm:text-[9px] dark:border-[#1E3A2D] dark:bg-[#0F2119]">
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

    case 'calculator':
      return (
        <div className="flex h-full flex-col justify-between gap-2 p-3 sm:p-4">
          {/* Top Utility Strip highlighting Calculator Button */}
          <div className="flex items-center justify-between rounded-xl border border-[#DCE7E0] bg-white px-3 py-2 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
            <div className="flex items-center gap-1.5">
              <AppAntiqueLogo size="sm" />
              <span className="text-[9px] font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                {t.brandName}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <div
                className={`flex items-center gap-1.5 rounded-lg border border-[#115E3B] bg-[#ECF7F1] px-2.5 py-1 text-[9px] font-bold text-[#115E3B] transition-all dark:border-[#10B981] dark:bg-[#132B20] dark:text-[#34D399] ${hi(1)}`}
              >
                <Calculator className="h-3.5 w-3.5" />
                <span>{t.calculatorButtonLabel}</span>
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-[#DCE7E0] bg-[#F7FAF8] px-2 py-1 text-[8px] font-semibold text-[#335947] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#9EC0AE]">
                <BookOpen className="h-3 w-3" />
                <span>{t.guideButtonLabel}</span>
              </div>
            </div>
          </div>

          {/* Calculator Modal Body Mockup */}
          <div dir={dir} className="grid flex-1 grid-cols-12 gap-2.5">
            {/* Left: Screen + Percentage Keypad */}
            <div
              className={`col-span-6 flex flex-col justify-between rounded-xl border border-[#DCE7E0] bg-white p-2.5 transition-all dark:border-[#1E3A2D] dark:bg-[#0F2119] ${hi(2)}`}
            >
              <div className="rounded-lg border border-[#DCE7E0] bg-[#F7FAF8] px-2.5 py-1.5 text-right dark:border-[#1E3A2D] dark:bg-[#091611]">
                <span className="tabular-nums block text-[8px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                  1000 − 15%
                </span>
                <span className="tabular-nums block text-sm font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                  850
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1 text-center text-[8px] font-bold">
                {['C', '⌫', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '='].map(
                  (key) => (
                    <span
                      key={key}
                      className={`rounded-md py-1 ${
                        key === '='
                          ? 'bg-[#115E3B] text-white dark:bg-[#10B981] dark:text-[#052E1C]'
                          : ['%', '÷', '×', '−'].includes(key)
                            ? 'bg-[#ECF7F1] text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]'
                            : 'border border-[#DCE7E0] bg-[#F7FAF8] text-[#0B1F16] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]'
                      }`}
                    >
                      {key}
                    </span>
                  )
                )}
              </div>
            </div>

            {/* Right: Live Currency Equivalence + Copy & History */}
            <div className="col-span-6 flex flex-col justify-between rounded-xl border border-[#DCE7E0] bg-white p-2.5 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
              <div className="flex items-center justify-between text-[9px] font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                <span>{t.calculatorTitle}</span>
                <span className="flex items-center gap-1 text-[8px] text-[#335947] dark:text-[#9EC0AE]">
                  <History className="h-3 w-3" />
                  <span>{t.calculatorHistoryTitle}</span>
                </span>
              </div>

              <div className="space-y-1 rounded-lg border border-[#DCE7E0] bg-[#F7FAF8] p-2 text-[8px] dark:border-[#1E3A2D] dark:bg-[#091611]">
                <div className="flex items-center justify-between text-[#335947] dark:text-[#9EC0AE]">
                  <span>1 000 − 15%</span>
                  <span className="tabular-nums font-bold text-[#115E3B] dark:text-[#34D399]">= 850</span>
                </div>
                <div className="flex items-center justify-between text-[#335947] dark:text-[#9EC0AE]">
                  <span>450 + 250</span>
                  <span className="tabular-nums font-bold text-[#115E3B] dark:text-[#34D399]">= 700</span>
                </div>
              </div>

              <div className={`space-y-1.5 rounded-lg p-1 transition-all ${hi(3)}`}>
                <div className="rounded-lg border border-[#115E3B]/25 bg-[#ECF7F1] px-2 py-1.5 dark:border-[#10B981]/30 dark:bg-[#132B20]">
                  <span className="block text-[7px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                    {t.calculatorEquivLabel}
                  </span>
                  <span className="tabular-nums block text-[9px] font-bold text-[#115E3B] dark:text-[#34D399]">
                    850 MAD · 85 EUR · 85 USD
                  </span>
                </div>

                <div className="flex items-center justify-center gap-1 rounded-lg bg-[#115E3B] py-1.5 text-[9px] font-bold text-white dark:bg-[#10B981] dark:text-[#052E1C]">
                  <Copy className="h-3 w-3" />
                  <span>{t.calculatorCopyResult}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );

    case 'customers':
      return (
        <div className="flex h-full flex-col justify-between gap-2 p-3 sm:p-4">
          {/* Top Tabs Mockup */}
          <div className="flex items-center justify-between gap-2 rounded-xl border border-[#DCE7E0] bg-white px-3 py-2 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
            <div className="flex items-center gap-1.5">
              <span className="rounded-lg border border-[#DCE7E0] px-2.5 py-1 text-[9px] font-semibold text-[#335947] dark:border-[#1E3A2D] dark:text-[#9EC0AE]">
                {t.tabInventory}
              </span>
              <span
                className={`flex items-center gap-1 rounded-lg bg-[#115E3B] px-2.5 py-1 text-[9px] font-bold text-white transition-all dark:bg-[#10B981] dark:text-[#052E1C] ${hi(1)}`}
              >
                <Users className="h-3 w-3" />
                <span>{t.tabCustomers}</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1 rounded-lg border border-[#DCE7E0] bg-[#ECF7F1] px-2 py-1 text-[8px] font-bold text-[#115E3B] dark:border-[#1E3A2D] dark:bg-[#132B20] dark:text-[#34D399]">
                <FileSpreadsheet className="h-3 w-3" />
                <span>{t.exportAllCustomersExcel}</span>
              </span>
              <span className="flex items-center gap-1 rounded-lg bg-[#115E3B] px-2 py-1 text-[8px] font-bold text-white dark:bg-[#10B981] dark:text-[#052E1C]">
                <UserPlus className="h-3 w-3" />
                <span>{t.addCustomer}</span>
              </span>
            </div>
          </div>

          {/* Customer Profile (WhatsApp + Social Links) & Purchase History Mockup */}
          <div dir={dir} className="grid flex-1 grid-cols-12 gap-2.5">
            <div className="col-span-6 flex flex-col justify-between rounded-xl border border-[#DCE7E0] bg-white p-2.5 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
              <div>
                <div className="flex items-center justify-between text-[9px] font-bold text-[#115E3B] dark:text-[#34D399]">
                  <span>CL0001</span>
                  <span>{t.customerCategorySeller}</span>
                </div>
                <p className="mt-0.5 text-[10px] font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                  Ahmed Benali · Fès
                </p>

                {/* Clickable WhatsApp Phone + Social Links */}
                <div className={`mt-1.5 space-y-1 rounded-lg p-0.5 transition-all ${hi(2)}`}>
                  <div className="flex items-center justify-between rounded-md border border-[#16A34A]/35 bg-[#ECFDF5] px-2 py-1 text-[8px] font-bold text-[#15803D] dark:border-[#16A34A]/40 dark:bg-[#0B2318] dark:text-[#4ADE80]">
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3 shrink-0" />
                      <span>+212 6 12 34 56</span>
                    </span>
                    <span>{t.customerWhatsAppBadge}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-[7.5px] font-semibold">
                    <span className="rounded border border-[#1877F2]/30 bg-[#1877F2]/10 px-1.5 py-0.5 text-[#1877F2]">
                      Facebook
                    </span>
                    <span className="rounded border border-[#C13584]/30 bg-[#C13584]/10 px-1.5 py-0.5 text-[#C13584]">
                      @ahmed_antiques
                    </span>
                    <span className="rounded border border-[#DCE7E0] bg-[#F7FAF8] px-1.5 py-0.5 text-[#335947] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#9EC0AE]">
                      <Globe className="inline h-2.5 w-2.5" /> Web
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-[#F7FAF8] px-2 py-1.5 text-[8.5px] dark:bg-[#091611]">
                <span className="text-[#335947] dark:text-[#9EC0AE]">{t.customerTotalSpent}</span>
                <span className="tabular-nums font-bold text-[#115E3B] dark:text-[#34D399]">4 400 MAD</span>
              </div>
            </div>

            <div className="col-span-6 flex flex-col justify-between rounded-xl border border-[#DCE7E0] bg-white p-2.5 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                  {t.customerHistoryTitle}
                </span>
                <span className="flex items-center gap-1 rounded-lg bg-[#115E3B] px-2 py-1 text-[8px] font-bold text-white dark:bg-[#10B981] dark:text-[#052E1C]">
                  <Plus className="h-2.5 w-2.5" />
                  <span>{t.customerAddPurchase}</span>
                </span>
              </div>

              <div className="space-y-1 rounded-lg border border-[#DCE7E0] bg-[#F7FAF8] p-2 text-[8px] dark:border-[#1E3A2D] dark:bg-[#091611]">
                <div className="flex items-center justify-between font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                  <span>L0001 · Lanterne Fassi</span>
                  <span className="tabular-nums text-[#115E3B] dark:text-[#34D399]">3 200 MAD</span>
                </div>
                <span className="block text-[#335947] dark:text-[#9EC0AE]">
                  Qté: 1 · {t.paymentCash}
                </span>
              </div>

              <div className="flex justify-end">
                <span
                  className={`flex items-center gap-1 rounded-lg border border-[#115E3B] bg-[#ECF7F1] px-2.5 py-1 text-[8px] font-bold text-[#115E3B] transition-all dark:border-[#10B981] dark:bg-[#132B20] dark:text-[#34D399] ${hi(3)}`}
                >
                  <FileSpreadsheet className="h-3 w-3" />
                  <span>{t.exportCustomerExcel} (.XLSX)</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      );

    case 'customer-gallery':
      return (
        <div className="flex h-full flex-col justify-between gap-2 p-3 sm:p-4">
          {/* Top Customer Detail Tab Bar */}
          <div className="flex items-center justify-between gap-2 rounded-xl border border-[#DCE7E0] bg-white px-3 py-2 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
            <div className="flex items-center gap-1.5">
              <span className="rounded-lg border border-[#DCE7E0] px-2.5 py-1 text-[8.5px] font-semibold text-[#335947] dark:border-[#1E3A2D] dark:text-[#9EC0AE]">
                {t.customerTabPurchases} (2)
              </span>
              <span
                className={`flex items-center gap-1 rounded-lg bg-[#115E3B] px-2.5 py-1 text-[8.5px] font-bold text-white transition-all dark:bg-[#10B981] dark:text-[#052E1C] ${hi(1)}`}
              >
                <Images className="h-3 w-3" />
                <span>{t.customerTabGallery} (4)</span>
              </span>
            </div>

            <span className="text-[8.5px] font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
              Ahmed Benali · CL0001
            </span>
          </div>

          {/* Body: Left = Camera & Phone Photo/Video Import | Right = Saved Photos & Videos Gallery */}
          <div dir={dir} className="grid flex-1 grid-cols-12 gap-2.5">
            <div className="col-span-6 flex flex-col justify-between rounded-xl border border-[#DCE7E0] bg-white p-2.5 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
              <div className="space-y-1.5">
                <div className="text-[9px] font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                  {t.customerGalleryFetchFromAccounts}
                </div>
                <p className="text-[7.5px] leading-snug text-[#335947] dark:text-[#9EC0AE]">
                  {t.customerGallerySubtitle}
                </p>
              </div>

              <div className={`space-y-1.5 rounded-lg p-1 transition-all ${hi(2)}`}>
                <div className="flex items-center justify-center gap-1.5 rounded-lg bg-[#115E3B] py-2 text-[8.5px] font-bold text-white dark:bg-[#10B981] dark:text-[#052E1C]">
                  <Camera className="h-3.5 w-3.5" />
                  <span>{t.takePhotoCamera}</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 rounded-lg border border-[#DCE7E0] bg-[#F7FAF8] py-2 text-[8.5px] font-bold text-[#115E3B] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#34D399]">
                  <Upload className="h-3.5 w-3.5" />
                  <span>{t.customerGalleryUploadDevice}</span>
                </div>
              </div>

              <div className="rounded-lg border border-dashed border-[#DCE7E0] bg-[#F7FAF8] px-2 py-1.5 text-center text-[7.5px] text-[#335947] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#9EC0AE]">
                JPG · PNG · MP4 · WEBM
              </div>
            </div>

            <div className="col-span-6 flex flex-col justify-between rounded-xl border border-[#DCE7E0] bg-white p-2.5 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
              <div className="flex items-center justify-between text-[8.5px] font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                <span>{t.customerGalleryTitle}</span>
                <span className="text-[8px] font-semibold text-[#115E3B] dark:text-[#34D399]">4</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div className="overflow-hidden rounded-lg border border-[#DCE7E0] bg-[#F7FAF8] dark:border-[#1E3A2D] dark:bg-[#091611]">
                  <img
                    src={chestImg}
                    alt="Photo"
                    referrerPolicy="no-referrer"
                    className="h-14 w-full object-cover"
                  />
                  <div className="flex items-center justify-between px-1.5 py-1 text-[7.5px] text-[#335947] dark:text-[#9EC0AE]">
                    <span>Photo</span>
                    <Maximize2 className="h-2.5 w-2.5" />
                  </div>
                </div>
                <div className="relative overflow-hidden rounded-lg border border-[#DCE7E0] bg-[#0B1F16] dark:border-[#1E3A2D]">
                  <img
                    src={lanternImg}
                    alt="Video"
                    referrerPolicy="no-referrer"
                    className="h-14 w-full object-cover opacity-75"
                  />
                  <span className="absolute top-1 left-1 flex items-center gap-0.5 rounded bg-[#0B1F16]/85 px-1 py-0.5 text-[7px] font-bold text-[#34D399]">
                    <Video className="h-2.5 w-2.5" /> {t.videoLabel}
                  </span>
                  <div className="flex items-center justify-between bg-[#F7FAF8] px-1.5 py-1 text-[7.5px] text-[#335947] dark:bg-[#091611] dark:text-[#9EC0AE]">
                    <span>MP4</span>
                    <Maximize2 className="h-2.5 w-2.5" />
                  </div>
                </div>
              </div>

              <div
                className={`flex items-center justify-center gap-1 rounded-lg border border-[#115E3B] bg-[#ECF7F1] py-1.5 text-[8.5px] font-bold text-[#115E3B] transition-all dark:border-[#10B981] dark:bg-[#132B20] dark:text-[#34D399] ${hi(3)}`}
              >
                <Download className="h-3 w-3" />
                <span>{t.customerGalleryDownloadDevice}</span>
              </div>
            </div>
          </div>
        </div>
      );

    case 'qr-pos':
      return (
        <div className="flex h-full flex-col justify-between gap-2 p-3 sm:p-4">
          {/* Top Bar: Scanner 2 Modes */}
          <div className="flex items-center justify-between gap-2 rounded-xl border border-[#DCE7E0] bg-white px-3 py-2 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
              <QrCode className="h-3.5 w-3.5 text-[#115E3B] dark:text-[#34D399]" />
              <span>{t.qrScanButtonLabel}</span>
            </div>

            <div className={`flex items-center gap-1.5 rounded-lg p-0.5 transition-all ${hi(1)}`}>
              <span className="flex items-center gap-1 rounded-lg border border-[#DCE7E0] bg-[#F7FAF8] px-2 py-1 text-[8px] font-bold text-[#115E3B] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#34D399]">
                <Eye className="h-3 w-3" />
                <span>{t.qrModeViewTitle}</span>
              </span>
              <span className="flex items-center gap-1 rounded-lg bg-[#115E3B] px-2 py-1 text-[8px] font-bold text-white dark:bg-[#10B981] dark:text-[#052E1C]">
                <ShoppingBag className="h-3 w-3" />
                <span>{t.qrModeSellTitle}</span>
              </span>
            </div>
          </div>

          {/* Body: Left = Dual Digital File (Client vs Management) | Right = POS Invoice & Stock Auto-Update */}
          <div dir={dir} className="grid flex-1 grid-cols-12 gap-2.5">
            <div className="col-span-6 flex flex-col justify-between rounded-xl border border-[#DCE7E0] bg-white p-2.5 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
              <div className={`grid grid-cols-2 gap-1 rounded-lg bg-[#F7FAF8] p-1 transition-all dark:bg-[#091611] ${hi(2)}`}>
                <span className="rounded-md bg-[#115E3B] px-1.5 py-1 text-center text-[8px] font-bold text-white dark:bg-[#10B981] dark:text-[#052E1C]">
                  {t.digitalTabClient}
                </span>
                <span className="rounded-md px-1.5 py-1 text-center text-[8px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                  {t.digitalTabManagement}
                </span>
              </div>

              <div className="my-1.5 flex items-center gap-2 rounded-lg border border-[#DCE7E0] bg-[#F7FAF8] p-1.5 dark:border-[#1E3A2D] dark:bg-[#091611]">
                <img
                  src={lanternImg}
                  alt="L0001"
                  referrerPolicy="no-referrer"
                  className="h-10 w-10 shrink-0 rounded-md object-cover"
                />
                <div className="min-w-0 flex-1 text-[8px]">
                  <span className="font-mono-code block font-bold text-[#115E3B] dark:text-[#34D399]">
                    L0001 · 3 200 MAD
                  </span>
                  <span className="block truncate font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    Lanterne Fassi
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-1 rounded-lg bg-[#16A34A] py-1.5 text-[8px] font-bold text-white">
                <MessageCircle className="h-3 w-3" />
                <span>{t.digitalWhatsappContact}</span>
              </div>
            </div>

            <div className="col-span-6 flex flex-col justify-between rounded-xl border border-[#DCE7E0] bg-white p-2.5 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
              <div className="flex items-center justify-between text-[8.5px] font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                <span className="flex items-center gap-1">
                  <Receipt className="h-3 w-3 text-[#115E3B] dark:text-[#34D399]" />
                  <span>{t.posTabLabel}</span>
                </span>
                <span className="font-mono-code text-[#115E3B] dark:text-[#34D399]">FAC-0001</span>
              </div>

              <div className="space-y-1 rounded-lg border border-[#DCE7E0] bg-[#F7FAF8] p-2 text-[8px] dark:border-[#1E3A2D] dark:bg-[#091611]">
                <div className="flex items-center justify-between text-[#335947] dark:text-[#9EC0AE]">
                  <span>{t.digitalMgmtSupplier}:</span>
                  <span className="font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">Fès</span>
                </div>
                <div className="flex items-center justify-between text-[#335947] dark:text-[#9EC0AE]">
                  <span>{t.posRemainingStock}:</span>
                  <span className="font-bold text-red-600 dark:text-red-400">0</span>
                </div>
              </div>

              <div
                className={`flex items-center justify-center gap-1 rounded-lg border border-[#115E3B] bg-[#ECF7F1] py-1.5 text-[8px] font-bold text-[#115E3B] transition-all dark:border-[#10B981] dark:bg-[#132B20] dark:text-[#34D399] ${hi(3)}`}
              >
                <Download className="h-3 w-3" />
                <span>{t.posDownloadReceipt}</span>
              </div>
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
