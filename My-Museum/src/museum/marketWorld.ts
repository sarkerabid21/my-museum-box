export type MarketCategory = 'hijab' | 'borkha' | 'tshirt' | 'pant' | 'shoes' | 'watch';

export interface MarketItem {
  id: string;
  name: string;
  banglaName: string;
  category: MarketCategory;
  floor: 1 | 2;
  stallName: string;
  shopkeeperName: string;
  icon: string;
  color: string;
  description: string;
  basePrice: number;
  minPrice: number;
  x: number;
  y: number;
  z: number;
}

export interface MarketShopSession {
  item: MarketItem;
  currentPrice: number;
  bargainStep: number;
  shopkeeperLine: string;
  canBargainMore: boolean;
}

export const MARKET_BUILDING = {
  minX: -278,
  maxX: -251,
  minZ: 75.0,
  maxZ: 96.0,
  secondFloorY: 4.25,
  stairMinX: -276,
  stairMaxX: -270,
  stairMinZ: 85.0,
  stairMaxZ: 93.0,
};

export const MARKET_ITEMS: MarketItem[] = [
  {
    id: 'item-hijab-1',
    name: 'Turkish Chiffon Silk Hijab',
    banglaName: 'তুর্কি শিফন সিল্ক হিজাব',
    category: 'hijab',
    floor: 1,
    stallName: 'মদিনা হিজাব ও বোরকা হাউস',
    shopkeeperName: 'ফারহানা আপা',
    icon: '🧕',
    color: '#EC4899',
    description: 'আরামদায়ক প্রিমিয়াম সফট শিফন ও সিল্কের তুর্কি ডিজাইনার হিজাব। আকর্ষনীয় কালার কালেকশন।',
    basePrice: 450,
    minPrice: 280,
    x: -257.5,
    y: 0.05,
    z: 80.5,
  },
  {
    id: 'item-borkha-1',
    name: 'Dubai Premium Abaya & Borkha',
    banglaName: 'দুবাই চেরি বোরকা ও আবায়া',
    category: 'borkha',
    floor: 1,
    stallName: 'মদিনা হিজাব ও বোরকা হাউস',
    shopkeeperName: 'ফারহানা আপা',
    icon: '👗',
    color: '#1E1B4B',
    description: 'অরিজিনাল দুবাই চেরি কাপড়ের নিখুঁত সুতার কাজ ও এমব্রয়ডারি করা আধুনিক ডিজাইনার বোরকা।',
    basePrice: 1800,
    minPrice: 1150,
    x: -260.0,
    y: 0.05,
    z: 80.5,
  },
  {
    id: 'item-shoes-1',
    name: 'Apex Casual Leather Shoes',
    banglaName: 'এপেক্স জেনুইন লেদার জুতা ও স্নিকার্স',
    category: 'shoes',
    floor: 1,
    stallName: 'রয়্যাল ফুটওয়্যার ও স্নিকার্স',
    shopkeeperName: 'শফিক ভাই',
    icon: '👞',
    color: '#78350F',
    description: '১০০% খাঁটি চামড়ার তৈরি টেকসই আরামদায়ক ক্যাজুয়াল জুতা ও আধুনিক স্নিকার্স।',
    basePrice: 1600,
    minPrice: 1050,
    x: -271.5,
    y: 0.05,
    z: 80.5,
  },
  {
    id: 'item-watch-1',
    name: 'Chronograph Luxury Watch',
    banglaName: 'রোলেক্স ক্রোনোগ্রাফ গোল্ডেন ঘড়ি',
    category: 'watch',
    floor: 1,
    stallName: 'টাইম জোন লাক্সারি ওয়াচ কর্নার',
    shopkeeperName: 'তানভীর ভাই',
    icon: '⌚',
    color: '#F59E0B',
    description: 'ওয়াটারপ্রুফ মেটালিক গোল্ডেন চেইন ও প্রিমিয়াম ডায়াল ক্রোনোগ্রাফ লাক্সারি হাতঘড়ি।',
    basePrice: 2200,
    minPrice: 1400,
    x: -257.5,
    y: 0.05,
    z: 89.5,
  },
  {
    id: 'item-tshirt-1',
    name: 'Cotton Printed Fashion T-Shirt',
    banglaName: 'প্রিমিয়াম কটন প্রিন্টেড টি-শার্ট',
    category: 'tshirt',
    floor: 2,
    stallName: 'ঢাকা ফ্যাশন টি-শার্ট হাব',
    shopkeeperName: 'রাকিব ভাই',
    icon: '👕',
    color: '#3B82F6',
    description: '১০০% পিওর কটন কম্বড ফেব্রিকের স্টাইলিশ কালারফুল গ্রাফিক ও পোলো টি-শার্ট।',
    basePrice: 550,
    minPrice: 350,
    x: -257.5,
    y: 4.25,
    z: 81.5,
  },
  {
    id: 'item-pant-1',
    name: 'Slim-Fit Stretch Denim Jeans Pant',
    banglaName: 'স্লিম-ফিট স্ট্রেচ ডেনিম জিন্স প্যান্ট',
    category: 'pant',
    floor: 2,
    stallName: 'ডেনিম প্লাস প্যান্ট ও জিন্স কর্নার',
    shopkeeperName: 'জামাল ভাই',
    icon: '👖',
    color: '#1E3A8A',
    description: 'উন্নত মানের টেকসই স্ট্রেচেবল ডেনিম ফেব্রিকের নিখুঁত ফিটিং ওয়াশ ব্লু জিন্স প্যান্ট।',
    basePrice: 1250,
    minPrice: 780,
    x: -271.5,
    y: 4.25,
    z: 81.5,
  },
];

