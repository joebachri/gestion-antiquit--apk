import {
  ArrowRightLeft,
  Banknote,
  BookOpen,
  Calculator,
  FileSpreadsheet,
  Languages,
  Moon,
  Package,
  PlusSquare,
  Printer,
  QrCode,
  Receipt,
  Settings,
  Sun,
  Truck,
  Upload,
  Users,
  Wallet,
  Warehouse,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Language } from '../types';
import { formatNumber, translations } from '../i18n';

interface LauncherHomeProps {
  lang: Language;
  isDark: boolean;
  totalProducts: number;
  totalCustomers: number;
  totalSuppliers: number;
  totalInvoices: number;
  totalWarehouses: number;
  portfolioPendingCount?: number;
  exportingExcel: boolean;
  onOpenInventory: () => void;
  onOpenAddProduct: () => void;
  onOpenCaisse: () => void;
  onOpenInvoices: () => void;
  onOpenPortfolio: () => void;
  onOpenQrScanner: () => void;
  onOpenCustomers: () => void;
  onOpenSuppliers: () => void;
  onOpenWarehouses: () => void;
  onOpenAdjustments: () => void;
  onOpenReports: () => void;
  onOpenImportExcel: () => void;
  onExportExcel: () => void;
  onOpenCalculator: () => void;
  onOpenSettings: () => void;
  onOpenGuide: () => void;
  onToggleLanguage: () => void;
  onToggleTheme: () => void;
}

interface LauncherAppItem {
  id: string;
  label: string;
  subtitle?: string;
  icon: LucideIcon;
  toneClass: string;
  disabled?: boolean;
  onClick: () => void;
}

