import { useEffect } from 'react';
import { Check, HandCoins, ShoppingBag, Sparkles, Tag, X } from 'lucide-react';
import type { MarketShopSession } from '../museum/marketWorld';

interface MarketShopModalProps {
  session: MarketShopSession;
  walletBdt: number;
  onBargain: () => void;
  onBuy: () => void;
  onClose: () => void;
}

export function MarketShopModal({
  session,
  walletBdt,
  onBargain,
  onBuy,
  onClose,
}: MarketShopModalProps) {
  const { item, currentPrice, canBargainMore, shopkeeperLine } = session;
  const isDiscounted = currentPrice < item.basePrice;
  const discountAmount = item.basePrice - currentPrice;
  const canAfford = walletBdt >= currentPrice;

  // Full keyboard shortcuts support: [B / D / 1] for Bargain, [Enter / K / 2] for Buy, [Esc] to Close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const code = e.code;
      // Bargain: 'KeyB', 'KeyD', 'Digit1', 'Numpad1', 'Space'
      if (
        (code === 'KeyB' || code === 'KeyD' || code === 'Digit1' || code === 'Numpad1' || code === 'Space') &&
        !e.repeat
      ) {
        if (canBargainMore) {
          e.preventDefault();
          onBargain();
        }
      }
      // Buy: 'Enter', 'NumpadEnter', 'KeyK', 'Digit2', 'Numpad2'
      else if (
        (code === 'Enter' || code === 'NumpadEnter' || code === 'KeyK' || code === 'Digit2' || code === 'Numpad2') &&
        !e.repeat
      ) {
        if (canAfford) {
          e.preventDefault();
          onBuy();
        }
      }
      // Close / Exit shop: 'Escape', 'KeyX'
      else if (code === 'Escape' || code === 'KeyX') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canBargainMore, canAfford, onBargain, onBuy, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Shopping at ${item.stallName}`}
      data-testid="market-shop-modal"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-4 select-none backdrop-blur-xs"
    >
      <div className="w-full max-w-md bg-[#181512] text-[#F7F5F0] border-2 border-[#EAB308] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 border-b border-stone-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-xl shrink-0">
              {item.icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-700/60 rounded-xs">
                  {item.floor === 1 ? '১ম তলা' : '২য় তলা'}
                </span>
                <span className="text-xs text-stone-400 font-medium truncate">{item.stallName}</span>
              </div>
              <h2 className="font-editorial text-lg font-bold leading-tight truncate text-[#FAF5EC]">
                {item.banglaName}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="দোকান থেকে বের হোন [Esc]"
            className="flex items-center gap-1 px-2 py-1 text-stone-400 hover:text-white hover:bg-stone-800 rounded-sm cursor-pointer transition-colors text-xs"
          >
            <kbd className="px-1 py-0.5 bg-stone-900 border border-stone-700 text-stone-400 text-[10px] font-mono rounded">Esc</kbd>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Shopkeeper Dialogue Bubble */}
          <div className="bg-stone-900/90 border-l-3 border-[#EAB308] p-3 rounded-r-sm space-y-1">
            <div className="flex items-center justify-between text-xs font-mono text-amber-300">
              <span className="font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                {item.shopkeeperName}
              </span>
              <span className="text-[11px] text-stone-400">দোকানদার</span>
            </div>
            <p className="text-sm text-stone-100 italic leading-relaxed" data-testid="shopkeeper-dialogue">
              “{shopkeeperLine}”
            </p>
          </div>

          {/* Item Details & Price Box */}
          <div className="bg-stone-900/60 border border-stone-800 p-4 rounded-sm space-y-3">
            <p className="text-xs text-stone-300 leading-normal">{item.description}</p>

            <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono text-stone-400 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-stone-400" />
                  বর্তমান মূল্য:
                </p>
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-2xl font-mono font-black text-amber-300"
                    data-testid="item-current-price"
                  >
                    ৳{currentPrice}
                  </span>
                  {isDiscounted && (
                    <span className="text-xs font-mono text-stone-400 line-through">
                      ৳{item.basePrice}
                    </span>
                  )}
                </div>
              </div>

              {isDiscounted && (
                <div className="px-2.5 py-1 bg-emerald-950/80 border border-emerald-600/60 text-emerald-300 text-xs font-mono font-bold rounded-sm animate-pulse">
                  ৳{discountAmount} সাশ্রয়!
                </div>
              )}
            </div>
          </div>

          {/* Wallet Balance Strip */}
          <div className="px-3.5 py-2 bg-stone-950 border border-stone-800 rounded-sm flex items-center justify-between text-xs font-mono">
            <span className="text-stone-400">আপনার ওয়ালেট ব্যালেন্স:</span>
            <span
              className={`font-bold ${canAfford ? 'text-emerald-300' : 'text-rose-400'}`}
              data-testid="wallet-in-shop"
            >
              ৳{walletBdt} BDT
            </span>
          </div>

          {/* Action Buttons with Keyboard Badge Prompts */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={onBargain}
              disabled={!canBargainMore}
              className={`px-3 py-2.5 border font-semibold text-xs flex items-center justify-center gap-1.5 rounded-sm transition-all ${
                canBargainMore
                  ? 'bg-amber-950/40 border-amber-500 text-amber-200 hover:bg-amber-900/60 active:scale-98 cursor-pointer'
                  : 'bg-stone-900/50 border-stone-800 text-stone-400 cursor-not-allowed opacity-50'
              }`}
              data-testid="btn-bargain-price"
              title="কীবোর্ড শর্টকাট: [B] বা [1]"
            >
              <kbd className="px-1.5 py-0.5 bg-black/50 border border-amber-500/60 text-amber-300 text-[10px] font-mono rounded">
                B
              </kbd>
              <HandCoins className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{canBargainMore ? 'দরদাম করুন' : 'একদাম'}</span>
            </button>

            <button
              type="button"
              onClick={onBuy}
              disabled={!canAfford}
              className={`px-3 py-2.5 font-semibold text-xs flex items-center justify-center gap-1.5 rounded-sm transition-all shadow-md ${
                canAfford
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 cursor-pointer active:scale-98'
                  : 'bg-stone-800 border border-stone-700 text-stone-400 cursor-not-allowed opacity-60'
              }`}
              data-testid="btn-buy-item"
              title="কীবোর্ড শর্টকাট: [Enter] বা [K]"
            >
              {canAfford ? (
                <>
                  <kbd className="px-1.5 py-0.5 bg-black/40 border border-emerald-300/60 text-emerald-200 text-[10px] font-mono rounded">
                    Enter
                  </kbd>
                  <ShoppingBag className="w-4 h-4 shrink-0" />
                  <span>কিনে নিন (৳{currentPrice})</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>টাকা কম আছে</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer Keyboard Guide Bar */}
        <div className="px-5 py-2.5 bg-stone-950/95 border-t border-stone-800 flex items-center justify-between text-[11px] text-stone-400 font-mono">
          <span className="text-stone-400">⌨️ কীবোর্ড শর্টকাট:</span>
          <div className="flex items-center gap-3">
            <span>
              <strong className="text-amber-300 font-bold">[B / 1]</strong> দরদাম
            </span>
            <span>
              <strong className="text-emerald-300 font-bold">[Enter]</strong> কিনুন
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
