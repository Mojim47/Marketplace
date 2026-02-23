import { Lock, Radar, Sparkles, TimerReset } from 'lucide-react';

const cards = [
  {
    title: 'Discovery Engine',
    body: 'کشف محصول با تحلیل نیت کاربر، نه فقط تطبیق کلمه.',
    icon: Sparkles,
    accent: 'text-cyan-300',
  },
  {
    title: 'Risk Control',
    body: 'حفاظت پرداخت، کشف رفتار مشکوک و کنترل خطای سفارش.',
    icon: Lock,
    accent: 'text-emerald-300',
  },
  {
    title: 'Realtime Signals',
    body: 'سیگنال قیمت، موجودی و نرخ تبدیل در زمان واقعی.',
    icon: Radar,
    accent: 'text-amber-300',
  },
  {
    title: 'Recovery Path',
    body: 'بازگشت کاربر به جریان خرید در کمترین زمان ممکن.',
    icon: TimerReset,
    accent: 'text-violet-300',
  },
];

export function BentoFeatureGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cards.map((card, idx) => (
        <article
          key={card.title}
          className={`rounded-3xl border border-white/10 bg-slate-900/70 p-5 transition duration-300 hover:-translate-y-1 ${
            idx === 0 ? 'sm:col-span-2' : ''
          }`}
        >
          <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 ${card.accent}`}>
            <card.icon size={18} />
          </div>
          <h3 className="mt-4 section-title text-2xl text-white">{card.title}</h3>
          <p className="mt-2 text-sm leading-7 text-slate-300">{card.body}</p>
        </article>
      ))}
    </div>
  );
}

