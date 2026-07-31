import { useEffect, useState } from "react";
import { Bookmark, Check, ChevronRight, LoaderCircle, SlidersHorizontal, Star, Trash2, X } from "lucide-react";
import { VarsityJacketViewer, renderNeckLabel, renderInteriorPatch, type BackDesign, type BodyMaterial } from "../components/VarsityJacketViewer";
import { useNavigate } from "react-router-dom";
import { createJacketCheckout, type ShopifyAttribute } from "../lib/shopify";
import {
  MAX_SAVED_JACKETS,
  type JacketConfiguration,
  type SavedJacket,
  type ShopifySavedJacketsApi,
} from "../lib/savedJackets";

const SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];

// Approved jacket body colors. Metallic gold and gold-family shades are not
// selectable; Champagne is represented as a pale neutral.
const COLOR_GROUPS: { group: string; shades: { label: string; color: string }[] }[] = [
  {
    group: "Neutrals",
    shades: [
      { label: "Black", color: "#181b20" },
      { label: "Jet Black", color: "#090909" },
      { label: "White", color: "#f8f8f5" },
      { label: "Off White", color: "#eee9df" },
      { label: "Gray", color: "#7a7a78" },
      { label: "Light Gray", color: "#b9b9b5" },
      { label: "Dark Gray", color: "#3a3a3a" },
      { label: "Brown", color: "#654332" },
      { label: "Champagne", color: "#f3e6d2" },
      { label: "Nude", color: "#d5b39c" },
    ],
  },
  {
    group: "Reds",
    shades: [
      { label: "Solid Red", color: "#d71920" },
      { label: "Maroon", color: "#561e1e" },
      { label: "Oxblood", color: "#691c1a" },
      { label: "Burgundy", color: "#770d22" },
      { label: "Wine", color: "#722f37" },
      { label: "Cardinal", color: "#8f2130" },
      { label: "Crimson", color: "#a11d2e" },
      { label: "Varsity Red", color: "#b3181e" },
    ],
  },
  {
    group: "Blues",
    shades: [
      { label: "Solid Blue", color: "#0057b8" },
      { label: "Dark Blue", color: "#1b294b" },
      { label: "France Blue", color: "#3a6bd6" },
      { label: "Bright Royal", color: "#3d87c0" },
      { label: "Light Blue", color: "#6fa8dc" },
      { label: "Baby Blue", color: "#8fb8e0" },
      { label: "Sky Blue", color: "#87ceeb" },
      { label: "Powder Blue", color: "#aecbe8" },
    ],
  },
  {
    group: "Greens",
    shades: [
      { label: "Solid Green", color: "#00843d" },
      { label: "Bottle Green", color: "#0e3426" },
      { label: "Ever Green", color: "#143d2b" },
      { label: "Forest Green", color: "#054012" },
      { label: "Hunter Green", color: "#24503a" },
      { label: "Army Green", color: "#4b5320" },
      { label: "Olive Green", color: "#59652f" },
      { label: "Emerald Green", color: "#007a5e" },
    ],
  },
  {
    group: "Purples",
    shades: [
      { label: "Solid Purple", color: "#6a1b9a" },
      { label: "Deep Purple", color: "#28142c" },
      { label: "Varsity Purple", color: "#4b1d63" },
      { label: "Royal Purple", color: "#5b21b6" },
      { label: "Grape", color: "#6f2da8" },
      { label: "Violet", color: "#8f5bd7" },
    ],
  },
  {
    group: "Yellows",
    shades: [
      { label: "Solid Yellow", color: "#ffd400" },
      { label: "Dark Yellow", color: "#aaa000" },
      { label: "Lemon", color: "#fff44f" },
      { label: "Light Yellow", color: "#fff3a3" },
    ],
  },
  {
    group: "Oranges",
    shades: [
      { label: "Solid Orange", color: "#f47c20" },
      { label: "Tangerine", color: "#f28500" },
      { label: "Melon", color: "#f28c82" },
      { label: "Mango", color: "#ff9f1c" },
      { label: "Apricot", color: "#f5b278" },
      { label: "Peach", color: "#f6c5a5" },
    ],
  },
];

// Leather / trim / snaps are black & white only.
const LEATHER_BW = [
  { label: "Black", color: "#1a1a1a" },
  { label: "White", color: "#f4f2ea" },
];

const LEATHER_TYPES = ["Nappa", "Cowhide"] as const;
type LeatherType = (typeof LEATHER_TYPES)[number];
type JacketEdition = "Classic" | "Footballers";

function labelForColor(color: string) {
  for (const group of COLOR_GROUPS) {
    const shade = group.shades.find((s) => s.color.toLowerCase() === color.toLowerCase());
    if (shade) return shade.label;
  }
  const bw = LEATHER_BW.find((s) => s.color.toLowerCase() === color.toLowerCase());
  return bw?.label ?? color;
}

function savedJacketBodyColor(jacket: SavedJacket) {
  return jacket.configuration.jacketEdition === "Footballers"
    ? jacket.configuration.sleeveColor
    : jacket.configuration.bodyColor;
}

// 2026–27 top-division club cities for England, France, Germany, Italy,
// Portugal and Spain. No protected competition or club names are shown.
const COUNTRY_CITIES: { country: string; cities: string[] }[] = [
  {
    country: "England",
    cities: [
      "Birmingham",
      "Bournemouth",
      "Brighton",
      "Coventry",
      "Hull",
      "Ipswich",
      "Leeds",
      "Liverpool",
      "London",
      "Manchester",
      "Newcastle",
      "Nottingham",
      "Sunderland",
    ],
  },
  {
    country: "France",
    cities: [
      "Angers",
      "Auxerre",
      "Brest",
      "Le Havre",
      "Le Mans",
      "Lens",
      "Lille",
      "Lorient",
      "Lyon",
      "Marseille",
      "Monaco",
      "Nice",
      "Paris",
      "Rennes",
      "Strasbourg",
      "Toulouse",
      "Troyes",
    ],
  },
  {
    country: "Germany",
    cities: [
      "Augsburg", "Berlin", "Bremen", "Cologne", "Dortmund", "Frankfurt", "Freiburg", "Gelsenkirchen",
      "Hamburg", "Leipzig", "Leverkusen", "Mainz", "Mönchengladbach", "Munich", "Paderborn", "Sinsheim",
      "Spiesen-Elversberg", "Stuttgart",
    ],
  },
  {
    country: "Italy",
    cities: [
      "Bergamo", "Bologna", "Cagliari", "Como", "Florence", "Frosinone", "Genoa", "Lecce", "Milan",
      "Monza", "Naples", "Parma", "Reggio Emilia", "Rome", "Turin", "Udine", "Venice",
    ],
  },
  {
    country: "Portugal",
    cities: [
      "Alverca do Ribatejo",
      "Amadora",
      "Arouca",
      "Barcelos",
      "Braga",
      "Estoril",
      "Funchal",
      "Guimarães",
      "Lisbon",
      "Moreira de Cónegos",
      "Ponta Delgada",
      "Porto",
      "Vila do Conde",
      "Vila Nova de Famalicão",
      "Viseu",
    ],
  },
  {
    country: "Spain",
    cities: [
      "A Coruña", "Barcelona", "Bilbao", "Cornellà de Llobregat", "Elche", "Getafe", "Madrid", "Málaga",
      "Pamplona", "San Sebastián", "Santander", "Seville", "Valencia", "Vigo", "Villarreal", "Vitoria-Gasteiz",
    ],
  },
];

