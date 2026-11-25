import { useEffect, useState } from 'react';
import { Bluetooth, CheckCircle2, Link2, Plus, Printer, Trash2, Unlink } from 'lucide-react';
import type { Language, PrinterMode, PrinterPaperFormat, SavedPrinterProfile } from '../types';
import { translations } from '../i18n';
import {
  disconnectBluetoothPrinter,
  isBluetoothPrinterConnected,
  isWebBluetoothSupported,
  linkBluetoothPrinter,
} from '../utils/printer';

interface PrinterSettingsCardProps {
  lang: Language;
  printerMode: PrinterMode;
  printerPaper: PrinterPaperFormat;
  printerName: string;
  printerLinked: boolean;
  savedPrinters?: SavedPrinterProfile[];
  activePrinterId?: string;
  onSavePrinter: (next: {
    printerMode: PrinterMode;
    printerPaper: PrinterPaperFormat;
    printerName: string;
    printerLinked: boolean;
    savedPrinters: SavedPrinterProfile[];
    activePrinterId: string;
  }) => Promise<void> | void;
  onNotify?: (msg: string) => void;
}

export function PrinterSettingsCard({
  lang,
  printerMode,
  printerPaper,
  printerName,
  printerLinked,
  savedPrinters = [],
  activePrinterId = '',
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

  const formatPaperShort = (paper: PrinterPaperFormat): string => {
    if (paper === 'a4') return 'A4';
    if (paper === 'label_50x30') return '50×30 mm';
    if (paper === 'label_40x30') return '40×30 mm';
    if (paper === 'roll_58') return '58 mm';
    return '80 mm';
  };

  const formatModeShort = (mode: PrinterMode): string => {
    if (mode === 'thermal_bt') return 'Bluetooth';
    if (mode === 'browser') return lang === 'ar' ? 'المتصفح' : 'Navigateur';
    return 'PDF / Système';
  };

  // Ensure legacy linked single printer appears cleanly in list if list was empty
  const effectivePrinters: SavedPrinterProfile[] =
    savedPrinters.length > 0
      ? savedPrinters
      : printerLinked && printerName.trim()
      ? [
          {
            id: activePrinterId || 'legacy-active-printer',
            name: printerName.trim(),
            mode: printerMode,
            paper: printerPaper,
            isBluetooth: printerMode === 'thermal_bt',
          },
        ]
      : [];

  const resolvedActiveId =
    activePrinterId ||
    effectivePrinters.find((p) => p.name === printerName && p.mode === printerMode)?.id ||
    (printerLinked && effectivePrinters[0]?.id) ||
    '';

  const handleAddPrinter = async () => {
    setSaving(true);
    setBtNotice('');
    try {
      const finalName = draftName.trim() || defaultNameForMode(draftMode, draftPaper);
      const newProfile: SavedPrinterProfile = {
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `pr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: finalName,
        mode: draftMode,
        paper: draftPaper,
        isBluetooth: draftMode === 'thermal_bt',
      };
      const nextList = [...effectivePrinters, newProfile];
      await onSavePrinter({
        printerMode: newProfile.mode,
        printerPaper: newProfile.paper,
        printerName: newProfile.name,
        printerLinked: true,
        savedPrinters: nextList,
        activePrinterId: newProfile.id,
      });
      setDraftName('');
      onNotify?.(`${t.printerAddedToast} ${finalName}`);
    } finally {
      setSaving(false);
    }
  };

  const handleActivatePrinter = async (profile: SavedPrinterProfile) => {
    setSaving(true);
    try {
      setDraftMode(profile.mode);
      setDraftPaper(profile.paper);
      setDraftName(profile.name);
      await onSavePrinter({
        printerMode: profile.mode,
        printerPaper: profile.paper,
        printerName: profile.name,
        printerLinked: true,
        savedPrinters: effectivePrinters,
        activePrinterId: profile.id,
      });
      onNotify?.(`${t.printerSystemLinkedToast} ${profile.name}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePrinter = async (profileId: string) => {
    setSaving(true);
    try {
      const nextList = effectivePrinters.filter((p) => p.id !== profileId);
      const deletingActive = profileId === resolvedActiveId;
      const nextActive = deletingActive ? nextList[0] : effectivePrinters.find((p) => p.id === resolvedActiveId);
      await onSavePrinter({
        printerMode: nextActive?.mode || draftMode,
        printerPaper: nextActive?.paper || draftPaper,
        printerName: nextActive?.name || '',
        printerLinked: Boolean(nextActive),
        savedPrinters: nextList,
        activePrinterId: nextActive?.id || '',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestPrinter = async (profile: SavedPrinterProfile) => {
    if (profile.mode === 'browser' && typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
    onNotify?.(`${t.printerTestToast} ${profile.name}`);
  };

  const handlePairBluetooth = async () => {
    setPairingBt(true);
    setBtNotice('');
    try {
      const res = await linkBluetoothPrinter();
      if (!res.ok) {
        setBtNotice(t.printerBluetoothUnsupported);
        return;
      }
      const nextPaper: PrinterPaperFormat = draftPaper === 'a4' ? 'label_50x30' : draftPaper;
      setDraftMode('thermal_bt');
      setDraftPaper(nextPaper);
      setDraftName(res.printerName);

      const existing = effectivePrinters.find(
        (p) => p.name.toLowerCase() === res.printerName.toLowerCase() && p.mode === 'thermal_bt'
      );
      const profile: SavedPrinterProfile = existing || {
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `bt-${Date.now()}`,
        name: res.printerName,
        mode: 'thermal_bt',
        paper: nextPaper,
        isBluetooth: true,
      };
      const nextList = existing ? effectivePrinters : [...effectivePrinters, profile];

      await onSavePrinter({
        printerMode: 'thermal_bt',
        printerPaper: profile.paper,
        printerName: profile.name,
        printerLinked: true,
        savedPrinters: nextList,
        activePrinterId: profile.id,
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
        savedPrinters: effectivePrinters,
        activePrinterId: '',
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
    <div className="space-y-4">
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

        {/* Saved Printers List */}
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#335947] dark:text-[#9EC0AE]">
            {t.printerSavedListTitle} ({effectivePrinters.length})
          </p>

          {effectivePrinters.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#DCE7E0] bg-white px-3 py-2.5 text-[11px] text-[#6B8A79] dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#8FB39E]">
              {t.printerEmptyListHint}
            </p>
          ) : (
            <div className="space-y-2">
              {effectivePrinters.map((profile) => {
                const isActive = printerLinked && profile.id === resolvedActiveId;
                return (
                  <div
                    key={profile.id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs ${
                      isActive
                        ? 'border-[#115E3B] bg-[#ECF7F1] dark:border-[#10B981] dark:bg-[#132B20]'
                        : 'border-[#DCE7E0] bg-white dark:border-[#1E3A2D] dark:bg-[#0F2119]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {profile.isBluetooth ? (
                          <Bluetooth className="h-3.5 w-3.5 shrink-0 text-[#115E3B] dark:text-[#34D399]" />
                        ) : (
                          <Printer className="h-3.5 w-3.5 shrink-0 text-[#115E3B] dark:text-[#34D399]" />
                        )}
                        <span className="truncate font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                          {profile.name}
                        </span>
                        {isActive && (
                          <span className="rounded-md bg-[#115E3B] px-1.5 py-0.5 text-[10px] font-bold text-white dark:bg-[#10B981] dark:text-[#052E1C]">
                            {t.printerActiveBadge}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                        {formatModeShort(profile.mode)} · {formatPaperShort(profile.paper)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => void handleActivatePrinter(profile)}
                          disabled={saving}
                          className="flex min-h-[34px] items-center gap-1 rounded-lg bg-[#115E3B] px-2.5 text-[11px] font-semibold text-white hover:bg-[#0D4A2E] dark:bg-[#10B981] dark:text-[#052E1C]"
                        >
                          <Link2 className="h-3 w-3" />
                          <span>{t.printerUseButton}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleTestPrinter(profile)}
                        className="flex min-h-[34px] items-center gap-1 rounded-lg border border-[#DCE7E0] bg-white px-2.5 text-[11px] font-semibold text-[#0B1F16] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#F2F9F5]"
                      >
                        <span>{t.printerTestButton}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeletePrinter(profile.id)}
                        disabled={saving}
                        aria-label={t.printerDeleteButton}
                        title={t.printerDeleteButton}
                        className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-[#DCE7E0] bg-white text-red-600 hover:bg-red-50 dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Printer Form */}
      <div className="space-y-3 rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-4 dark:border-[#1E3A2D] dark:bg-[#091611]">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 shrink-0 text-[#115E3B] dark:text-[#34D399]" />
          <p className="text-xs font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
            {t.printerAddTitle}
          </p>
        </div>

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
              <span>
                {isWebBluetoothSupported()
                  ? t.printerLinkBluetoothButton
                  : t.printerLinkBluetoothButton}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleAddPrinter()}
            disabled={saving}
            className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#115E3B] px-3 text-xs font-semibold text-white hover:bg-[#0D4A2E] disabled:opacity-60 whitespace-nowrap dark:bg-[#10B981] dark:text-[#052E1C]"
          >
            <Plus className="h-4 w-4" />
            <span>{saving ? t.saving : t.printerAddButton}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

