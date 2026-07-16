import { useEffect, useState } from "react";
import { ChevronRight, X, Star } from "lucide-react";
import { VarsityJacketViewer, renderNeckLabel, renderInteriorPatch, type BackDesign } from "../components/VarsityJacketViewer";
import { useNavigate } from "react-router-dom";

const SIZES = ["XXS", "XS", "S", "M", "L", "XL", "2XL", "3XL"];

// Wool body shades, grouped Figma-style. Gold/metallic and yellow shades are
// intentionally excluded for now (gold is reserved for the fixed brand
// details; yellows are skipped per spec).
const COLOR_GROUPS: { group: string; shades: { label: string; color: string }[] }[] = [
  {
    group: "Neutrals",
    shades: [
      { label: "Bright White", color: "#f1ead9" },
      { label: "Cream", color: "#e7dec8" },
      { label: "Bone", color: "#d9cfba" },
      { label: "Stone Grey", color: "#9a958c" },
      { label: "Charcoal", color: "#2c2c2c" },
      { label: "Black", color: "#141414" },
    ],
  },
  {
    group: "Reds",
    shades: [
      { label: "Maroon", color: "#5e1b26" },
      { label: "Burgundy", color: "#6b1e2a" },
      { label: "Cardinal", color: "#8f2130" },
      { label: "Crimson", color: "#a11d2e" },
      { label: "Brick", color: "#7c3a34" },
    ],
  },
  {
    group: "Greens",
    shades: [
      { label: "Forest", color: "#1a3d2b" },
      { label: "Hunter", color: "#24503a" },
      { label: "Bottle", color: "#0f3d2e" },
      { label: "Olive", color: "#4a5320" },
      { label: "Sage", color: "#7fa88a" },
    ],
  },
  {
    group: "Blues",
    shades: [
      { label: "Navy", color: "#1e2d5a" },
      { label: "Royal Blue", color: "#20408f" },
      { label: "Medium Blue", color: "#2f5fb0" },
      { label: "France Blue", color: "#3a6bd6" },
      { label: "Baby Blue", color: "#8fb8e0" },
      { label: "Powder", color: "#aecbe8" },
    ],
  },
  {
    group: "Purples",
    shades: [
      { label: "Deep Purple", color: "#38265a" },
      { label: "Grape", color: "#442a6b" },
      { label: "Violet", color: "#5b3a86" },
      { label: "Plum", color: "#5a2a52" },
    ],
  },
  {
    group: "Oranges",
    shades: [
      { label: "Terracotta", color: "#bd6a45" },
      { label: "Burnt Orange", color: "#b5531f" },
      { label: "Rust", color: "#9c4419" },
      { label: "Coral", color: "#d47a5a" },
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

function labelForColor(color: string) {
  for (const group of COLOR_GROUPS) {
    const shade = group.shades.find((s) => s.color.toLowerCase() === color.toLowerCase());
    if (shade) return shade.label;
  }
  const bw = LEATHER_BW.find((s) => s.color.toLowerCase() === color.toLowerCase());
  return bw?.label ?? color;
}

// City list compiled from the current clubs of the top five leagues.
const CITY_LEAGUES: { league: string; cities: string[] }[] = [
  {
    league: "Premier League · England",
    cities: [
      "London",
      "Manchester",
      "Liverpool",
      "Birmingham",
      "Newcastle",
      "Nottingham",
      "Wolverhampton",
      "Brighton",
      "Southampton",
      "Leicester",
      "Ipswich",
      "Bournemouth",
    ],
  },
  {
    league: "La Liga · Spain",
    cities: [
      "Madrid",
      "Barcelona",
      "Sevilla",
      "Valencia",
      "Bilbao",
      "San Sebastián",
      "Vigo",
      "Villarreal",
      "Girona",
      "Las Palmas",
      "Palma",
      "Pamplona",
    ],
  },
  {
    league: "Bundesliga · Germany",
    cities: [
      "Munich",
      "Dortmund",
      "Leipzig",
      "Leverkusen",
      "Frankfurt",
      "Berlin",
      "Stuttgart",
      "Mönchengladbach",
      "Wolfsburg",
      "Freiburg",
      "Bremen",
      "Hamburg",
    ],
  },
  {
    league: "Ligue 1 · France",
    cities: [
      "Paris",
      "Marseille",
      "Lyon",
      "Monaco",
      "Lille",
      "Nice",
      "Rennes",
      "Lens",
      "Nantes",
      "Strasbourg",
      "Toulouse",
      "Saint-Étienne",
    ],
  },
  {
    league: "Serie A · Italy",
    cities: [
      "Milan",
      "Turin",
      "Rome",
      "Naples",
      "Florence",
      "Bergamo",
      "Bologna",
      "Genoa",
      "Verona",
      "Udine",
      "Como",
      "Cagliari",
    ],
  },
];

const PRINT_COLORS = [
  { label: "White", color: "#f4f2ea" },
  { label: "Black", color: "#1a1a1a" },
];

export function JacketBuilderPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"materials" | "patches">("materials");
  const [expandedSection, setExpandedSection] = useState<string | null>("Body");
  const [openBodyGroup, setOpenBodyGroup] = useState<string | null>("Neutrals");

  const [bodyColor, setBodyColor] = useState("#141414");
  const [sleeveColor, setSleeveColor] = useState("#f4f2ea");
  const [leatherType, setLeatherType] = useState<LeatherType>("Nappa");
  const [pocketColor, setPocketColor] = useState("#f4f2ea");
  const [snapColor, setSnapColor] = useState("#f4f2ea");
  const [trimColor, setTrimColor] = useState("#f4f2ea");

  const [showSizeModal, setShowSizeModal] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [wishlisted, setWishlisted] = useState(false);
  const [showInterior, setShowInterior] = useState(false);
  const [interiorImages, setInteriorImages] = useState<{ label: string; patch: string } | null>(null);

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
  const [backNumber, setBackNumber] = useState("10");
  const [sleeveNumbers, setSleeveNumbers] = useState(["", "", "", "", ""]);
  const [backCity, setBackCity] = useState("Madrid");
  const [printColor, setPrintColor] = useState(PRINT_COLORS[0].color);

  const backDesign: BackDesign = {
    stars: backStars,
    backNumber,
    sleeveNumbers,
    city: backCity,
    printColor,
  };

  const onBackNumberChange = (value: string) => setBackNumber(value.replace(/\D/g, "").slice(0, 2));
  const onSleeveNumberChange = (index: number, value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 2);
    setSleeveNumbers((numbers) => numbers.map((n, i) => (i === index ? digits : n)));
  };

  const price = 895;

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
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4 border-b border-gray-200 bg-white z-10 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-[11px] sm:text-xs tracking-widest text-gray-600 hover:text-black transition-colors uppercase"
        >
          <X className="w-3.5 h-3.5" />
          <span>Exit</span>
        </button>

        <div className="order-3 flex w-full gap-0 border border-gray-200 sm:order-none sm:w-auto">
          <button
            onClick={() => setActiveTab("materials")}
            className={`flex-1 px-3 py-2 text-[10px] tracking-widest uppercase transition-colors sm:flex-none sm:px-4 ${
              activeTab === "materials" ? "bg-black text-white" : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Materials &amp; Colors
          </button>
          <button
            onClick={() => setActiveTab("patches")}
            className={`flex-1 px-3 py-2 text-[10px] tracking-widest uppercase transition-colors sm:flex-none sm:px-4 ${
              activeTab === "patches" ? "bg-black text-white" : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Design &amp; Patches
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={() => setWishlisted((w) => !w)} className="text-gray-400 hover:text-black transition-colors">
            <Star className={`w-4 h-4 ${wishlisted ? "fill-black text-black" : ""}`} />
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <div className="text-sm font-semibold tracking-wide">${price.toLocaleString()}</div>
          <button
            onClick={() => setShowSizeModal(true)}
            className="bg-black text-white px-3 py-2 text-[10px] tracking-widest uppercase hover:bg-gray-800 transition-colors sm:px-5"
          >
            Add to Cart
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden md:flex-row">
        {/* Left sidebar */}
        <div className="order-2 h-[44dvh] w-full shrink-0 border-t border-gray-200 overflow-y-auto bg-white md:order-1 md:h-auto md:w-64 md:border-r md:border-t-0">
          {activeTab === "materials" ? (
            <div>
              {/* Body — grouped wool color picker */}
              <div className="border-b border-gray-100">
                {accordionHeader("Body", bodyColor, "Wool")}
                {expandedSection === "Body" && (
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
                    Black quilted lining
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: "#c9a84c" }} />
                    Gold chest badge, stars &amp; accents
                  </li>
                </ul>
                <p className="text-[10px] text-gray-400 leading-relaxed pt-1">
                  Every jacket ships with the Manoir Kits “One of One · Legends Edition” neck tag.
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
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setBackStars(backStars === n ? Math.max(1, n - 1) : n)} className="p-1">
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

              {/* Sleeve numbers */}
              <div>
                <label className="text-[10px] tracking-widest uppercase text-gray-400 block mb-1.5">
                  Sleeve Numbers (up to 5, run down the arms)
                </label>
                <div className="flex gap-1.5">
                  {sleeveNumbers.map((value, i) => (
                    <input
                      key={i}
                      type="text"
                      inputMode="numeric"
                      value={value}
                      onChange={(e) => onSleeveNumberChange(i, e.target.value)}
                      placeholder="00"
                      className="w-10 border border-gray-300 px-0 py-2 text-center text-xs tracking-widest focus:outline-none focus:border-black"
                    />
                  ))}
                </div>
              </div>

              {/* Print color — black or white only */}
              <div>
                <label className="text-[10px] tracking-widest uppercase text-gray-400 block mb-1.5">Print Color</label>
                <div className="flex gap-2">
                  {PRINT_COLORS.map((opt) => (
                    <button
                      key={opt.color}
                      title={opt.label}
                      onClick={() => setPrintColor(opt.color)}
                      className={`w-8 h-8 rounded-full border shrink-0 ${
                        printColor.toLowerCase() === opt.color.toLowerCase()
                          ? "border-black ring-2 ring-black ring-offset-1"
                          : "border-gray-300"
                      }`}
                      style={{ backgroundColor: opt.color }}
                    />
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-gray-400 leading-relaxed">
                Gold stars, the chest badge and “EST. 2026” are fixed brand details. Pick your city from the dropdown
                below the jacket.
              </p>
            </div>
          )}
        </div>

        {/* Jacket preview */}
        <div className="order-1 relative h-[46dvh] min-h-[300px] flex-none bg-[#f0ede8] overflow-hidden sm:min-h-[340px] md:order-2 md:h-auto md:min-h-0 md:flex-1">
          <VarsityJacketViewer
            bodyColor={bodyColor}
            sleeveColor={sleeveColor}
            leatherType={leatherType}
            trimColor={trimColor}
            snapColor={snapColor}
            pocketColor={pocketColor}
            liningColor="#141414"
            backDesign={backDesign}
          />

          {/* Interior details card */}
          <button
            onClick={() => setShowInterior((v) => !v)}
            className={`absolute top-3 right-3 px-3 py-2 text-[10px] tracking-widest uppercase border transition-colors sm:top-4 sm:right-4 sm:px-4 ${
              showInterior
                ? "bg-black text-white border-black"
                : "bg-white text-gray-700 border-gray-300 hover:border-black"
            }`}
          >
            {showInterior ? "Close Details" : "Interior Details"}
          </button>
          {showInterior && (
            <div className="absolute top-14 left-3 right-3 max-h-[calc(100%-4.5rem)] overflow-y-auto bg-white border border-gray-200 shadow-xl p-4 space-y-4 z-10 sm:left-auto sm:right-4 sm:w-60">
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
              className="w-full max-w-xs bg-white border border-gray-300 px-3 py-2 text-[11px] tracking-widest uppercase focus:outline-none focus:border-black cursor-pointer sm:w-auto sm:px-4 sm:text-xs"
            >
              {CITY_LEAGUES.map(({ league, cities }) => (
                <optgroup key={league} label={league}>
                  {cities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <span className="text-center text-[9px] tracking-widest uppercase text-gray-400 pointer-events-none select-none sm:text-[10px]">
              Drag to rotate · Scroll to zoom
            </span>
          </div>
        </div>
      </div>

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
                  onClick={() => setSelectedSize(size)}
                  className={`py-2 border text-xs font-medium tracking-wide transition-colors ${
                    selectedSize === size ? "bg-black text-white border-black" : "border-gray-300 hover:border-black"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>

            <button
              disabled={!selectedSize}
              className="w-full bg-black text-white py-3 text-xs tracking-widest uppercase disabled:opacity-40 hover:bg-gray-800 transition-colors"
            >
              Checkout
            </button>

            <p className="text-[10px] text-gray-400 text-center mt-3">
              We accept all debit/credit cards, as well as payment via PayPal.
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
