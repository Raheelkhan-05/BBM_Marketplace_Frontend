// components/home/CategoryIcons.jsx
//
// Custom duotone icon set for the Home page CategoryStrip.
// Style: 48x48 grid, 2.2px ink stroke, BBM yellow fill accents, white highlights —
// the same ink + yellow palette used by the search bar.
//
// Resolution: getCategoryIcon(name, slug) tests the category name/slug against
// ICON_RULES in order (first match wins) and falls back to FallbackIcon, so a
// brand-new category never renders blank. Order matters: more specific rules
// (e.g. DrumIcon for "industrial oil") must sit above broader ones (OilIcon).

const INK = "#111111";
const Y = "#FFD60A";
const W = "#FFFFFF";

function Svg({ children }) {
    return (
        <svg
            viewBox="0 0 48 48"
            fill="none"
            stroke={INK}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
            className="h-full w-full"
        >
            {children}
        </svg>
    );
}

/* ───────────── Icons ───────────── */

export function AllIcon() {
    return (
        <Svg>
            <rect x="7" y="7" width="14" height="14" rx="4" fill={Y} />
            <rect x="27" y="7" width="14" height="14" rx="4" fill={W} />
            <rect x="7" y="27" width="14" height="14" rx="4" fill={W} />
            <rect x="27" y="27" width="14" height="14" rx="4" fill={W} />
        </Svg>
    );
}

export function FallbackIcon() {
    return (
        <Svg>
            <path d="M6 10 Q6 8 8 8 H25 L42 25 Q43 26 42 27 L27 42 Q26 43 25 42 L8 25 Q6 23 6 21Z" fill={Y} />
            <circle cx="16" cy="18" r="3" fill={W} />
        </Svg>
    );
}

function BearingIcon() {
    const balls = [[35, 24], [29.5, 33.5], [18.5, 33.5], [13, 24], [18.5, 14.5], [29.5, 14.5]];
    return (
        <Svg>
            <circle cx="24" cy="24" r="17" fill={W} />
            <circle cx="24" cy="24" r="7" fill={Y} />
            {balls.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="2.6" fill={Y} strokeWidth="1.8" />
            ))}
        </Svg>
    );
}

// Oil drop — used for generic "Lubricants" / oil / fuel categories.
function OilIcon() {
    return (
        <Svg>
            <path d="M24 6 C24 6 12 20 12 28 a12 12 0 0 0 24 0 C36 20 24 6 24 6Z" fill={Y} />
            <path d="M18 29 a6 6 0 0 0 5 6" />
        </Svg>
    );
}

// Oil drum with a white drop on a yellow band — "Industrial Oil" / drums / barrels.
function DrumIcon() {
    return (
        <Svg>
            <path d="M12 10 Q12 7 15 7 H33 Q36 7 36 10 V38 Q36 41 33 41 H15 Q12 41 12 38Z" fill={W} />
            <rect x="12" y="16" width="24" height="16" fill={Y} />
            <path d="M24 19.5 C24 19.5 19.5 24 19.5 26.5 a4.5 4.5 0 0 0 9 0 C28.5 24 24 19.5 24 19.5Z" fill={W} strokeWidth="1.8" />
        </Svg>
    );
}

function DumbbellIcon() {
    return (
        <Svg>
            <line x1="17" y1="24" x2="31" y2="24" strokeWidth="3" />
            <rect x="12" y="14" width="5" height="20" rx="2" fill={Y} />
            <rect x="31" y="14" width="5" height="20" rx="2" fill={Y} />
            <rect x="6" y="18" width="6" height="12" rx="2" fill={W} />
            <rect x="36" y="18" width="6" height="12" rx="2" fill={W} />
        </Svg>
    );
}

function BoltIcon() {
    return (
        <Svg>
            <path d="M27 5 L12 27 H23 L21 43 L36 20 H25 Z" fill={Y} />
        </Svg>
    );
}

function BulbIcon() {
    return (
        <Svg>
            <path d="M24 6 C15 6 10 13 10 19 C10 25 14 28 16 32 V36 H32 V32 C34 28 38 25 38 19 C38 13 33 6 24 6Z" fill={Y} />
            <path d="M18 41 H30" />
            <path d="M21 36 V28 M27 36 V28 M21 28 L24 24 L27 28" strokeWidth="1.8" />
        </Svg>
    );
}

function HammerIcon() {
    return (
        <Svg>
            <g transform="rotate(45 24 24)">
                <rect x="21" y="16" width="6" height="26" rx="2" fill={W} />
                <rect x="11" y="7" width="26" height="10" rx="2.5" fill={Y} />
            </g>
        </Svg>
    );
}

