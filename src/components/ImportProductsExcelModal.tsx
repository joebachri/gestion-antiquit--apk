import { useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  X,
} from 'lucide-react';
import type { ExcelImportMode, Language, ProductPayload } from '../types';
import { formatCurrency, formatNumber, translations } from '../i18n';
import { buildProductsTemplateExcelBlob, parseProductsFromExcelFile } from '../utils/excel';
import { saveOrShareBlob } from '../utils/download';

interface ImportProductsExcelModalProps {
  isOpen: boolean;
  lang: Language;
  currency: string;
  onClose: () => void;
  onImport: (items: ProductPayload[], mode: ExcelImportMode) => Promise<void>;
}

export function ImportProductsExcelModal({
  isOpen,
  lang,
  currency,
  onClose,
  onImport,
}: ImportProductsExcelModalProps) {
  const t = translations[lang];
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<ProductPayload[]>([]);
  const [duplicateMode, setDuplicateMode] = useState<ExcelImportMode>('skip');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const customCodesCount = parsedRows.filter((r) => Boolean(r.code && r.code.trim())).length;

  const handleDownloadTemplate = async () => {
    const blob = buildProductsTemplateExcelBlob(currency, lang);
    const filename = `modele-codes-produits-${currency.toLowerCase()}.xlsx`;
    await saveOrShareBlob(blob, filename, t.importExcelTemplateButton);
  };

  const handleFileChange = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setErrorMsg('');
    setParsing(true);
    try {
      const { rows } = await parseProductsFromExcelFile(file, currency);
      setFileName(file.name);
      if (rows.length === 0) {
        setParsedRows([]);
        setErrorMsg(t.importExcelEmptyError);
      } else {
        setParsedRows(rows);
      }
    } catch {
      setParsedRows([]);
      setErrorMsg(t.importExcelEmptyError);
    } finally {
      setParsing(false);
    }
  };

  const handleSubmit = async () => {
    if (parsedRows.length === 0 || importing) return;
    setImporting(true);
    setErrorMsg('');
    try {
      await onImport(parsedRows, duplicateMode);
      setFileName('');
      setParsedRows([]);
      onClose();
    } catch {
      setErrorMsg(t.errorSave);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-[#DCE7E0] bg-white shadow-2xl sm:rounded-3xl dark:border-[#1E3A2D] dark:bg-[#0F2119]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-[#DCE7E0] px-5 py-4 dark:border-[#1E3A2D]">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ECF7F1] text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                {t.importExcelTitle}
              </h2>
              <p className="truncate text-xs text-[#335947] dark:text-[#9EC0AE]">
                {t.importExcelSubtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Template + File Picker */}
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={parsing}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#115E3B] px-4 text-xs font-semibold text-white hover:bg-[#0D4A2E] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#052E1C] dark:hover:bg-[#059669]"
            >
              <Upload className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {fileName || t.importExcelChooseFile}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void handleDownloadTemplate()}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] px-4 text-xs font-semibold text-[#115E3B] hover:bg-[#ECF7F1] whitespace-nowrap shrink-0 dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#34D399]"
            >
              <Download className="h-4 w-4 shrink-0" />
              <span>{t.importExcelTemplateButton}</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              className="hidden"
              onChange={(e) => {
                void handleFileChange(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          {/* Duplicate Mode Switcher */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
              {t.importExcelDuplicateModeLabel}
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setDuplicateMode('skip')}
                className={`min-h-[42px] rounded-xl border px-3 text-xs font-semibold text-start transition-colors ${
                  duplicateMode === 'skip'
                    ? 'border-[#115E3B] bg-[#ECF7F1] text-[#115E3B] dark:border-[#10B981] dark:bg-[#132B20] dark:text-[#34D399]'
                    : 'border-[#DCE7E0] bg-[#F7FAF8] text-[#335947] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#9EC0AE]'
                }`}
              >
                {t.importExcelDuplicateSkip}
              </button>
              <button
                type="button"
                onClick={() => setDuplicateMode('update')}
                className={`min-h-[42px] rounded-xl border px-3 text-xs font-semibold text-start transition-colors ${
                  duplicateMode === 'update'
                    ? 'border-[#115E3B] bg-[#ECF7F1] text-[#115E3B] dark:border-[#10B981] dark:bg-[#132B20] dark:text-[#34D399]'
                    : 'border-[#DCE7E0] bg-[#F7FAF8] text-[#335947] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#9EC0AE]'
                }`}
              >
                {t.importExcelDuplicateUpdate}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          {/* Parsed Rows Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#10B981]/35 bg-[#ECF7F1]/70 px-3.5 py-2.5 text-xs dark:border-[#10B981]/30 dark:bg-[#132B20]/60">
                <div className="flex items-center gap-2 font-semibold text-[#115E3B] dark:text-[#34D399]">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{t.importExcelPreviewTitle}</span>
                </div>
                <div className="tabular-nums flex items-center gap-3 font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                  <span>
                    {formatNumber(parsedRows.length, lang)} {t.importExcelDetectedRows}
                  </span>
                  <span className="text-[#115E3B] dark:text-[#34D399]">
                    {formatNumber(customCodesCount, lang)} {t.importExcelCustomCodesCount}
                  </span>
                </div>
              </div>

              <div className="max-h-64 overflow-auto rounded-2xl border border-[#DCE7E0] dark:border-[#1E3A2D]">
                <table className="w-full border-collapse text-xs">
                  <thead className="sticky top-0 bg-[#F7FAF8] text-[#335947] dark:bg-[#091611] dark:text-[#9EC0AE]">
                    <tr className="border-b border-[#DCE7E0] dark:border-[#1E3A2D]">
                      <th className="px-3 py-2 text-start font-bold">{t.importExcelColCode}</th>
                      <th className="px-3 py-2 text-start font-bold">{t.importExcelColName}</th>
                      <th className="px-3 py-2 text-end font-bold">{t.importExcelColQty}</th>
                      <th className="px-3 py-2 text-end font-bold">{t.importExcelColPrice}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE7E0] bg-white dark:divide-[#1E3A2D] dark:bg-[#0F2119]">
                    {parsedRows.slice(0, 100).map((row, idx) => (
                      <tr key={`${row.code || 'auto'}-${idx}`}>
                        <td className="font-mono-code px-3 py-2 font-bold text-[#115E3B] dark:text-[#34D399]">
                          {row.code?.trim() || t.importExcelAutoCodeHint}
                        </td>
                        <td className="max-w-[200px] truncate px-3 py-2 font-medium text-[#0B1F16] dark:text-[#F2F9F5]">
                          {row.name}
                        </td>
                        <td className="tabular-nums px-3 py-2 text-end text-[#0B1F16] dark:text-[#F2F9F5]">
                          {formatNumber(row.quantity, lang)}
                        </td>
                        <td className="tabular-nums px-3 py-2 text-end font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                          {formatCurrency(row.sellingPrice, currency, lang)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-[#DCE7E0] bg-[#F7FAF8] px-5 py-3.5 dark:border-[#1E3A2D] dark:bg-[#091611]">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-xl border border-[#DCE7E0] bg-white px-4 text-xs font-semibold text-[#0B1F16] hover:bg-[#F7FAF8] dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5]"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={parsedRows.length === 0 || importing}
            className="min-h-[44px] rounded-xl bg-[#115E3B] px-5 text-xs font-semibold text-white hover:bg-[#0D4A2E] disabled:opacity-50 dark:bg-[#10B981] dark:text-[#052E1C]"
          >
            {importing
              ? t.importExcelImporting
              : `${t.importExcelSubmitButton} (${formatNumber(parsedRows.length, lang)})`}
          </button>
        </div>
      </div>
    </div>
  );
}
