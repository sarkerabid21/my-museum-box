import type { ArtworkItem, MuseumMember, MuseumMeta } from '../types/museum';

export const CURATED_SAMPLES = [
  {
    id: 'sample-alpine',
    title: 'Alpenglow Over Glacial Ridge',
    artist: 'Henrik Lindqvist',
    dateCaptured: '2026-11-12',
    notes: 'Impasto oil study capturing late-autumn sunset reflections across high alpine granite and glacial ice.',
    imageUrl: '/src/assets/images/art_alpine_twilight_1795278906644.jpg',
    aspectRatio: '4:3' as const,
    frameStyle: 'bronze' as const,
    cropMargin: 0.14,
  },
  {
    id: 'sample-botanical',
    title: 'Magnolia & Olive in Terracotta',
    artist: 'Clara Vermeer-Bauer',
    dateCaptured: '2026-09-24',
    notes: 'Chiaroscuro still life composed beside a north-facing studio casement in early autumn light.',
    imageUrl: '/src/assets/images/art_botanical_atelier_1795278908731.jpg',
    aspectRatio: '3:4' as const,
    frameStyle: 'walnut' as const,
    cropMargin: 0.03,
  },
  {
    id: 'sample-courtyard',
    title: 'Cloister Reflections at Four',
    artist: 'Mateo Delacroix',
    dateCaptured: '2026-07-08',
    notes: 'Medium-format architectural study of limestone colonnades mirrored across a still courtyard basin.',
    imageUrl: '/src/assets/images/art_brutalist_courtyard_1795278907758.jpg',
    aspectRatio: '4:3' as const,
    frameStyle: 'obsidian' as const,
    cropMargin: 0.02,
  },
  {
    id: 'sample-coastal',
    title: 'Limestone Headlands at Dawn',
    artist: 'Soraia Mendes',
    dateCaptured: '2026-04-19',
    notes: 'Palette-knife seascape exploring cobalt tidal movement against sunlit coastal cliffs.',
    imageUrl: '/src/assets/images/art_coastal_horizon_1795278908179.jpg',
    aspectRatio: '4:3' as const,
    frameStyle: 'bronze' as const,
    cropMargin: 0.11,
  },
  {
    id: 'sample-abstract',
    title: 'Arc in Raw Ochre & Charcoal',
    artist: 'Nadia Al-Mansoor',
    dateCaptured: '2025-11-30',
    notes: 'Minimalist gesso and mineral pigment composition balancing curved bronze sweeps with calligraphic ink.',
    imageUrl: '/src/assets/images/art_abstract_ochre_1795278909230.jpg',
    aspectRatio: '3:4' as const,
    frameStyle: 'alabaster' as const,
    cropMargin: 0.15,
  },
];

export function createSeedMuseum(ownerId: string, ownerName: string): MuseumMeta {
  return {
    id: `museum-${ownerId}`,
    ownerId,
    ownerName,
    title: 'The Grand Private Gallery',
    description:
      'A personal architectural museum of fine photography, paintings, and cherished memories curated chronologically.',
    accessCode: 'MUS-742A',
    wallTheme: 'alabaster',
    isOpenByCode: true,
    memberEmails: ['clara.curator@gallery.example'],
    curatorEmails: ['clara.curator@gallery.example'],
    artworkCount: CURATED_SAMPLES.length,
    roomNames: {},
    createdAt: '2025-11-30',
  };
}

export function createSeedArtworks(museumId: string, ownerId: string, ownerName: string): ArtworkItem[] {
  return CURATED_SAMPLES.map((s) => ({
    id: s.id,
    museumId,
    ownerId,
    uploadedBy: ownerId,
    uploadedByName: ownerName,
    title: s.title,
    artist: s.artist,
    dateCaptured: s.dateCaptured,
    notes: s.notes,
    imageUrl: s.imageUrl,
    aspectRatio: s.aspectRatio,
    frameStyle: s.frameStyle,
    isOpenByCode: true,
    viewerEmails: ['clara.curator@gallery.example'],
    cropMargin: s.cropMargin,
  }));
}

export function createSeedMembers(museumId: string, ownerId: string): MuseumMember[] {
  return [
    {
      id: 'member-clara',
      museumId,
      ownerId,
      email: 'clara.curator@gallery.example',
      displayName: 'Clara Moreau',
      role: 'curator',
      gender: 'woman',
      createdAt: '2026-10-15',
    },
  ];
}
