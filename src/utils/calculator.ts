export type CalcOperator = '+' | '-' | '×' | '÷';

interface NumToken {
  type: 'num';
  value: number;
  isPercent: boolean;
}

interface OpToken {
  type: 'op';
  value: '+' | '-' | '*' | '/';
}

type Token = NumToken | OpToken;

export function normalizeCalcInput(expr: string): string {
  return expr
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/,/g, '.')
    .replace(/\s+/g, '');
}

function cleanFloat(num: number): number {
  if (!Number.isFinite(num)) return NaN;
  const rounded = Number(num.toPrecision(12));
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function evaluateCalculatorExpression(rawExpression: string): number | null {
  const expr = normalizeCalcInput(rawExpression);
  if (!expr) return null;

  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    // Check for unary minus or number start
    const prev = tokens[tokens.length - 1];
    const expectsNumber = !prev || prev.type === 'op';

    if (expectsNumber && (ch === '-' || ch === '+' || /\d|\./.test(ch))) {
      let numStr = '';
      if (ch === '-' || ch === '+') {
        numStr += ch;
        i += 1;
      }
      let hasDigits = false;
      let hasDot = false;
      while (i < expr.length && (/\d/.test(expr[i]) || (expr[i] === '.' && !hasDot))) {
        if (expr[i] === '.') {
          hasDot = true;
        } else {
          hasDigits = true;
        }
        numStr += expr[i];
        i += 1;
      }
      if (!hasDigits) return null;

      let isPercent = false;
      if (i < expr.length && expr[i] === '%') {
        isPercent = true;
        i += 1;
      }

      const parsed = Number(numStr);
      if (!Number.isFinite(parsed)) return null;
      tokens.push({ type: 'num', value: parsed, isPercent });
      continue;
    }

    if (!expectsNumber && (ch === '+' || ch === '-' || ch === '*' || ch === '/')) {
      tokens.push({ type: 'op', value: ch });
      i += 1;
      continue;
    }

    return null;
  }

  if (tokens.length === 0) return null;
  // Ignore trailing operator if user evaluates right after typing e.g. "50 +" -> evaluate "50"
  if (tokens[tokens.length - 1].type === 'op') {
    tokens.pop();
  }
  if (tokens.length === 0) return null;

  // Pass 1: resolve * and / (converting % operands to decimal ratio)
  const firstPass: Token[] = [];
  let idx = 0;
  while (idx < tokens.length) {
    const tok = tokens[idx];
    if (tok.type === 'op' && (tok.value === '*' || tok.value === '/')) {
      const leftTok = firstPass.pop();
      const rightTok = tokens[idx + 1];
      if (!leftTok || leftTok.type !== 'num' || !rightTok || rightTok.type !== 'num') {
        return null;
      }
      const leftVal = leftTok.isPercent ? leftTok.value / 100 : leftTok.value;
      const rightVal = rightTok.isPercent ? rightTok.value / 100 : rightTok.value;
      if (tok.value === '/' && rightVal === 0) {
        return null;
      }
      const res = tok.value === '*' ? leftVal * rightVal : leftVal / rightVal;
      firstPass.push({ type: 'num', value: cleanFloat(res), isPercent: false });
      idx += 2;
    } else {
      firstPass.push(tok);
      idx += 1;
    }
  }

  // Pass 2: resolve + and - left-to-right (supporting shop A + B% and A - B%)
  const firstTok = firstPass[0];
  if (!firstTok || firstTok.type !== 'num') return null;
  let acc = firstTok.isPercent ? cleanFloat(firstTok.value / 100) : firstTok.value;

  for (let j = 1; j < firstPass.length; j += 2) {
    const opTok = firstPass[j];
    const rightTok = firstPass[j + 1];
    if (!opTok || opTok.type !== 'op' || !rightTok || rightTok.type !== 'num') {
      return null;
    }
    const delta = rightTok.isPercent
      ? acc * (rightTok.value / 100)
      : rightTok.value;
    acc = opTok.value === '+' ? cleanFloat(acc + delta) : cleanFloat(acc - delta);
  }

  return Number.isFinite(acc) ? cleanFloat(acc) : null;
}

export function formatCalculatorNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const cleaned = cleanFloat(value);
  const str = String(cleaned);
  if (str.includes('e') || str.includes('E')) return str;
  const [intPart, decPart] = str.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
}
