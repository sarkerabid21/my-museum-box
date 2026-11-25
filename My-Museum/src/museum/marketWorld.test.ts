import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MARKET_ITEMS,
  MARKET_BUILDING,
  computeMarketElevation,
  createMarketSession,
  negotiateMarketPrice,
  buyMarketItem,
  findNearestMarketItem,
  type MarketCategory,
} from './marketWorld';

test('Chittagong Grand Market: all 6 requested items exist on specified floors', () => {
  const expectedCategories: MarketCategory[] = ['hijab', 'borkha', 'shoes', 'watch', 'tshirt', 'pant'];
  const presentCategories = MARKET_ITEMS.map((item) => item.category);

  for (const cat of expectedCategories) {
    assert.ok(
      presentCategories.includes(cat),
      `Missing required item category: ${cat}`
    );
  }

  // Floor 1 Items: Hijab, Borkha, Shoes, Watch
  const floor1Items = MARKET_ITEMS.filter((item) => item.floor === 1);
  assert.equal(floor1Items.length, 4, 'Floor 1 must contain 4 items');
  const floor1Cats = floor1Items.map((i) => i.category);
  assert.ok(floor1Cats.includes('hijab'), 'Floor 1 must have hijab (হিজাব)');
  assert.ok(floor1Cats.includes('borkha'), 'Floor 1 must have borkha (বোরকা)');
  assert.ok(floor1Cats.includes('shoes'), 'Floor 1 must have shoes (জুতা)');
  assert.ok(floor1Cats.includes('watch'), 'Floor 1 must have watch (ঘড়ি)');

  // Floor 2 Items: T-shirt, Pant
  const floor2Items = MARKET_ITEMS.filter((item) => item.floor === 2);
  assert.equal(floor2Items.length, 2, 'Floor 2 must contain 2 items');
  const floor2Cats = floor2Items.map((i) => i.category);
  assert.ok(floor2Cats.includes('tshirt'), 'Floor 2 must have t-shirt (টি-শার্ট)');
  assert.ok(floor2Cats.includes('pant'), 'Floor 2 must have pant (প্যান্ট)');

  // All items have valid base prices and minimum prices
  for (const item of MARKET_ITEMS) {
    assert.ok(item.basePrice > 0, `${item.name} must have positive base price`);
    assert.ok(item.minPrice > 0, `${item.name} must have positive min price`);
    assert.ok(item.basePrice >= item.minPrice, `${item.name} basePrice must be >= minPrice`);
    assert.ok(item.banglaName.length > 0, `${item.name} must have Bengali name`);
    assert.ok(item.stallName.length > 0, `${item.name} must have stall name`);
    assert.ok(item.icon.length > 0, `${item.name} must have icon`);
  }
});

test('computeMarketElevation: elevation calculations for 1st floor, staircase, and 2nd floor', () => {
  // Outside market bounds
  assert.equal(computeMarketElevation(0, 0, 0), 0);
  assert.equal(computeMarketElevation(-300, 80, 0), 0);

  // Inside market - Ground floor (1st floor)
  const groundY = computeMarketElevation(-265, 80, 0.05);
  assert.equal(groundY, 0.05, '1st floor ground elevation must be 0.05m');

  // Staircase (z = 85.0 to 93.0, x between -276 and -270)
  // At stair bottom (z = 85.0)
  const stairBottom = computeMarketElevation(-273, 85.0, 0.1);
  assert.ok(Math.abs(stairBottom - 0.1) < 0.05, 'Stair bottom elevation should be near 0.1m');

  // At stair midpoint (z = 89.0)
  const stairMid = computeMarketElevation(-273, 89.0, 2.0);
  assert.ok(stairMid > 1.8 && stairMid < 2.5, `Stair midpoint should be around 2.1m, got ${stairMid}`);

  // At stair top (z = 93.0)
  const stairTop = computeMarketElevation(-273, 93.0, 4.0);
  assert.ok(Math.abs(stairTop - 4.25) < 0.05, 'Stair top elevation should be near 4.25m');

  // 2nd floor platform (when player already at y >= 2.5)
  const secondFloorY = computeMarketElevation(-265, 80, 4.25);
  assert.equal(secondFloorY, 4.25, '2nd floor upper platform must retain 4.25m elevation');
});

test('createMarketSession & negotiateMarketPrice: interactive bargaining flow', () => {
  const watchItem = MARKET_ITEMS.find((it) => it.category === 'watch')!;
  assert.ok(watchItem);

  const initialSession = createMarketSession(watchItem);
  assert.equal(initialSession.item.id, watchItem.id);
  assert.equal(initialSession.currentPrice, watchItem.basePrice);
  assert.equal(initialSession.bargainStep, 0);
  assert.equal(initialSession.canBargainMore, true);

  // First round of bargaining
  const round1 = negotiateMarketPrice(initialSession);
  assert.ok(round1.currentPrice < initialSession.currentPrice);
  assert.equal(round1.bargainStep, 1);
  assert.ok(round1.shopkeeperLine.length > 0);

  // Second round of bargaining
  const round2 = negotiateMarketPrice(round1);
  assert.ok(round2.currentPrice <= round1.currentPrice);
  assert.equal(round2.bargainStep, 2);

  // Final round of bargaining: reaches minimum floor price
  const round3 = negotiateMarketPrice(round2);
  assert.equal(round3.currentPrice, watchItem.minPrice);
  assert.equal(round3.canBargainMore, false);

  // Bargaining again after reaching bottom price does not reduce below minPrice
  const round4 = negotiateMarketPrice(round3);
  assert.equal(round4.currentPrice, watchItem.minPrice);
  assert.equal(round4.canBargainMore, false);
});

test('buyMarketItem: wallet balance deduction and insufficient funds handling', () => {
  const hijabItem = MARKET_ITEMS.find((it) => it.category === 'hijab')!;
  assert.ok(hijabItem);

  const session = createMarketSession(hijabItem);

  // Attempt purchase with insufficient funds
  const failed = buyMarketItem(session, 100);
  assert.equal(failed.ok, false);
  assert.equal(failed.nextWallet, 100);
  assert.ok(failed.message.includes('টাকা কম আছে'));

  // Successful purchase with sufficient funds
  const initialWallet = 5000;
  const success = buyMarketItem(session, initialWallet);
  assert.equal(success.ok, true);
  assert.equal(success.nextWallet, initialWallet - session.currentPrice);
  assert.ok(success.message.includes('অভিনন্দন'));
});

test('findNearestMarketItem: finds nearest stall within radius', () => {
  const tShirtItem = MARKET_ITEMS.find((it) => it.category === 'tshirt')!;
  assert.ok(tShirtItem);

  // Close to t-shirt stall
  const found = findNearestMarketItem(tShirtItem.x + 0.5, tShirtItem.y, tShirtItem.z + 0.5, 3.5);
  assert.ok(found);
  assert.equal(found.id, tShirtItem.id);

  // Far away
  const notFound = findNearestMarketItem(0, 0, 0, 3.5);
  assert.equal(notFound, null);
});
