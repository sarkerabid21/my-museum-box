import React, { useState } from 'react';
import { ImagePlus, Upload, X } from 'lucide-react';
import type { AspectRatioType, FrameStyle } from '../types/museum';
import { CURATED_SAMPLES } from '../data/seedMuseum';
import { calculateMuseumLayout, toRomanNumeral, validateArtworkInput } from '../museum/layout';
import { compressUploadedImage } from '../three/webglUtils';

interface UploadArtworkModalProps {
  open: boolean;
  onClose: () => void;
  currentArtworkCount: number;
  defaultArtist: string;
  isCloudSynced?: boolean;
  onSubmitArtwork: (payload: {
    title: string;
    artist: string;
    dateCaptured: string;
    notes: string;
    imageUrl: string;
    aspectRatio: AspectRatioType;
    frameStyle: FrameStyle;
  }) => Promise<void> | void;
}

const FRAME_OPTIONS: { id: FrameStyle; label: string; swatch: string }[] = [
  { id: 'bronze', label: 'Gilded Bronze', swatch: '#A67C46' },
  { id: 'walnut', label: 'Walnut Wood', swatch: '#4B3121' },
  { id: 'obsidian', label: 'Gallery Black', swatch: '#1E1C1A' },
  { id: 'alabaster', label: 'Alabaster', swatch: '#E8E3DA' },
];

