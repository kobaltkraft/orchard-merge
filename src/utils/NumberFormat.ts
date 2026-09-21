import Decimal from 'decimal.js';
export function fmt(n: number | string | Decimal): string {
  const d = new Decimal(n);
  if (!d.isFinite()) return '0';
  const neg = d.isNegative(); const a = d.abs();
  const units: Array<[number, string]> = [[1e12,'T'],[1e9,'B'],[1e6,'M'],[1e3,'K']];
  for (const [v, s] of units) {
    if (a.gte(v)) {
      const x = a.div(v);
      const str = x.gte(100) ? x.toFixed(0) : x.gte(10) ? x.toFixed(1) : x.toFixed(2);
      return (neg?'-':'') + str.replace(/\.0+$|\.0$/,'').replace(/(\.\d)0$/,'$1') + s;
    }
  }
  return (neg?'-':'') + a.toFixed(a.lt(10) && !a.isInteger() ? 1 : 0);
}
export function fmtInt(n: number | string | Decimal): string {
  try { return new Decimal(n).floor().toNumber().toLocaleString('en-US'); }
  catch { return '0'; }
}
