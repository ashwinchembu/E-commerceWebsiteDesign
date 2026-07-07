import { useState } from "react";
import { ChevronRight, X, Star } from "lucide-react";
import { JacketViewer3D, type BackDesign } from "../components/JacketViewer3D";
import { useNavigate } from "react-router-dom";

const SIZES = ["XXS", "XS", "S", "M", "L", "XL", "2XL", "3XL"];

const SECTION_OPTIONS: Record<string, { label: string; color: string }[]> = {
  Collar: [
    { label: "Regular", color: "#f0efe9" },
  ],
  Body: [
    { label: "Bright White Wool", color: "#f0e9d8" },
    { label: "Black Wool", color: "#1a1a1a" },
    { label: "Navy Wool", color: "#1e2d5a" },
    { label: "Burgundy Wool", color: "#6b1e2a" },
    { label: "Forest Wool", color: "#1a3d2b" },
  ],
  "Inside Lining": [
    { label: "Black Quilted", color: "#141414" },
    { label: "White Quilted", color: "#fafafa" },
    { label: "Gold Satin", color: "#c8a94a" },
  ],
  Sleeves: [
    { label: "Bright White Leather", color: "#f4f2ea" },
    { label: "Black Leather", color: "#1a1a1a" },
    { label: "Caramel Leather", color: "#b07d3a" },
    { label: "Burgundy Leather", color: "#6b1e2a" },
    { label: "Navy Leather", color: "#1e2d5a" },
  ],
  "Shoulder Inserts": [
    { label: "No Shoulder Inserts", color: "#e8e8e8" },
    { label: "Bright White Leather", color: "#f4f2ea" },
    { label: "Black Leather", color: "#1a1a1a" },
  ],
  Pockets: [
    { label: "Bright White Leather", color: "#f4f2ea" },
    { label: "Black Leather", color: "#1a1a1a" },
    { label: "Caramel Leather", color: "#b07d3a" },
    { label: "Burgundy Leather", color: "#6b1e2a" },
    { label: "Navy Leather", color: "#1e2d5a" },
  ],
  Snaps: [
    { label: "Off White Snaps", color: "#efe9dc" },
    { label: "Black Snaps", color: "#1a1a1a" },
    { label: "Antique Gold Snaps", color: "#c9a84c" },
  ],
  "Knit Trim": [
    { label: "Solid Bright White", color: "#f0efe9" },
    { label: "Solid Black", color: "#1a1a1a" },
    { label: "Solid Navy", color: "#1e2d5a" },
    { label: "Solid Burgundy", color: "#6b1e2a" },
  ],
};

const CITIES = [
  "Madrid",
  "Barcelona",
  "Manchester",
  "Liverpool",
  "London",
  "Munich",
  "Dortmund",
  "Milan",
  "Turin",
  "Rome",
  "Naples",
  "Paris",
  "Marseille",
  "Lyon",
  "Amsterdam",
  "Lisbon",
  "Porto",
  "Sevilla",
  "Glasgow",
  "Istanbul",
];

const PRINT_COLORS = [
  { label: "Bright White", color: "#f5f5f0" },
  { label: "Black", color: "#1a1a1a" },
  { label: "Gold", color: "#c9a84c" },
  { label: "Navy", color: "#1e2d5a" },
  { label: "Burgundy", color: "#6b1e2a" },
];

// Personalization can't use a pro player's name
const BLOCKED_PLAYER_NAMES = [
  "messi", "ronaldo", "cristiano", "neymar", "mbappe", "haaland", "bellingham",
  "salah", "kane", "modric", "benzema", "lewandowski", "vinicius", "foden",
  "saka", "griezmann", "pedri", "gavi", "yamal", "zidane", "beckham",
  "maradona", "pele", "ronaldinho", "ibrahimovic", "zlatan", "suarez",
  "aguero", "hazard", "de bruyne", "debruyne", "kroos", "iniesta", "xavi",
  "buffon", "dybala", "pogba", "rashford", "sterling", "sancho", "musiala",
  "wirtz", "odegaard", "rice", "palmer", "rodri", "henry", "drogba", "kaka",
];

function isBlockedPlayerName(name: string) {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return false;
  return BLOCKED_PLAYER_NAMES.some(
    (player) => normalized === player || normalized.split(" ").includes(player),
  );
}


