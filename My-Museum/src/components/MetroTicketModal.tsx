import { useState, useEffect } from 'react';
import { Check, CreditCard, Ticket, Train, X } from 'lucide-react';
import {
  METRO_STATIONS,
  buyMetroTicket,
  type MetroStation,
  type MetroTicket,
} from '../museum/metroSystem';

interface MetroTicketModalProps {
  currentStationId?: string | null;
  walletBdt: number;
  onTicketPurchased: (ticket: MetroTicket, nextWallet: number) => void;
  onClose: () => void;
}

export function MetroTicketModal({
  currentStationId = 'station-ctg',
  walletBdt,
  onTicketPurchased,
  onClose,
}: MetroTicketModalProps) {
  const initialFrom =
    METRO_STATIONS.find((s) => s.id === currentStationId) ?? METRO_STATIONS[0];
  const [fromStation, setFromStation] = useState<MetroStation>(initialFrom);
  const [toStation, setToStation] = useState<MetroStation>(
    METRO_STATIONS.find((s) => s.id !== initialFrom.id) ?? METRO_STATIONS[2]
  );
  const [ticketType, setTicketType] = useState<'single' | 'pass'>('single');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const price = ticketType === 'pass' ? 100 : 35;
  const canAfford = walletBdt >= price;

  const handleBuy = () => {
    setErrorMsg(null);
    const res = buyMetroTicket(ticketType, fromStation, toStation, walletBdt);
    if (!res.ok) {
      setErrorMsg(res.message);
      return;
    }
    if (res.ticket) {
      onTicketPurchased(res.ticket, res.nextWallet);
    }
  };

  // Keyboard accessibility: [Enter] to buy, [1] / [2] to select ticket type, [Esc] to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        if (canAfford) {
          e.preventDefault();
          handleBuy();
        }
      } else if (e.code === 'Digit1') {
        setTicketType('single');
      } else if (e.code === 'Digit2') {
        setTicketType('pass');
      } else if (e.code === 'Escape' || e.code === 'KeyX') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canAfford, ticketType, fromStation, toStation, walletBdt]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="মেট্রোরেল টিকিট কাউন্টার"
      data-testid="metro-ticket-modal"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 select-none backdrop-blur-xs"
    >
      <div className="w-full max-w-md bg-[#121815] text-[#F7F5F0] border-2 border-emerald-500 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-emerald-950 via-stone-900 to-emerald-950 border-b border-emerald-700/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-xl text-emerald-300 shrink-0">
              <Train className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-900 text-emerald-200 border border-emerald-600 rounded-xs">
                  METRO RAIL
                </span>
                <span className="text-xs text-stone-300 font-medium truncate">স্বয়ংক্রিয় টিকিট কাউন্টার</span>
              </div>
              <h2 className="font-editorial text-lg font-bold leading-tight truncate text-[#FAF5EC]">
                চট্টগ্রাম-কক্সবাজার এক্সপ্রেস মেট্রোরেল
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন [Esc]"
            className="flex items-center gap-1 px-2 py-1 text-stone-400 hover:text-white hover:bg-stone-800 rounded-sm cursor-pointer transition-colors text-xs"
          >
            <kbd className="px-1 py-0.5 bg-stone-900 border border-stone-700 text-stone-400 text-[10px] font-mono rounded">
              Esc
            </kbd>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Station Selector */}
          <div className="grid grid-cols-2 gap-3 bg-stone-900/80 p-3 border border-stone-800 rounded-sm">
            <div>
              <label className="block text-[11px] font-mono text-stone-400 mb-1">প্রস্থান স্টেশন (From):</label>
              <select
                value={fromStation.id}
                onChange={(e) => {
                  const s = METRO_STATIONS.find((st) => st.id === e.target.value);
                  if (s) setFromStation(s);
                }}
                className="w-full bg-stone-950 border border-emerald-600/70 text-emerald-200 text-xs px-2.5 py-1.5 rounded-sm focus:outline-none focus:border-emerald-400"
              >
                {METRO_STATIONS.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.banglaName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-stone-400 mb-1">গন্তব্য স্টেশন (To):</label>
              <select
                value={toStation.id}
                onChange={(e) => {
                  const s = METRO_STATIONS.find((st) => st.id === e.target.value);
                  if (s) setToStation(s);
                }}
                className="w-full bg-stone-950 border border-emerald-600/70 text-emerald-200 text-xs px-2.5 py-1.5 rounded-sm focus:outline-none focus:border-emerald-400"
              >
                {METRO_STATIONS.filter((st) => st.id !== fromStation.id).map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.banglaName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Ticket Type Options */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTicketType('single')}
              className={`p-3 border text-left rounded-sm transition-all cursor-pointer ${
                ticketType === 'single'
                  ? 'bg-emerald-950/70 border-emerald-400 text-white shadow-md'
                  : 'bg-stone-900/50 border-stone-800 text-stone-400 hover:border-stone-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Ticket className="w-4 h-4 text-emerald-400" />
                <span className="font-mono text-sm font-bold text-emerald-300">৳৩৫</span>
              </div>
              <div className="text-xs font-bold text-stone-100">[1] সিঙ্গেল যাত্রা</div>
              <div className="text-[10px] text-stone-400">একবার ভ্রমণের জন্য টিকিট</div>
            </button>

            <button
              type="button"
              onClick={() => setTicketType('pass')}
              className={`p-3 border text-left rounded-sm transition-all cursor-pointer ${
                ticketType === 'pass'
                  ? 'bg-amber-950/70 border-amber-400 text-white shadow-md'
                  : 'bg-stone-900/50 border-stone-800 text-stone-400 hover:border-stone-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <CreditCard className="w-4 h-4 text-amber-400" />
                <span className="font-mono text-sm font-bold text-amber-300">৳১০০</span>
              </div>
              <div className="text-xs font-bold text-stone-100">[2] MRT Rapid Pass</div>
              <div className="text-[10px] text-stone-400">সারাদিন আনলিমিটেড ভ্রমণ</div>
            </button>
          </div>

          {/* Wallet Balance Strip */}
          <div className="px-3.5 py-2 bg-stone-950 border border-stone-800 rounded-sm flex items-center justify-between text-xs font-mono">
            <span className="text-stone-400">আপনার ওয়ালেট ব্যালেন্স:</span>
            <span className={`font-bold ${canAfford ? 'text-emerald-300' : 'text-rose-400'}`}>
              ৳{walletBdt} BDT
            </span>
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-rose-950/80 border border-rose-500/80 text-rose-200 text-xs rounded-sm">
              {errorMsg}
            </div>
          )}

          {/* Action Buy Button */}
          <button
            type="button"
            onClick={handleBuy}
            disabled={!canAfford}
            className={`w-full py-2.5 font-bold text-xs flex items-center justify-center gap-2 rounded-sm transition-all shadow-md ${
              canAfford
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 cursor-pointer active:scale-98'
                : 'bg-stone-800 border border-stone-700 text-stone-400 cursor-not-allowed opacity-60'
            }`}
          >
            {canAfford ? (
              <>
                <kbd className="px-1.5 py-0.5 bg-black/40 border border-emerald-300/60 text-emerald-200 text-[10px] font-mono rounded">
                  Enter
                </kbd>
                <Check className="w-4 h-4 shrink-0" />
                <span>টিকিট কাটুন (৳{price})</span>
              </>
            ) : (
              <span>ওয়ালেটে পর্যাপ্ত টাকা নেই</span>
            )}
          </button>
        </div>

        {/* Keyboard Shortcut Footer */}
        <div className="px-5 py-2.5 bg-stone-950/95 border-t border-stone-800 flex items-center justify-between text-[11px] text-stone-400 font-mono">
          <span>⌨️ কীবোর্ড শর্টকাট:</span>
          <div className="flex items-center gap-3">
            <span>
              <strong className="text-emerald-300 font-bold">[Enter]</strong> কাটুন
            </span>
            <span>
              <strong className="text-amber-300 font-bold">[1/2]</strong> ধরন
            </span>
            <span>
              <strong className="text-stone-300 font-bold">[Esc]</strong> বের হোন
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
