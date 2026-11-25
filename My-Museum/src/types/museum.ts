export type Gender = 'man' | 'woman';
export type AccessoryType = 'none' | 'glasses' | 'scarf' | 'lanyard';
export type WallTheme = 'alabaster' | 'travertine' | 'charcoal';
export type FrameStyle = 'bronze' | 'walnut' | 'obsidian' | 'alabaster';
export type AspectRatioType = '4:3' | '3:4' | '1:1';
export type MemberRole = 'visitor' | 'curator';
export type DateSortOrder = 'newest' | 'oldest';
export type RoomShape = 'rotunda' | 'atrium' | 'salon' | 'pavilion' | 'cross_hall';

export interface AvatarConfig {
  displayName: string;
  gender: Gender;
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  outfitStyle: string;
  outfitColor: string;
  accentColor: string;
  accessory: AccessoryType;
}

export interface MuseumMeta {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  description: string;
  accessCode: string;
  wallTheme: WallTheme;
  isOpenByCode: boolean;
  memberEmails: string[];
  curatorEmails: string[];
  artworkCount: number;
  roomNames?: Record<string, string>;
  createdAt?: string;
}

export interface ArtworkItem {
  id: string;
  museumId: string;
  ownerId: string;
  uploadedBy: string;
  uploadedByName: string;
  title: string;
  artist: string;
  dateCaptured: string; // YYYY-MM-DD
  notes: string;
  imageUrl: string;
  aspectRatio: AspectRatioType;
  frameStyle: FrameStyle;
  isOpenByCode: boolean;
  viewerEmails: string[];
  cropMargin?: number; // optional subtle inset crop for canvas photos
  createdAt?: string;
}

export interface MuseumMember {
  id: string;
  museumId: string;
  ownerId: string;
  email: string;
  displayName: string;
  role: MemberRole;
  gender: Gender;
  createdAt?: string;
}

export interface VisitorPresence {
  uid: string;
  museumId: string;
  ownerId: string;
  memberKey?: string;
  displayName: string;
  gender: Gender;
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  outfitStyle: string;
  outfitColor: string;
  accentColor: string;
  accessory: AccessoryType;
  x: number;
  z: number;
  yaw: number;
  isOnline?: boolean;
  isSimulated?: boolean;
  ridingRideId?: string | null;
  ridingVehicleId?: string | null;
  updatedAt?: number;
}

export interface OptionItem {
  id: string;
  label: string;
}

export const SKIN_TONES: { hex: string; label: string }[] = [
  { hex: '#F4D8C4', label: 'Porcelain' },
  { hex: '#E6BC9A', label: 'Warm Sand' },
  { hex: '#D49E76', label: 'Golden Tan' },
  { hex: '#B67B52', label: 'Caramel' },
  { hex: '#8C583A', label: 'Chestnut' },
  { hex: '#5D3926', label: 'Espresso' },
];

export const HAIR_COLORS: { hex: string; label: string }[] = [
  { hex: '#1E1B18', label: 'Obsidian' },
  { hex: '#4A3423', label: 'Dark Walnut' },
  { hex: '#7A5230', label: 'Auburn Brown' },
  { hex: '#B8925A', label: 'Honey Blonde' },
  { hex: '#8E8A84', label: 'Silver Slate' },
  { hex: '#632B21', label: 'Mahogany' },
];

export const OUTFIT_COLORS: { hex: string; label: string }[] = [
  { hex: '#262930', label: 'Charcoal Wool' },
  { hex: '#233447', label: 'Midnight Navy' },
  { hex: '#5C4033', label: 'Curator Umber' },
  { hex: '#2D4739', label: 'Gallery Pine' },
  { hex: '#6E2E36', label: 'Bordeaux' },
  { hex: '#C6B9A6', label: 'Oatmeal Linen' },
  { hex: '#3A3248', label: 'Plum Slate' },
];

export const ACCENT_COLORS: { hex: string; label: string }[] = [
  { hex: '#EFECE6', label: 'Alabaster' },
  { hex: '#C49A6C', label: 'Warm Bronze' },
  { hex: '#1F1D1B', label: 'Ink Black' },
  { hex: '#7C93A6', label: 'Slate Blue' },
  { hex: '#9A4638', label: 'Terracotta' },
];

export const HAIR_STYLES_BY_GENDER: Record<Gender, OptionItem[]> = {
  man: [
    { id: 'taper', label: 'Classic Taper' },
    { id: 'swept', label: 'Swept Back' },
    { id: 'curly', label: 'Textured Curl' },
    { id: 'crop', label: 'Short Crop' },
  ],
  woman: [
    { id: 'flowing', label: 'Long Flowing' },
    { id: 'bob', label: 'Sleek Bob' },
    { id: 'bun', label: 'High Chignon' },
    { id: 'waves', label: 'Shoulder Waves' },
  ],
};

export const OUTFIT_STYLES_BY_GENDER: Record<Gender, OptionItem[]> = {
  man: [
    { id: 'blazer', label: 'Tailored Blazer' },
    { id: 'trench', label: 'Gallery Overcoat' },
    { id: 'turtleneck', label: 'Studio Knit' },
  ],
  woman: [
    { id: 'dress', label: 'Pleated Midi Dress' },
    { id: 'coat', label: 'Tailored Gallery Coat' },
    { id: 'blazer_skirt', label: 'Curator Blazer & Skirt' },
  ],
};

export const ACCESSORIES: { id: AccessoryType; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'glasses', label: 'Glasses' },
  { id: 'scarf', label: 'Curator Scarf' },
  { id: 'lanyard', label: 'Gallery Pass' },
];

export const DEFAULT_AVATAR_BY_GENDER: Record<Gender, AvatarConfig> = {
  man: {
    displayName: 'Julian Vance',
    gender: 'man',
    skinTone: '#D49E76',
    hairStyle: 'taper',
    hairColor: '#1E1B18',
    outfitStyle: 'blazer',
    outfitColor: '#233447',
    accentColor: '#EFECE6',
    accessory: 'glasses',
  },
  woman: {
    displayName: 'Clara Moreau',
    gender: 'woman',
    skinTone: '#E6BC9A',
    hairStyle: 'flowing',
    hairColor: '#4A3423',
    outfitStyle: 'dress',
    outfitColor: '#6E2E36',
    accentColor: '#C49A6C',
    accessory: 'scarf',
  },
};
