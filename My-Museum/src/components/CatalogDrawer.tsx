import { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Calendar,
  Compass,
  Eye,
  Grid2x2,
  List,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { ArtworkItem, DateSortOrder } from '../types/museum';
import {
  formatAccessionNumber,
  formatArchivalDate,
  getArtworkPlacement,
  getResolvedRoomName,
  groupArtworksByDate,
  sortArtworksByDate,
  toRomanNumeral,
} from '../museum/layout';

interface CatalogDrawerProps {
  open: boolean;
  onClose: () => void;
  artworks: ArtworkItem[];
  roomNames?: Record<string, string>;
  canCurate: boolean;
  onWalkToArtwork?: (artworkId: string) => void;
  onInspectArtwork: (artwork: ArtworkItem, slotIndex: number) => void;
  onDeleteArtwork: (artworkId: string) => void;
  onOpenUpload: () => void;
}

export function CatalogDrawer({
  open,
  onClose,
  artworks,
  roomNames,
  canCurate,
  onWalkToArtwork,
  onInspectArtwork,
  onDeleteArtwork,
  onOpenUpload,
}: CatalogDrawerProps) {
  const [sortOrder, setSortOrder] = useState<DateSortOrder>('newest');
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');
  const [searchQuery, setSearchQuery] = useState('');

  const slotIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    artworks.forEach((a, idx) => map.set(a.id, idx));
    return map;
  }, [artworks]);

  const filteredArtworks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return artworks;
    return artworks.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.artist.toLowerCase().includes(q) ||
        a.dateCaptured.includes(q) ||
        a.notes.toLowerCase().includes(q)
    );
  }, [artworks, searchQuery]);

  const sortedFlat = useMemo(
    () => sortArtworksByDate(filteredArtworks, sortOrder),
    [filteredArtworks, sortOrder]
  );

  const groupedByDate = useMemo(
    () => groupArtworksByDate(filteredArtworks, sortOrder),
    [filteredArtworks, sortOrder]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-stone-950/60"
      role="dialog"
      aria-modal="true"
      aria-label="Museum Exhibition Catalog"
    >
      <div className="w-full max-w-2xl bg-[#F7F5F0] text-[#1C1917] h-full flex flex-col border-l border-stone-300 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between gap-4 bg-[#FAF8F4]">
          <div>
            <p className="text-xs font-mono text-[#8A5A2B] tracking-wider mb-1 tabular-nums">
              EXHIBITION ARCHIVE · {artworks.length} {artworks.length === 1 ? 'WORK' : 'WORKS'}
            </p>
            <h2 className="text-2xl font-editorial font-semibold text-stone-900">
              Complete Collection by Date
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canCurate && (
              <button
                type="button"
                onClick={onOpenUpload}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#8A5A2B] text-white text-xs font-medium hover:bg-[#734922] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Artwork
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close catalog drawer"
              className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-200/70 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sort & Filter Toolbar */}
        <div className="px-6 py-4 border-b border-stone-200 bg-[#F4F1EA] flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, creator, or date..."
              aria-label="Search museum catalog"
              className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#8A5A2B]"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Explicit Date Sorting Segmented Control */}
            <div
              className="flex items-center bg-stone-200/80 p-0.5 border border-stone-300"
              role="group"
              aria-label="Sort collection by date"
            >
              <button
                type="button"
                onClick={() => setSortOrder('newest')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  sortOrder === 'newest'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <ArrowDownUp className="w-3.5 h-3.5" />
                Newest First
              </button>
              <button
                type="button"
                onClick={() => setSortOrder('oldest')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  sortOrder === 'oldest'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Oldest First
              </button>
            </div>

            {/* View Toggle */}
            <div className="flex items-center bg-stone-200/80 p-0.5 border border-stone-300">
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                aria-label="Chronological timeline view"
                className={`p-1.5 transition-colors cursor-pointer ${
                  viewMode === 'timeline'
                    ? 'bg-white text-stone-900'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                aria-label="Archival grid view"
                className={`p-1.5 transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-stone-900'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Grid2x2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5" data-testid="catalog-list">
          {filteredArtworks.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-editorial text-2xl text-stone-800 mb-2">
                {artworks.length === 0
                  ? 'Your gallery walls are ready'
                  : 'No artworks match your search'}
              </p>
              <p className="text-sm text-stone-500 mb-6">
                {artworks.length === 0
                  ? 'Upload your first photograph or painting. New walls expand automatically as your collection grows.'
                  : 'Try another title, artist name, or clear the search field.'}
              </p>
              {canCurate && artworks.length === 0 && (
                <button
                  type="button"
                  onClick={onOpenUpload}
                  className="px-5 py-2.5 bg-[#1C1917] text-white text-sm font-medium hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  Upload First Artwork
                </button>
              )}
            </div>
          ) : viewMode === 'timeline' ? (
            <div className="space-y-8">
              {groupedByDate.map((group) => (
                <section key={group.dateKey}>
                  <div className="flex items-center justify-between pb-2 mb-4 border-b border-stone-300">
                    <div className="flex items-center gap-2 text-xs font-mono text-stone-700 tabular-nums">
                      <Calendar className="w-3.5 h-3.5 text-[#8A5A2B]" />
                      <span>{group.label}</span>
                      <span className="text-stone-400" aria-hidden="true">·</span>
                      <span className="text-stone-500">{group.dateKey}</span>
                    </div>
                    <span className="text-xs text-stone-500 tabular-nums">
                      {group.items.length} {group.items.length === 1 ? 'work' : 'works'}
                    </span>
                  </div>

                  <div className="space-y-4">
                    {group.items.map((item) => {
                      const slotIdx = slotIndexMap.get(item.id) ?? 0;
                      const placement = getArtworkPlacement(slotIdx);
                      const accession = formatAccessionNumber(item.dateCaptured, slotIdx);
                      return (
                        <article
                          key={item.id}
                          className="flex gap-4 bg-white border border-stone-200 p-4 hover:border-stone-400 transition-colors"
                          data-artwork-date={item.dateCaptured}
                        >
                          <div className="w-28 h-24 shrink-0 bg-stone-200 overflow-hidden">
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono text-stone-500 tabular-nums mb-1">
                              {accession} · Room {toRomanNumeral(placement.roomNumber)} (
                              {getResolvedRoomName(placement.roomIndex, roomNames)}) · {placement.wallLabel}
                            </p>
                            <h3 className="font-editorial text-xl font-semibold text-stone-900 truncate">
                              {item.title}
                            </h3>
                            <p className="text-xs text-stone-600 mt-0.5">
                              {item.artist} · {formatArchivalDate(item.dateCaptured)}
                            </p>
                            {item.notes && (
                              <p className="text-xs text-stone-500 mt-2 line-clamp-2 leading-relaxed">
                                {item.notes}
                              </p>
                            )}
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                              {onWalkToArtwork && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onWalkToArtwork(item.id);
                                    onClose();
                                  }}
                                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8A5A2B] hover:text-[#66401B] cursor-pointer"
                                >
                                  <Compass className="w-3.5 h-3.5" />
                                  Walk To Wall
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onInspectArtwork(item, slotIdx)}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-700 hover:text-stone-950 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Inspect
                              </button>
                              {canCurate && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteArtwork(item.id)}
                                  aria-label={`Remove '${item.title}'`}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-red-700 cursor-pointer ml-auto"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sortedFlat.map((item) => {
                const slotIdx = slotIndexMap.get(item.id) ?? 0;
                const placement = getArtworkPlacement(slotIdx);
                return (
                  <article
                    key={item.id}
                    className="bg-white border border-stone-200 overflow-hidden flex flex-col"
                    data-artwork-date={item.dateCaptured}
                  >
                    <div className="aspect-[4/3] bg-stone-200 overflow-hidden">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <p className="text-xs font-mono text-stone-500 tabular-nums mb-1">
                        {item.dateCaptured} · Room {toRomanNumeral(placement.roomNumber)} (
                        {getResolvedRoomName(placement.roomIndex, roomNames)})
                      </p>
                      <h3 className="font-editorial text-lg font-semibold text-stone-900 truncate">
                        {item.title}
                      </h3>
                      <p className="text-xs text-stone-600 mb-3">{item.artist}</p>
                      <div className="mt-auto pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
                        {onWalkToArtwork ? (
                          <button
                            type="button"
                            onClick={() => {
                              onWalkToArtwork(item.id);
                              onClose();
                            }}
                            className="text-xs font-medium text-[#8A5A2B] hover:text-[#66401B] cursor-pointer"
                          >
                            Walk To Wall
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onInspectArtwork(item, slotIdx)}
                            className="text-xs font-medium text-stone-800 hover:text-stone-950 cursor-pointer"
                          >
                            Inspect
                          </button>
                        )}
                        {canCurate && (
                          <button
                            type="button"
                            onClick={() => onDeleteArtwork(item.id)}
                            aria-label={`Remove '${item.title}'`}
                            className="text-xs text-stone-500 hover:text-red-700 cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