/**
 * Calculates continuous walkable elevation inside the 2-storey Chittagong Grand Market:
 * - Climbs continuously up the staircase (0m -> 4.25m) between z = 85.0 and 93.0
 * - Retains 2nd floor platform level (y = 4.25m) when walking on the upper floor
 * - Retains ground floor tile level (y = 0.05m) when on the 1st floor
 */
export function computeMarketElevation(x: number, z: number, currentY = 0): number {
  if (
    x < MARKET_BUILDING.minX ||
    x > MARKET_BUILDING.maxX ||
    z < MARKET_BUILDING.minZ ||
    z > MARKET_BUILDING.maxZ
  ) {
    return 0;
  }

  // Inside the walkable staircase ramp (rising from 0.05m to 4.25m):
  if (
    x >= MARKET_BUILDING.stairMinX &&
    x <= MARKET_BUILDING.stairMaxX &&
    z >= MARKET_BUILDING.stairMinZ &&
    z <= MARKET_BUILDING.stairMaxZ
  ) {
    const frac =
      (z - MARKET_BUILDING.stairMinZ) / (MARKET_BUILDING.stairMaxZ - MARKET_BUILDING.stairMinZ);
    return 0.1 + frac * (MARKET_BUILDING.secondFloorY - 0.1);
  }

  // If player is already on or near the second floor:
  if (currentY >= 2.5) {
    return MARKET_BUILDING.secondFloorY;
  }

  return 0.05; // Ground floor tile level
}

/**
 * Creates an interactive shopping & bargaining session when the player approaches a market stall.
 */
export function createMarketSession(item: MarketItem): MarketShopSession {
  const line =
    item.category === 'hijab'
      ? `${item.shopkeeperName}: "আসসালামু আলাইকুম আপু/ভাইয়া! একদম অরিজিনাল সফট তুর্কি হিজাব, মাত্র ৳${item.basePrice} টাকায় নিয়ে যান!"`
      : item.category === 'borkha'
        ? `${item.shopkeeperName}: "একদম দুবাই চেরি ফেব্রিকের অরিজিনাল বোরকা ও আবায়া! গায়ের রঙে দারুণ মানাবে, মাত্র ৳${item.basePrice} টাকা।" `
        : item.category === 'tshirt'
          ? `${item.shopkeeperName}: "বস! ১০০% কম্বড সুতির এক্সপোর্ট কোয়ালিটি টি-শার্ট! অফার প্রাইস ৳${item.basePrice} টাকা।" `
          : item.category === 'pant'
            ? `${item.shopkeeperName}: "ভাই একদম অরিজিনাল স্ট্রেচ ডেনিম জিন্স! টেকসই ও প্রিমিয়াম ফিটিং, ৳${item.basePrice} টাকায় নিয়ে যান।" `
            : item.category === 'shoes'
              ? `${item.shopkeeperName}: "১০০% পিওর লেদারের জুতা ভাই, পরলে পা একদম আরাম পাবে। দাম ৳${item.basePrice} টাকা।" `
              : `${item.shopkeeperName}: "স্যার! রোলেক্স ক্রোনোগ্রাফ গোল্ডেন চেইনের লাক্সারি ওয়াটারপ্রুফ ঘড়ি! মাত্র ৳${item.basePrice} টাকা।" `;

  return {
    item,
    currentPrice: item.basePrice,
    bargainStep: 0,
    shopkeeperLine: line,
    canBargainMore: item.basePrice > item.minPrice,
  };
}