export function JacketBuilderPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"materials" | "patches">("materials");
  const [expandedSection, setExpandedSection] = useState<string | null>("Body");
  const [selections, setSelections] = useState<Record<string, string>>({
    Collar: "Regular",
    Body: "Bright White Wool",
    "Inside Lining": "Black Quilted",
    Sleeves: "Bright White Leather",
    "Shoulder Inserts": "No Shoulder Inserts",
    Pockets: "Bright White Leather",
    Snaps: "Off White Snaps",
    "Knit Trim": "Solid Bright White",
  });
  const colorOf = (section: string, fallback: string) =>
    SECTION_OPTIONS[section]?.find((o) => o.label === selections[section])?.color ?? fallback;
  const [showSizeModal, setShowSizeModal] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [wishlisted, setWishlisted] = useState(false);

  const [backName, setBackName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [backStars, setBackStars] = useState(5);
  const [backNumbers, setBackNumbers] = useState(["", "", "", "", ""]);
  const [backCity, setBackCity] = useState("Madrid");
  const [printColor, setPrintColor] = useState(PRINT_COLORS[0].color);

  const backDesign: BackDesign = {
    stars: backStars,
    numbers: backNumbers,
    name: nameError ? "" : backName,
    city: backCity,
    color: printColor,
  };

  const onNameChange = (value: string) => {
    setBackName(value);
    setNameError(
      isBlockedPlayerName(value) ? "Player names aren't allowed — make it your own." : null,
    );
  };

  const onNumberChange = (index: number, value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 2);
    setBackNumbers((numbers) => numbers.map((n, i) => (i === index ? digits : n)));
  };

  const price = 895;

  const getSwatchColor = (section: string) => {
    const sel = selections[section];
    const opts = SECTION_OPTIONS[section] || [];
    return opts.find((o) => o.label === sel)?.color ?? "#ccc";
  };

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
              {Object.keys(SECTION_OPTIONS).map((section) => {
                const isOpen = expandedSection === section;
                const swatchColor = getSwatchColor(section);
                const currentLabel = selections[section] ?? "";
                return (
                  <div key={section} className="border-b border-gray-100">
                    <button
                      onClick={() => setExpandedSection(isOpen ? null : section)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-7 h-7 rounded border border-gray-200 shrink-0"
                          style={{ backgroundColor: swatchColor }}
                        />
                        <div className="text-left">
                          <div className="text-[10px] tracking-widest uppercase text-gray-400">{section}</div>
                          <div className="text-xs font-medium text-black leading-tight">{currentLabel}</div>
                        </div>
                      </div>
                      <ChevronRight
                        className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${isOpen ? "rotate-90" : ""}`}
                      />
                    </button>
                    {isOpen && (
                      <div className="bg-gray-50 border-t border-gray-100">
                        {SECTION_OPTIONS[section].map((opt) => {
                          const active = selections[section] === opt.label;
                          return (
                            <button
                              key={opt.label}
                              onClick={() => setSelections((s) => ({ ...s, [section]: opt.label }))}
                              className={`w-full flex items-center gap-3 px-5 py-2.5 text-left hover:bg-gray-100 transition-colors ${
                                active ? "bg-gray-100" : ""
                              }`}
                            >
                              <div
                                className={`w-5 h-5 rounded border shrink-0 ${active ? "border-black ring-1 ring-black" : "border-gray-300"}`}
                                style={{ backgroundColor: opt.color }}
                              />
                              <span className={`text-xs ${active ? "font-semibold" : "text-gray-600"}`}>{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 space-y-6">
              <p className="text-[10px] tracking-widest uppercase text-gray-400">
                Back Design · Drag the jacket to see the back
              </p>

              {/* Name */}
              <div>
                <label className="text-[10px] tracking-widest uppercase text-gray-400 block mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  value={backName}
                  onChange={(e) => onNameChange(e.target.value)}
                  maxLength={14}
                  placeholder="YOUR NAME"
                  className={`w-full border px-3 py-2 text-xs tracking-widest uppercase focus:outline-none ${
                    nameError ? "border-red-400" : "border-gray-300 focus:border-black"
                  }`}
                />
                {nameError && <p className="text-[10px] text-red-500 mt-1">{nameError}</p>}
              </div>

              {/* Stars */}
              <div>
                <label className="text-[10px] tracking-widest uppercase text-gray-400 block mb-1.5">
                  Stars ({backStars} of 5)
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setBackStars(backStars === n ? n - 1 : n)}
                      className="p-1"
                    >
                      <Star
                        className={`w-5 h-5 ${
                          n <= backStars ? "fill-black text-black" : "text-gray-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Numbers */}
              <div>
                <label className="text-[10px] tracking-widest uppercase text-gray-400 block mb-1.5">
                  Numbers (2 digits each)
                </label>
                <div className="flex gap-1.5">
                  {backNumbers.map((value, i) => (
                    <input
                      key={i}
                      type="text"
                      inputMode="numeric"
                      value={value}
                      onChange={(e) => onNumberChange(i, e.target.value)}
                      placeholder="00"
                      className="w-10 border border-gray-300 px-0 py-2 text-center text-xs tracking-widest focus:outline-none focus:border-black"
                    />
                  ))}
                </div>
              </div>

              {/* Print color */}
              <div>
                <label className="text-[10px] tracking-widest uppercase text-gray-400 block mb-1.5">
                  Print Color
                </label>
                <div className="flex gap-2">
                  {PRINT_COLORS.map((option) => (
                    <button
                      key={option.color}
                      title={option.label}
                      onClick={() => setPrintColor(option.color)}
                      className={`w-7 h-7 rounded-full border ${
                        printColor === option.color
                          ? "border-black ring-1 ring-black"
                          : "border-gray-300"
                      }`}
                      style={{ backgroundColor: option.color }}
                    />
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-gray-400 leading-relaxed">
                The Manoir Kits crest and “EST. 2026” always appear on the back. Pick your city
                below the jacket.
              </p>
            </div>
          )}
        </div>

        {/* Jacket preview */}
        <div className="flex-1 relative bg-[#f0ede8] overflow-hidden">
          <JacketViewer3D
            bodyColor={colorOf("Body", "#f0e9d8")}
            sleeveColor={colorOf("Sleeves", "#f4f2ea")}
            trimColor={colorOf("Knit Trim", "#f0efe9")}
            snapColor={colorOf("Snaps", "#efe9dc")}
            pocketColor={colorOf("Pockets", "#f4f2ea")}
            liningColor={colorOf("Inside Lining", "#141414")}
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
