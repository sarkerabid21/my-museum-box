import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { Museum3DView } from './Museum3DView';
import { createSeedMuseum, createSeedArtworks, createSeedMembers } from '../data/seedMuseum';
import { DEFAULT_AVATAR_BY_GENDER } from '../types/museum';

describe('Museum3DView SSR render', () => {
  it('renders without throwing', () => {
    const museum = createSeedMuseum('guest', 'Julian Vance');
    const artworks = createSeedArtworks('museum-guest', 'guest', 'Julian Vance');
    const members = createSeedMembers('museum-guest', 'guest');
    const avatar = DEFAULT_AVATAR_BY_GENDER.man;

    const html = ReactDOMServer.renderToString(
      React.createElement(Museum3DView, {
        museum,
        avatar,
        artworks,
        members,
        liveVisitors: [],
        showInvitedIn3D: true,
        canCurate: true,
        canRenameRooms: true,
        teleportTargetId: null,
        onClearTeleport: () => {},
        onSelectArtwork: () => {},
        onRequestRenameRoom: () => {},
        onNotify: () => {},
        onOpenCatalog: () => {},
        onOpenUpload: () => {},
        onOpenAccess: () => {},
        onReturnHome: () => {},
        onChangeWallTheme: () => {},
        onPositionBroadcast: () => {},
        onPresenceOffline: () => {},
        isPaused: false,
      })
    );

    assert.ok(html.includes('data-testid="museum-3d-view"'));
    assert.ok(html.includes('Amusement Park'));
  });
});
