import { useRef, useState, type ChangeEvent } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowRight,
  Calendar,
  ExternalLink,
  FolderKanban,
  LogOut,
  Mail,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  Upload,
  Users,
  X,
} from 'lucide-react';
import type { PendingMuseumInvite } from '../services/gmailService';
import {
  ABID_SIGNATURE_VIDEO_URL,
  ABID_TRIPO_SOURCE_URL,
  EXCLUSIVE_ABID_EMAIL,
} from '../museum/exclusiveAvatar';
import {
  ACCENT_COLORS,
  ACCESSORIES,
  DEFAULT_AVATAR_BY_GENDER,
  HAIR_COLORS,
  HAIR_STYLES_BY_GENDER,
  OUTFIT_COLORS,
  OUTFIT_STYLES_BY_GENDER,
  SKIN_TONES,
  type AccessoryType,
  type ArtworkItem,
  type AvatarConfig,
  type Gender,
  type MuseumMember,
  type MuseumMeta,
} from '../types/museum';
import {
  calculateMuseumLayout,
  formatArchivalDate,
  sortArtworksByDate,
} from '../museum/layout';
import { AvatarPreview3D } from './AvatarPreview3D';

export type InviteBannerState = 'needs-auth' | 'loading' | 'accepted' | 'error' | null;

interface HomeStudioProps {
  user: User | null;
  authLoading: boolean;
  avatar: AvatarConfig;
  isExclusiveAbid: boolean;
  customGlbBuffer: ArrayBuffer | null;
  customGlbName: string | null;
  museum: MuseumMeta;
  artworks: ArtworkItem[];
  members: MuseumMember[];
  accessibleMuseums: MuseumMeta[];
  pendingInvite: PendingMuseumInvite | null;
  inviteBannerState: InviteBannerState;
  inviteBannerMessage: string | null;
  onDismissInvite: () => void;
  onSignInGoogle: () => void;
  onSignOut: () => void;
  onChangeAvatar: (next: AvatarConfig) => void;
  onUploadCustomGlb: (file: File) => Promise<void>;
  onClearCustomGlb: () => Promise<void>;
  onEnterMuseum: () => void;
  onOpenCatalog: () => void;
  onOpenUpload: () => void;
  onOpenAccess: () => void;
  onSwitchMuseum: (museumId: string) => void;
  onInspectArtwork: (artwork: ArtworkItem, slotIndex: number) => void;
}

function GoogleGIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.64v3.02h3.88c2.27-2.09 3.54-5.17 3.54-8.9z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.94-2.9l-3.88-3.02c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.27v3.12A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28V6.6H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.4l4.01-3.12z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.6l4.01 3.12c.95-2.84 3.6-4.95 6.72-4.95z"
      />
    </svg>
  );
}

