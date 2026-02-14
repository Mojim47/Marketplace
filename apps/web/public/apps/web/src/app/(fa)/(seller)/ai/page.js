'use client';
// Offline AI demand prediction page (Farsi)
import { AIService } from '@nextgen/ai/src/core/ai.service';
import { IranDemandPredictionStrategy } from '@nextgen/ai/src/iran/demand-prediction.strategy';
import { useState } from 'react';
import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
export default function AIDemandPage() {
  const [history, setHistory] = useState('1200000,1500000,1800000');
  const [output, setOutput] = useState('');
  async function runPrediction() {
    const sales = history
      .split(',')
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n));
    const svc = new AIService(new IranDemandPredictionStrategy());
    const jalaliDates = sales.map((_val, i) => `1403/01/${String(10 + i).padStart(2, '0')}`);
    const res = await svc.predict({
      salesHistoryIrr: sales,
      jalaliDates,
      importIndex: sales.map(() => 0.85),
      inflationRate: 0.45,
    });
    setOutput(res.localizedText);
  }
  return _jsxs('div', {
    style: { direction: 'rtl', fontFamily: 'sans-serif', padding: '1rem' },
    children: [
      _jsx('h1', {
        children:
          '\u067E\u06CC\u0634\u200C\u0628\u06CC\u0646\u06CC \u062A\u0642\u0627\u0636\u0627 (\u0622\u0641\u0644\u0627\u06CC\u0646)',
      }),
      _jsx('p', {
        children:
          '\u0645\u062F\u0644 \u06A9\u0648\u0627\u0646\u062A\u06CC\u0632\u0647 TinyLlama (\u06F4 \u0628\u06CC\u062A) - \u0627\u062C\u0631\u0627 \u062F\u0631 \u0645\u0631\u0648\u0631\u06AF\u0631 \u0628\u062F\u0648\u0646 \u0627\u0631\u0633\u0627\u0644 \u062F\u0627\u062F\u0647.',
      }),
      _jsxs('label', {
        children: [
          '\u062A\u0627\u0631\u06CC\u062E\u0686\u0647 \u0641\u0631\u0648\u0634 (\u0631\u06CC\u0627\u0644): ',
          _jsx('input', { value: history, onChange: (e) => setHistory(e.target.value) }),
        ],
      }),
      _jsx('button', { onClick: runPrediction, children: '\u0645\u062D\u0627\u0633\u0628\u0647' }),
      _jsx('pre', { children: output }),
    ],
  });
}
//# sourceMappingURL=page.js.map
