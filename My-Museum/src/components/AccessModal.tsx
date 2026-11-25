import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  KeyRound,
  Link2,
  Mail,
  Send,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { Gender, MemberRole, MuseumMember, MuseumMeta } from '../types/museum';
import { validateAccessGrant } from '../museum/layout';
import {
  buildMuseumInvitationEmail,
  buildMuseumInviteUrl,
} from '../services/gmailService';

export interface InviteEmailDraft {
  email: string;
  displayName: string;
  role: MemberRole;
  gender: Gender;
  personalNote: string;
  alreadyMember: boolean;
}

interface AccessModalProps {
  open: boolean;
  onClose: () => void;
  museum: MuseumMeta;
  isOwner: boolean;
  isSignedIn: boolean;
  inviteBaseUrl: string;
  members: MuseumMember[];
  accessibleMuseums: MuseumMeta[];
  showInvitedIn3D: boolean;
  onToggleShowInvitedIn3D: (next: boolean) => void;
  onSignInGoogle: () => void;
  onGrantAccess: (input: {
    email: string;
    displayName: string;
    role: MemberRole;
    gender: Gender;
  }) => Promise<void> | void;
  onSendInviteEmail: (input: InviteEmailDraft) => Promise<void>;
  onRevokeAccess: (member: MuseumMember) => Promise<void> | void;
  onToggleOpenByCode: (isOpen: boolean) => Promise<void> | void;
  onJoinByCode: (code: string) => Promise<string | null>;
  onSwitchMuseum: (museumId: string) => void;
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

export function AccessModal({
  open,
  onClose,
  museum,
  isOwner,
  isSignedIn,
  inviteBaseUrl,
  members,
  accessibleMuseums,
  showInvitedIn3D,
  onToggleShowInvitedIn3D,
  onSignInGoogle,
  onGrantAccess,
  onSendInviteEmail,
  onRevokeAccess,
  onToggleOpenByCode,
  onJoinByCode,
  onSwitchMuseum,
}: AccessModalProps) {
  const [tab, setTab] = useState<'share' | 'join'>('share');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<MemberRole>('visitor');
  const [gender, setGender] = useState<Gender>('woman');
  const [personalNote, setPersonalNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [busy, setBusy] = useState(false);

  // Explicit user-confirmation preview state before sending any Gmail message
  const [pendingDraft, setPendingDraft] = useState<InviteEmailDraft | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const directInviteUrl = useMemo(
    () =>
      buildMuseumInviteUrl(inviteBaseUrl, {
        museumId: museum.id,
        accessCode: museum.accessCode,
        museumTitle: museum.title,
        hostName: museum.ownerName,
      }),
    [inviteBaseUrl, museum.id, museum.accessCode, museum.title, museum.ownerName]
  );

  const previewEmail = useMemo(() => {
    if (!pendingDraft) return null;
    return buildMuseumInvitationEmail({
      recipientEmail: pendingDraft.email,
      recipientName: pendingDraft.displayName,
      hostName: museum.ownerName,
      museumTitle: museum.title,
      museumId: museum.id,
      accessCode: museum.accessCode,
      role: pendingDraft.role,
      gender: pendingDraft.gender,
      inviteUrl: directInviteUrl,
      personalNote: pendingDraft.personalNote,
    });
  }, [pendingDraft, museum, directInviteUrl]);

  if (!open) return null;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(museum.accessCode);
    } catch {
      // Clipboard fallback ignored
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(directInviteUrl);
    } catch {
      // Clipboard fallback ignored
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const validateNewVisitor = () => {
    const validation = validateAccessGrant({
      email,
      displayName,
      role,
      gender,
      existingEmails: members.map((m) => m.email),
    });
    if (!validation.valid) {
      setErrors(validation.errors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handlePreviewInviteEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateNewVisitor()) return;
    setSendError(null);
    setPendingDraft({
      email: email.trim().toLowerCase(),
      displayName: displayName.trim(),
      role,
      gender,
      personalNote: personalNote.trim(),
      alreadyMember: false,
    });
  };

  const handleGrantOnly = async (draftOverride?: InviteEmailDraft) => {
    const target = draftOverride ?? {
      email: email.trim().toLowerCase(),
      displayName: displayName.trim(),
      role,
      gender,
      personalNote: personalNote.trim(),
      alreadyMember: false,
    };

    if (!draftOverride && !validateNewVisitor()) return;

    setBusy(true);
    setSendError(null);
    try {
      await onGrantAccess({
        email: target.email,
        displayName: target.displayName,
        role: target.role,
        gender: target.gender,
      });
      setEmail('');
      setDisplayName('');
      setPersonalNote('');
      setErrors({});
      setPendingDraft(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to grant access.';
      if (draftOverride) {
        setSendError(msg);
      } else {
        setErrors({ form: msg });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmSendEmail = async () => {
    if (!pendingDraft) return;
    setBusy(true);
    setSendError(null);
    try {
      await onSendInviteEmail(pendingDraft);
      if (!pendingDraft.alreadyMember) {
        setEmail('');
        setDisplayName('');
        setPersonalNote('');
      }
      setErrors({});
      setPendingDraft(null);
    } catch (err) {
      setSendError(
        err instanceof Error
          ? err.message
          : 'Could not send the invitation email. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleOpenResendPreview = (member: MuseumMember) => {
    setSendError(null);
    setPendingDraft({
      email: member.email,
      displayName: member.displayName,
      role: member.role,
      gender: member.gender,
      personalNote: '',
      alreadyMember: true,
    });
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCode.trim().toUpperCase();
    if (cleaned.length < 4) {
      setJoinError('Enter a valid museum access code (e.g., MUS-742A).');
      return;
    }
    setBusy(true);
    setJoinError('');
    try {
      const errorMsg = await onJoinByCode(cleaned);
      if (errorMsg) {
        setJoinError(errorMsg);
      } else {
        setJoinCode('');
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/65"
      role="dialog"
      aria-modal="true"
      aria-label="Museum Access and Shared Visitors"
    >
      <div className="bg-[#FAF8F4] text-[#1C1917] w-full max-w-xl max-h-[92vh] overflow-y-auto border border-stone-300 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-mono text-[#8A5A2B] tracking-wider mb-1">
              {pendingDraft
                ? 'CONFIRM GMAIL INVITATION · REVIEW BEFORE SENDING'
                : 'MULTI-VISITOR ACCESS · GMAIL INVITATIONS'}
            </p>
            <h2 className="text-2xl font-editorial font-semibold text-stone-900">
              {pendingDraft ? 'Confirm & Send Museum Invitation' : 'Share & Visit Museums'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setPendingDraft(null);
              setSendError(null);
              onClose();
            }}
            aria-label="Close access dialog"
            className="p-2 text-stone-500 hover:text-stone-900 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MANDATORY EXPLICIT CONFIRMATION STEP BEFORE SENDING GMAIL */}
        {pendingDraft && previewEmail ? (
          <div className="p-6 space-y-5" data-testid="invite-email-confirmation">
            <div className="bg-white border border-stone-200 p-4 space-y-2.5 text-xs">
              <div className="flex items-start justify-between gap-4">
                <span className="text-stone-500 shrink-0 w-24">Recipient</span>
                <span className="font-medium text-stone-900 text-right break-all">
                  {pendingDraft.displayName} &lt;{previewEmail.to}&gt;
                </span>
              </div>
              <div className="flex items-start justify-between gap-4 border-t border-stone-100 pt-2">
                <span className="text-stone-500 shrink-0 w-24">Subject</span>
                <span className="font-medium text-stone-900 text-right">
                  {previewEmail.subject}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4 border-t border-stone-100 pt-2">
                <span className="text-stone-500 shrink-0 w-24">Access Link</span>
                <span className="font-mono text-[11px] text-[#8A5A2B] text-right break-all">
                  {directInviteUrl}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4 border-t border-stone-100 pt-2">
                <span className="text-stone-500 shrink-0 w-24">Pass Code</span>
                <span className="font-mono font-semibold text-stone-900 tracking-wider">
                  {museum.accessCode}
                </span>
              </div>
            </div>

            {/* Visual Preview of the Editorial Invitation Email */}
            <div className="border border-stone-300 bg-[#F4F0E8] p-3">
              <p className="text-[11px] font-mono text-stone-500 uppercase tracking-wider mb-2">
                Email Preview Sent to {pendingDraft.displayName}
              </p>
              <div className="bg-[#FAF8F4] border border-stone-300 overflow-hidden shadow-sm">
                <div className="bg-[#181512] px-5 py-4 border-b-2 border-[#C99A5B] text-center">
                  <p className="text-[10px] font-mono tracking-[0.2em] text-[#D9B37C] uppercase">
                    MY MUSEUM · PRIVATE EXHIBITION PASS
                  </p>
                  <p className="font-editorial text-xl font-semibold text-[#FAF6EE] mt-0.5">
                    {museum.title}
                  </p>
                </div>
                <div className="p-4 space-y-3 text-xs text-stone-700">
                  <p>
                    Dear <strong className="text-stone-900">{pendingDraft.displayName}</strong>,
                  </p>
                  <p className="leading-relaxed">
                    <strong className="text-stone-900">{museum.ownerName}</strong> has personally invited you to step inside their private 3D architectural gallery,{' '}
                    <strong className="text-stone-900">{museum.title}</strong>.
                  </p>
                  {pendingDraft.personalNote && (
                    <div className="bg-[#F3EEE5] border-l-2 border-[#8A5A2B] px-3 py-2 italic text-stone-700">
                      &ldquo;{pendingDraft.personalNote}&rdquo;
                    </div>
                  )}
                  <div className="bg-white border border-stone-200 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span>
                      {pendingDraft.role === 'curator' ? 'Co-Curator' : 'Private Visitor'} ·{' '}
                      {pendingDraft.gender === 'woman' ? 'Woman 3D Model' : 'Man 3D Model'}
                    </span>
                    <span className="font-mono font-semibold text-[#8A5A2B]">
                      {museum.accessCode}
                    </span>
                  </div>
                  <div className="text-center pt-1">
                    <span className="inline-block px-4 py-2 bg-[#8A5A2B] text-white text-xs font-medium">
                      Enter {museum.title} →
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Optional note input when re-sending to an existing member */}
            {pendingDraft.alreadyMember && (
              <div>
                <label
                  htmlFor="resend-personal-note"
                  className="block text-xs font-medium text-stone-700 mb-1"
                >
                  Optional Personal Message
                </label>
                <input
                  id="resend-personal-note"
                  type="text"
                  maxLength={300}
                  value={pendingDraft.personalNote}
                  onChange={(e) =>
                    setPendingDraft({ ...pendingDraft, personalNote: e.target.value })
                  }
                  placeholder="Add a warm note for your visitor..."
                  className="w-full px-3 py-2 bg-white border border-stone-300 text-xs focus:outline-none focus:border-[#8A5A2B]"
                />
              </div>
            )}

            {sendError && (
              <div
                role="alert"
                className="p-3 bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed"
              >
                {sendError}
              </div>
            )}

            {!isSignedIn ? (
              <div className="p-4 bg-[#F3ECE2] border border-[#C99A5B]/60 space-y-3">
                <p className="text-xs text-stone-800 leading-relaxed">
                  <strong>Sign in with Google</strong> to send this invitation directly from your Gmail account, or grant guest access locally and copy the invite link.
                </p>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onSignInGoogle}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-stone-300 text-stone-900 text-xs font-medium hover:border-stone-500 transition-colors cursor-pointer"
                  >
                    <GoogleGIcon className="w-4 h-4" />
                    Sign in with Google
                  </button>
                  {!pendingDraft.alreadyMember && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleGrantOnly(pendingDraft)}
                      className="px-4 py-2 bg-[#1C1917] text-[#F7F5F0] text-xs font-medium hover:bg-stone-800 disabled:opacity-50 cursor-pointer"
                    >
                      Grant Access Only (Guest)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setPendingDraft(null);
                      setSendError(null);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs text-stone-600 hover:text-stone-900 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 pt-1">
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  By confirming, My Museum will{' '}
                  {pendingDraft.alreadyMember
                    ? 'email the private entry link'
                    : 'grant gallery access and send this email'}{' '}
                  to <strong>{previewEmail.to}</strong> using your Gmail account (Google will prompt once for Gmail sending permission if not yet granted).
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setPendingDraft(null);
                        setSendError(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-stone-300 bg-white text-stone-700 text-xs font-medium hover:border-stone-500 disabled:opacity-50 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                    {!pendingDraft.alreadyMember && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleGrantOnly(pendingDraft)}
                        className="px-3.5 py-2 border border-stone-300 bg-[#F4F1EA] text-stone-800 text-xs font-medium hover:border-stone-500 disabled:opacity-50 cursor-pointer"
                      >
                        Grant Without Email
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleConfirmSendEmail}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#8A5A2B] text-white text-xs font-medium hover:bg-[#734922] disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {busy ? 'Sending via Gmail...' : 'Confirm & Send Invitation Email'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Tab Bar */}
            <div className="px-6 pt-4 border-b border-stone-200 flex gap-6 bg-[#F4F1EA]">
              <button
                type="button"
                onClick={() => setTab('share')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  tab === 'share'
                    ? 'border-[#8A5A2B] text-stone-900'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                Invite &amp; Grant Access
              </button>
              <button
                type="button"
                onClick={() => setTab('join')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  tab === 'join'
                    ? 'border-[#8A5A2B] text-stone-900'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                Enter Shared Museum ({accessibleMuseums.length})
              </button>
            </div>

            {tab === 'share' ? (
              <div className="p-6 space-y-6">
                {/* Access Code & Direct Invite Link Box */}
                <div className="p-4 bg-white border border-stone-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-stone-500 mb-0.5">Museum Pass Code &amp; Link</p>
                      <p className="text-lg font-mono font-semibold text-stone-900 tracking-widest tabular-nums">
                        {museum.accessCode}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#8A5A2B] text-white text-xs font-medium hover:bg-[#734922] transition-colors cursor-pointer"
                      >
                        {copiedLink ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Link2 className="w-3.5 h-3.5" />
                        )}
                        {copiedLink ? 'Link Copied' : 'Copy Invite Link'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1C1917] text-[#F7F5F0] text-xs font-medium hover:bg-stone-800 transition-colors cursor-pointer"
                      >
                        {copiedCode ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        {copiedCode ? 'Copied' : 'Copy Code'}
                      </button>
                    </div>
                  </div>
                  {isOwner && (
                    <div className="pt-2.5 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-600">
                      <span>Private by default — only invited emails can unlock your museum.</span>
                      <label className="inline-flex items-center gap-2 text-stone-700 cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={museum.isOpenByCode}
                          onChange={(e) => onToggleOpenByCode(e.target.checked)}
                          className="accent-[#8A5A2B] w-4 h-4"
                        />
                        Allow open code entry
                      </label>
                    </div>
                  )}
                </div>

                {/* Invite Visitor by Email Form */}
                {isOwner && (
                  <form onSubmit={handlePreviewInviteEmail} className="space-y-4" noValidate>
                    <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                      <UserPlus className="w-4 h-4 text-[#8A5A2B]" />
                      <span>Send Private Email Invitation</span>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed">
                      Enter a visitor&apos;s email to grant access and send a styled museum invitation email containing a direct link into <strong>{museum.title}</strong>.
                    </p>

                    {errors.form && (
                      <p className="text-xs text-red-700" role="alert">
                        {errors.form}
                      </p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="grant-name"
                          className="block text-xs font-medium text-stone-700 mb-1"
                        >
                          Visitor Name
                        </label>
                        <input
                          id="grant-name"
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="e.g., Nadia Rahman"
                          className="w-full px-3 py-2 bg-white border border-stone-300 text-sm focus:outline-none focus:border-[#8A5A2B]"
                        />
                        {errors.displayName && (
                          <p className="text-xs text-red-700 mt-1" role="alert">
                            {errors.displayName}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="grant-email"
                          className="block text-xs font-medium text-stone-700 mb-1"
                        >
                          Email Address
                        </label>
                        <input
                          id="grant-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="visitor@gmail.com"
                          className="w-full px-3 py-2 bg-white border border-stone-300 text-sm focus:outline-none focus:border-[#8A5A2B]"
                        />
                        {errors.email && (
                          <p className="text-xs text-red-700 mt-1" role="alert">
                            {errors.email}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="block text-xs font-medium text-stone-700 mb-1">
                          3D Avatar Gender
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(['man', 'woman'] as Gender[]).map((g) => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => setGender(g)}
                              className={`py-2 text-xs font-medium border transition-colors cursor-pointer ${
                                gender === g
                                  ? 'border-[#8A5A2B] bg-[#F3ECE2] text-stone-900'
                                  : 'border-stone-300 bg-white text-stone-600 hover:border-stone-400'
                              }`}
                            >
                              {g === 'man' ? 'Man Model' : 'Woman Model'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="block text-xs font-medium text-stone-700 mb-1">
                          Permission Level
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(['visitor', 'curator'] as MemberRole[]).map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => setRole(r)}
                              className={`py-2 text-xs font-medium border transition-colors cursor-pointer ${
                                role === r
                                  ? 'border-[#8A5A2B] bg-[#F3ECE2] text-stone-900'
                                  : 'border-stone-300 bg-white text-stone-600 hover:border-stone-400'
                              }`}
                            >
                              {r === 'visitor' ? 'Visitor (View)' : 'Co-Curator (Add)'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="grant-note"
                        className="block text-xs font-medium text-stone-700 mb-1"
                      >
                        Personal Invitation Note (Optional)
                      </label>
                      <textarea
                        id="grant-note"
                        rows={2}
                        maxLength={300}
                        value={personalNote}
                        onChange={(e) => setPersonalNote(e.target.value)}
                        placeholder="e.g., Come explore my new Room II exhibition!"
                        className="w-full px-3 py-2 bg-white border border-stone-300 text-xs focus:outline-none focus:border-[#8A5A2B] resize-none"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="submit"
                        disabled={busy}
                        className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-[#8A5A2B] text-white text-sm font-medium hover:bg-[#734922] disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        <Mail className="w-4 h-4" />
                        Preview &amp; Send Email Invite
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleGrantOnly()}
                        className="py-2.5 px-3.5 bg-white border border-stone-300 text-stone-700 text-xs font-medium hover:border-stone-500 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Add Only
                      </button>
                    </div>
                  </form>
                )}

                {/* Granted Visitors Roster */}
                <div className="pt-4 border-t border-stone-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                      <Users className="w-4 h-4 text-[#8A5A2B]" />
                      <span>Authorized Visitors ({members.length})</span>
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showInvitedIn3D}
                        onChange={(e) => onToggleShowInvitedIn3D(e.target.checked)}
                        className="accent-[#8A5A2B] w-4 h-4"
                      />
                      Show invited avatars in 3D hall
                    </label>
                  </div>

                  {members.length === 0 ? (
                    <p className="text-xs text-stone-500 py-3">
                      No visitors invited yet. Send an invitation email above or copy your direct invite link so friends can explore with you.
                    </p>
                  ) : (
                    <ul
                      className="divide-y divide-stone-200 border border-stone-200 bg-white"
                      data-testid="members-list"
                    >
                      {members.map((m) => (
                        <li
                          key={m.id}
                          className="px-4 py-3 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-stone-900 truncate">
                              {m.displayName}
                            </p>
                            <p className="text-xs text-stone-500 truncate">
                              {m.email} · {m.gender === 'woman' ? 'Woman 3D Avatar' : 'Man 3D Avatar'} ·{' '}
                              {m.role === 'curator' ? 'Co-Curator' : 'Visitor'}
                            </p>
                          </div>
                          {isOwner && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenResendPreview(m)}
                                aria-label={`Send invitation email to ${m.displayName}`}
                                title="Preview & send invitation email"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-stone-200 bg-[#FAF8F4] text-stone-700 hover:border-[#8A5A2B] hover:text-[#8A5A2B] text-xs font-medium transition-colors cursor-pointer"
                              >
                                <Mail className="w-3.5 h-3.5" />
                                Email
                              </button>
                              <button
                                type="button"
                                onClick={() => onRevokeAccess(m)}
                                aria-label={`Revoke access for ${m.displayName}`}
                                className="p-1.5 text-stone-400 hover:text-red-700 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                <form onSubmit={handleJoinSubmit} className="space-y-3" noValidate>
                  <label htmlFor="join-code" className="block text-sm font-medium text-stone-900">
                    Enter a Friend&apos;s Museum Access Code
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="join-code"
                        type="text"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="MUS-742A"
                        className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 text-sm font-mono uppercase tracking-wider focus:outline-none focus:border-[#8A5A2B]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy}
                      className="px-4 py-2 bg-[#1C1917] text-[#F7F5F0] text-sm font-medium hover:bg-stone-800 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      Enter Gallery
                    </button>
                  </div>
                  {joinError && (
                    <p className="text-xs text-red-700" role="alert">
                      {joinError}
                    </p>
                  )}
                </form>

                <div className="pt-4 border-t border-stone-200 space-y-3">
                  <p className="text-sm font-semibold text-stone-900">
                    Your Museums &amp; Shared Invitations
                  </p>
                  <div className="space-y-2">
                    {accessibleMuseums.map((m) => {
                      const active = m.id === museum.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            onSwitchMuseum(m.id);
                            onClose();
                          }}
                          className={`w-full text-left p-4 border transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                            active
                              ? 'border-[#8A5A2B] bg-[#F3ECE2]'
                              : 'border-stone-200 bg-white hover:border-stone-400'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-editorial text-lg font-semibold text-stone-900 truncate">
                              {m.title}
                            </p>
                            <p className="text-xs text-stone-500">
                              Curated by {m.ownerName} · Code {m.accessCode}
                            </p>
                          </div>
                          <span className="text-xs font-medium text-[#8A5A2B] shrink-0">
                            {active ? 'Active' : 'Visit'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