export function LauncherHome({
  lang,
  isDark,
  totalProducts,
  totalCustomers,
  totalSuppliers,
  totalInvoices,
  totalWarehouses,
  portfolioPendingCount = 0,
  exportingExcel,
  onOpenInventory,
  onOpenAddProduct,
  onOpenCaisse,
  onOpenInvoices,
  onOpenPortfolio,
  onOpenQrScanner,
  onOpenCustomers,
  onOpenSuppliers,
  onOpenWarehouses,
  onOpenAdjustments,
  onOpenReports,
  onOpenImportExcel,
  onExportExcel,
  onOpenCalculator,
  onOpenSettings,
  onOpenGuide,
  onToggleLanguage,
  onToggleTheme,
}: LauncherHomeProps) {
  const t = translations[lang];

  const items: LauncherAppItem[] = [
    {
      id: 'inventory',
      label: t.tabInventory,
      subtitle: `${formatNumber(totalProducts, lang)} ${t.referencesUnit}`,
      icon: Package,
      toneClass:
        'border-[#115E3B]/20 bg-[#115E3B] text-white dark:border-[#10B981]/30 dark:bg-[#10B981] dark:text-[#052E1C]',
      onClick: onOpenInventory,
    },
    {
      id: 'add-product',
      label: t.addProduct,
      icon: PlusSquare,
      toneClass:
        'border-[#115E3B]/25 bg-[#ECF7F1] text-[#115E3B] dark:border-[#10B981]/30 dark:bg-[#132B20] dark:text-[#34D399]',
      onClick: onOpenAddProduct,
    },
    {
      id: 'caisse',
      label: t.launcherCashierLabel,
      subtitle: t.launcherCashierSubtitle,
      icon: Banknote,
      toneClass:
        'border-[#047857]/25 bg-[#D1FAE5] text-[#065F46] dark:border-[#10B981]/30 dark:bg-[#0D2E22] dark:text-[#34D399]',
      onClick: onOpenCaisse,
    },
    {
      id: 'invoices',
      label: t.launcherInvoicesLabel,
      subtitle: `${formatNumber(totalInvoices, lang)} ${t.launcherInvoicesUnit}`,
      icon: Receipt,
      toneClass:
        'border-[#B45309]/25 bg-[#FEF3C7] text-[#92400E] dark:border-[#F59E0B]/30 dark:bg-[#2B1F0B] dark:text-[#FBBF24]',
      onClick: onOpenInvoices,
    },
    {
      id: 'portfolio',
      label: t.portfolioNavLabel,
      subtitle:
        portfolioPendingCount > 0
          ? `${formatNumber(portfolioPendingCount, lang)} · ${t.portfolioLauncherSubtitle}`
          : t.portfolioLauncherSubtitle,
      icon: Wallet,
      toneClass:
        'border-[#0369A1]/25 bg-[#E0F2FE] text-[#075985] dark:border-[#38BDF8]/30 dark:bg-[#0B2333] dark:text-[#7DD3FC]',
      onClick: onOpenPortfolio,
    },
    {
      id: 'qr-scanner',
      label: t.qrScanButtonLabel,
      icon: QrCode,
      toneClass:
        'border-[#0F766E]/25 bg-[#CCFBF1] text-[#115E59] dark:border-[#2DD4BF]/30 dark:bg-[#0D2927] dark:text-[#5EEAD4]',
      onClick: onOpenQrScanner,
    },
    {
      id: 'customers',
      label: t.tabCustomers,
      subtitle: `${formatNumber(totalCustomers, lang)} ${t.launcherCustomersUnit}`,
      icon: Users,
      toneClass:
        'border-[#1D4ED8]/20 bg-[#DBEAFE] text-[#1E40AF] dark:border-[#60A5FA]/30 dark:bg-[#10203A] dark:text-[#93C5FD]',
      onClick: onOpenCustomers,
    },
    {
      id: 'suppliers',
      label: t.suppliersNavLabel,
      subtitle: `${formatNumber(totalSuppliers, lang)} ${t.launcherSuppliersUnit}`,
      icon: Truck,
      toneClass:
        'border-[#9A3412]/20 bg-[#FFEDD5] text-[#9A3412] dark:border-[#FB923C]/30 dark:bg-[#2C180B] dark:text-[#FDBA74]',
      onClick: onOpenSuppliers,
    },
    {
      id: 'warehouses',
      label: t.warehousesNavLabel,
      subtitle: `${formatNumber(totalWarehouses, lang)} ${t.launcherWarehousesUnit}`,
      icon: Warehouse,
      toneClass:
        'border-[#334155]/20 bg-[#E2E8F0] text-[#1E293B] dark:border-[#94A3B8]/25 dark:bg-[#16222E] dark:text-[#CBD5E1]',
      onClick: onOpenWarehouses,
    },
    {
      id: 'adjustments',
      label: t.adjustmentsNavLabel,
      icon: ArrowRightLeft,
      toneClass:
        'border-[#0369A1]/20 bg-[#E0F2FE] text-[#075985] dark:border-[#38BDF8]/30 dark:bg-[#0B2333] dark:text-[#7DD3FC]',
      onClick: onOpenAdjustments,
    },
    {
      id: 'reports',
      label: t.reportsNavLabel,
      icon: Printer,
      toneClass:
        'border-[#4338CA]/20 bg-[#E0E7FF] text-[#3730A3] dark:border-[#818CF8]/30 dark:bg-[#171A38] dark:text-[#A5B4FC]',
      onClick: onOpenReports,
    },
    {
      id: 'import-excel',
      label: t.importExcelButton,
      icon: Upload,
      toneClass:
        'border-[#15803D]/25 bg-[#DCFCE7] text-[#166534] dark:border-[#4ADE80]/30 dark:bg-[#0D2B1A] dark:text-[#86EFAC]',
      onClick: onOpenImportExcel,
    },
    {
      id: 'export-excel',
      label: t.exportExcel,
      icon: FileSpreadsheet,
      toneClass:
        'border-[#15803D]/25 bg-[#ECFDF5] text-[#065F46] dark:border-[#34D399]/30 dark:bg-[#0D2720] dark:text-[#6EE7B7]',
      disabled: exportingExcel,
      onClick: onExportExcel,
    },
    {
      id: 'calculator',
      label: t.calculatorButtonLabel,
      icon: Calculator,
      toneClass:
        'border-[#475569]/20 bg-[#F1F5F9] text-[#334155] dark:border-[#94A3B8]/25 dark:bg-[#18222B] dark:text-[#E2E8F0]',
      onClick: onOpenCalculator,
    },
    {
      id: 'settings',
      label: t.settingsButtonLabel,
      icon: Settings,
      toneClass:
        'border-[#DCE7E0] bg-white text-[#115E3B] dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#34D399]',
      onClick: onOpenSettings,
    },
    {
      id: 'guide',
      label: t.guideButtonLabel,
      icon: BookOpen,
      toneClass:
        'border-[#0F766E]/20 bg-[#F0FDFA] text-[#115E59] dark:border-[#2DD4BF]/25 dark:bg-[#0F2724] dark:text-[#5EEAD4]',
      onClick: onOpenGuide,
    },
    {
      id: 'language',
      label: t.launcherLanguageLabel,
      subtitle: t.launcherLanguageValue,
      icon: Languages,
      toneClass:
        'border-[#DCE7E0] bg-white text-[#0B1F16] dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5]',
      onClick: onToggleLanguage,
    },
    {
      id: 'theme',
      label: t.launcherThemeLabel,
      subtitle: isDark ? t.launcherThemeDark : t.launcherThemeLight,
      icon: isDark ? Sun : Moon,
      toneClass:
        'border-[#DCE7E0] bg-white text-[#0B1F16] dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#FBBF24]',
      onClick: onToggleTheme,
    },
  ];

  return (
    <section
      aria-label={t.launcherSectionTitle}
      className="mx-auto flex min-h-[calc(100dvh-110px)] max-w-5xl flex-col justify-center py-4 sm:py-8"
    >
      <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-6 sm:gap-y-8 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              disabled={item.disabled}
              className="group flex flex-col items-center rounded-2xl p-2 text-center transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#115E3B] disabled:opacity-60"
            >
              <span
                className={`flex h-16 w-16 items-center justify-center rounded-[22px] border shadow-xs transition-all duration-150 group-hover:-translate-y-0.5 group-hover:shadow-md sm:h-[74px] sm:w-[74px] sm:rounded-[24px] ${item.toneClass}`}
              >
                <Icon className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2} />
              </span>

              <span className="mt-2.5 line-clamp-2 max-w-[104px] text-xs font-semibold leading-snug text-[#0B1F16] sm:max-w-[128px] sm:text-sm dark:text-[#F2F9F5]">
                {item.label}
              </span>

              {item.subtitle && (
                <span className="tabular-nums mt-0.5 truncate max-w-[110px] text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                  {item.subtitle}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
