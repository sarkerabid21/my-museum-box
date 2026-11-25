import React, { useState } from 'react';
import type { SnowmanCustomization, SnowmanHat, SnowmanScarf } from '../museum/kashmirWorld';

interface SnowmanBuilderModalProps {
  onBuild: (customization: SnowmanCustomization) => void;
  onClose: () => void;
}

export function SnowmanBuilderModal({ onBuild, onClose }: SnowmanBuilderModalProps) {
  const [hat, setHat] = useState<SnowmanHat>('top_hat');
  const [scarf, setScarf] = useState<SnowmanScarf>('red_wool');
  const [carrotNose, setCarrotNose] = useState(true);
  const [stickArms, setStickArms] = useState(true);
  const [coalEyes, setCoalEyes] = useState(true);
  const [coalButtons, setCoalButtons] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onBuild({
      hat,
      scarf,
      carrotNose,
      stickArms,
      coalEyes,
      coalButtons,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Snowman Builder & Customizer"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-md bg-stone-900 border-2 border-cyan-400 text-stone-100 rounded-lg shadow-2xl p-5 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <span className="text-2xl">☃️</span>
            <div>
              <h2 className="text-base font-bold text-cyan-300">স্নোম্যান তৈরি ও সাজসজ্জা</h2>
              <p className="text-xs text-stone-400">Interactive Snowman Customizer</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center font-bold text-sm cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Hat Selection */}
          <div>
            <label className="block text-xs font-semibold text-cyan-200 mb-1.5">
              টুপি নির্বাচন করুন (Select Hat)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  { id: 'top_hat', label: '🎩 টপ হ্যাট' },
                  { id: 'beanie', label: '🧢 বিনি ক্যাপ' },
                  { id: 'santa', label: '🎅 সান্তা হ্যাট' },
                  { id: 'none', label: '❌ কোনোটি নয়' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setHat(item.id)}
                  className={`p-2 text-xs rounded border text-center cursor-pointer transition-all ${
                    hat === item.id
                      ? 'bg-cyan-600/40 border-cyan-400 text-cyan-100 font-bold shadow-md'
                      : 'bg-stone-800/80 border-stone-700 hover:border-stone-500 text-stone-300'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scarf Selection */}
          <div>
            <label className="block text-xs font-semibold text-cyan-200 mb-1.5">
              মাফলার বা স্কার্ফ (Select Scarf)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  { id: 'red_wool', label: '🧣 লাল পশম' },
                  { id: 'golden_silk', label: '🧣 সোনালী সিল্ক' },
                  { id: 'blue_striped', label: '🧣 নীল ডোরা' },
                  { id: 'none', label: '❌ কোনোটি নয়' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setScarf(item.id)}
                  className={`p-2 text-xs rounded border text-center cursor-pointer transition-all ${
                    scarf === item.id
                      ? 'bg-cyan-600/40 border-cyan-400 text-cyan-100 font-bold shadow-md'
                      : 'bg-stone-800/80 border-stone-700 hover:border-stone-500 text-stone-300'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2 pt-1 border-t border-stone-800/80">
            <label className="flex items-center justify-between text-xs text-stone-200 cursor-pointer">
              <span>🥕 গাজরের তৈরি নাক (Carrot Nose)</span>
              <input
                type="checkbox"
                checked={carrotNose}
                onChange={(e) => setCarrotNose(e.target.checked)}
                className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between text-xs text-stone-200 cursor-pointer">
              <span>🌿 গাছের ডালের হাত (Stick Arms)</span>
              <input
                type="checkbox"
                checked={stickArms}
                onChange={(e) => setStickArms(e.target.checked)}
                className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between text-xs text-stone-200 cursor-pointer">
              <span>⚫ কয়লার চোখ (Coal Eyes)</span>
              <input
                type="checkbox"
                checked={coalEyes}
                onChange={(e) => setCoalEyes(e.target.checked)}
                className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between text-xs text-stone-200 cursor-pointer">
              <span>🔘 জামার কয়লার বোতাম (Coal Buttons)</span>
              <input
                type="checkbox"
                checked={coalButtons}
                onChange={(e) => setCoalButtons(e.target.checked)}
                className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
              />
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold text-xs rounded cursor-pointer"
            >
              বাতিল (Cancel)
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded cursor-pointer shadow-lg active:scale-98 transition-all"
            >
              ❄️ স্নোম্যান বসান (Place Snowman)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