export function UploadArtworkModal({
  open,
  onClose,
  currentArtworkCount,
  defaultArtist,
  isCloudSynced = false,
  onSubmitArtwork,
}: UploadArtworkModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState(defaultArtist || '');
  const [dateCaptured, setDateCaptured] = useState(today);
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatioType>('4:3');
  const [frameStyle, setFrameStyle] = useState<FrameStyle>('bronze');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const currentLayout = calculateMuseumLayout(currentArtworkCount);
  const nextLayout = calculateMuseumLayout(currentArtworkCount + 1);
  const willCreateNewRoom = nextLayout.roomCount > currentLayout.roomCount;
  const nextCreatedRoom = nextLayout.rooms[nextLayout.rooms.length - 1];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const result = await compressUploadedImage(file);
      setImageUrl(result.dataUrl);
      setAspectRatio(result.aspectRatio);
      if (!title.trim()) {
        const cleanName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
        if (cleanName) setTitle(cleanName.slice(0, 80));
      }
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.imageUrl;
        return copy;
      });
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        imageUrl: err instanceof Error ? err.message : 'Unable to process image.',
      }));
    } finally {
      setBusy(false);
    }
  };

  const handleSelectSample = (sample: (typeof CURATED_SAMPLES)[number]) => {
    setImageUrl(sample.imageUrl);
    setAspectRatio(sample.aspectRatio);
    setFrameStyle(sample.frameStyle);
    if (!title.trim()) setTitle(sample.title);
    if (!artist.trim()) setArtist(sample.artist);
    if (!notes.trim()) setNotes(sample.notes);
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.imageUrl;
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateArtworkInput({
      title,
      artist,
      dateCaptured,
      imageUrl,
      notes,
    });
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setBusy(true);
    try {
      await onSubmitArtwork({
        title: title.trim(),
        artist: artist.trim(),
        dateCaptured,
        notes: notes.trim(),
        imageUrl,
        aspectRatio,
        frameStyle,
      });
      setTitle('');
      setNotes('');
      setImageUrl('');
      setErrors({});
      onClose();
    } catch (err) {
      setErrors({
        form: err instanceof Error ? err.message : 'Failed to save artwork.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/65"
      role="dialog"
      aria-modal="true"
      aria-label="Add Artwork to Museum Wall"
    >
      <div className="bg-[#FAF8F4] text-[#1C1917] w-full max-w-2xl max-h-[92vh] overflow-y-auto border border-stone-300 shadow-2xl">
        <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-mono text-[#8A5A2B] tracking-wider mb-1 tabular-nums">
              {willCreateNewRoom
                ? `AUTOMATIC EXPANSION · CREATES ${nextCreatedRoom.isCrossHall ? 'GRAND CROSS HALL' : 'ROOM'} ${toRomanNumeral(nextLayout.roomCount)} (${nextCreatedRoom.capacity} NEW WALLS)`
                : `ROOM ${toRomanNumeral(currentLayout.roomCount)} · WALL SLOT ${currentArtworkCount + 1} OF ${currentLayout.totalWallSlots}`}
            </p>
            <h2 className="text-2xl font-editorial font-semibold text-stone-900">
              Hang New Artwork
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close add artwork dialog"
            className="p-2 text-stone-500 hover:text-stone-900 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5" noValidate>
          <div className="px-3.5 py-2.5 bg-white border border-stone-200 text-xs text-stone-700 flex items-center justify-between gap-3">
            <span>
              <strong className="text-stone-900">Private Storage:</strong>{' '}
              {isCloudSynced
                ? 'Saved strictly to your personal Firebase Firestore database (hidden from other accounts unless invited).'
                : 'Guest Studio preview only (saved locally in this browser). Sign in with Google for your own private Firebase database.'}
            </span>
          </div>

          {willCreateNewRoom && (
            <div className="p-3.5 bg-[#EFEAE0] border border-stone-300 text-xs text-stone-800 leading-relaxed">
              Current rooms are full ({currentArtworkCount}/{currentLayout.totalWallSlots} walls).
              Adding this artwork will automatically construct{' '}
              <strong>
                {nextCreatedRoom.isCrossHall
                  ? `Grand Cross Hall ${toRomanNumeral(nextLayout.roomCount)} (X-Shaped Pavilion · 18 Walls)`
                  : `Room ${toRomanNumeral(nextLayout.roomCount)} (8 Walls)`}
              </strong>{' '}
              with a distinct architectural shape, floral vase centerpiece, and an interactive double door.
            </div>
          )}

          {errors.form && (
            <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-800" role="alert">
              {errors.form}
            </div>
          )}

          {/* Image Upload & Quick Samples */}
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-2">
              Photograph or Artwork Image
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
              <label className="flex flex-col items-center justify-center border border-dashed border-stone-400 bg-white hover:bg-stone-50 p-5 cursor-pointer transition-colors min-h-[150px] text-center">
                <Upload className="w-5 h-5 text-[#8A5A2B] mb-2" />
                <span className="text-sm font-medium text-stone-800">
                  Upload from Device
                </span>
                <span className="text-xs text-stone-500 mt-1">
                  JPG, PNG, or WebP · Auto-framed for 3D wall
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>

              <div className="bg-stone-100 border border-stone-200 flex items-center justify-center overflow-hidden min-h-[150px]">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Artwork preview"
                    referrerPolicy="no-referrer"
                    className="w-full h-40 object-cover"
                  />
                ) : (
                  <div className="text-center p-4 text-stone-400">
                    <ImagePlus className="w-6 h-6 mx-auto mb-1.5" />
                    <span className="text-xs">Preview appears here</span>
                  </div>
                )}
              </div>
            </div>
            {errors.imageUrl && (
              <p className="text-xs text-red-700 mt-1.5" role="alert">
                {errors.imageUrl}
              </p>
            )}

            {/* Quick Museum Archive Samples for effortless testing/curation */}
            <div className="mt-3">
              <p className="text-xs text-stone-500 mb-2">
                Or select a curated studio photograph:
              </p>
              <div className="grid grid-cols-5 gap-2">
                {CURATED_SAMPLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectSample(s)}
                    aria-label={`Use sample artwork ${s.title}`}
                    className={`aspect-[4/3] overflow-hidden border transition-all cursor-pointer ${
                      imageUrl === s.imageUrl
                        ? 'border-[#8A5A2B] ring-2 ring-[#8A5A2B]/30'
                        : 'border-stone-300 hover:border-stone-500'
                    }`}
                  >
                    <img
                      src={s.imageUrl}
                      alt={s.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="artwork-title" className="block text-xs font-medium text-stone-700 mb-1.5">
                Artwork Title
              </label>
              <input
                id="artwork-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Sunset Over Cox's Bazar"
                className="w-full px-3 py-2 bg-white border border-stone-300 text-sm text-stone-900 focus:outline-none focus:border-[#8A5A2B]"
              />
              {errors.title && (
                <p className="text-xs text-red-700 mt-1" role="alert">
                  {errors.title}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="artwork-artist" className="block text-xs font-medium text-stone-700 mb-1.5">
                Creator / Photographer
              </label>
              <input
                id="artwork-artist"
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Your name or artist"
                className="w-full px-3 py-2 bg-white border border-stone-300 text-sm text-stone-900 focus:outline-none focus:border-[#8A5A2B]"
              />
              {errors.artist && (
                <p className="text-xs text-red-700 mt-1" role="alert">
                  {errors.artist}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="artwork-date" className="block text-xs font-medium text-stone-700 mb-1.5">
                Archival Date (used for Date Sorting)
              </label>
              <input
                id="artwork-date"
                type="date"
                value={dateCaptured}
                onChange={(e) => setDateCaptured(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 text-sm text-stone-900 font-mono tabular-nums focus:outline-none focus:border-[#8A5A2B]"
              />
              {errors.dateCaptured && (
                <p className="text-xs text-red-700 mt-1" role="alert">
                  {errors.dateCaptured}
                </p>
              )}
            </div>

            <div>
              <span className="block text-xs font-medium text-stone-700 mb-1.5">
                Frame Molding Finish
              </span>
              <div className="grid grid-cols-2 gap-2">
                {FRAME_OPTIONS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFrameStyle(f.id)}
                    className={`flex items-center gap-2 px-2.5 py-2 text-xs border text-left cursor-pointer transition-colors ${
                      frameStyle === f.id
                        ? 'border-[#8A5A2B] bg-[#F3ECE2] text-stone-900 font-medium'
                        : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 border border-stone-400 shrink-0"
                      style={{ backgroundColor: f.swatch }}
                    />
                    <span className="truncate">{f.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="artwork-notes" className="block text-xs font-medium text-stone-700 mb-1.5">
              Curatorial Note (Optional)
            </label>
            <textarea
              id="artwork-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Story, location, medium, or memory attached to this piece..."
              className="w-full px-3 py-2 bg-white border border-stone-300 text-sm text-stone-900 focus:outline-none focus:border-[#8A5A2B]"
            />
          </div>

          <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-stone-700 hover:text-stone-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2.5 bg-[#1C1917] text-[#F7F5F0] text-sm font-medium hover:bg-stone-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {busy ? 'Hanging Artwork...' : 'Hang on Museum Wall'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
