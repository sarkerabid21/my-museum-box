import { Landmark, Navigation, Wallet } from 'lucide-react';
import {
  projectWorldToMinimap,
  type TrafficVehicleState,
  type WorldZoneInfo,
} from '../museum/outdoorWorld';

interface WorldMinimapProps {
  playerX: number;
  playerZ: number;
  playerYaw: number;
  zone: WorldZoneInfo;
  vehicles: ReadonlyArray<Pick<TrafficVehicleState, 'id' | 'kind' | 'x' | 'z' | 'status'>>;
  walletBdt: number;
  drivingLabel?: string | null;
  hasCrossHall?: boolean;
  metroTrainPos?: { x: number; z: number } | null;
  onTeleport?: (targetX: number, targetZ: number, label: string) => void;
}

const MAP_W = 204;
const MAP_H = 112;

export function WorldMinimap({
  playerX,
  playerZ,
  playerYaw,
  zone,
  vehicles,
  walletBdt,
  drivingLabel = null,
  hasCrossHall = false,
  metroTrainPos = null,
  onTeleport,
}: WorldMinimapProps) {
  const playerPt = projectWorldToMinimap(playerX, playerZ, MAP_W, MAP_H);
  const museumPt = projectWorldToMinimap(0, 0, MAP_W, MAP_H);
  const ctgPt = projectWorldToMinimap(-395, 68, MAP_W, MAP_H);
  const bridgePt = projectWorldToMinimap(-220, 68, MAP_W, MAP_H);
  const marketPt = projectWorldToMinimap(-264.5, 85.5, MAP_W, MAP_H);
  const terminalPt = projectWorldToMinimap(-148, 85, MAP_W, MAP_H);
  const coxsPt = projectWorldToMinimap(170, 35, MAP_W, MAP_H);
  const metroCtgPt = projectWorldToMinimap(-300.0, 61.5, MAP_W, MAP_H);
  const metroMuseumPt = projectWorldToMinimap(0, 63.0, MAP_W, MAP_H);
  const metroCoxsPt = projectWorldToMinimap(172, 63.0, MAP_W, MAP_H);
  const kashmirPassPt = projectWorldToMinimap(-430, 68, MAP_W, MAP_H);
  const kashmirVillagePt = projectWorldToMinimap(-550, 68, MAP_W, MAP_H);
  const kashmirLakePt = projectWorldToMinimap(-610, 39, MAP_W, MAP_H);
  const kashmirArenaPt = projectWorldToMinimap(-610, 85, MAP_W, MAP_H);
  const kashmirGondolaPt = projectWorldToMinimap(-665, 125, MAP_W, MAP_H);
  const kashmirSummitPt = projectWorldToMinimap(-755, 185, MAP_W, MAP_H);
  const metroTrainPt = metroTrainPos
    ? projectWorldToMinimap(metroTrainPos.x, metroTrainPos.z, MAP_W, MAP_H)
    : null;

  // Convert avatar yaw (0 = +Z down on minimap, +PI/2 = +X right on minimap) into CSS degrees where 0deg points UP (-Z)
  const headingDeg = 180 - (playerYaw * 180) / Math.PI;

  const badgeStyles: Record<WorldZoneInfo['symbol'], string> = {
    MUSEUM: 'bg-[#8A5A2B] text-white border-[#D4B282]',
    GARDEN: 'bg-emerald-900 text-emerald-100 border-emerald-500/60',
    PARK: 'bg-rose-700 text-white border-rose-300',
    ROAD: 'bg-stone-800 text-amber-200 border-amber-500/50',
    CTG: 'bg-emerald-700 text-white border-emerald-300',
    COXS: 'bg-sky-700 text-white border-sky-300',
    KASHMIR: 'bg-cyan-900 text-cyan-100 border-cyan-400',
  };

  return (
    <aside
      aria-label="Live world minimap"
      data-testid="world-minimap"
      data-zone-symbol={zone.symbol}
      className="absolute top-2.5 right-2.5 sm:top-4 sm:right-4 z-20 w-[132px] sm:w-[216px] bg-[#181512]/94 text-[#F7F5F0] border border-stone-700 shadow-2xl select-none"
    >
      {/* Top Location Symbol Strip */}
      <div className="px-1.5 py-1 sm:px-2.5 sm:py-1.5 border-b border-stone-700/90 flex items-center justify-between gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
          {zone.symbol === 'MUSEUM' ? (
            <Landmark className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#E8CFA6] shrink-0" />
          ) : (
            <Navigation className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#E8CFA6] shrink-0" />
          )}
          <span
            className={`px-1 py-0.5 sm:px-1.5 text-[9px] sm:text-[10px] font-mono font-bold tracking-wider border ${badgeStyles[zone.symbol]}`}
            data-testid="minimap-zone-symbol"
          >
            {zone.symbol}
          </span>
          <span className="hidden sm:inline text-[11px] text-stone-300 truncate">{zone.label}</span>
        </div>
      </div>

      {/* Schematic Interactive Map Canvas (scales crisply on compact mobile screens) */}
      <div className="p-1 sm:p-2">
        <svg
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="block w-full h-[66px] sm:h-[110px] bg-[#1E251F] border border-stone-700/80"
          role="img"
          aria-label={`Map showing current location: ${zone.label} (${zone.symbol})`}
        >
          {/* Chittagong green hillside tint (West) */}
          <rect x={0} y={0} width={52} height={MAP_H} fill="#1F3B2B" />

          {/* Cox's Bazar coastal ocean tint (East) */}
          <rect x={156} y={0} width={48} height={MAP_H} fill="#0F3A52" />
          <rect x={148} y={0} width={10} height={MAP_H} fill="#8C7B56" opacity={0.45} />

          {/* Garden Courtyard */}
          <rect x={68} y={40} width={68} height={24} fill="#2A4D30" />
          <rect x={96} y={40} width={12} height={26} fill="#9C9283" opacity={0.65} />

          {/* West Amusement Park (Chorki, Dolna, Water Slide) */}
          <g
            className={onTeleport ? 'cursor-pointer hover:opacity-85' : ''}
            onClick={() => onTeleport?.(-18.2, 11.5, 'Amusement Park Entrance Arch')}
            role={onTeleport ? 'button' : undefined}
            tabIndex={onTeleport ? 0 : undefined}
            aria-label="Teleport to Amusement Park"
          >
            <rect x={54} y={14} width={28} height={38} fill="#4C1D3D" stroke="#F472B6" strokeWidth={0.9} opacity={0.9} />
            <text x={62} y={30} textAnchor="middle" fill="#FDE047" fontSize="8" fontWeight="700">
              🎡
            </text>
          </g>

          {/* West Aquapark: Tsunami Water Slide & Swimming Pool (Spacious Outer West Zone) */}
          <g
            className={onTeleport ? 'cursor-pointer hover:opacity-85' : ''}
            onClick={() => onTeleport?.(-75.0, 18.5, 'Tsunami Water Slide & Pool')}
            role={onTeleport ? 'button' : undefined}
            tabIndex={onTeleport ? 0 : undefined}
            aria-label="Teleport to Tsunami Water Slide & Swimming Pool"
          >
            <rect x={32} y={18} width={22} height={32} fill="#0284C7" stroke="#38BDF8" strokeWidth={0.8} rx={2} opacity={0.95} />
            <text x={43} y={36} textAnchor="middle" fill="#E0F2FE" fontSize="9" fontWeight="700">
              🌊
            </text>
          </g>

          {/* East Thrill Park: Cyclone Roller Coaster */}
          <g
            className={onTeleport ? 'cursor-pointer hover:opacity-85' : ''}
            onClick={() => onTeleport?.(61.0, 22.8, 'Cyclone Roller Coaster (East Park)')}
            role={onTeleport ? 'button' : undefined}
            tabIndex={onTeleport ? 0 : undefined}
            aria-label="Teleport to Cyclone Roller Coaster"
          >
            <rect x={150} y={30} width={28} height={29} fill="#0C4A6E" stroke="#38BDF8" strokeWidth={0.9} rx={2} opacity={0.92} />
            <rect x={152} y={50} width={18} height={8} fill="#06B6D4" opacity={0.95} />
            <text x={164} y={45} textAnchor="middle" fill="#FDE047" fontSize="10" fontWeight="700">
              🎢
            </text>
          </g>

          {/* Museum Architectural Footprint */}
          <g
            className={onTeleport ? 'cursor-pointer hover:opacity-85' : ''}
            onClick={() => onTeleport?.(0, 0, 'Museum Gallery (Room 1)')}
            role={onTeleport ? 'button' : undefined}
            tabIndex={onTeleport ? 0 : undefined}
            aria-label="Teleport to Museum Gallery"
          >
            <text
              x={museumPt.mx}
              y={10}
              textAnchor="middle"
              fill="#E8CFA6"
              fontSize="7"
              fontFamily="monospace"
              fontWeight="800"
            >
              MUSEUM
            </text>
            {hasCrossHall && (
              <rect
                x={museumPt.mx - 28}
                y={17}
                width={56}
                height={11}
                fill={zone.symbol === 'MUSEUM' ? '#9A6834' : '#4E4237'}
                stroke="#E8CFA6"
                strokeWidth={1.1}
              />
            )}
            <rect
              x={museumPt.mx - 18}
              y={13}
              width={36}
              height={28}
              fill={zone.symbol === 'MUSEUM' ? '#A6723B' : '#574A3D'}
              stroke="#E8CFA6"
              strokeWidth={1.4}
            />
            {/* Museum Classical Symbol */}
            <text
              x={museumPt.mx}
              y={31}
              textAnchor="middle"
              fill="#FAF5EC"
              fontSize="13"
              fontWeight="700"
            >
              🏛
            </text>
          </g>

          {/* Highway Asphalt Band (East to Center, stopping at x ~ -50) */}
          <rect x={120} y={42} width={MAP_W - 120} height={13} fill="#2B2F36" />
          <line
            x1={120}
            y1={48.5}
            x2={MAP_W}
            y2={48.5}
            stroke="#EAB308"
            strokeWidth={0.9}
            strokeDasharray="4 3"
          />

          {/* Chittagong Zero Point Grand Roundabout */}
          <g
            className={onTeleport ? 'cursor-pointer hover:opacity-85' : ''}
            onClick={() => onTeleport?.(-395, 68, 'Chittagong Zero Point Grand Roundabout')}
            role={onTeleport ? 'button' : undefined}
            tabIndex={onTeleport ? 0 : undefined}
            aria-label="Teleport to Chittagong Zero Point"
          >
            <circle cx={ctgPt.mx} cy={ctgPt.my} r={8.0} fill="#181A1F" stroke="#EAB308" strokeWidth={1.1} />
            <circle cx={ctgPt.mx} cy={ctgPt.my} r={4.8} fill="#065F46" stroke="#FEF08A" strokeWidth={0.7} />
            <text x={ctgPt.mx} y={ctgPt.my + 2.5} textAnchor="middle" fill="#FEF08A" fontSize="6">
              📍
            </text>
            <text x={ctgPt.mx} y={ctgPt.my - 9.5} textAnchor="middle" fill="#34D399" fontSize="3.8" fontWeight="800">
              ZERO POINT
            </text>
          </g>

          {/* Winding Black Highway Network (Mathematically smooth curve from Zero Point into city boulevard, bridge & CTG hills) */}
          <path
            d={`M 175 45.2 L 135 45.2 C 122 45.2, 114 52, 110 59 L 102 65 C 98 67, 94 67.5, 90 67.5 L ${bridgePt.mx + 8} 67.5 L ${bridgePt.mx - 8} 67.5 L 36 67.5 L ${ctgPt.mx} ${ctgPt.my}`}
            fill="none"
            stroke="#181A1F"
            strokeWidth={10}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Continuous Double Amber-Yellow Highway Center Divider */}
          <path
            d={`M 175 44.7 L 135 44.7 C 122 44.7, 114 51.5, 110 58.5 L 102 64.5 C 98 66.5, 94 67.0, 90 67.0 L ${bridgePt.mx + 8} 67.0 L ${bridgePt.mx - 8} 67.0 L 36 67.0 L ${ctgPt.mx} ${ctgPt.my - 0.5}`}
            fill="none"
            stroke="#EAB308"
            strokeWidth={0.65}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={`M 175 45.7 L 135 45.7 C 122 45.7, 114 52.5, 110 59.5 L 102 65.5 C 98 67.5, 94 68.0, 90 68.0 L ${bridgePt.mx + 8} 68.0 L ${bridgePt.mx - 8} 68.0 L 36 68.0 L ${ctgPt.mx} ${ctgPt.my + 0.5}`}
            fill="none"
            stroke="#EAB308"
            strokeWidth={0.65}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Grand River flowing from Karnaphuli / Launch Terminal, south of Gallery buildings, and merging into Cox's ocean */}
          <path
            d="M 42 25 L 53 25 L 53 84 L 95 84 L 155 84 L 195 80 L 195 112 L 42 112 Z"
            fill="#0284C7"
            opacity={0.88}
          />
          {/* North river branch in CTG */}
          <rect x={53} y={25} width={38} height={15} fill="#0284C7" opacity={0.65} />

          {/* Coastal Footbridge across river estuary into Cox's ocean */}
          <line x1={155} y1={82} x2={155} y2={106} stroke="#82542A" strokeWidth={1.8} />

          {/* Karnaphuli Launch Terminal Jetties & Docks */}
          <g
            className={onTeleport ? 'cursor-pointer hover:opacity-85' : ''}
            onClick={() => onTeleport?.(-160, 88, 'Karnaphuli Launch Terminal')}
            role={onTeleport ? 'button' : undefined}
            tabIndex={onTeleport ? 0 : undefined}
            aria-label="Teleport to Karnaphuli Launch Terminal"
          >
            {/* Pier 1 (Main Launch Pier) */}
            <rect x={65} y={84} width={3.2} height={19} fill="#82542A" stroke="#FEF08A" strokeWidth={0.4} />
            {/* Pier 2 (Cargo Pier) */}
            <rect x={55} y={84} width={2.8} height={17} fill="#82542A" />
            {/* Pier 3 (Speedboat Pontoon) */}
            <rect x={76} y={84} width={2.8} height={15} fill="#82542A" />

            {/* Moored Passenger Launch MV Karnaphuli */}
            <rect x={69} y={92} width={5} height={16} fill="#F8FAFC" stroke="#DC2626" strokeWidth={0.6} rx={1} />
            <text x={71.5} y={102} textAnchor="middle" fill="#0F172A" fontSize="6" fontWeight="700">
              🚢
            </text>

            {/* Speedboats */}
            <text x={81} y={96} textAnchor="middle" fill="#FDE047" fontSize="6">
              🚤
            </text>

            {/* Terminal Badge Label */}
            <rect x={58} y={79} width={34} height={5} fill="#0F172A" opacity={0.85} rx={1} />
            <text x={75} y={83} textAnchor="middle" fill="#38BDF8" fontSize="3.8" fontWeight="700">
              ⚓ LAUNCH TERMINAL
            </text>
          </g>

          {/* Grand Signboard before the Bridge: "WELCOME TO CHITTAGONG" at x = -195.5 (mx ~ 56) */}
          <line x1={56} y1={62} x2={56} y2={77} stroke="#10B981" strokeWidth={1.8} strokeDasharray="1 1" />
          <rect x={47} y={59} width={18} height={4.5} fill="#065F46" stroke="#FEF08A" strokeWidth={0.4} rx={1} />
          <text x={56} y={62.5} textAnchor="middle" fill="#FEF08A" fontSize="3.2" fontWeight="800">
            WELCOME TO CTG
          </text>

          {/* Karnaphuli Truss Bridge across the River */}
          <rect x={41} y={64} width={13} height={12} fill="#DC2626" opacity={0.95} stroke="#F87171" strokeWidth={0.8} />

          {/* City Buildings along boulevard (Mall, Sweet Shop, Jewelry, Towers) */}
          <rect x={82} y={56} width={11} height={7} fill="#1E3A8A" stroke="#60A5FA" strokeWidth={0.6} /> {/* Mega Mall */}
          <rect x={66} y={57} width={9} height={6} fill="#14532D" stroke="#86EFAC" strokeWidth={0.6} /> {/* Market */}
          <rect x={84} y={74} width={8} height={5} fill="#F472B6" stroke="#FB7185" strokeWidth={0.6} /> {/* Sweet Shop */}
          <rect x={74} y={74} width={8} height={5} fill="#EAB308" stroke="#FEF08A" strokeWidth={0.6} /> {/* Jewelry */}
          <rect x={62} y={73} width={9} height={6} fill="#0F172A" stroke="#38BDF8" strokeWidth={0.6} /> {/* Skyline Tower */}

          {/* Chittagong Hill View Grand Market (2-Storey Shopping Complex) */}
          <g
            className={onTeleport ? 'cursor-pointer hover:opacity-85' : ''}
            onClick={() => onTeleport?.(-264.5, 76.5, 'Chittagong Grand Market (2-Storey)')}
            role={onTeleport ? 'button' : undefined}
            tabIndex={onTeleport ? 0 : undefined}
            aria-label="Teleport to Chittagong Grand Market"
          >
            <rect
              x={marketPt.mx - 6}
              y={marketPt.my - 6}
              width={12}
              height={12}
              fill="#831843"
              stroke="#F472B6"
              strokeWidth={0.8}
              rx={1.5}
            />
            <text x={marketPt.mx} y={marketPt.my + 2} textAnchor="middle" fill="#FDF2F8" fontSize="6" fontWeight="700">
              🛍️
            </text>
            <rect
              x={marketPt.mx - 14}
              y={marketPt.my + 7}
              width={28}
              height={4.5}
              fill="#0F172A"
              opacity={0.85}
              rx={1}
            />
            <text x={marketPt.mx} y={marketPt.my + 10.3} textAnchor="middle" fill="#F472B6" fontSize="3.2" fontWeight="800">
              GRAND MARKET
            </text>
          </g>

          {/* Elevated Metro Rail Line (Chittagong <-> Museum Gallery <-> Cox's Bazar) */}
          <path
            d={`M ${metroCtgPt.mx - 15} ${metroCtgPt.my} L ${metroCtgPt.mx} ${metroCtgPt.my} L ${metroMuseumPt.mx} ${metroMuseumPt.my} L ${metroCoxsPt.mx} ${metroCoxsPt.my} L ${metroCoxsPt.mx + 8} ${metroCoxsPt.my}`}
            fill="none"
            stroke="#059669"
            strokeWidth={2.4}
            strokeDasharray="3 1.5"
            opacity={0.9}
          />

          {/* Metro Station 1: Chittagong Grand Market Metro Station */}
          <g
            className={onTeleport ? 'cursor-pointer hover:opacity-85' : ''}
            onClick={() => onTeleport?.(-300, 78, 'Chittagong Grand Market Metro Station')}
            role={onTeleport ? 'button' : undefined}
            tabIndex={onTeleport ? 0 : undefined}
            aria-label="Teleport to Chittagong Metro Station"
          >
            <circle cx={metroCtgPt.mx} cy={metroCtgPt.my} r={3.2} fill="#059669" stroke="#FEF08A" strokeWidth={0.8} />
            <text x={metroCtgPt.mx} y={metroCtgPt.my - 4.5} textAnchor="middle" fill="#34D399" fontSize="3.0" fontWeight="800">
              🚉 CTG METRO
            </text>
          </g>

          {/* Metro Station 2: Museum Gallery Central Metro Station */}
          <g
            className={onTeleport ? 'cursor-pointer hover:opacity-85' : ''}
            onClick={() => onTeleport?.(0, 51.5, 'Museum Gallery Central Metro Station')}
            role={onTeleport ? 'button' : undefined}
            tabIndex={onTeleport ? 0 : undefined}
            aria-label="Teleport to Museum Gallery Metro Station"
          >
            <circle cx={metroMuseumPt.mx} cy={metroMuseumPt.my} r={3.2} fill="#059669" stroke="#FEF08A" strokeWidth={0.8} />
            <text x={metroMuseumPt.mx} y={metroMuseumPt.my - 4.5} textAnchor="middle" fill="#34D399" fontSize="3.0" fontWeight="800">
              🚉 MUSEUM METRO
            </text>
          </g>

          {/* Metro Station 3: Cox's Bazar Sea Beach Metro Station */}
          <g
            className={onTeleport ? 'cursor-pointer hover:opacity-85' : ''}
            onClick={() => onTeleport?.(172, 51.5, "Cox's Bazar Sea Beach Metro Station")}
            role={onTeleport ? 'button' : undefined}
            tabIndex={onTeleport ? 0 : undefined}
            aria-label="Teleport to Cox's Bazar Metro Station"
          >
            <circle cx={metroCoxsPt.mx} cy={metroCoxsPt.my} r={3.2} fill="#059669" stroke="#FEF08A" strokeWidth={0.8} />
            <text x={metroCoxsPt.mx} y={metroCoxsPt.my - 4.5} textAnchor="middle" fill="#38BDF8" fontSize="3.0" fontWeight="800">
              🚉 COXS METRO
            </text>
          </g>

          {/* Live Metro Train Moving Marker */}
          {metroTrainPt && (
            <g>
              <circle cx={metroTrainPt.mx} cy={metroTrainPt.my} r={3.6} fill="#10B981" stroke="#FFFFFF" strokeWidth={0.9} />
              <text x={metroTrainPt.mx} y={metroTrainPt.my + 1.2} textAnchor="middle" fontSize="4.8">
                🚇
              </text>
            </g>
          )}

          {/* Chittagong Green Rolling Hills on western horizon */}
          <circle cx={14} cy={45} r={10} fill="#14532D" opacity={0.7} />
          <circle cx={10} cy={70} r={12} fill="#14532D" opacity={0.7} />
          <circle cx={12} cy={95} r={11} fill="#14532D" opacity={0.7} />

          {/* Opposite-Side Varied Architectural Footprints (East) */}
          <circle cx={135} cy={65} r={4.5} fill="#5C7080" opacity={0.85} />
          <rect x={148} y={60} width={12} height={8} fill="#7B9989" opacity={0.85} />
          <rect x={165} y={60} width={10} height={9} fill="#A38B68" opacity={0.85} />

          {/* West Landmark Badge: CTG */}
          <g transform={`translate(${ctgPt.mx}, ${ctgPt.my - 20})`}>
            <rect
              x={-16}
              y={-8}
              width={32}
              height={15}
              fill={zone.symbol === 'CTG' ? '#10B981' : '#0B5E3C'}
              stroke="#E2E8F0"
              strokeWidth={1}
            />
            <text
              x={0}
              y={2.5}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="8.5"
              fontFamily="monospace"
              fontWeight="800"
            >
              CTG
            </text>
          </g>

          {/* Far West Kashmir Snow Valley Landmark */}
          <g>
            {/* Frozen Dal Lake Teleport */}
            <g
              className={onTeleport ? 'cursor-pointer hover:opacity-85' : ''}
              onClick={() => onTeleport?.(-610, 39, 'Frozen Dal Lake Ice Rink')}
              role={onTeleport ? 'button' : undefined}
              tabIndex={onTeleport ? 0 : undefined}
              aria-label="Teleport to Frozen Dal Lake"
            >
              <rect x={kashmirLakePt.mx - 8} y={kashmirLakePt.my - 5} width={16} height={10} fill="#38BDF8" stroke="#E0F2FE" strokeWidth={0.8} rx={2} opacity={0.9} />
              <text x={kashmirLakePt.mx} y={kashmirLakePt.my + 1.8} textAnchor="middle" fontSize="6.5">
                ⛸️
              </text>
            </g>

            {/* Snowman & Snowball Fight Arena Teleport */}
            <g
              className={onTeleport ? 'cursor-pointer hover:opacity-85' : ''}
              onClick={() => onTeleport?.(-610, 85, 'Snowman & Snowball Fight Arena')}
              role={onTeleport ? 'button' : undefined}
              tabIndex={onTeleport ? 0 : undefined}
              aria-label="Teleport to Snowman Arena"
            >
              <circle cx={kashmirArenaPt.mx} cy={kashmirArenaPt.my} r={4.5} fill="#F8FAFC" stroke="#38BDF8" strokeWidth={0.8} />
              <text x={kashmirArenaPt.mx} y={kashmirArenaPt.my + 2.0} textAnchor="middle" fontSize="6.5">
                ☃️
              </text>
            </g>

            {/* Mountain Gondola Cable Car Line & Teleport */}
            <path
              d={`M ${kashmirGondolaPt.mx} ${kashmirGondolaPt.my} L ${kashmirSummitPt.mx} ${kashmirSummitPt.my}`}
              fill="none"
              stroke="#FDE047"
              strokeWidth={1.2}
              strokeDasharray="2 1"
            />
            <g
              className={onTeleport ? 'cursor-pointer hover:opacity-85' : ''}
              onClick={() => onTeleport?.(-665, 125, 'Gulmarg Gondola Base Station')}
              role={onTeleport ? 'button' : undefined}
              tabIndex={onTeleport ? 0 : undefined}
              aria-label="Teleport to Gondola Base Station"
            >
              <circle cx={kashmirGondolaPt.mx} cy={kashmirGondolaPt.my} r={4.0} fill="#065F46" stroke="#FDE047" strokeWidth={0.8} />
              <text x={kashmirGondolaPt.mx} y={kashmirGondolaPt.my + 1.5} textAnchor="middle" fontSize="5.5">
                🚡
              </text>
            </g>

            {/* Far West Landmark Badge: KASHMIR */}
            <g transform={`translate(${kashmirVillagePt.mx}, ${kashmirVillagePt.my - 22})`}>
              <rect
                x={-24}
                y={-8}
                width={48}
                height={15}
                fill={zone.symbol === 'KASHMIR' ? '#0284C7' : '#075985'}
                stroke="#E0F2FE"
                strokeWidth={1}
                rx={2}
              />
              <text
                x={0}
                y={2.5}
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="7.5"
                fontFamily="monospace"
                fontWeight="800"
              >
                ❄️ KASHMIR
              </text>
            </g>
          </g>

          {/* East Landmark Badge: COXS */}
          <g transform={`translate(${coxsPt.mx}, ${coxsPt.my - 20})`}>
            <rect
              x={-18}
              y={-8}
              width={36}
              height={15}
              fill={zone.symbol === 'COXS' ? '#38BDF8' : '#0369A1'}
              stroke="#E2E8F0"
              strokeWidth={1}
            />
            <text
              x={0}
              y={2.5}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="8.5"
              fontFamily="monospace"
              fontWeight="800"
            >
              COXS
            </text>
          </g>

          {/* Live Moving Traffic Vehicle Blips */}
          {vehicles.map((v) => {
            if (v.status === 'player_driving') return null;
            const pt = projectWorldToMinimap(v.x, v.z, MAP_W, MAP_H);
            const color =
              v.kind === 'rickshaw'
                ? '#F97316'
                : v.kind === 'bike'
                  ? '#60A5FA'
                  : v.kind === 'speedboat'
                    ? '#38BDF8'
                    : '#F8FAFC';
            return (
              <circle
                key={v.id}
                cx={pt.mx}
                cy={pt.my}
                r={v.kind === 'speedboat' ? 2.8 : v.kind === 'car' ? 2.4 : 1.9}
                fill={color}
                opacity={0.9}
              />
            );
          })}

          {/* Live Player Position & Heading Chevron */}
          <g transform={`translate(${playerPt.mx}, ${playerPt.my}) rotate(${headingDeg})`}>
            <polygon
              points="0,-5.5 4.2,4.2 0,2.1 -4.2,4.2"
              fill="#FACC15"
              stroke="#181512"
              strokeWidth={1.1}
            />
          </g>
        </svg>
      </div>

      {/* Footer Wallet & Active Vehicle Readout */}
      <div className="px-1.5 py-1 sm:px-2.5 sm:py-1.5 border-t border-stone-800 flex items-center justify-between gap-1 text-[10px] sm:text-[11px] font-mono">
        <span className="inline-flex items-center gap-0.5 sm:gap-1 text-emerald-300 shrink-0" data-testid="wallet-balance">
          <Wallet className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          ৳{walletBdt}
        </span>
        <span className="text-stone-400 truncate max-w-[66px] sm:max-w-[125px]">
          {drivingLabel ? drivingLabel : 'On Foot'}
        </span>
      </div>
    </aside>
  );
}