// Every national team to have reached a men's World Cup finals tournament,
// including the four 2026 debutants. Current country/team names are used.
const WORLD_CUP_COUNTRIES = [
  "Algeria", "Angola", "Argentina", "Australia", "Austria", "Belgium", "Bolivia", "Bosnia and Herzegovina",
  "Brazil", "Bulgaria", "Cabo Verde", "Cameroon", "Canada", "Chile", "China PR", "Colombia", "Costa Rica",
  "Croatia", "Cuba", "Curaçao", "Czech Republic", "Denmark", "DR Congo", "East Germany", "Ecuador", "Egypt", "El Salvador",
  "England", "France", "Germany", "Ghana", "Greece", "Haiti", "Honduras", "Hungary", "Iceland", "Indonesia",
  "Iran", "Iraq", "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan", "Jordan", "Kuwait", "Mexico",
  "Morocco", "Netherlands", "New Zealand", "Nigeria", "North Korea", "Northern Ireland", "Norway", "Panama",
  "Paraguay", "Peru", "Poland", "Portugal", "Qatar", "Republic of Ireland", "Romania", "Russia", "Saudi Arabia",
  "Scotland", "Senegal", "Serbia", "Slovakia", "Slovenia", "South Africa", "South Korea", "Spain", "Sweden",
  "Switzerland", "Togo", "Trinidad and Tobago", "Tunisia", "Turkey", "Ukraine", "United Arab Emirates",
  "United States", "Uruguay", "Uzbekistan", "Wales",
].sort((a, b) => a.localeCompare(b));

const PRINT_COLORS = [
  { label: "White", color: "#f4f2ea" },
  { label: "Black", color: "#1a1a1a" },
];

interface JacketBuilderPageProps {
  accessRole?: "visitor" | "footballer" | "admin";
  onShopifySignIn?: () => void;
  shopifyAccessStatus?: "checking" | "signed-out" | "eligible" | "ineligible" | "unavailable" | "error";
  savedJacketsApi?: ShopifySavedJacketsApi;
}

