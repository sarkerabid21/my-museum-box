# My Museum — Firestore Security Specification (Phase 0)

## Data Invariants
1. **User Privacy (PII Isolation)**: `/users/{userId}` stores email and avatar configuration; only `request.auth.uid == userId` may read or write it. Collection listing is forbidden.
2. **Museum Ownership**: Only a verified authenticated user can create a museum with `ownerId == request.auth.uid`. `ownerId` and `createdAt` are immutable.
3. **Subcollection Master Gate**: Every document in `artworks`, `members`, and `presence` must belong to an existing parent `/museums/{museumId}` and carry matching `museumId` and `ownerId`.
4. **Access Revocation**: Removing an email from `/museums/{museumId}.memberEmails` immediately revokes single-document reads and subcollection writes via the parent `get()` gate.
5. **Bounded Arrays**: `memberEmails` and `viewerEmails` are strictly capped at 10 strings (each <= 160 chars).
6. **Strict Timestamps**: All `createdAt` and `updatedAt` fields must equal `request.time`.

## The Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Identity Spoofing on User Profile**: Creating `/users/alice` while authenticated as `bob` with `{ uid: "alice", ... }`.
2. **Shadow Field Injection on User Profile**: Updating `/users/alice` with an extra ghost field `{ isAdmin: true }`.
3. **Unverified Email Write**: Creating a museum when `request.auth.token.email_verified == false`.
4. **Oversized Document ID Poisoning**: Creating `/museums/<200-char-id>` or `/museums/bad$id`.
5. **Owner Hijack on Update**: Updating `/museums/m1` to change `ownerId` to another UID.
6. **Unbounded Array Denial-of-Wallet**: Updating `/museums/m1` with `memberEmails` containing 15 entries.
7. **Orphaned Artwork Write**: Creating `/museums/nonexistent/artworks/a1`.
8. **Unauthorized Visitor Artwork Deletion**: An invited `visitor` attempting to delete `/museums/m1/artworks/a1`.
9. **Spoofed Timestamp**: Creating an artwork with a client-forged past `createdAt` timestamp (`!= request.time`).
10. **PII Leak Attempt**: Authenticated user `bob` attempting `get` or `list` on `/users/alice` or `/museums/m1/members` when not owner/invited.
11. **Presence Hijack**: Authenticated user `bob` writing to `/museums/m1/presence/alice`.
12. **Blanket Query Scraping**: Running an unfiltered `list` on `/museums` or `/museumCodes` as an uninvited user.
