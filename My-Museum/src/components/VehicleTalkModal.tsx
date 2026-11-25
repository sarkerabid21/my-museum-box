import { AlertTriangle, Bike, Car, Check, HandCoins, MapPin, X } from 'lucide-react';
import type { RideDestination, VehicleTalkSession } from '../museum/outdoorWorld';

interface VehicleTalkModalProps {
  session: VehicleTalkSession;
  walletBdt: number;
  errorText?: string | null;
  onSelectDestination: (dest: RideDestination) => void;
  onBargain: () => void;
  onPayAndRide: () => void;
  onChintai: () => void;
  onClose: () => void;
}

export function VehicleTalkModal({
  session,
  walletBdt,
  errorText = null,
  onSelectDestination,
  onBargain,
  onPayAndRide,
  onChintai,
  onClose,
}: VehicleTalkModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Talking to ${session.driverName}`}
      data-testid="vehicle-talk-modal"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-4"
    >
      <div className="w-full max-w-md bg-[#181512] text-[#F7F5F0] border border-[#C99A5B] shadow-2xl">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-stone-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 bg-stone-800 border border-stone-700 flex items-center justify-center text-[#E8CFA6] shrink-0">
              {session.kind === 'car' ? (
                <Car className="w-5 h-5" />
              ) : (
                <Bike className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="font-editorial text-lg font-semibold leading-tight truncate">
                {session.driverName} · {session.vehicleTitle}
              </h2>
              <p className="text-xs font-mono text-stone-400">
                Wallet: <span className="text-emerald-300">৳{walletBdt} BDT</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Let driver go"
            className="p-1.5 text-stone-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Driver Live Dialogue Bubble */}
        <div className="px-5 pt-4 pb-3 space-y-4">
          <div className="bg-stone-900 border-l-2 border-[#C99A5B] px-3.5 py-3">
            <p className="text-xs font-mono uppercase tracking-wider text-[#D4B282] mb-1">
              {session.driverName} says
            </p>
            <p className="text-sm text-stone-100 leading-relaxed" data-testid="driver-dialogue">
              “{session.driverLine}”
            </p>
          </div>

          {/* Destination Selector */}
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-stone-400 mb-2 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#D4B282]" />
              Where do you want to go?
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: 'ctg', label: 'Chittagong', sub: 'CTG ←' },
                  { id: 'coxs', label: "Cox's Bazar", sub: 'COXS →' },
                  { id: 'kashmir', label: 'Kashmir', sub: 'KASHMIR ❄️' },
                  { id: 'freeroam', label: 'Local Ride', sub: 'Free Roam' },
                ] as const
              ).map((dest) => {
                const active = session.destination === dest.id;
                return (
                  <button
                    key={dest.id}
                    type="button"
                    onClick={() => onSelectDestination(dest.id)}
                    className={`px-2.5 py-2 border text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#8A5A2B]/30 border-[#C99A5B] text-[#FAF5EC]'
                        : 'bg-stone-900 border-stone-700 text-stone-300 hover:border-stone-500'
                    }`}
                  >
                    <div className="text-xs font-semibold">{dest.label}</div>
                    <div className="text-[10px] font-mono text-stone-400">{dest.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current Negotiated Fare Box */}
          <div className="flex items-center justify-between bg-stone-900/90 border border-stone-800 px-3.5 py-2.5">
            <div>
              <div className="text-[11px] font-mono uppercase text-stone-400">Quoted Fare (Vara)</div>
              <div className="text-xl font-mono font-bold text-[#E8CFA6]" data-testid="quoted-fare">
                ৳{session.askingFare} BDT
              </div>
            </div>
            <button
              type="button"
              onClick={onBargain}
              disabled={!session.canBargainMore}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border transition-colors ${
                session.canBargainMore
                  ? 'bg-stone-800 hover:bg-stone-700 text-amber-200 border-amber-500/50 cursor-pointer'
                  : 'bg-stone-900 text-stone-500 border-stone-800 cursor-not-allowed'
              }`}
            >
              <HandCoins className="w-3.5 h-3.5" />
              {session.canBargainMore ? 'Bargain (Vara Komao)' : 'Final Price'}
            </button>
          </div>

          {errorText && (
            <p className="text-xs text-rose-300 bg-rose-950/60 border border-rose-800/70 px-3 py-2">
              {errorText}
            </p>
          )}
        </div>

        {/* Action Buttons: Pay & Ride, Chintai (Seize Vehicle), or Let Go */}
        <div className="px-5 py-4 border-t border-stone-800 flex flex-col gap-2">
          <button
            type="button"
            onClick={onPayAndRide}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            <Check className="w-4 h-4" />
            Pay ৳{session.askingFare} &amp; Ride {session.vehicleTitle}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onChintai}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-900/85 hover:bg-rose-800 text-rose-100 border border-rose-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Chintai (Take Vehicle)
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-medium transition-colors cursor-pointer"
            >
              Let Go (Chere Dao)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