function NutIcon() {
    return (
        <Svg>
            <path d="M40 24 L32 37.86 H16 L8 24 L16 10.14 H32Z" fill={Y} />
            <circle cx="24" cy="24" r="6.5" fill={W} />
        </Svg>
    );
}

function BoxIcon() {
    return (
        <Svg>
            <path d="M24 6 L40 14 V32 L24 42 L8 32 V14Z" fill={W} />
            <path d="M24 6 L40 14 L24 22 L8 14Z" fill={Y} />
            <path d="M24 22 V42" />
        </Svg>
    );
}

function HelmetIcon() {
    return (
        <Svg>
            <path d="M9 30 C9 18 16 11 24 11 C32 11 39 18 39 30Z" fill={Y} />
            <rect x="5" y="30" width="38" height="6" rx="3" fill={W} />
            <path d="M24 11 V30" />
        </Svg>
    );
}

function ValveIcon() {
    return (
        <Svg>
            <rect x="4" y="26" width="40" height="10" rx="2" fill={W} />
            <rect x="18" y="22" width="12" height="18" rx="3" fill={Y} />
            <path d="M24 22 V13 M16 13 H32" strokeWidth="3" />
        </Svg>
    );
}

function FlaskIcon() {
    return (
        <Svg>
            <path d="M15 30 H33 L39 39 Q40.5 42 36 42 H12 Q7.5 42 9 39Z" fill={Y} stroke="none" />
            <path d="M20 6 H28 M21 6 V19 L9.5 38.5 Q8 42 12 42 H36 Q40 42 38.5 38.5 L27 19 V6" />
            <circle cx="22" cy="35" r="1.6" fill={W} strokeWidth="1.4" />
        </Svg>
    );
}

function CarIcon() {
    return (
        <Svg>
            <path d="M5 32 V25 Q5 23 7 22.5 L13 21 L18 14 H31 L37 21 L42 23 Q43 24 43 26 V32Z" fill={Y} />
            <path d="M18 21 L21 16.5 H30 L34 21Z" fill={W} strokeWidth="1.8" />
            <circle cx="14" cy="33" r="5" fill={W} />
            <circle cx="35" cy="33" r="5" fill={W} />
        </Svg>
    );
}

function ChipIcon() {
    return (
        <Svg>
            <path d="M19 8 V14 M24 8 V14 M29 8 V14 M19 34 V40 M24 34 V40 M29 34 V40 M8 19 H14 M8 24 H14 M8 29 H14 M34 19 H40 M34 24 H40 M34 29 H40" />
            <rect x="14" y="14" width="20" height="20" rx="3" fill={Y} />
            <rect x="20" y="20" width="8" height="8" rx="1.5" fill={W} />
        </Svg>
    );
}

function PencilIcon() {
    return (
        <Svg>
            <path d="M10 38 L12 30 L32 10 L38 16 L18 36Z" fill={Y} />
            <path d="M10 38 L12 30 L18 36Z" fill={W} />
            <path d="M28 14 L34 20" />
        </Svg>
    );
}

function AppleIcon() {
    return (
        <Svg>
            <path d="M24 14 C20 10 10 12 10 24 C10 34 17 42 21 40 Q24 39 27 40 C31 42 38 34 38 24 C38 12 28 10 24 14Z" fill={Y} />
            <path d="M24 14 Q24 9 28 6" />
            <path d="M28 8 Q33 7 34 11 Q29 12 28 8Z" fill={W} strokeWidth="1.8" />
        </Svg>
    );
}

function ShirtIcon() {
    return (
        <Svg>
            <path d="M17 7 L6 14 L11 22 L16 19 V41 H32 V19 L37 22 L42 14 L31 7 Q24 12 17 7Z" fill={Y} />
        </Svg>
    );
}

function MedicalIcon() {
    return (
        <Svg>
            <rect x="6" y="6" width="36" height="36" rx="10" fill={W} />
            <path d="M20 12 H28 V20 H36 V28 H28 V36 H20 V28 H12 V20 H20Z" fill={Y} />
        </Svg>
    );
}

function BuildingIcon() {
    return (
        <Svg>
            <path d="M10 42 V10 Q10 8 12 8 H28 Q30 8 30 10 V42" fill={Y} />
            <path d="M30 42 V22 H38 Q40 22 40 24 V42" fill={W} />
            <path d="M5 42 H43" />
            <path d="M16 15 H18 M22 15 H24 M16 23 H18 M22 23 H24 M16 31 H18 M22 31 H24" strokeWidth="3" />
        </Svg>
    );
}

function RollerIcon() {
    return (
        <Svg>
            <rect x="7" y="8" width="29" height="12" rx="3.5" fill={Y} />
            <path d="M36 14 H41 V26 H24 V31" />
            <rect x="20.5" y="31" width="7" height="11" rx="2" fill={W} />
        </Svg>
    );
}