export function JacketBuilderPage({
  accessRole = "visitor",
  onShopifySignIn,
  savedJacketsApi,
  shopifyAccessStatus = "signed-out",
}: JacketBuilderPageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"materials" | "patches">("materials");
  const [expandedSection, setExpandedSection] = useState<string | null>("Jacket");
  const [openBodyGroup, setOpenBodyGroup] = useState<string | null>("Neutrals");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [jacketEdition, setJacketEdition] = useState<JacketEdition>("Classic");
  const [showFootballersAccess, setShowFootballersAccess] = useState(false);
  const [bodyColor, setBodyColor] = useState("#181b20");
  const [sleeveColor, setSleeveColor] = useState("#1a1a1a");
  const [leatherType, setLeatherType] = useState<LeatherType>("Nappa");
  const [pocketColor, setPocketColor] = useState("#1a1a1a");
  const [snapColor, setSnapColor] = useState("#1a1a1a");
  const [trimColor, setTrimColor] = useState("#1a1a1a");

  const [showSizeModal, setShowSizeModal] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [showInterior, setShowInterior] = useState(false);
  const [interiorImages, setInteriorImages] = useState<{ label: string; patch: string } | null>(null);
  const [showSavedJackets, setShowSavedJackets] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [savedJackets, setSavedJackets] = useState<SavedJacket[]>([]);
  const [savedJacketsDigest, setSavedJacketsDigest] = useState<string | null>(null);
  const [savedJacketsStatus, setSavedJacketsStatus] = useState<"idle" | "loading" | "saving">("idle");
  const [savedJacketsError, setSavedJacketsError] = useState<string | null>(null);
  const [activeSavedJacketId, setActiveSavedJacketId] = useState<string | null>(null);

  // Render the interior patch artwork (shared with the 3D viewer's canvas
  // painters) into images the first time the Interior Details card opens.
  useEffect(() => {
    if (!showInterior || interiorImages) return;
    let active = true;
    void renderInteriorPatch().then((patch) => {
      if (!active) return;
      setInteriorImages({ label: renderNeckLabel().toDataURL(), patch: patch.toDataURL() });
    });
    return () => {
      active = false;
    };
  }, [showInterior, interiorImages]);

  const [backStars, setBackStars] = useState(5);
  const [backNumber, setBackNumber] = useState("7");
  const [leftSleeveNumbers, setLeftSleeveNumbers] = useState(["", "", "", "", ""]);
  const [rightSleeveNumbers, setRightSleeveNumbers] = useState(["", "", "", "", ""]);
  const [backCity, setBackCity] = useState("Madrid");
  const [backPrintColor, setBackPrintColor] = useState(PRINT_COLORS[0].color);
  const [sleevePrintColor, setSleevePrintColor] = useState(PRINT_COLORS[0].color);
  const [liningColor, setLiningColor] = useState(LEATHER_BW[0].color);

  const backDesign: BackDesign = {
    stars: backStars,
    backNumber,
    leftSleeveNumbers,
    rightSleeveNumbers,
    city: backCity,
    backPrintColor,
    sleevePrintColor,
  };

  const isFootballersEdition = jacketEdition === "Footballers";
  const canUseFootballersEdition = accessRole === "footballer" || accessRole === "admin";
  const shopifySignedIn = shopifyAccessStatus === "eligible" || shopifyAccessStatus === "ineligible";
  const footballersAccessLabel =
    shopifyAccessStatus === "checking"
      ? "Checking account"
      : shopifyAccessStatus === "ineligible"
        ? "Approval required"
        : shopifyAccessStatus === "error" || shopifyAccessStatus === "unavailable"
          ? "Account check unavailable"
          : "Shopify account required";
  const renderedBodyColor = isFootballersEdition ? sleeveColor : bodyColor;
  const renderedBodyMaterial: BodyMaterial = isFootballersEdition ? "Leather" : "Wool";

  useEffect(() => {
    if (!savedJacketsApi || !shopifySignedIn) {
      setSavedJackets([]);
      setSavedJacketsDigest(null);
      setSavedJacketsStatus("idle");
      return;
    }
    let active = true;
    setSavedJacketsStatus("loading");
    setSavedJacketsError(null);
    void savedJacketsApi.load()
      .then((store) => {
        if (!active) return;
        setSavedJackets(store.jackets);
        setSavedJacketsDigest(store.compareDigest);
        setSavedJacketsStatus("idle");
      })
      .catch((error) => {
        if (!active) return;
        setSavedJacketsStatus("idle");
        setSavedJacketsError(
          error instanceof Error ? error.message : "Saved jackets could not be loaded.",
        );
      });
    return () => {
      active = false;
    };
  }, [savedJacketsApi, shopifySignedIn]);

  const currentConfiguration = (): JacketConfiguration => ({
    version: 1,
    jacketEdition,
    bodyColor,
    sleeveColor,
    leatherType,
    pocketColor,
    snapColor,
    trimColor,
    liningColor,
    backStars,
    backNumber,
    leftSleeveNumbers,
    rightSleeveNumbers,
    backCity,
    backPrintColor,
    sleevePrintColor,
    selectedSize,
  });

  const loadConfiguration = (jacket: SavedJacket) => {
    const configuration = jacket.configuration;
    if (configuration.jacketEdition === "Footballers" && !canUseFootballersEdition) {
      setSavedJacketsError("Footballers access is required to load this jacket.");
      return;
    }
    setJacketEdition(configuration.jacketEdition);
    setBodyColor(configuration.bodyColor);
    setSleeveColor(configuration.sleeveColor);
    setLeatherType(configuration.leatherType);
    setPocketColor(configuration.pocketColor);
    setSnapColor(configuration.snapColor);
    setTrimColor(configuration.trimColor);
    setLiningColor(configuration.liningColor);
    setBackStars(configuration.backStars);
    setBackNumber(configuration.backNumber);
    setLeftSleeveNumbers(configuration.leftSleeveNumbers);
    setRightSleeveNumbers(configuration.rightSleeveNumbers);
    setBackCity(configuration.backCity);
    setBackPrintColor(configuration.backPrintColor);
    setSleevePrintColor(configuration.sleevePrintColor);
    setSelectedSize(configuration.selectedSize);
    setActiveSavedJacketId(jacket.id);
    setSavedJacketsError(null);
    setShowSavedJackets(false);
    setShowComparison(false);
  };

  const persistSavedJackets = async (jackets: SavedJacket[]) => {
    if (!savedJacketsApi || !shopifySignedIn || savedJacketsStatus === "saving") return false;
    setSavedJacketsStatus("saving");
    setSavedJacketsError(null);
    try {
      const store = await savedJacketsApi.save(jackets, savedJacketsDigest);
      setSavedJackets(store.jackets);
      setSavedJacketsDigest(store.compareDigest);
      setSavedJacketsStatus("idle");
      return true;
    } catch (error) {
      setSavedJacketsStatus("idle");
      setSavedJacketsError(
        error instanceof Error ? error.message : "Shopify could not save these jackets.",
      );
      return false;
    }
  };

  const saveCurrentJacket = async (asNew = false) => {
    const now = new Date().toISOString();
    const active = !asNew
      ? savedJackets.find((jacket) => jacket.id === activeSavedJacketId)
      : undefined;
    if (!active && savedJackets.length >= MAX_SAVED_JACKETS) {
      setSavedJacketsError(`Delete a saved jacket before adding another. The limit is ${MAX_SAVED_JACKETS}.`);
      return;
    }
    const usedCompNames = new Set(savedJackets.map((jacket) => jacket.name));
    const nextCompNumber = Array.from({ length: MAX_SAVED_JACKETS }, (_, index) => index + 1)
      .find((number) => !usedCompNames.has(`Comp ${number}`)) ?? savedJackets.length + 1;
    const next = active
      ? savedJackets.map((jacket) =>
          jacket.id === active.id
            ? { ...jacket, configuration: currentConfiguration(), updatedAt: now }
            : jacket,
        )
      : [
          ...savedJackets,
          {
            id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `jacket-${Date.now()}`,
            name: `Comp ${nextCompNumber}`,
            createdAt: now,
            updatedAt: now,
            configuration: currentConfiguration(),
          },
        ];
    const saved = await persistSavedJackets(next);
    if (saved && !active) setActiveSavedJacketId(next[next.length - 1].id);
  };

  const deleteSavedJacket = async (id: string) => {
    const next = savedJackets.filter((jacket) => jacket.id !== id);
    const saved = await persistSavedJackets(next);
    if (saved && activeSavedJacketId === id) setActiveSavedJacketId(null);
  };

  const onBackNumberChange = (value: string) => setBackNumber(value.replace(/\D/g, "").slice(0, 2));
  const onSleeveNumberChange = (side: "left" | "right", index: number, value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 2);
    const setter = side === "left" ? setLeftSleeveNumbers : setRightSleeveNumbers;
    setter((numbers) => numbers.map((n, i) => (i === index ? digits : n)));
  };

  const price = isFootballersEdition ? 1695 : 1195;

  const checkoutAttributes = (): ShopifyAttribute[] => [
    { key: "Edition", value: jacketEdition },
    { key: "Size", value: selectedSize ?? "" },
    { key: "Body material", value: renderedBodyMaterial },
    { key: "Body color", value: labelForColor(renderedBodyColor) },
    { key: "Sleeve color", value: labelForColor(sleeveColor) },
    { key: "Leather type", value: leatherType },
    { key: "Pocket color", value: labelForColor(pocketColor) },
    { key: "Snap color", value: labelForColor(snapColor) },
    { key: "Knit trim color", value: labelForColor(trimColor) },
    { key: "Inside lining", value: labelForColor(liningColor) },
    { key: "Back city", value: backCity },
    { key: "Back number", value: backNumber || "None" },
    { key: "Gold stars", value: String(backStars) },
    { key: "Back design color", value: labelForColor(backPrintColor) },
    { key: "Left sleeve numbers", value: leftSleeveNumbers.filter(Boolean).join(", ") || "None" },
    { key: "Right sleeve numbers", value: rightSleeveNumbers.filter(Boolean).join(", ") || "None" },
    { key: "Sleeve number color", value: labelForColor(sleevePrintColor) },
    { key: "Production time", value: "4–6 weeks" },
    { key: "Final sale", value: "Yes" },
  ];

  const proceedToShopify = async () => {
    if (!selectedSize || checkoutPending) return;
    setCheckoutPending(true);
    setCheckoutError(null);
    try {
      const checkoutUrl = await createJacketCheckout(selectedSize, jacketEdition, checkoutAttributes());
      window.location.assign(checkoutUrl);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Unable to start Shopify checkout.");
      setCheckoutPending(false);
    }
  };

  // Black/white swatch sections (pockets, snaps, knit trim).
  const BW_SECTIONS: { section: string; color: string; setColor: (c: string) => void; material: string }[] = [
    { section: "Pockets", color: pocketColor, setColor: setPocketColor, material: "Leather" },
    { section: "Snaps", color: snapColor, setColor: setSnapColor, material: "Metal" },
    { section: "Knit Trim", color: trimColor, setColor: setTrimColor, material: "Knit" },
  ];

  const accordionHeader = (section: string, color: string, material: string) => {
    const isOpen = expandedSection === section;
    return (
      <button
        onClick={() => setExpandedSection(isOpen ? null : section)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded border border-gray-200 shrink-0" style={{ backgroundColor: color }} />
          <div className="text-left">
            <div className="text-[10px] tracking-widest uppercase text-gray-400">
              {section} · {material}
            </div>
            <div className="text-xs font-medium text-black leading-tight">{labelForColor(color)}</div>
          </div>
        </div>
        <ChevronRight className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${isOpen ? "rotate-90" : ""}`} />
      </button>
    );
  };

  const bwSwatches = (color: string, setColor: (c: string) => void) => (
    <div className="bg-gray-50 border-t border-gray-100 px-5 py-3 flex gap-2">
      {LEATHER_BW.map((opt) => {
        const active = color.toLowerCase() === opt.color.toLowerCase();
        return (
          <button
            key={opt.color}
            title={opt.label}
            onClick={() => setColor(opt.color)}
            className={`w-8 h-8 rounded-full border shrink-0 transition-transform hover:scale-110 ${
              active ? "border-black ring-2 ring-black ring-offset-1" : "border-gray-300"
            }`}
            style={{ backgroundColor: opt.color }}
          />
        );
      })}
    </div>
  );

  return (
    <div className="fixed inset-0 h-[100dvh] bg-white flex flex-col z-50 font-['League_Spartan',sans-serif]">
      {/* Top bar */}
      <div className="border-b border-gray-200 bg-white z-10 shrink-0">
        <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 sm:h-14 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 text-[11px] tracking-widest text-gray-600 hover:text-black transition-colors uppercase sm:text-xs"
            >
              <X className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
            <button
              onClick={() => setSidebarOpen((open) => !open)}
              className="hidden items-center gap-1 border border-gray-200 px-3 py-2 text-[10px] tracking-widest uppercase text-gray-600 transition-colors hover:border-black hover:text-black md:flex"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {sidebarOpen ? "Hide" : "Customize"}
            </button>
          </div>

          <div className="hidden gap-0 border border-gray-200 sm:flex">
            <button
              onClick={() => {
                setActiveTab("materials");
                setSidebarOpen(true);
              }}
              className={`px-4 py-2 text-[10px] tracking-widest uppercase transition-colors ${
                activeTab === "materials" ? "bg-black text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Materials &amp; Colors
            </button>
            <button
              onClick={() => {
                setActiveTab("patches");
                setSidebarOpen(true);
              }}
              className={`px-4 py-2 text-[10px] tracking-widest uppercase transition-colors ${
                activeTab === "patches" ? "bg-black text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Design &amp; Patches
            </button>
          </div>

          <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
            <button
              onClick={() => {
                setShowSavedJackets(true);
                setShowComparison(false);
              }}
              className="flex items-center gap-1 border border-gray-200 px-2 py-2 text-[9px] tracking-widest uppercase text-gray-700 transition-colors hover:border-black sm:px-3 sm:text-[10px]"
              aria-label={`Saved jackets ${savedJackets.length} of ${MAX_SAVED_JACKETS}`}
            >
              {savedJacketsStatus === "loading" ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Bookmark className="h-3.5 w-3.5" />
              )}
              <span className="hidden lg:inline">Saved</span>
              <span>{savedJackets.length}/{MAX_SAVED_JACKETS}</span>
            </button>
            <div className="text-sm font-semibold tracking-wide">${price.toLocaleString()}</div>
            <button
              onClick={() => setShowSizeModal(true)}
              className="bg-black text-white px-3 py-2 text-[10px] tracking-widest uppercase hover:bg-gray-800 transition-colors sm:px-5"
            >
              Add to Cart
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2 border-t border-gray-100 px-3 py-2 sm:hidden">
          <div className="flex gap-0 border border-gray-200">
            <button
              onClick={() => {
                setActiveTab("materials");
                setSidebarOpen(true);
              }}
              className={`flex-1 px-3 py-2 text-[10px] tracking-widest uppercase transition-colors ${
                activeTab === "materials" ? "bg-black text-white" : "bg-white text-gray-600"
              }`}
            >
              Materials
            </button>
            <button
              onClick={() => {
                setActiveTab("patches");
                setSidebarOpen(true);
              }}
              className={`flex-1 px-3 py-2 text-[10px] tracking-widest uppercase transition-colors ${
                activeTab === "patches" ? "bg-black text-white" : "bg-white text-gray-600"
              }`}
            >
              Design
            </button>
          </div>
          <button
            onClick={() => setSidebarOpen((open) => !open)}
            className={`flex items-center gap-1 border px-3 py-2 text-[10px] tracking-widest uppercase transition-colors ${
              sidebarOpen ? "border-black bg-black text-white" : "border-gray-200 bg-white text-gray-700"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {sidebarOpen ? "Hide" : "Edit"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden md:flex-row">
        {/* Left sidebar */}
        <div
          className={`order-2 w-full shrink-0 border-t border-gray-200 bg-white transition-[height,width] duration-200 md:order-1 md:border-r md:border-t-0 ${
            sidebarOpen
              ? "h-[44dvh] overflow-y-auto md:h-auto md:w-64"
              : "h-0 overflow-hidden border-t-0 md:h-auto md:w-0 md:border-r-0"
          }`}
          aria-hidden={!sidebarOpen}
        >
          {activeTab === "materials" ? (
            <div>
              {/* Jacket edition */}
              <div className="border-b border-gray-100">
                {accordionHeader(
                  "Jacket",
                  isFootballersEdition ? sleeveColor : bodyColor,
                  isFootballersEdition ? `${leatherType} Footballers Leather` : "Classic Wool + Leather",
                )}
                {expandedSection === "Jacket" && (
                  <div className="bg-gray-50 border-t border-gray-100 px-4 py-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {(["Classic", "Footballers"] as JacketEdition[]).map((edition) => {
                        const active = jacketEdition === edition;
                        return (
                          <button
                            key={edition}
                            onClick={() => {
                              if (edition === "Footballers" && !canUseFootballersEdition) {
                                setShowFootballersAccess(true);
                                return;
                              }
                              setJacketEdition(edition);
                              setShowFootballersAccess(false);
                              if (edition === "Footballers") setExpandedSection("Body");
                            }}
                            className={`min-h-20 border px-3 py-3 text-left transition-colors ${
                              active ? "border-black bg-white" : "border-gray-200 bg-white text-gray-500 hover:border-black"
                            }`}
                          >
                            <span className="block text-[10px] tracking-widest uppercase">{edition}</span>
                            <span className="mt-1 block text-xs leading-snug">
                              {edition === "Footballers" ? "Full leather body and sleeves" : "Wool body with leather sleeves"}
                            </span>
                            {edition === "Footballers" && !canUseFootballersEdition && (
                              <span className="mt-2 block text-[9px] tracking-widest uppercase text-gray-400">
                                {footballersAccessLabel}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {showFootballersAccess && !canUseFootballersEdition && (
                      <div className="border border-gray-200 bg-white p-3">
                        <p className="text-xs leading-relaxed text-gray-600">
                          {shopifyAccessStatus === "ineligible"
                            ? "This Shopify account is signed in, but Footballers access has not been approved."
                            : shopifyAccessStatus === "checking"
                              ? "Checking your Shopify customer account for Footballers access."
                              : shopifyAccessStatus === "unavailable"
                                ? "Shopify customer access is temporarily unavailable."
                                : shopifyAccessStatus === "error"
                                  ? "Shopify could not verify your customer account. Please sign in again."
                                : "Sign in with an approved Shopify customer account to unlock Footballers jackets."}
                        </p>
                        {(shopifyAccessStatus === "signed-out" || shopifyAccessStatus === "error") &&
                        onShopifySignIn ? (
                          <button
                            onClick={onShopifySignIn}
                            className="mt-3 w-full bg-black px-3 py-2 text-[10px] tracking-widest uppercase text-white transition-colors hover:bg-gray-800"
                          >
                            Sign In With Shopify
                          </button>
                        ) : shopifyAccessStatus !== "checking" ? (
                          <button
                            onClick={() => navigate("/contact")}
                            className="mt-3 w-full bg-black px-3 py-2 text-[10px] tracking-widest uppercase text-white transition-colors hover:bg-gray-800"
                          >
                            Request Footballers Access
                          </button>
                        ) : null}
                      </div>
                    )}
                    {isFootballersEdition && (
                      <p className="text-[10px] leading-relaxed text-gray-500">
                        Footballers jackets use one full-leather shell. Pick Nappa for a smoother finish or Cowhide for a tougher grain.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Body — grouped wool color picker */}
              <div className="border-b border-gray-100">
                {accordionHeader("Body", isFootballersEdition ? sleeveColor : bodyColor, isFootballersEdition ? `${leatherType} Leather` : "Wool")}
                {expandedSection === "Body" && (
                  isFootballersEdition ? (
                    <div className="bg-gray-50 border-t border-gray-100 px-5 py-3 space-y-3">
                      <div>
                        <div className="text-[10px] tracking-widest uppercase text-gray-400 mb-1.5">Full Leather Color</div>
                        <div className="flex gap-2">
                          {LEATHER_BW.map((opt) => {
                            const active = sleeveColor.toLowerCase() === opt.color.toLowerCase();
                            return (
                              <button
                                key={opt.color}
                                title={opt.label}
                                onClick={() => setSleeveColor(opt.color)}
                                className={`w-8 h-8 rounded-full border shrink-0 transition-transform hover:scale-110 ${
                                  active ? "border-black ring-2 ring-black ring-offset-1" : "border-gray-300"
                                }`}
                                style={{ backgroundColor: opt.color }}
                              />
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] tracking-widest uppercase text-gray-400 mb-1.5">Leather Type</div>
                        <div className="flex gap-2">
                          {LEATHER_TYPES.map((type) => (
                            <button
                              key={type}
                              onClick={() => setLeatherType(type)}
                              className={`px-4 py-1.5 text-xs tracking-wide border transition-colors ${
                                leatherType === type
                                  ? "bg-black text-white border-black"
                                  : "border-gray-300 text-gray-600 hover:border-black"
                              }`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border-t border-gray-100 py-1">
                      {COLOR_GROUPS.map(({ group, shades }) => {
                        const groupOpen = openBodyGroup === group;
                        return (
                          <div key={group} className="border-b border-gray-100 last:border-b-0">
                            <button
                              onClick={() => setOpenBodyGroup(groupOpen ? null : group)}
                              className="w-full flex items-center justify-between px-5 py-2 hover:bg-gray-100 transition-colors"
                            >
                              <span className="text-[11px] tracking-widest uppercase text-gray-500">{group}</span>
                              <ChevronRight className={`w-3 h-3 text-gray-400 transition-transform ${groupOpen ? "rotate-90" : ""}`} />
                            </button>
                            {groupOpen && (
                              <div className="px-5 pb-3 pt-1 flex flex-wrap gap-2">
                                {shades.map((shade) => {
                                  const active = bodyColor.toLowerCase() === shade.color.toLowerCase();
                                  return (
                                    <button
                                      key={shade.color}
                                      title={shade.label}
                                      onClick={() => setBodyColor(shade.color)}
                                      className={`w-8 h-8 rounded-full border shrink-0 transition-transform hover:scale-110 ${
                                        active ? "border-black ring-2 ring-black ring-offset-1" : "border-gray-300"
                                      }`}
                                      style={{ backgroundColor: shade.color }}
                                    />
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </div>

              {/* Sleeves — black/white leather + leather type */}
              <div className="border-b border-gray-100">
                {accordionHeader("Sleeves", sleeveColor, `${leatherType} Leather`)}
                {expandedSection === "Sleeves" && (
                  <div className="bg-gray-50 border-t border-gray-100 px-5 py-3 space-y-3">
                    <div>
                      <div className="text-[10px] tracking-widest uppercase text-gray-400 mb-1.5">Color</div>
                      <div className="flex gap-2">
                        {LEATHER_BW.map((opt) => {
                          const active = sleeveColor.toLowerCase() === opt.color.toLowerCase();
                          return (
                            <button
                              key={opt.color}
                              title={opt.label}
                              onClick={() => setSleeveColor(opt.color)}
                              className={`w-8 h-8 rounded-full border shrink-0 transition-transform hover:scale-110 ${
                                active ? "border-black ring-2 ring-black ring-offset-1" : "border-gray-300"
                              }`}
                              style={{ backgroundColor: opt.color }}
                            />
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] tracking-widest uppercase text-gray-400 mb-1.5">Leather Type</div>
                      <div className="flex gap-2">
                        {LEATHER_TYPES.map((type) => (
                          <button
                            key={type}
                            onClick={() => setLeatherType(type)}
                            className={`px-4 py-1.5 text-xs tracking-wide border transition-colors ${
                              leatherType === type
                                ? "bg-black text-white border-black"
                                : "border-gray-300 text-gray-600 hover:border-black"
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Pockets / Snaps / Knit Trim — black & white only */}
              {BW_SECTIONS.map(({ section, color, setColor, material }) => (
                <div key={section} className="border-b border-gray-100">
                  {accordionHeader(section, color, material)}
                  {expandedSection === section && bwSwatches(color, setColor)}
                </div>
              ))}

              <div className="border-b border-gray-100">
                {accordionHeader("Inside Lining", liningColor, "Quilted")}
                {expandedSection === "Inside Lining" && bwSwatches(liningColor, setLiningColor)}
              </div>

              {/* Fixed signature details */}
              <div className="px-4 py-4 space-y-3">
                <p className="text-[10px] tracking-widest uppercase text-gray-400">Signature details</p>
                <ul className="space-y-2 text-xs text-gray-600">
                  <li className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0 border border-gray-300" style={{ backgroundColor: "#f0efe9" }} />
                    Regular collar
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: "#141414" }} />
                    {labelForColor(liningColor)} quilted lining
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: "#c9a84c" }} />
                    Gold chest badge, stars &amp; accents
                  </li>
                </ul>
                <p className="text-[10px] text-gray-400 leading-relaxed pt-1">
                  Every jacket ships with the Manoir Kits “One of One · Legends Edition” lining patch.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-6">
              <p className="text-[10px] tracking-widest uppercase text-gray-400">
                Back &amp; sleeve design · Drag the jacket to see the back
              </p>

              {/* Stars */}
              <div>
                <label className="text-[10px] tracking-widest uppercase text-gray-400 block mb-1.5">
                  Gold Stars ({backStars} of 5)
                </label>
                <div className="flex flex-wrap items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setBackStars(backStars === n ? n - 1 : n)}
                      className="flex h-8 w-8 items-center justify-center"
                      title={`${n} star${n === 1 ? "" : "s"}`}
                    >
                      <Star className={`w-5 h-5 ${n <= backStars ? "fill-[#c9a84c] text-[#c9a84c]" : "text-gray-300"}`} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Back number */}
              <div>
                <label className="text-[10px] tracking-widest uppercase text-gray-400 block mb-1.5">Back Number (00–99)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={backNumber}
                  onChange={(e) => onBackNumberChange(e.target.value)}
                  placeholder="00"
                  className="w-16 border border-gray-300 py-2 text-center text-base font-semibold tracking-widest focus:outline-none focus:border-black"
                />
              </div>

              {/* Sleeve numbers — each arm has its own set */}
              <div className="space-y-3">
                {([
                  { side: "left" as const, label: "Left Sleeve Numbers (up to 5)", values: leftSleeveNumbers },
                  { side: "right" as const, label: "Right Sleeve Numbers (up to 5)", values: rightSleeveNumbers },
                ]).map(({ side, label, values }) => (
                  <div key={side}>
                    <label className="text-[10px] tracking-widest uppercase text-gray-400 block mb-1.5">{label}</label>
                    <div className="flex gap-1.5">
                      {values.map((value, i) => (
                        <input
                          key={i}
                          type="text"
                          inputMode="numeric"
                          value={value}
                          onChange={(e) => onSleeveNumberChange(side, i, e.target.value)}
                          placeholder="00"
                          className="w-10 border border-gray-300 px-0 py-2 text-center text-xs tracking-widest focus:outline-none focus:border-black"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Back and sleeve artwork colors are intentionally independent. */}
              <div>
                <label className="text-[10px] tracking-widest uppercase text-gray-400 block mb-1.5">Back Design Color</label>
                <div className="flex gap-2">
                  {PRINT_COLORS.map((opt) => (
                    <button
                      key={opt.color}
                      title={opt.label}
                      onClick={() => setBackPrintColor(opt.color)}
                      className={`w-8 h-8 rounded-full border shrink-0 ${
                        backPrintColor.toLowerCase() === opt.color.toLowerCase()
                          ? "border-black ring-2 ring-black ring-offset-1"
                          : "border-gray-300"
                      }`}
                      style={{ backgroundColor: opt.color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] tracking-widest uppercase text-gray-400 block mb-1.5">Sleeve Number Color</label>
                <div className="flex gap-2">
                  {PRINT_COLORS.map((opt) => (
                    <button
                      key={opt.color}
                      title={opt.label}
                      onClick={() => setSleevePrintColor(opt.color)}
                      className={`w-8 h-8 rounded-full border shrink-0 ${
                        sleevePrintColor.toLowerCase() === opt.color.toLowerCase()
                          ? "border-black ring-2 ring-black ring-offset-1"
                          : "border-gray-300"
                      }`}
                      style={{ backgroundColor: opt.color }}
                    />
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-gray-400 leading-relaxed">
                Gold stars, the chest badge and “EST. 2026” are fixed brand details. Pick your country or city from the dropdown
                below the jacket.
              </p>
            </div>
          )}
        </div>

        {/* Jacket preview */}
        <div
          className={`order-1 relative bg-[#f0ede8] overflow-hidden transition-[height] duration-200 md:order-2 md:h-auto md:min-h-0 md:flex-1 ${
            sidebarOpen ? "h-[46dvh] min-h-[260px] flex-none sm:min-h-[340px]" : "min-h-[320px] flex-1"
          }`}
        >
          <VarsityJacketViewer
            bodyColor={renderedBodyColor}
            bodyMaterial={renderedBodyMaterial}
            sleeveColor={sleeveColor}
            leatherType={leatherType}
            trimColor={trimColor}
            snapColor={snapColor}
            pocketColor={pocketColor}
            liningColor={liningColor}
            backDesign={backDesign}
          />

          {/* Interior details card */}
          <button
            onClick={() => setShowInterior((v) => !v)}
            className={`absolute top-3 right-3 z-20 px-3 py-2 text-[10px] tracking-widest uppercase border transition-colors sm:top-4 sm:right-4 sm:px-4 ${
              showInterior
                ? "bg-black text-white border-black"
                : "bg-white text-gray-700 border-gray-300 hover:border-black"
            }`}
          >
            {showInterior ? "Close Details" : "Interior Details"}
          </button>
          {showInterior && (
            <div className="absolute top-14 left-3 right-3 z-30 max-h-[calc(100%-4.5rem)] overflow-y-auto bg-white border border-gray-200 shadow-xl p-4 space-y-4 sm:left-auto sm:right-4 sm:w-60">
              <p className="text-[10px] tracking-widest uppercase text-gray-400">Sewn inside every jacket</p>
              <div>
                <div className="bg-[#1a1a1a] p-3 flex items-center justify-center rounded-sm">
                  {interiorImages ? (
                    <img src={interiorImages.label} alt="Neck label" className="w-40" />
                  ) : (
                    <div className="w-40 h-20" />
                  )}
                </div>
                <p className="mt-1.5 text-[10px] tracking-widest uppercase text-gray-500">Leather neck label</p>
              </div>
              <div>
                <div className="bg-[#1a1a1a] p-3 flex items-center justify-center rounded-sm">
                  {interiorImages ? (
                    <img src={interiorImages.patch} alt="One-of-one interior patch" className="w-32" />
                  ) : (
                    <div className="w-32 h-40" />
                  )}
                </div>
                <p className="mt-1.5 text-[10px] tracking-widest uppercase text-gray-500">One-of-one lining patch</p>
              </div>
            </div>
          )}

          {/* City picker + drag hint */}
          <div className="absolute bottom-3 left-1/2 flex w-[calc(100%-1.5rem)] -translate-x-1/2 flex-col items-center gap-2 sm:bottom-4 sm:w-auto">
            <select
              value={backCity}
              onChange={(e) => setBackCity(e.target.value)}
              className="w-full max-w-xs cursor-pointer bg-white border border-gray-300 px-3 py-2 text-[11px] tracking-widest uppercase focus:outline-none focus:border-black sm:w-auto sm:px-4 sm:text-xs"
            >
              <optgroup label="Countries">
                {WORLD_CUP_COUNTRIES.map((country) => (
                  <option key={`country-${country}`} value={country}>
                    {country}
                  </option>
                ))}
              </optgroup>
              {COUNTRY_CITIES.map(({ country, cities }) => (
                <optgroup key={country} label={country}>
                  {[...cities].sort((a, b) => a.localeCompare(b)).map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <span className="text-center text-[9px] tracking-widest uppercase text-gray-400 pointer-events-none select-none sm:text-[10px]">
              <span className="sm:hidden">One finger to rotate · Pinch to zoom</span>
              <span className="hidden sm:inline">Drag to rotate · Scroll to zoom</span>
            </span>
          </div>
        </div>
      </div>

      {/* Shopify-backed saved jacket comparisons */}
      {showSavedJackets && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
          onClick={() => setShowSavedJackets(false)}
        >
          <div
            className="flex max-h-[92dvh] w-full max-w-4xl flex-col bg-white shadow-2xl sm:max-h-[86dvh] sm:rounded"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 sm:px-6">
              <div>
                <p className="text-[10px] tracking-[0.24em] text-gray-400 uppercase">Saved to Shopify</p>
                <h2 className="mt-1 text-base font-semibold tracking-widest uppercase">
                  {showComparison ? "Compare Jackets" : `Saved Jackets ${savedJackets.length}/${MAX_SAVED_JACKETS}`}
                </h2>
              </div>
              <button
                onClick={() => setShowSavedJackets(false)}
                className="p-2 text-gray-400 transition-colors hover:text-black"
                aria-label="Close saved jackets"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 sm:p-6">
              {!shopifySignedIn ? (
                <div className="mx-auto max-w-md py-8 text-center">
                  <Bookmark className="mx-auto h-8 w-8 text-gray-300" />
                  <h3 className="mt-4 text-sm font-semibold tracking-widest uppercase">Sign in to save jackets</h3>
                  <p className="mt-2 text-xs leading-relaxed text-gray-500">
                    Save up to four jacket builds to your Shopify account and open them on another device.
                  </p>
                  {onShopifySignIn && (
                    <button
                      onClick={onShopifySignIn}
                      className="mt-5 bg-black px-6 py-3 text-[10px] tracking-widest text-white uppercase transition-colors hover:bg-gray-800"
                    >
                      Sign In With Shopify
                    </button>
                  )}
                </div>
              ) : savedJacketsStatus === "loading" ? (
                <div className="flex items-center justify-center gap-2 py-12 text-xs tracking-widest text-gray-500 uppercase">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Loading saved jackets
                </div>
              ) : showComparison ? (
                <div>
                  <button
                    onClick={() => setShowComparison(false)}
                    className="mb-4 text-[10px] tracking-widest text-gray-500 underline underline-offset-4 uppercase"
                  >
                    Back to saved jackets
                  </button>
                  <div className="overflow-x-auto">
                    <div className="grid min-w-[640px] grid-cols-[130px_repeat(4,minmax(120px,1fr))] border-l border-t border-gray-200 text-xs">
                    <div className="border-b border-r border-gray-200 bg-gray-50 p-3" />
                    {Array.from({ length: MAX_SAVED_JACKETS }, (_, index) => {
                      const jacket = savedJackets[index];
                      return (
                        <div key={jacket?.id ?? `empty-${index}`} className="border-b border-r border-gray-200 p-3">
                          {jacket ? (
                            <>
                              <div className="mb-2 flex h-12 overflow-hidden border border-gray-200">
                                <span className="flex-1" style={{ backgroundColor: savedJacketBodyColor(jacket) }} />
                                <span className="w-1/3" style={{ backgroundColor: jacket.configuration.sleeveColor }} />
                              </div>
                              <p className="font-semibold tracking-wide">{jacket.name}</p>
                            </>
                          ) : (
                            <span className="text-gray-300">Empty</span>
                          )}
                        </div>
                      );
                    })}
                    {[
                      ["Edition", (jacket: SavedJacket) => jacket.configuration.jacketEdition],
                      ["Body", (jacket: SavedJacket) => labelForColor(savedJacketBodyColor(jacket))],
                      ["Sleeves", (jacket: SavedJacket) => labelForColor(jacket.configuration.sleeveColor)],
                      ["Leather", (jacket: SavedJacket) => jacket.configuration.leatherType],
                      ["City", (jacket: SavedJacket) => jacket.configuration.backCity],
                      ["Number", (jacket: SavedJacket) => jacket.configuration.backNumber || "None"],
                      ["Size", (jacket: SavedJacket) => jacket.configuration.selectedSize || "Not picked"],
                    ].flatMap(([label, read]) => [
                      <div key={`${String(label)}-label`} className="border-b border-r border-gray-200 bg-gray-50 p-3 font-medium uppercase tracking-wide">
                        {String(label)}
                      </div>,
                      ...Array.from({ length: MAX_SAVED_JACKETS }, (_, index) => {
                        const jacket = savedJackets[index];
                        return (
                          <div key={`${String(label)}-${index}`} className="border-b border-r border-gray-200 p-3 text-gray-600">
                            {jacket ? (read as (item: SavedJacket) => string)(jacket) : "—"}
                          </div>
                        );
                      }),
                    ])}
                    </div>
                  </div>
                  <p className="mt-3 text-[10px] leading-relaxed text-gray-400 sm:hidden">
                    Swipe the comparison table sideways to see every saved jacket.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-4">
                    <button
                      disabled={savedJacketsStatus === "saving" || (!activeSavedJacketId && savedJackets.length >= MAX_SAVED_JACKETS)}
                      onClick={() => void saveCurrentJacket(false)}
                      className="flex items-center gap-2 bg-black px-4 py-3 text-[10px] tracking-widest text-white uppercase transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {savedJacketsStatus === "saving" ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Bookmark className="h-3.5 w-3.5" />
                      )}
                      {activeSavedJacketId ? "Update Loaded Comp" : "Save Current Jacket"}
                    </button>
                    {activeSavedJacketId && savedJackets.length < MAX_SAVED_JACKETS && (
                      <button
                        disabled={savedJacketsStatus === "saving"}
                        onClick={() => void saveCurrentJacket(true)}
                        className="border border-gray-300 px-4 py-3 text-[10px] tracking-widest uppercase transition-colors hover:border-black disabled:opacity-40"
                      >
                        Save As New
                      </button>
                    )}
                    <button
                      disabled={savedJackets.length < 2}
                      onClick={() => setShowComparison(true)}
                      className="border border-gray-300 px-4 py-3 text-[10px] tracking-widest uppercase transition-colors hover:border-black disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Compare All
                    </button>
                  </div>

                  {savedJackets.length === 0 ? (
                    <div className="py-10 text-center">
                      <p className="text-sm tracking-widest uppercase">No saved jackets yet</p>
                      <p className="mt-2 text-xs text-gray-500">Save the jacket currently shown in the builder as your first comp.</p>
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {savedJackets.map((jacket) => {
                        const loaded = activeSavedJacketId === jacket.id;
                        return (
                          <article key={jacket.id} className={`border p-3 ${loaded ? "border-black" : "border-gray-200"}`}>
                            <div className="flex h-24 overflow-hidden border border-gray-100">
                              <span className="flex-1" style={{ backgroundColor: savedJacketBodyColor(jacket) }} />
                              <span className="w-1/3" style={{ backgroundColor: jacket.configuration.sleeveColor }} />
                            </div>
                            <div className="mt-3 flex items-start justify-between gap-2">
                              <div>
                                <h3 className="text-xs font-semibold tracking-widest uppercase">{jacket.name}</h3>
                                <p className="mt-1 text-[10px] text-gray-500">
                                  {jacket.configuration.jacketEdition} · {jacket.configuration.backCity}
                                </p>
                              </div>
                              {loaded && <Check className="h-4 w-4 shrink-0" />}
                            </div>
                            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                              <button
                                onClick={() => loadConfiguration(jacket)}
                                className="bg-black px-3 py-2 text-[9px] tracking-widest text-white uppercase transition-colors hover:bg-gray-800"
                              >
                                {loaded ? "Loaded" : "Load"}
                              </button>
                              <button
                                disabled={savedJacketsStatus === "saving"}
                                onClick={() => void deleteSavedJacket(jacket.id)}
                                className="border border-gray-300 p-2 text-gray-500 transition-colors hover:border-red-500 hover:text-red-600 disabled:opacity-40"
                                aria-label={`Delete ${jacket.name}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {savedJacketsError && (
                <p role="alert" className="mt-4 border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-700">
                  {savedJacketsError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Size picker modal */}
      {showSizeModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4" onClick={() => setShowSizeModal(false)}>
          <div className="bg-white w-full max-w-sm rounded shadow-xl p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold tracking-widest uppercase">Pick a size and proceed to checkout!</h3>
              <button onClick={() => setShowSizeModal(false)} className="text-gray-400 hover:text-black transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Please choose the size from the options below. Once you place your order, the size cannot be changed. Not sure what size to choose?{" "}
              <button className="underline">See our size guide.</button>
            </p>

            <div className="grid grid-cols-4 gap-2 mb-5">
              {SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    setSelectedSize(size);
                    setCheckoutError(null);
                  }}
                  className={`py-2 border text-xs font-medium tracking-wide transition-colors ${
                    selectedSize === size ? "bg-black text-white border-black" : "border-gray-300 hover:border-black"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>

            <button
              disabled={!selectedSize || checkoutPending}
              onClick={proceedToShopify}
              className="w-full bg-black text-white py-3 text-xs tracking-widest uppercase disabled:opacity-40 hover:bg-gray-800 transition-colors"
            >
              {checkoutPending ? "Creating Shopify Checkout…" : "Checkout Securely on Shopify"}
            </button>

            {checkoutError && (
              <p role="alert" className="mt-3 border border-red-200 bg-red-50 p-3 text-center text-[11px] leading-relaxed text-red-700">
                {checkoutError}
              </p>
            )}

            <p className="text-[10px] text-gray-400 text-center mt-3">
              Available payment methods are shown and processed securely by Shopify.
            </p>

            <div className="mt-3 bg-amber-50 border border-amber-200 p-3 text-center">
              <p className="text-[10px] tracking-wide text-amber-800 uppercase">
                Final Sale — No Returns or Exchanges · 4–6 Week Production Time
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
