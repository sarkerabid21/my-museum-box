import { Compass, Trash2, X } from 'lucide-react';
import type { ArtworkItem } from '../types/museum';
import {
  formatAccessionNumber,
  formatArchivalDate,
  getArtworkPlacement,
  getResolvedRoomName,
  toRomanNumeral,
} from '../museum/layout';

interface ArtworkInspectModalProps {
  artwork: ArtworkItem | null;
  slotIndex: number;
  roomNames?: Record<string, string>;
  canDelete: boolean;
  onClose: () => void;
  onWalkTo?: (artworkId: string) => void;
  onDelete: (artworkId: string) => void;
}

export function ArtworkInspectModal({
  artwork,
  slotIndex,
  roomNames,
  canDelete,
  onClose,
  onWalkTo,
  onDelete,
}: ArtworkInspectModalProps) {
  if (!artwork) return null;

  const placement = getArtworkPlacement(slotIndex);
  const accession = formatAccessionNumber(artwork.dateCaptured, slotIndex);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75"
      role="dialog"
      aria-modal="true"
      aria-label={`Inspect ${artwork.title}`}
    >
      <div className="bg-[#FAF8F4] text-[#1C1917] w-full max-w-4xl max-h-[92vh] overflow-y-auto border border-stone-300 shadow-2xl grid grid-cols-1 md:grid-cols-12">
        {/* Artwork Frame Presentation */}
        <div className="md:col-span-7 bg-[#E9E4DB] p-6 sm:p-8 flex items-center justify-center min-h-[280px]">
          <div className="bg-white p-3 shadow-lg border border-stone-300 max-h-[65vh] overflow-hidden">
            <img
              src={artwork.imageUrl}
              alt={artwork.title}
              referrerPolicy="no-referrer"
              className="max-h-[58vh] w-auto object-contain block"
            />
          </div>
        </div>

        {/* Museum Accession Details */}
        <div className="md:col-span-5 p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3 mb-4">
              <p className="text-xs font-mono text-[#8A5A2B] tracking-wider tabular-nums">
                {accession}
              </p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close artwork inspection"
                className="p-1.5 text-stone-500 hover:text-stone-900 cursor-pointer -mt-1 -mr-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h2 className="font-editorial text-3xl font-semibold text-stone-900 leading-tight mb-2">
              {artwork.title}
            </h2>
            <p className="text-sm text-stone-600 mb-6">{artwork.artist}</p>

            <dl className="divide-y divide-stone-200 border-t border-b border-stone-200 text-xs">
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-stone-500">Archival Date</dt>
                <dd className="text-stone-900 font-medium tabular-nums">
                  {formatArchivalDate(artwork.dateCaptured)}
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-stone-500">Gallery Room</dt>
                <dd className="text-stone-900 font-medium text-right">
                  Room {toRomanNumeral(placement.roomNumber)} ·{' '}
                  {getResolvedRoomName(placement.roomIndex, roomNames)} ({placement.wallLabel})
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-stone-500">Frame Finish</dt>
                <dd className="text-stone-900 font-medium capitalize">{artwork.frameStyle}</dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-stone-500">Curated By</dt>
                <dd className="text-stone-900 font-medium">{artwork.uploadedByName}</dd>
              </div>
            </dl>

            {artwork.notes && (
              <p className="mt-5 text-sm text-stone-700 leading-relaxed">
                {artwork.notes}
              </p>
            )}
          </div>

          <div className="mt-8 pt-4 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
            {onWalkTo && (
              <button
                type="button"
                onClick={() => {
                  onWalkTo(artwork.id);
                  onClose();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1C1917] text-[#F7F5F0] text-xs font-medium hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5" />
                Stand Before Work
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete(artwork.id);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove from Wall
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
