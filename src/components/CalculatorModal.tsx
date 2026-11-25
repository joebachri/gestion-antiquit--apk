import { useCallback, useEffect, useState } from 'react';
import { Calculator as CalculatorIcon, Check, Copy, Delete, History, X } from 'lucide-react';
import type { Language } from '../types';
import { translations } from '../i18n';
import { evaluateCalculatorExpression, formatCalculatorNumber } from '../utils/calculator';
import { convertFromMad, convertToMad } from '../utils/currency';
import { copyTextWithFallback } from '../utils/download';

interface CalculatorModalProps {
  isOpen: boolean;
  lang: Language;
  currency: string;
  onClose: () => void;
}

interface CalcHistoryEntry {
  expression: string;
  result: string;
  numericValue: number;
}

const OPERATORS = new Set(['+', '-', '×', '÷']);

function formatDisplayExpression(expr: string): string {
  return expr.replace(/([+\-×÷])/g, ' $1 ').replace(/\s+/g, ' ').trim();
}

export function CalculatorModal({ isOpen, lang, currency, onClose }: CalculatorModalProps) {
  const t = translations[lang];
  const [expression, setExpression] = useState('');
  const [resultDisplay, setResultDisplay] = useState('0');
  const [justEvaluated, setJustEvaluated] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<CalcHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const handleClear = useCallback(() => {
    setExpression('');
    setResultDisplay('0');
    setJustEvaluated(false);
    setHasError(false);
  }, []);

  const handleBackspace = useCallback(() => {
    setHasError(false);
    if (justEvaluated) {
      setExpression('');
      setResultDisplay('0');
      setJustEvaluated(false);
      return;
    }
    setExpression((prev) => {
      const next = prev.slice(0, -1);
      if (!next) {
        setResultDisplay('0');
      } else {
        const preview = evaluateCalculatorExpression(next);
        if (preview !== null) {
          setResultDisplay(String(preview));
        }
      }
      return next;
    });
  }, [justEvaluated]);

  const handleAppendDigit = useCallback(
    (digit: string) => {
      setHasError(false);
      if (justEvaluated) {
        const next = digit === '.' ? '0.' : digit;
        setExpression(next);
        setResultDisplay(next);
        setJustEvaluated(false);
        return;
      }

      setExpression((prev) => {
        // Prevent multiple dots inside the current number segment
        if (digit === '.') {
          const segments = prev.split(/[+\-×÷]/);
          const currentSegment = segments[segments.length - 1] || '';
          if (currentSegment.includes('.') || currentSegment.includes('%')) {
            return prev;
          }
          const addition = currentSegment === '' ? '0.' : '.';
          const next = `${prev}${addition}`;
          setResultDisplay(next);
          return next;
        }

        // After '%' without an operator, start fresh or insert implicit multiplication? Better: prevent trailing digit right after '%'
        if (prev.endsWith('%')) {
          return prev;
        }

        // Avoid leading double zeroes like "00"
        const segments = prev.split(/[+\-×÷]/);
        const currentSegment = segments[segments.length - 1] || '';
        let next: string;
        if (currentSegment === '0' && digit !== '.') {
          next = `${prev.slice(0, -1)}${digit}`;
        } else {
          next = `${prev}${digit}`;
        }

        const preview = evaluateCalculatorExpression(next);
        if (preview !== null) {
          setResultDisplay(String(preview));
        } else {
          setResultDisplay(next);
        }
        return next;
      });
    },
    [justEvaluated]
  );

  const handleOperator = useCallback(
    (op: '+' | '-' | '×' | '÷') => {
      setHasError(false);
      if (justEvaluated) {
        const base = hasError ? '0' : resultDisplay;
        setExpression(`${base}${op}`);
        setJustEvaluated(false);
        return;
      }

      setExpression((prev) => {
        if (!prev) {
          return op === '-' ? '-' : `0${op}`;
        }
        if (prev === '-') {
          return op === '-' ? '-' : `0${op}`;
        }
        const lastChar = prev[prev.length - 1];
        if (OPERATORS.has(lastChar)) {
          return `${prev.slice(0, -1)}${op}`;
        }
        return `${prev}${op}`;
      });
    },
    [hasError, justEvaluated, resultDisplay]
  );

  const handlePercent = useCallback(() => {
    setHasError(false);
    if (justEvaluated) {
      const evaluated = evaluateCalculatorExpression(`${resultDisplay}%`);
      if (evaluated !== null) {
        setExpression(String(evaluated));
        setResultDisplay(String(evaluated));
        setJustEvaluated(false);
      }
      return;
    }

    setExpression((prev) => {
      if (!prev) return prev;
      const lastChar = prev[prev.length - 1];
      if (OPERATORS.has(lastChar) || lastChar === '%' || lastChar === '.') {
        return prev;
      }
      const next = `${prev}%`;
      const preview = evaluateCalculatorExpression(next);
      if (preview !== null) {
        setResultDisplay(String(preview));
      }
      return next;
    });
  }, [justEvaluated, resultDisplay]);

  const handleToggleSign = useCallback(() => {
    setHasError(false);
    if (justEvaluated) {
      const num = Number(resultDisplay);
      if (Number.isFinite(num) && num !== 0) {
        const toggled = String(-num);
        setExpression(toggled);
        setResultDisplay(toggled);
        setJustEvaluated(false);
      }
      return;
    }

    setExpression((prev) => {
      if (!prev) return '-';
      if (prev === '-') return '';
      // Toggle sign on the trailing number segment if expression ends with digits
      const match = prev.match(/^(.*?)(\(?-?\d*\.?\d+%?)$/);
      if (!match) return prev;
      const [, prefix, numPart] = match;
      if (!numPart) return prev;

      let next: string;
      if (!prefix) {
        next = numPart.startsWith('-') ? numPart.slice(1) : `-${numPart}`;
      } else {
        const lastOp = prefix[prefix.length - 1];
        if (lastOp === '+' && !numPart.startsWith('-')) {
          next = `${prefix.slice(0, -1)}-${numPart}`;
        } else if (lastOp === '-' && prefix.length > 1 && !OPERATORS.has(prefix[prefix.length - 2])) {
          next = `${prefix.slice(0, -1)}+${numPart}`;
        } else if (numPart.startsWith('-')) {
          next = `${prefix}${numPart.slice(1)}`;
        } else {
          next = `${prefix}-${numPart}`;
        }
      }
      const preview = evaluateCalculatorExpression(next);
      if (preview !== null) {
        setResultDisplay(String(preview));
      }
      return next;
    });
  }, [justEvaluated, resultDisplay]);

  const handleEquals = useCallback(() => {
    if (!expression) return;
    const evaluated = evaluateCalculatorExpression(expression);
    if (evaluated === null) {
      setHasError(true);
      setResultDisplay(t.calculatorError);
      setJustEvaluated(true);
      return;
    }

    const resultStr = String(evaluated);
    setHistory((prev) => [
      {
        expression: formatDisplayExpression(expression),
        result: formatCalculatorNumber(evaluated),
        numericValue: evaluated,
      },
      ...prev.slice(0, 7),
    ]);
    setResultDisplay(resultStr);
    setJustEvaluated(true);
    setHasError(false);
  }, [expression, t.calculatorError]);

  const handleCopyResult = useCallback(async () => {
    if (hasError) return;
    const valueToCopy = resultDisplay || '0';
    const ok = await copyTextWithFallback(valueToCopy);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }, [hasError, resultDisplay]);

  // Keyboard support while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleAppendDigit(e.key);
      } else if (e.key === '.' || e.key === ',') {
        e.preventDefault();
        handleAppendDigit('.');
      } else if (e.key === '+') {
        e.preventDefault();
        handleOperator('+');
      } else if (e.key === '-') {
        e.preventDefault();
        handleOperator('-');
      } else if (e.key === '*') {
        e.preventDefault();
        handleOperator('×');
      } else if (e.key === '/') {
        e.preventDefault();
        handleOperator('÷');
      } else if (e.key === '%') {
        e.preventDefault();
        handlePercent();
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEquals();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Delete' || e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleAppendDigit,
    handleBackspace,
    handleClear,
    handleEquals,
    handleOperator,
    handlePercent,
    isOpen,
    onClose,
  ]);

  if (!isOpen) return null;

  const numericCurrent = !hasError ? Number(resultDisplay) : NaN;
  const formattedMainDisplay = hasError
    ? t.calculatorError
    : Number.isFinite(numericCurrent) && !resultDisplay.endsWith('.')
      ? formatCalculatorNumber(numericCurrent)
      : resultDisplay || '0';

  // Quick commercial shop currency equivalence based on active currency
  const showCurrencyStrip =
    !hasError && Number.isFinite(numericCurrent) && numericCurrent !== 0;
  const madEquivalent = showCurrencyStrip ? convertToMad(numericCurrent, currency) : 0;
  const eurEquivalent = showCurrencyStrip ? convertFromMad(madEquivalent, 'EUR') : 0;
  const usdEquivalent = showCurrencyStrip ? convertFromMad(madEquivalent, 'USD') : 0;

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.calculatorTitle}
        className="w-full max-w-sm overflow-hidden rounded-t-3xl border border-[#DCE7E0] bg-white shadow-2xl sm:rounded-3xl dark:border-[#1E3A2D] dark:bg-[#0F2119]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-[#DCE7E0] sm:hidden dark:bg-[#1E3A2D]" />

        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-[#DCE7E0] px-5 py-3.5 dark:border-[#1E3A2D]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ECF7F1] text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]">
              <CalculatorIcon className="h-4 w-4" />
            </span>
            <h2 className="font-display text-base font-bold text-[#0B1F16] sm:text-lg dark:text-[#F2F9F5]">
              {t.calculatorTitle}
            </h2>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowHistory((prev) => !prev)}
              aria-label={t.calculatorHistoryTitle}
              title={t.calculatorHistoryTitle}
              className={`flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl transition-colors ${
                showHistory
                  ? 'bg-[#ECF7F1] text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]'
                  : 'text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]'
              }`}
            >
              <History className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label={t.close}
              className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {/* Collapsible Recent Calculations History */}
          {showHistory && (
            <div className="mb-3 max-h-36 overflow-y-auto rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-2.5 dark:border-[#1E3A2D] dark:bg-[#091611]">
              <p className="mb-1.5 px-1 text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                {t.calculatorHistoryTitle}
              </p>
              {history.length === 0 ? (
                <p className="px-1 py-2 text-center text-xs text-[#6B8A79] dark:text-[#5F8370]">
                  {t.calculatorNoHistory}
                </p>
              ) : (
                <div className="space-y-1">
                  {history.map((item, idx) => (
                    <button
                      key={`${item.expression}-${idx}`}
                      type="button"
                      dir="ltr"
                      onClick={() => {
                        setExpression(String(item.numericValue));
                        setResultDisplay(String(item.numericValue));
                        setJustEvaluated(false);
                        setHasError(false);
                        setShowHistory(false);
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition-colors hover:bg-white dark:hover:bg-[#102119]"
                    >
                      <span className="tabular-nums truncate text-[#335947] dark:text-[#9EC0AE]">
                        {item.expression}
                      </span>
                      <span className="tabular-nums shrink-0 pl-2 font-bold text-[#115E3B] dark:text-[#34D399]">
                        = {item.result}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Calculator Display */}
          <div
            dir="ltr"
            className="mb-4 rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-4 dark:border-[#1E3A2D] dark:bg-[#091611]"
          >
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => void handleCopyResult()}
                title={t.calculatorCopyResult}
                aria-label={t.calculatorCopyResult}
                className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold text-[#115E3B] transition-colors hover:bg-[#ECF7F1] dark:text-[#34D399] dark:hover:bg-[#132B20]"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? t.copied : t.calculatorCopyResult}</span>
              </button>

              <span className="tabular-nums min-h-[20px] truncate text-right text-xs font-medium text-[#335947] dark:text-[#9EC0AE]">
                {expression ? formatDisplayExpression(expression) : '\u00A0'}
              </span>
            </div>

            <div className="tabular-nums mt-1.5 overflow-x-auto text-right font-display text-3xl font-bold tracking-tight text-[#0B1F16] dark:text-[#F2F9F5]">
              {formattedMainDisplay}
            </div>

            {showCurrencyStrip && (
              <div className="tabular-nums mt-2 flex flex-wrap items-center justify-end gap-x-2 border-t border-[#DCE7E0]/80 pt-2 text-[11px] font-medium text-[#335947] dark:border-[#1E3A2D] dark:text-[#9EC0AE]">
                <span>{formatCalculatorNumber(madEquivalent)} MAD</span>
                <span aria-hidden="true">·</span>
                <span>{formatCalculatorNumber(eurEquivalent)} EUR</span>
                <span aria-hidden="true">·</span>
                <span>{formatCalculatorNumber(usdEquivalent)} USD</span>
              </div>
            )}
          </div>

          {/* 5x4 Keypad (Always LTR for standard calculator muscle memory) */}
          <div dir="ltr" className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={handleClear}
              aria-label={t.calculatorClear}
              className="flex min-h-[52px] items-center justify-center rounded-2xl border border-red-200/80 bg-red-50 text-base font-bold text-red-700 transition-transform active:scale-95 dark:border-red-900/50 dark:bg-red-950/35 dark:text-red-300"
            >
              C
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              aria-label={t.calculatorBackspace}
              className="flex min-h-[52px] items-center justify-center rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] text-[#0B1F16] transition-transform hover:bg-[#ECF7F1] active:scale-95 dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#F2F9F5] dark:hover:bg-[#162E23]"
            >
              <Delete className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handlePercent}
              className="flex min-h-[52px] items-center justify-center rounded-2xl border border-[#DCE7E0] bg-[#ECF7F1] text-base font-bold text-[#115E3B] transition-transform hover:bg-[#DCF0E4] active:scale-95 dark:border-[#1E3A2D] dark:bg-[#132B20] dark:text-[#34D399]"
            >
              %
            </button>
            <button
              type="button"
              onClick={() => handleOperator('÷')}
              className="flex min-h-[52px] items-center justify-center rounded-2xl border border-[#DCE7E0] bg-[#ECF7F1] text-xl font-bold text-[#115E3B] transition-transform hover:bg-[#DCF0E4] active:scale-95 dark:border-[#1E3A2D] dark:bg-[#132B20] dark:text-[#34D399]"
            >
              ÷
            </button>

            {['7', '8', '9'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleAppendDigit(d)}
                className="tabular-nums flex min-h-[52px] items-center justify-center rounded-2xl border border-[#DCE7E0] bg-white text-lg font-bold text-[#0B1F16] transition-transform hover:bg-[#F7FAF8] active:scale-95 dark:border-[#1E3A2D] dark:bg-[#0B1913] dark:text-[#F2F9F5] dark:hover:bg-[#132B20]"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleOperator('×')}
              className="flex min-h-[52px] items-center justify-center rounded-2xl border border-[#DCE7E0] bg-[#ECF7F1] text-xl font-bold text-[#115E3B] transition-transform hover:bg-[#DCF0E4] active:scale-95 dark:border-[#1E3A2D] dark:bg-[#132B20] dark:text-[#34D399]"
            >
              ×
            </button>

            {['4', '5', '6'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleAppendDigit(d)}
                className="tabular-nums flex min-h-[52px] items-center justify-center rounded-2xl border border-[#DCE7E0] bg-white text-lg font-bold text-[#0B1F16] transition-transform hover:bg-[#F7FAF8] active:scale-95 dark:border-[#1E3A2D] dark:bg-[#0B1913] dark:text-[#F2F9F5] dark:hover:bg-[#132B20]"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleOperator('-')}
              className="flex min-h-[52px] items-center justify-center rounded-2xl border border-[#DCE7E0] bg-[#ECF7F1] text-xl font-bold text-[#115E3B] transition-transform hover:bg-[#DCF0E4] active:scale-95 dark:border-[#1E3A2D] dark:bg-[#132B20] dark:text-[#34D399]"
            >
              −
            </button>

            {['1', '2', '3'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleAppendDigit(d)}
                className="tabular-nums flex min-h-[52px] items-center justify-center rounded-2xl border border-[#DCE7E0] bg-white text-lg font-bold text-[#0B1F16] transition-transform hover:bg-[#F7FAF8] active:scale-95 dark:border-[#1E3A2D] dark:bg-[#0B1913] dark:text-[#F2F9F5] dark:hover:bg-[#132B20]"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleOperator('+')}
              className="flex min-h-[52px] items-center justify-center rounded-2xl border border-[#DCE7E0] bg-[#ECF7F1] text-xl font-bold text-[#115E3B] transition-transform hover:bg-[#DCF0E4] active:scale-95 dark:border-[#1E3A2D] dark:bg-[#132B20] dark:text-[#34D399]"
            >
              +
            </button>

            <button
              type="button"
              onClick={handleToggleSign}
              className="flex min-h-[52px] items-center justify-center rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] text-base font-bold text-[#0B1F16] transition-transform hover:bg-[#ECF7F1] active:scale-95 dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#F2F9F5] dark:hover:bg-[#162E23]"
            >
              ±
            </button>
            <button
              type="button"
              onClick={() => handleAppendDigit('0')}
              className="tabular-nums flex min-h-[52px] items-center justify-center rounded-2xl border border-[#DCE7E0] bg-white text-lg font-bold text-[#0B1F16] transition-transform hover:bg-[#F7FAF8] active:scale-95 dark:border-[#1E3A2D] dark:bg-[#0B1913] dark:text-[#F2F9F5] dark:hover:bg-[#132B20]"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => handleAppendDigit('.')}
              className="flex min-h-[52px] items-center justify-center rounded-2xl border border-[#DCE7E0] bg-white text-xl font-bold text-[#0B1F16] transition-transform hover:bg-[#F7FAF8] active:scale-95 dark:border-[#1E3A2D] dark:bg-[#0B1913] dark:text-[#F2F9F5] dark:hover:bg-[#132B20]"
            >
              .
            </button>
            <button
              type="button"
              onClick={handleEquals}
              className="flex min-h-[52px] items-center justify-center rounded-2xl bg-[#115E3B] text-xl font-bold text-white transition-transform hover:bg-[#0D4A2E] active:scale-95 dark:bg-[#10B981] dark:text-[#052E1C] dark:hover:bg-[#059669]"
            >
              =
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