function SproutIcon() {
    return (
        <Svg>
            <path d="M24 42 V22" />
            <path d="M24 28 C14 28 10 22 10 14 C18 14 24 18 24 28Z" fill={Y} />
            <path d="M24 22 C24 14 29 9 38 9 C38 17 33 22 24 22Z" fill={W} />
        </Svg>
    );
}

function BucketIcon() {
    return (
        <Svg>
            <path d="M10 19 H38 L34 42 H14Z" fill={Y} />
            <path d="M12 19 Q24 3 36 19" />
            <path d="M12 26 H36" strokeWidth="1.8" />
        </Svg>
    );
}

function BeamIcon() {
    return (
        <Svg>
            <path d="M10 10 H38 V16 H27 V32 H38 V38 H10 V32 H21 V16 H10Z" fill={Y} />
        </Svg>
    );
}

function GearIcon() {
    return (
        <Svg>
            {[0, 45, 90, 135].map((a) => (
                <rect key={a} x="21" y="6" width="6" height="36" rx="2" fill={Y} transform={`rotate(${a} 24 24)`} />
            ))}
            <circle cx="24" cy="24" r="12" fill={Y} />
            <circle cx="24" cy="24" r="4.5" fill={W} />
        </Svg>
    );
}

/* ───────────── Matching rules (first match wins — order matters) ───────────── */

const ICON_RULES = [
    { icon: BearingIcon, test: /bearing|bush(?:ing)?|\broller\b/ },
    // Specific oil rule BEFORE the generic one so "Industrial Oil" and
    // "Lubricants" get different icons.
    { icon: DrumIcon, test: /industrial oil|\bdrums?\b|barrel/ },
    { icon: OilIcon, test: /\boils?\b|lubric|grease|\bfuel|petrol|diesel/ },
    { icon: DumbbellIcon, test: /sport|fitness|\bgym|exercise|athlet/ },
    { icon: BulbIcon, test: /\blights?\b|lighting|\blamps?\b|\bled\b|bulb/ },
    { icon: BoltIcon, test: /electri|cable|\bwire|switch|\bpower\b|battery|inverter/ },
    { icon: HammerIcon, test: /\btools?\b|plier|spanner|wrench|drill|hand ?tool/ },
    { icon: NutIcon, test: /fasten|\bbolts?\b|\bnuts?\b|screw|hardware|fitting/ },
    { icon: BoxIcon, test: /packag|carton|\bbox|courier|logistic/ },
    { icon: HelmetIcon, test: /safety|\bppe\b|helmet|protect/ },
    { icon: ValveIcon, test: /\bpipes?\b|plumb|valve|pump|water|sanit/ },
    { icon: FlaskIcon, test: /chemical|\blab\b|laborator|solvent|adhesive|reagent/ },
    { icon: CarIcon, test: /\bauto|\bcars?\b|vehicle|tyre|tire|\bbike|automotive/ },
    { icon: ChipIcon, test: /electronic|computer|mobile|semiconductor|\bchip|\bit\b|laptop/ },
    // station(a|e)r covers both "stationery" and the "stationary" spelling in the DB.
    { icon: PencilIcon, test: /station(?:a|e)r|office|paper|print|\bbooks?\b/ },
    { icon: AppleIcon, test: /\bfood|grocer|beverage|fmcg|snack|edible|dairy/ },
    { icon: ShirtIcon, test: /textile|cloth|apparel|garment|fabric|fashion|\bwear\b/ },
    { icon: MedicalIcon, test: /medical|health|pharma|hospital|surgical/ },
    { icon: BuildingIcon, test: /construct|building|cement|\bcivil|real ?estate|infrastructure/ },
    { icon: RollerIcon, test: /paint|coating|colou?r|varnish/ },
    { icon: SproutIcon, test: /agri|\bfarm|\bseeds?\b|fertili|garden|\bplants?\b/ },
    { icon: BucketIcon, test: /clean|hygiene|housekeep|janitor|detergent/ },
    { icon: BeamIcon, test: /steel|\bmetals?\b|\biron\b|alloy|alumin|\bsheets?\b/ },
    { icon: GearIcon, test: /machin|motor|industrial|engine|\bgears?\b|equipment|mechanical/ },
];

const cache = new Map();

export function getCategoryIcon(name = "", slug = "") {
    const key = `${name}|${slug}`;
    if (cache.has(key)) return cache.get(key);
    const hay = `${name} ${slug}`.toLowerCase().replace(/[-_]+/g, " ");
    const hit = ICON_RULES.find((r) => r.test.test(hay));
    const icon = hit ? hit.icon : FallbackIcon;
    cache.set(key, icon);
    return icon;
}

export function CategoryIcon({ name, slug }) {
    const Icon = getCategoryIcon(name, slug);
    return <Icon />;
}