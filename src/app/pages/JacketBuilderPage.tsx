import { useState } from "react";
import { ChevronRight, X, Star } from "lucide-react";
import { JacketViewer3D, type BackDesign } from "../components/JacketViewer3D";
import { useNavigate } from "react-router-dom";

const SIZES = ["XXS", "XS", "S", "M", "L", "XL", "2XL", "3XL"];

// Grouped shade palette shared by the body (wool) and sleeves (leather).
// Gold / metallic / goldenrod shades are intentionally excluded — gold is
// reserved for the fixed brand details (chest badge, stars, accents).
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
    group: "Yellows",
    shades: [
      { label: "Pale Yellow", color: "#ece3ac" },
      { label: "Butter", color: "#eede86" },
      { label: "Canary", color: "#f0e24c" },
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

function labelForColor(color: string) {
  for (const group of COLOR_GROUPS) {
    const shade = group.shades.find((s) => s.color.toLowerCase() === color.toLowerCase());
    if (shade) return shade.label;
  }
  return color;
}

// Major European football cities across the top five leagues.
const CITIES = [
  // Premier League
  "London",
  "Manchester",
  "Liverpool",
  "Newcastle",
  "Birmingham",
  "Leeds",
  // La Liga
  "Madrid",
  "Barcelona",
  "Sevilla",
  "Valencia",
  "Bilbao",
  "San Sebastián",
  // Bundesliga
  "Munich",
  "Dortmund",
  "Berlin",
  "Hamburg",
  "Leverkusen",
  "Frankfurt",
  // Serie A
  "Milan",
  "Turin",
  "Rome",
  "Naples",
  "Florence",
  "Bergamo",
  // Ligue 1
  "Paris",
  "Marseille",
  "Lyon",
  "Monaco",
  "Lille",
  "Nice",
  // Other iconic footballing cities
  "Lisbon",
  "Porto",
  "Amsterdam",
  "Glasgow",
];

export function JacketBuilderPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"materials" | "patches">("materials");
  const [expandedSection, setExpandedSection] = useState<string | null>("Body");
  const [openColorGroup, setOpenColorGroup] = useState<Record<string, string | null>>({
    Body: "Neutrals",
    Sleeves: "Neutrals",
  });

  const [bodyColor, setBodyColor] = useState("#141414");
  const [sleeveColor, setSleeveColor] = useState("#f1ead9");

  const [showSizeModal, setShowSizeModal] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [wishlisted, setWishlisted] = useState(false);

  const [backStars, setBackStars] = useState(5);
  const [backNumber, setBackNumber] = useState("10");
  const [sleeveNumbers, setSleeveNumbers] = useState(["", "", "", "", ""]);
  const [backCity, setBackCity] = useState("Madrid");

  const backDesign: BackDesign = {
    stars: backStars,
    backNumber,
    sleeveNumbers,
    city: backCity,
  };

  const onBackNumberChange = (value: string) => {
    setBackNumber(value.replace(/\D/g, "").slice(0, 2));
  };

  const onSleeveNumberChange = (index: number, value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 2);
    setSleeveNumbers((numbers) => numbers.map((n, i) => (i === index ? digits : n)));
  };

  const price = 895;

  // The two user-configurable material colors + a read-only lining note.
  const MATERIAL_SECTIONS: { section: string; color: string; setColor: (c: string) => void; material: string }[] = [
    { section: "Body", color: bodyColor, setColor: setBodyColor, material: "Wool" },
    { section: "Sleeves", color: sleeveColor, setColor: setSleeveColor, material: "Leather" },
  ];

  return (
    <div className="fixed inset-0 bg-white flex flex-col z-50 font-['League_Spartan',sans-serif]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white z-10 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-xs tracking-widest text-gray-600 hover:text-black transition-colors uppercase"
        >
          <X className="w-3.5 h-3.5" />
          <span>Exit</span>
        </button>

        {/* Tabs */}
        <div className="flex gap-0 border border-gray-200">
          <button
            onClick={() => setActiveTab("materials")}
            className={`px-4 py-2 text-[10px] tracking-widest uppercase transition-colors ${
              activeTab === "materials" ? "bg-black text-white" : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Materials &amp; Colors
          </button>
          <button
            onClick={() => setActiveTab("patches")}
            className={`px-4 py-2 text-[10px] tracking-widest uppercase transition-colors ${
              activeTab === "patches" ? "bg-black text-white" : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Design &amp; Patches
          </button>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {/* Wishlist */}
          <button onClick={() => setWishlisted((w) => !w)} className="text-gray-400 hover:text-black transition-colors">
            <Star className={`w-4 h-4 ${wishlisted ? "fill-black text-black" : ""}`} />
          </button>

          <div className="w-px h-5 bg-gray-200" />

          <div className="text-sm font-semibold tracking-wide">${price.toLocaleString()}</div>
          <button
            onClick={() => setShowSizeModal(true)}
            className="bg-black text-white px-5 py-2 text-[10px] tracking-widest uppercase hover:bg-gray-800 transition-colors"
          >
            Add to Cart
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-64 shrink-0 border-r border-gray-200 overflow-y-auto bg-white">
          {activeTab === "materials" ? (
            <div>
              {MATERIAL_SECTIONS.map(({ section, color, setColor, material }) => {
                const isOpen = expandedSection === section;
                return (
                  <div key={section} className="border-b border-gray-100">
                    <button
                      onClick={() => setExpandedSection(isOpen ? null : section)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-7 h-7 rounded border border-gray-200 shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <div className="text-left">
                          <div className="text-[10px] tracking-widest uppercase text-gray-400">
                            {section} · {material}
                          </div>
                          <div className="text-xs font-medium text-black leading-tight">{labelForColor(color)}</div>
                        </div>
                      </div>
                      <ChevronRight
                        className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${isOpen ? "rotate-90" : ""}`}
                      />
                    </button>
                    {isOpen && (
                      <div className="bg-gray-50 border-t border-gray-100 py-1">
                        {COLOR_GROUPS.map(({ group, shades }) => {
                          const groupOpen = openColorGroup[section] === group;
                          return (
                            <div key={group} className="border-b border-gray-100 last:border-b-0">
                              <button
                                onClick={() =>
                                  setOpenColorGroup((prev) => ({
                                    ...prev,
                                    [section]: groupOpen ? null : group,
                                  }))
                                }
                                className="w-full flex items-center justify-between px-5 py-2 hover:bg-gray-100 transition-colors"
                              >
                                <span className="text-[11px] tracking-widest uppercase text-gray-500">{group}</span>
                                <ChevronRight
                                  className={`w-3 h-3 text-gray-400 transition-transform ${groupOpen ? "rotate-90" : ""}`}
                                />
                              </button>
                              {groupOpen && (
                                <div className="px-5 pb-3 pt-1 flex flex-wrap gap-2">
                                  {shades.map((shade) => {
                                    const active = color.toLowerCase() === shade.color.toLowerCase();
                                    return (
                                      <button
                                        key={shade.color}
                                        title={shade.label}
                                        onClick={() => setColor(shade.color)}
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
                );
              })}

              {/* Fixed brand details — not user-configurable */}
              <div className="px-4 py-4 space-y-3">
                <p className="text-[10px] tracking-widest uppercase text-gray-400">Signature details</p>
                <ul className="space-y-2 text-xs text-gray-600">
                  <li className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: "#141414" }} />
                    Black quilted lining &amp; collar
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: "#c9a84c" }} />
                    Gold chest badge, stars &amp; accents
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0 border border-gray-300" style={{ backgroundColor: "#efe9dc" }} />
                    Cream knit trim &amp; snaps
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
                    <button
                      key={n}
                      onClick={() => setBackStars(backStars === n ? Math.max(1, n - 1) : n)}
                      className="p-1"
                    >
                      <Star
                        className={`w-5 h-5 ${
                          n <= backStars ? "fill-[#c9a84c] text-[#c9a84c]" : "text-gray-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Back number */}
              <div>
                <label className="text-[10px] tracking-widest uppercase text-gray-400 block mb-1.5">
                  Back Number (00–99)
                </label>
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

              <p className="text-[10px] text-gray-400 leading-relaxed">
                Gold stars, the chest badge and “EST. 2026” are fixed brand details. Pick your city
                from the dropdown below the jacket.
              </p>
            </div>
          )}
        </div>

        {/* Jacket preview */}
        <div className="flex-1 relative bg-[#f0ede8] overflow-hidden">
          <JacketViewer3D
            bodyColor={bodyColor}
            sleeveColor={sleeveColor}
            trimColor="#e9e2d0"
            snapColor="#efe9dc"
            pocketColor={sleeveColor}
            liningColor="#141414"
            insertColor={bodyColor}
            backDesign={backDesign}
          />

          {/* City picker + drag hint */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
            <select
              value={backCity}
              onChange={(e) => setBackCity(e.target.value)}
              className="bg-white border border-gray-300 px-4 py-2 text-xs tracking-widest uppercase focus:outline-none focus:border-black cursor-pointer"
            >
              {CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <span className="text-[10px] tracking-widest uppercase text-gray-400 pointer-events-none select-none">
              Drag to rotate · Scroll to zoom
            </span>
          </div>
        </div>
      </div>

      {/* Size picker modal */}
      {showSizeModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowSizeModal(false)}>
          <div
            className="bg-white w-full max-w-sm rounded shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
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
                    selectedSize === size
                      ? "bg-black text-white border-black"
                      : "border-gray-300 hover:border-black"
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
