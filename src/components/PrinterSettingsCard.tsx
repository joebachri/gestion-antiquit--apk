import { useEffect, useState } from 'react';
import { Bluetooth, CheckCircle2, Link2, Printer, Unlink } from 'lucide-react';
import type { Language, PrinterMode, PrinterPaperFormat } from '../types';
import { translations } from '../i18n';
import {
  disconnectBluetoothPrinter,
  isBluetoothPrinterConnected,
  linkBluetoothPrinter,
} from '../utils/printer';

interface PrinterSettingsCardProps {
  lang: Language;
  printerMode: PrinterMode;
  printerPaper: PrinterPaperFormat;
  printerName: string;
  printerLinked: boolean;
  onSavePrinter: (next: {
    printerMode: PrinterMode;
    printerPaper: PrinterPaperFormat;
    printerName: string;
    printerLinked: boolean;
  }) => Promise<void> | void;
  onNotify?: (msg: string) => void;
}

export function PrinterSettingsCard({
  lang,
  printerMode,
  printerPaper,
  printerName,
  printerLinked,
  onSavePrinter,
  onNotify,
}: PrinterSettingsCardProps) {
  const t = translations[lang];
  const [draftMode, setDraftMode] = useState<PrinterMode>(printerMode);
  const [draftPaper, setDraftPaper] = useState<PrinterPaperFormat>(printerPaper);
  const [draftName, setDraftName] = useState<string>(printerName);
  const [pairingBt, setPairingBt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [btNotice, setBtNotice] = useState('');

  useEffect(() => {
    setDraftMode(printerMode);
    setDraftPaper(printerPaper);
    setDraftName(printerName);
  }, [printerMode, printerPaper, printerName]);

  const defaultNameForMode = (mode: PrinterMode, paper: PrinterPaperFormat): string => {
    if (mode === 'thermal_bt') {
      return lang === 'ar' ? 'طابعة حرارية بلوتوث' : 'Imprimante Thermique Bluetooth';
    }
    if (mode === 'browser') {
      return lang === 'ar' ? 'طابعة المتصفح' : 'Imprimante Navigateur';
    }
    const paperLabel =
      paper === 'a4'
        ? 'A4'
        : paper === 'label_50x30'
        ? '50×30 mm'
        : paper === 'label_40x30'
        ? '40×30 mm'
        : paper === 'roll_58'
        ? '58 mm'
        : '80 mm';
    return lang === 'ar' ? `PDF / النظام (${paperLabel})` : `PDF / Système (${paperLabel})`;
  };

  const handleLinkPrinter = async () => {
    setSaving(true);
    setBtNotice('');
    try {
      const finalName = draftName.trim() || defaultNameForMode(draftMode, draftPaper);
      setDraftName(finalName);
      await onSavePrinter({
        printerMode: draftMode,
        printerPaper: draftPaper,
        printerName: finalName,
        printerLinked: true,
      });
      onNotify?.(`${t.printerSystemLinkedToast} ${finalName}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePairBluetooth = async () => {
    setPairingBt(true);
    setBtNotice('');
    try {
      const res = await linkBluetoothPrinter();
      if (!res.ok) {
        if (res.reason === 'UNSUPPORTED' || res.reason === 'FAILED') {
          setBtNotice(t.printerBluetoothUnsupported);
        }
        return;
      }
      const nextPaper: PrinterPaperFormat = draftPaper === 'a4' ? 'label_50x30' : draftPaper;
      setDraftMode('thermal_bt');
      setDraftPaper(nextPaper);
      setDraftName(res.printerName);

      await onSavePrinter({
        printerMode: 'thermal_bt',
        printerPaper: nextPaper,
        printerName: res.printerName,
        printerLinked: true,
      });
      onNotify?.(`${t.printerBluetoothLinkedToast} ${res.printerName}`);
    } finally {
      setPairingBt(false);
    }
  };

  const handleUnlink = async () => {
    disconnectBluetoothPrinter();
    setSaving(true);
    try {
      await onSavePrinter({
        printerMode: draftMode,
        printerPaper: draftPaper,
        printerName: '',
        printerLinked: false,
      });
      setDraftName('');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'min-h-[42px] w-full rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5] dark:placeholder:text-[#8FB39E] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16]';

  const paperOptions: Array<{ id: PrinterPaperFormat; label: string }> = [
    { id: 'a4', label: t.printerPaperA4 },
    { id: 'label_50x30', label: t.printerPaper50x30 },
    { id: 'label_40x30', label: t.printerPaper40x30 },
    { id: 'roll_58', label: t.printerPaper58 },
    { id: 'roll_80', label: t.printerPaper80 },
  ];

  const btConnectedNow = isBluetoothPrinterConnected();

  return (
    <div className="space-y-3 rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-4 dark:border-[#1E3A2D] dark:bg-[#091611]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Printer className="h-4 w-4 shrink-0 text-[#115E3B] dark:text-[#34D399]" />
          <div>
            <p className="text-xs font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
              {t.printerSectionTitle}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-[#335947] dark:text-[#9EC0AE]">
              {t.printerSectionSubtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Linked Printer Status */}
      {printerLinked ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#10B981]/35 bg-[#ECF7F1] px-3 py-2 text-xs dark:border-[#10B981]/30 dark:bg-[#132B20]">
          <div className="flex min-w-0 items-center gap-1.5 text-[#115E3B] dark:text-[#34D399]">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="truncate font-semibold">
              {t.printerLinkedBadge} {printerName || defaultNameForMode(printerMode, printerPaper)}
              {btConnectedNow ? (lang === 'ar' ? ' (بلوتوث متصل)' : ' (BT OK)') : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void handleUnlink()}
            disabled={saving}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#335947] hover:text-red-600 dark:text-[#9EC0AE] dark:hover:text-red-400"
          >
            <Unlink className="h-3.5 w-3.5" />
            <span>{t.printerUnlinkButton}</span>
          </button>
        </div>
      ) : (
        <p className="rounded-xl border border-[#DCE7E0] bg-white px-3 py-2 text-[11px] text-[#335947] dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#9EC0AE]">
          {t.printerNotLinkedHint}
        </p>
      )}

      {/* Mode Selection */}
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
          {t.printerModeLabel}
        </label>
        <div className="grid grid-cols-1 gap-1.5">
          {(
            [
              {
                id: 'pdf_system' as PrinterMode,
                title: t.printerModePdfSystem,
                desc: t.printerModePdfSystemDesc,
              },
              {
                id: 'thermal_bt' as PrinterMode,
                title: t.printerModeThermalBt,
                desc: t.printerModeThermalBtDesc,
              },
              {
                id: 'browser' as PrinterMode,
                title: t.printerModeBrowser,
                desc: t.printerModeBrowserDesc,
              },
            ] as const
          ).map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => {
                setDraftMode(mode.id);
                setBtNotice('');
              }}
              className={`rounded-xl border px-3 py-2 text-start transition-colors ${
                draftMode === mode.id
                  ? 'border-[#115E3B] bg-[#ECF7F1] text-[#0B1F16] dark:border-[#10B981] dark:bg-[#132B20] dark:text-[#F2F9F5]'
                  : 'border-[#DCE7E0] bg-white text-[#335947] hover:border-[#115E3B]/40 dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#9EC0AE]'
              }`}
            >
              <span className="block text-xs font-bold">{mode.title}</span>
              <span className="mt-0.5 block text-[11px] leading-snug opacity-85">{mode.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Format & Printer Name */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
            {t.printerPaperLabel}
          </label>
          <select
            value={draftPaper}
            onChange={(e) => setDraftPaper(e.target.value as PrinterPaperFormat)}
            className={inputClass}
          >
            {paperOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
            {t.printerNameLabel}
          </label>
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder={t.printerNamePlaceholder}
            maxLength={80}
            className={inputClass}
          />
        </div>
      </div>

      {btNotice && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {btNotice}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        {draftMode === 'thermal_bt' && (
          <button
            type="button"
            onClick={() => void handlePairBluetooth()}
            disabled={pairingBt}
            className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#115E3B] bg-white px-3 text-xs font-semibold text-[#115E3B] hover:bg-[#ECF7F1] disabled:opacity-60 whitespace-nowrap dark:border-[#10B981] dark:bg-[#0F2119] dark:text-[#34D399]"
          >
            <Bluetooth className="h-3.5 w-3.5" />
            <span>{t.printerLinkBluetoothButton}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => void handleLinkPrinter()}
          disabled={saving}
          className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#115E3B] px-3 text-xs font-semibold text-white hover:bg-[#0D4A2E] disabled:opacity-60 whitespace-nowrap dark:bg-[#10B981] dark:text-[#052E1C]"
        >
          <Link2 className="h-3.5 w-3.5" />
          <span>{saving ? t.saving : t.printerLinkButton}</span>
        </button>
      </div>
    </div>
  );
}
