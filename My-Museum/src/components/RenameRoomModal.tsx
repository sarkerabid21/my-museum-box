import React, { useEffect, useState } from 'react';
import { DoorOpen, RotateCcw, X } from 'lucide-react';
import {
  getDefaultRoomName,
  toRomanNumeral,
  validateRoomName,
} from '../museum/layout';

interface RenameRoomModalProps {
  roomIndex: number | null;
  currentName: string;
  canEdit: boolean;
  onClose: () => void;
  onSaveName: (roomIndex: number, nextName: string) => Promise<void> | void;
}

export function RenameRoomModal({
  roomIndex,
  currentName,
  canEdit,
  onClose,
  onSaveName,
}: RenameRoomModalProps) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(currentName);
    setError(null);
  }, [currentName, roomIndex]);

  if (roomIndex === null) return null;

  const defaultName = getDefaultRoomName(roomIndex);
  const roomNumeral = toRomanNumeral(roomIndex + 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      onClose();
      return;
    }
    const check = validateRoomName(name);
    if (!check.valid) {
      setError(check.errors.roomName ?? 'Invalid room name.');
      return;
    }
    setBusy(true);
    try {
      await onSaveName(roomIndex, name.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save room name.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/65"
      role="dialog"
      aria-modal="true"
      aria-label={`Rename Room ${roomNumeral}`}
    >
      <div className="bg-[#FAF8F4] text-[#1C1917] w-full max-w-md border border-stone-300 shadow-2xl">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-mono text-[#8A5A2B] tracking-wider mb-0.5">
              DOOR SIGNBOARD · ROOM {roomNumeral}
            </p>
            <h2 className="font-editorial text-2xl font-semibold text-stone-900">
              {canEdit ? 'Name This Museum Room' : 'Room Signboard'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rename room dialog"
            className="p-1.5 text-stone-500 hover:text-stone-900 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
          <p className="text-xs text-stone-600 leading-relaxed flex items-start gap-2">
            <DoorOpen className="w-4 h-4 text-[#8A5A2B] shrink-0 mt-0.5" />
            <span>
              {canEdit
                ? 'This name appears on the gilded architectural signboard mounted directly above the room doorway.'
                : 'Only the museum owner can rename rooms on the door signboards.'}
            </span>
          </p>

          <div>
            <label
              htmlFor="room-signboard-name"
              className="block text-xs font-medium text-stone-700 mb-1.5"
            >
              Room Signboard Name
            </label>
            <input
              id="room-signboard-name"
              type="text"
              maxLength={60}
              disabled={!canEdit || busy}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder={defaultName}
              className="w-full px-3 py-2 bg-white border border-stone-300 text-sm text-stone-900 focus:outline-none focus:border-[#8A5A2B] disabled:bg-stone-100"
              autoFocus
            />
            {error && (
              <p className="text-xs text-red-700 mt-1.5" role="alert">
                {error}
              </p>
            )}
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setName(defaultName);
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-900 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to default ({defaultName})
            </button>
          )}

          <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-700 hover:text-stone-900 cursor-pointer"
            >
              Cancel
            </button>
            {canEdit && (
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2 bg-[#1C1917] text-[#F7F5F0] text-xs font-medium hover:bg-stone-800 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {busy ? 'Updating Signboard...' : 'Save Room Name'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