export function HomeStudio({
  user,
  authLoading,
  avatar,
  isExclusiveAbid,
  customGlbBuffer,
  customGlbName,
  museum,
  artworks,
  members,
  accessibleMuseums,
  pendingInvite,
  inviteBannerState,
  inviteBannerMessage,
  onDismissInvite,
  onSignInGoogle,
  onSignOut,
  onChangeAvatar,
  onUploadCustomGlb,
  onClearCustomGlb,
  onEnterMuseum,
  onOpenCatalog,
  onOpenUpload,
  onOpenAccess,
  onSwitchMuseum,
  onInspectArtwork,
}: HomeStudioProps) {
  const layout = calculateMuseumLayout(artworks.length);
  const recentArtworks = sortArtworksByDate(artworks, 'newest').slice(0, 4);
  const hairOptions = HAIR_STYLES_BY_GENDER[avatar.gender];
  const outfitOptions = OUTFIT_STYLES_BY_GENDER[avatar.gender];
  const [showRefVideo, setShowRefVideo] = useState(false);
  const [glbBusy, setGlbBusy] = useState(false);
  const [glbError, setGlbError] = useState<string | null>(null);
  const glbInputRef = useRef<HTMLInputElement | null>(null);

  const handleGlbFilePicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setGlbError(null);
    setGlbBusy(true);
    try {
      await onUploadCustomGlb(file);
    } catch (err) {
      setGlbError(err instanceof Error ? err.message : 'Could not load that .GLB 3D model.');
    } finally {
      setGlbBusy(false);
    }
  };

  const handleGenderSwitch = (nextGender: Gender) => {
    if (nextGender === avatar.gender) return;
    const defaults = DEFAULT_AVATAR_BY_GENDER[nextGender];
    onChangeAvatar({
      ...avatar,
      gender: nextGender,
      hairStyle: defaults.hairStyle,
      outfitStyle: defaults.outfitStyle,
      outfitColor: defaults.outfitColor,
    });
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#1C1917] flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-[#F7F5F0]/95 border-b border-stone-200">
        <div className="max-w-[1320px] mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#studio"
            className="font-editorial text-2xl font-semibold tracking-tight text-stone-900 whitespace-nowrap shrink-0"
          >
            My Museum
          </a>

          {/* Zone 2: 4 concise single-line text nav links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-600"
          >
            <a
              href="#studio"
              className="hover:text-stone-900 transition-colors whitespace-nowrap shrink-0"
            >
              Avatar Studio
            </a>
            <a
              href="#collection"
              className="hover:text-stone-900 transition-colors whitespace-nowrap shrink-0"
            >
              Collection
            </a>
            <a
              href="#shared-access"
              className="hover:text-stone-900 transition-colors whitespace-nowrap shrink-0"
            >
              Shared Access
            </a>
            <a
              href="#architecture"
              className="hover:text-stone-900 transition-colors whitespace-nowrap shrink-0"
            >
              Guide
            </a>
          </nav>

          {/* Zone 3: 1 Primary CTA */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={onEnterMuseum}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1C1917] text-[#F7F5F0] text-xs font-medium hover:bg-stone-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Enter Museum
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* SECTION 1: Avatar Studio Hero (2-Column Balanced 1440px Split) */}
        <section id="studio" className="max-w-[1320px] mx-auto px-5 sm:px-8 pt-6 pb-12">
          {/* Quiet Account & Museum Utility Ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-6 border-b border-stone-200 text-xs text-stone-600">
            <div className="flex flex-wrap items-center gap-2">
              {accessibleMuseums.length > 1 ? (
                <label className="inline-flex items-center gap-1.5">
                  <span className="sr-only">Active museum</span>
                  <select
                    aria-label="Switch active museum"
                    value={museum.id}
                    onChange={(e) => onSwitchMuseum(e.target.value)}
                    className="font-medium text-stone-900 bg-white border border-stone-300 px-2 py-0.5 text-xs focus:outline-none focus:border-stone-900 cursor-pointer"
                  >
                    {accessibleMuseums.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                        {user && m.ownerId !== user.uid ? ' (Shared)' : ' (Yours)'}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <span className="font-medium text-stone-900">{museum.title}</span>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {artworks.length} Artworks · {layout.roomCount}{' '}
                {layout.roomCount === 1 ? 'Room' : 'Rooms'} ({layout.totalWallSlots} Walls)
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">Code {museum.accessCode}</span>
            </div>

            <div className="flex items-center gap-4">
              {authLoading ? (
                <span className="text-stone-500">Checking account...</span>
              ) : user ? (
                <div className="flex items-center gap-3">
                  <span className="text-stone-800 font-medium">
                    Signed in as {user.displayName || user.email}
                  </span>
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="inline-flex items-center gap-1.5 text-stone-600 hover:text-stone-900 underline underline-offset-4 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-stone-500">Guest Studio Mode</span>
                  <button
                    type="button"
                    onClick={onSignInGoogle}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white border border-stone-300 text-stone-900 font-medium hover:border-stone-500 transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                  >
                    <GoogleGIcon className="w-3.5 h-3.5" />
                    Sign in with Google
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Direct Email Invitation Banner (appears when opening /?invite=...&code=...) */}
          {pendingInvite && inviteBannerState && (
            <div
              data-testid="private-invite-banner"
              className="mb-6 bg-[#181512] text-[#FAF6EE] border border-[#C99A5B]/70 px-5 py-4 flex flex-wrap items-center justify-between gap-4 shadow-md"
            >
              <div className="flex items-start gap-3.5 min-w-0 flex-1">
                <div className="w-9 h-9 bg-[#2A231C] border border-[#C99A5B]/60 flex items-center justify-center shrink-0 mt-0.5">
                  <Mail className="w-4 h-4 text-[#D9B37C]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-mono text-[#D9B37C] tracking-wider uppercase">
                    PRIVATE EXHIBITION INVITATION · PASS {pendingInvite.accessCode || 'DIRECT'}
                  </p>
                  <p className="font-editorial text-xl font-semibold text-[#FAF6EE] leading-snug mt-0.5">
                    {pendingInvite.hostName} invited you to &ldquo;{pendingInvite.museumTitle}&rdquo;
                  </p>
                  <p className="text-xs text-stone-300 mt-1 leading-relaxed">
                    {inviteBannerState === 'needs-auth' &&
                      'Sign in with the Google account that received this invitation email to unlock the private museum and enter with your 3D avatar.'}
                    {inviteBannerState === 'loading' &&
                      'Verifying your private gallery invitation and loading rooms...'}
                    {inviteBannerState === 'accepted' &&
                      `Invitation unlocked! Customize your 3D Man or Woman model below, or walk straight into "${museum.title}" now.`}
                    {inviteBannerState === 'error' &&
                      (inviteBannerMessage ||
                        'This private invitation belongs to another email address. Sign in with the invited Google email to unlock it.')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {inviteBannerState === 'needs-auth' && (
                  <button
                    type="button"
                    onClick={onSignInGoogle}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white text-stone-900 text-xs font-medium hover:bg-stone-100 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <GoogleGIcon className="w-4 h-4" />
                    Sign in with Google to Enter
                  </button>
                )}
                {inviteBannerState === 'accepted' && (
                  <button
                    type="button"
                    onClick={onEnterMuseum}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#8A5A2B] text-white text-xs font-medium hover:bg-[#734922] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Enter {museum.title}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
                {inviteBannerState === 'error' && (
                  <button
                    type="button"
                    onClick={onSignInGoogle}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white text-stone-900 text-xs font-medium hover:bg-stone-100 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <GoogleGIcon className="w-4 h-4" />
                    Switch Google Account
                  </button>
                )}
                <button
                  type="button"
                  onClick={onDismissInvite}
                  aria-label="Dismiss invitation banner"
                  className="p-1.5 text-stone-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-stretch">
            {/* Left Dominant Anchor: Live 3D Avatar Preview Stage */}
            <div className="lg:col-span-6 flex flex-col">
              <AvatarPreview3D
                avatar={avatar}
                customGlbBuffer={isExclusiveAbid ? customGlbBuffer : null}
                isExclusiveModel={isExclusiveAbid}
              />
            </div>

            {/* Right Column: Exclusive Personal 3D Model Atelier (abidsarker213@gmail.com ONLY) OR Standard Customizer */}
            <div className="lg:col-span-6 bg-white border border-stone-200 p-6 flex flex-col justify-between">
              {isExclusiveAbid ? (
                <div className="space-y-4" data-testid="exclusive-abid-panel">
                  <div>
                    <p className="text-xs font-mono text-[#8A5A2B] tracking-wider mb-1 inline-flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      EXCLUSIVE PERSONAL 3D MODEL · {EXCLUSIVE_ABID_EMAIL.toUpperCase()}
                    </p>
                    <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-stone-900 leading-[1.08] text-balance">
                      Your personal 3D character is ready for the museum
                    </h1>
                    <p className="text-sm text-stone-600 mt-2 leading-relaxed max-w-xl">
                      This custom 3D model is strictly locked to your Google account. Walk every room with WASD or Arrow keys, open doors with F or Space, rename room signboards, and curate your walls as your signature character.
                    </p>
                  </div>

                  {/* Visitor Nameplate */}
                  <div>
                    <label
                      htmlFor="avatar-display-name"
                      className="block text-xs font-medium text-stone-700 mb-1.5"
                    >
                      Visitor Nameplate
                    </label>
                    <input
                      id="avatar-display-name"
                      type="text"
                      maxLength={80}
                      value={avatar.displayName}
                      onChange={(e) =>
                        onChangeAvatar({ ...avatar, displayName: e.target.value })
                      }
                      placeholder="Ashfaq Sarker Abid"
                      className="w-full px-3 py-2 bg-[#FAF8F4] border border-stone-300 text-sm text-stone-900 focus:outline-none focus:border-[#8A5A2B]"
                    />
                  </div>

                  {/* Signature Specification Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#FAF8F4] border border-stone-200 p-4">
                    <div>
                      <p className="text-[11px] font-mono text-[#8A5A2B] tracking-wider uppercase mb-1">
                        Signature Styling
                      </p>
                      <p className="text-xs text-stone-700 leading-relaxed">
                        Burgundy &amp; indigo plaid rolled-sleeve shirt, rose-silver glasses, sculpted beard, left wristwatch, ivory chinos &amp; charcoal sneakers.
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-mono text-[#8A5A2B] tracking-wider uppercase mb-1">
                        Active 3D Rig
                      </p>
                      <p className="text-xs font-medium text-stone-900">
                        {customGlbName
                          ? `Imported Tripo GLB (${customGlbName})`
                          : 'Articulated Full-Stride 3D Model'}
                      </p>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Private to your login — invisible to guests &amp; other accounts.
                      </p>
                    </div>
                  </div>

                  {/* Tripo 360 Reference & Optional .GLB Importer */}
                  <div className="border border-stone-200 bg-[#F7F5F0] p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium text-stone-900">
                          Tripo 3D Reference &amp; Optional .GLB Mesh Import
                        </p>
                        <p className="text-[11px] text-stone-600 mt-0.5">
                          Your articulated walking model is active now. You can also import your exported <span className="font-mono">.glb</span> file from Tripo Studio anytime.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowRefVideo((v) => !v)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-stone-300 text-xs font-medium text-stone-800 hover:border-stone-500 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Play className="w-3 h-3 text-[#8A5A2B]" />
                        {showRefVideo ? 'Hide 360° Clip' : 'View 360° Reference'}
                      </button>
                    </div>

                    {showRefVideo && (
                      <div className="bg-[#181512] border border-stone-300 overflow-hidden">
                        <video
                          src={ABID_SIGNATURE_VIDEO_URL}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full max-h-56 object-contain mx-auto"
                        />
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2.5">
                      <input
                        ref={glbInputRef}
                        type="file"
                        accept=".glb"
                        onChange={handleGlbFilePicked}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={glbBusy}
                        onClick={() => glbInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1C1917] text-[#F7F5F0] text-xs font-medium hover:bg-stone-800 transition-colors cursor-pointer disabled:opacity-60"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {glbBusy
                          ? 'Loading .GLB...'
                          : customGlbName
                            ? 'Replace Tripo .GLB'
                            : 'Import Exported Tripo .GLB'}
                      </button>

                      {customGlbName && (
                        <button
                          type="button"
                          onClick={() => void onClearCustomGlb()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-300 text-stone-800 text-xs font-medium hover:border-stone-500 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Use Articulated Model
                        </button>
                      )}

                      <a
                        href={ABID_TRIPO_SOURCE_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[#8A5A2B] hover:text-[#66401B] underline underline-offset-4 ml-auto"
                      >
                        Tripo Model Page
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    {glbError && (
                      <p className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2">
                        {glbError}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-mono text-[#8A5A2B] tracking-wider mb-1">
                      STEP 01 · PERSONALIZE YOUR 3D VISITOR
                    </p>
                    <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-stone-900 leading-[1.08] text-balance">
                      Craft your avatar before entering the gallery
                    </h1>
                    <p className="text-sm text-stone-600 mt-2 leading-relaxed max-w-xl">
                      Select Man or Woman proportions, customize your hair, attire, and accessories, then walk through your expanding 3D art museum or visit shared collections.
                    </p>
                  </div>

                  {/* Gender & Display Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <span className="block text-xs font-medium text-stone-700 mb-1.5">
                        3D Model Silhouette
                      </span>
                      <div
                        className="grid grid-cols-2 gap-1.5 p-1 bg-[#F3EFE8] border border-stone-200"
                        role="group"
                        aria-label="Choose avatar gender"
                      >
                        <button
                          type="button"
                          onClick={() => handleGenderSwitch('man')}
                          aria-pressed={avatar.gender === 'man'}
                          className={`py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                            avatar.gender === 'man'
                              ? 'bg-[#1C1917] text-[#F7F5F0]'
                              : 'text-stone-700 hover:text-stone-950'
                          }`}
                        >
                          Man Model
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGenderSwitch('woman')}
                          aria-pressed={avatar.gender === 'woman'}
                          className={`py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                            avatar.gender === 'woman'
                              ? 'bg-[#1C1917] text-[#F7F5F0]'
                              : 'text-stone-700 hover:text-stone-950'
                          }`}
                        >
                          Woman Model
                        </button>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="avatar-display-name"
                        className="block text-xs font-medium text-stone-700 mb-1.5"
                      >
                        Visitor Nameplate
                      </label>
                      <input
                        id="avatar-display-name"
                        type="text"
                        maxLength={80}
                        value={avatar.displayName}
                        onChange={(e) =>
                          onChangeAvatar({ ...avatar, displayName: e.target.value })
                        }
                        placeholder="Your name in the museum"
                        className="w-full px-3 py-2 bg-[#FAF8F4] border border-stone-300 text-sm text-stone-900 focus:outline-none focus:border-[#8A5A2B]"
                      />
                    </div>
                  </div>

                  {/* Hair Style & Attire Style */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <span className="block text-xs font-medium text-stone-700 mb-1.5">
                        Hair Style
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {hairOptions.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => onChangeAvatar({ ...avatar, hairStyle: opt.id })}
                            className={`px-2.5 py-1.5 text-xs border text-left transition-colors cursor-pointer truncate ${
                              avatar.hairStyle === opt.id
                                ? 'border-[#8A5A2B] bg-[#F5EFE6] text-stone-900 font-medium'
                                : 'border-stone-200 bg-[#FAF8F4] text-stone-600 hover:border-stone-400'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="block text-xs font-medium text-stone-700 mb-1.5">
                        Gallery Attire
                      </span>
                      <div className="grid grid-cols-1 gap-1.5">
                        {outfitOptions.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => onChangeAvatar({ ...avatar, outfitStyle: opt.id })}
                            className={`px-3 py-1.5 text-xs border text-left transition-colors cursor-pointer ${
                              avatar.outfitStyle === opt.id
                                ? 'border-[#8A5A2B] bg-[#F5EFE6] text-stone-900 font-medium'
                                : 'border-stone-200 bg-[#FAF8F4] text-stone-600 hover:border-stone-400'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Color Swatches: Skin, Hair, Outfit, Accent */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <span className="block text-xs font-medium text-stone-700 mb-1.5">
                        Skin Tone
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {SKIN_TONES.map((tone) => (
                          <button
                            key={tone.hex}
                            type="button"
                            onClick={() => onChangeAvatar({ ...avatar, skinTone: tone.hex })}
                            aria-label={`Skin tone ${tone.label}`}
                            className={`w-6 h-6 border transition-transform cursor-pointer ${
                              avatar.skinTone === tone.hex
                                ? 'border-stone-950 scale-110 ring-2 ring-[#8A5A2B]/40'
                                : 'border-stone-300 hover:scale-105'
                            }`}
                            style={{ backgroundColor: tone.hex }}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="block text-xs font-medium text-stone-700 mb-1.5">
                        Hair Color
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {HAIR_COLORS.map((c) => (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => onChangeAvatar({ ...avatar, hairColor: c.hex })}
                            aria-label={`Hair color ${c.label}`}
                            className={`w-6 h-6 border transition-transform cursor-pointer ${
                              avatar.hairColor === c.hex
                                ? 'border-stone-950 scale-110 ring-2 ring-[#8A5A2B]/40'
                                : 'border-stone-300 hover:scale-105'
                            }`}
                            style={{ backgroundColor: c.hex }}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="block text-xs font-medium text-stone-700 mb-1.5">
                        Primary Wardrobe Color
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {OUTFIT_COLORS.map((c) => (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => onChangeAvatar({ ...avatar, outfitColor: c.hex })}
                            aria-label={`Outfit color ${c.label}`}
                            className={`w-6 h-6 border transition-transform cursor-pointer ${
                              avatar.outfitColor === c.hex
                                ? 'border-stone-950 scale-110 ring-2 ring-[#8A5A2B]/40'
                                : 'border-stone-300 hover:scale-105'
                            }`}
                            style={{ backgroundColor: c.hex }}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="block text-xs font-medium text-stone-700 mb-1.5">
                        Accent & Trim
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {ACCENT_COLORS.map((c) => (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => onChangeAvatar({ ...avatar, accentColor: c.hex })}
                            aria-label={`Accent color ${c.label}`}
                            className={`w-6 h-6 border transition-transform cursor-pointer ${
                              avatar.accentColor === c.hex
                                ? 'border-stone-950 scale-110 ring-2 ring-[#8A5A2B]/40'
                                : 'border-stone-300 hover:scale-105'
                            }`}
                            style={{ backgroundColor: c.hex }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Accessories */}
                  <div>
                    <span className="block text-xs font-medium text-stone-700 mb-1.5">
                      Accessory
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {ACCESSORIES.map((acc) => (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() =>
                            onChangeAvatar({ ...avatar, accessory: acc.id as AccessoryType })
                          }
                          className={`px-3 py-1.5 text-xs border transition-colors cursor-pointer whitespace-nowrap ${
                            avatar.accessory === acc.id
                              ? 'border-[#8A5A2B] bg-[#F5EFE6] text-stone-900 font-medium'
                              : 'border-stone-200 bg-[#FAF8F4] text-stone-600 hover:border-stone-400'
                          }`}
                        >
                          {acc.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Primary Enter Museum Action */}
              <div className="mt-5 pt-4 border-t border-stone-200 flex flex-wrap items-center justify-between gap-4">
                <div className="text-xs text-stone-500">
                  Entering <span className="font-medium text-stone-800">{museum.title}</span> as{' '}
                  <span className="font-medium text-stone-800">
                    {isExclusiveAbid
                      ? 'Exclusive 3D Model'
                      : avatar.gender === 'woman'
                        ? 'Woman'
                        : 'Man'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onEnterMuseum}
                  className="inline-flex items-center gap-2.5 px-6 py-2.5 bg-[#8A5A2B] text-white text-sm font-medium hover:bg-[#734922] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Enter 3D Museum
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* 4-Column Architectural Summary Strip below the Hero Split */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-8 border-t border-stone-200">
            <div>
              <p className="text-xs text-stone-500">Curated Works</p>
              <p className="font-editorial text-3xl font-semibold text-stone-900 tabular-nums mt-1">
                {artworks.length}
              </p>
              <p className="text-xs text-stone-500 mt-0.5">Framed across gallery walls</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Architectural Rooms</p>
              <p className="font-editorial text-3xl font-semibold text-stone-900 tabular-nums mt-1">
                {layout.roomCount} {layout.roomCount === 1 ? 'Room' : 'Rooms'}
              </p>
              <p className="text-xs text-stone-500 mt-0.5">
                8 walls per room · new room spawns automatically
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Authorized Visitors</p>
              <p className="font-editorial text-3xl font-semibold text-stone-900 tabular-nums mt-1">
                {members.length + 1}
              </p>
              <p className="text-xs text-stone-500 mt-0.5">
                Private by default · gender-matched 3D avatars
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Gallery Capacity</p>
              <p className="font-editorial text-3xl font-semibold text-stone-900 tabular-nums mt-1">
                {layout.totalWallSlots} Walls
              </p>
              <p className="text-xs text-stone-500 mt-0.5">
                Unique room shapes, doors &amp; floral vases
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 2: Exhibition Collection Preview (Date-Sorted) */}
        <section id="collection" className="bg-[#EFECE6] border-t border-b border-stone-200 py-14">
          <div className="max-w-[1320px] mx-auto px-5 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
              <div>
                <p className="text-xs font-mono text-[#8A5A2B] tracking-wider mb-1.5">
                  CURATED ARCHIVE · CHRONOLOGICAL ORDER
                </p>
                <h2 className="font-editorial text-3xl sm:text-4xl font-semibold text-stone-900">
                  Recent Works on the Gallery Walls
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onOpenUpload}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1C1917] text-[#F7F5F0] text-xs font-medium hover:bg-stone-800 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Artwork
                </button>
                <button
                  type="button"
                  onClick={onOpenCatalog}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-stone-300 text-stone-900 text-xs font-medium hover:border-stone-500 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <FolderKanban className="w-3.5 h-3.5 text-[#8A5A2B]" />
                  View All Sorted by Date ({artworks.length})
                </button>
              </div>
            </div>

            {recentArtworks.length === 0 ? (
              <div className="bg-white border border-stone-200 p-10 text-center">
                <p className="font-editorial text-2xl font-semibold text-stone-900 mb-2">
                  Your private gallery is ready for your first artwork
                </p>
                <p className="text-sm text-stone-600 max-w-lg mx-auto mb-5">
                  Every signed-in account has its own private Firebase museum. Upload photos to fill Room I (8 walls) — adding a 9th artwork automatically builds Room II with a connecting door.
                </p>
                <button
                  type="button"
                  onClick={onOpenUpload}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#8A5A2B] text-white text-xs font-medium hover:bg-[#734922] transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Upload First Artwork
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {recentArtworks.map((work) => {
                  const slotIdx = artworks.findIndex((a) => a.id === work.id);
                  return (
                    <article
                      key={work.id}
                      className="bg-white border border-stone-200 flex flex-col overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => onInspectArtwork(work, Math.max(0, slotIdx))}
                        className="aspect-[4/3] bg-stone-200 overflow-hidden text-left cursor-pointer group"
                      >
                        <img
                          src={work.imageUrl}
                          alt={work.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                        />
                      </button>
                      <div className="p-4 flex-1 flex flex-col">
                        <p className="text-xs font-mono text-stone-500 tabular-nums flex items-center gap-1.5 mb-1">
                          <Calendar className="w-3 h-3 text-[#8A5A2B]" />
                          {formatArchivalDate(work.dateCaptured)}
                        </p>
                        <h3 className="font-editorial text-xl font-semibold text-stone-900 leading-snug">
                          {work.title}
                        </h3>
                        <p className="text-xs text-stone-600 mt-1">{work.artist}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* SECTION 3: Shared Access & Multi-Museum Switching */}
        <section id="shared-access" className="max-w-[1320px] mx-auto px-5 sm:px-8 py-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5">
              <p className="text-xs font-mono text-[#8A5A2B] tracking-wider mb-1.5">
                SHARED EXHIBITIONS · COLLABORATIVE VISITS
              </p>
              <h2 className="font-editorial text-3xl sm:text-4xl font-semibold text-stone-900 mb-3 text-balance">
                Invite companions to walk your museum together
              </h2>
              <p className="text-sm text-stone-600 leading-relaxed mb-6">
                Grant private access by email or share your gallery code. Each visitor enters with their chosen Man or Woman 3D model, exploring your framed photographs and paintings side by side.
              </p>
              <button
                type="button"
                onClick={onOpenAccess}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1C1917] text-[#F7F5F0] text-xs font-medium hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <Users className="w-4 h-4" />
                Manage Access & Join Museum
              </button>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {accessibleMuseums.map((m) => {
                const isActive = m.id === museum.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSwitchMuseum(m.id)}
                    className={`p-5 border text-left transition-colors cursor-pointer ${
                      isActive
                        ? 'border-[#8A5A2B] bg-white'
                        : 'border-stone-200 bg-[#FAF8F4] hover:border-stone-400'
                    }`}
                  >
                    <p className="text-xs font-mono text-[#8A5A2B] tabular-nums mb-1">
                      {isActive ? 'ACTIVE GALLERY' : 'AVAILABLE GALLERY'} · {m.accessCode}
                    </p>
                    <h3 className="font-editorial text-2xl font-semibold text-stone-900">
                      {m.title}
                    </h3>
                    <p className="text-xs text-stone-600 mt-1">
                      Curated by {m.ownerName}
                    </p>
                  </button>
                );
              })}

              <div className="p-5 border border-dashed border-stone-300 bg-[#FAF8F4] flex flex-col justify-between">
                <div>
                  <p className="text-xs font-mono text-stone-500 mb-1">AUTHORIZED ROSTER</p>
                  <p className="font-editorial text-2xl font-semibold text-stone-900">
                    {members.length} Invited {members.length === 1 ? 'Visitor' : 'Visitors'}
                  </p>
                  <p className="text-xs text-stone-600 mt-1">
                    {members.length > 0
                      ? members.map((m) => `${m.displayName} (${m.gender === 'woman' ? 'Woman' : 'Man'})`).join(' · ')
                      : 'Invite friends by email or share your code.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenAccess}
                  className="mt-4 text-xs font-medium text-[#8A5A2B] hover:text-[#66401B] text-left cursor-pointer"
                >
                  Add or manage visitors →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: Architectural Guide */}
        <section id="architecture" className="border-t border-stone-200 bg-[#FAF8F4] py-12">
          <div className="max-w-[1320px] mx-auto px-5 sm:px-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <p className="text-xs font-mono text-[#8A5A2B] mb-2">01 · MULTI-ROOM ARCHITECTURE</p>
              <h3 className="font-editorial text-2xl font-semibold text-stone-900 mb-2">
                8 walls per room, new rooms auto-built
              </h3>
              <p className="text-sm text-stone-600 leading-relaxed">
                Each museum room holds 8 framed walls with its own unique architectural shape and floral vase centerpiece. Exceeding 8 artworks automatically creates a new connected room.
              </p>
            </div>
            <div>
              <p className="text-xs font-mono text-[#8A5A2B] mb-2">02 · DOORS &amp; CUSTOM SIGNBOARDS</p>
              <h3 className="font-editorial text-2xl font-semibold text-stone-900 mb-2">
                Open doors &amp; name every room
              </h3>
              <p className="text-sm text-stone-600 leading-relaxed">
                Press F or Space (or click) near any connecting double door to swing it open and walk into the next room. Click the gilded signboard above any doorway to give that room a custom name.
              </p>
            </div>
            <div>
              <p className="text-xs font-mono text-[#8A5A2B] mb-2">03 · PRIVATE CLOUD ISOLATION</p>
              <h3 className="font-editorial text-2xl font-semibold text-stone-900 mb-2">
                Your own private gallery account
              </h3>
              <p className="text-sm text-stone-600 leading-relaxed">
                Sign in with Google so every uploaded artwork and room name saves strictly to your personal Firebase account. Nobody else sees your museum unless you invite them.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200 bg-[#F7F5F0] py-6">
        <div className="max-w-[1320px] mx-auto px-5 sm:px-8 flex flex-wrap items-center justify-between gap-4 text-xs text-stone-500">
          <span className="font-editorial text-base text-stone-800">My Museum</span>
          <span>3D Architectural Gallery · Personal & Shared Exhibitions</span>
        </div>
      </footer>
    </div>
  );
}