/**
 * Interactive Banglish price bargaining ("দরদাম করুন").
 */
export function negotiateMarketPrice(session: MarketShopSession): MarketShopSession {
  if (!session.canBargainMore || session.currentPrice <= session.item.minPrice) {
    return {
      ...session,
      canBargainMore: false,
      shopkeeperLine: `${session.item.shopkeeperName}: "না ভাই, ৳${session.item.minPrice} এর নিচে দিলে আমার কেনা দামও উঠবে না! এর এক টাকাও কমে দেওয়া সম্ভব না।"`,
    };
  }

  const nextStep = session.bargainStep + 1;
  const isFinalStep = nextStep >= 3;
  const discount = Math.max(
    40,
    Math.round(((session.currentPrice - session.item.minPrice) * 0.52) / 10) * 10
  );
  const nextPrice = isFinalStep
    ? session.item.minPrice
    : Math.max(session.item.minPrice, session.currentPrice - discount);
  const canBargainMore = nextPrice > session.item.minPrice && !isFinalStep;

  const responses = [
    `${session.item.shopkeeperName}: "আরে ভাই আপনি তো ভালো দরদাম জানেন! আচ্ছা ঠিক আছে, আপনার জন্য ৳${nextPrice} রাখলাম।"`,
    `${session.item.shopkeeperName}: "ভাই এতে তো আমার চালান উঠবে না! তাও আপনি যখন বললেন, ৳${nextPrice} টাকা দিয়েন।"`,
    `${session.item.shopkeeperName}: "লাস্ট কথা ৳${nextPrice} টাকা! এক টাকাও আর কমাতে পারব না, নিলে নিয়ে নিন, প্যাকেট করে দিই?"`,
  ];

  const line = responses[Math.min(nextStep - 1, responses.length - 1)];

  return {
    ...session,
    currentPrice: nextPrice,
    bargainStep: nextStep,
    canBargainMore,
    shopkeeperLine: line,
  };
}

/**
 * Purchases the item with the final negotiated price and deducts BDT from the player's wallet.
 */
export function buyMarketItem(
  session: MarketShopSession,
  walletBdt: number
): { ok: boolean; nextWallet: number; message: string } {
  if (walletBdt < session.currentPrice) {
    return {
      ok: false,
      nextWallet: walletBdt,
      message: `টাকা কম আছে! আপনার ওয়ালেটে আছে ৳${walletBdt}, কিন্তু দাম ৳${session.currentPrice}। দরদাম করুন বা অন্য পণ্য দেখুন!`,
    };
  }

  return {
    ok: true,
    nextWallet: walletBdt - session.currentPrice,
    message: `অভিনন্দন! ৳${session.currentPrice} দিয়ে ${session.item.banglaName} সফলভাবে কিনেছেন! আপনার ব্যাগে যোগ হয়েছে।`,
  };
}

/**
 * Finds the nearest market item / stall within interaction range of the player.
 */
export function findNearestMarketItem(
  px: number,
  py: number,
  pz: number,
  maxRadius = 3.8
): MarketItem | null {
  let best: MarketItem | null = null;
  let bestDist = maxRadius;

  for (const item of MARKET_ITEMS) {
    const dist = Math.hypot(item.x - px, item.y - py, item.z - pz);
    if (dist <= bestDist) {
      bestDist = dist;
      best = item;
    }
  }

  return best;
}
