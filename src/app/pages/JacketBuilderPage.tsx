import { useState } from "react";
import { ChevronRight, X, Star } from "lucide-react";
import { JacketViewer3D } from "../components/JacketViewer3D";
import { useNavigate } from "react-router-dom";

const SIZES = ["XXS", "XS", "S", "M", "L", "XL", "2XL", "3XL"];

const SECTION_OPTIONS: Record<string, { label: string; color: string }[]> = {
  Body: [
    { label: "Bright White Wool", color: "#f5f5f0" },
    { label: "Black Quilted", color: "#1a1a1a" },
    { label: "Navy Wool", color: "#1e2d5a" },
    { label: "Burgundy Wool", color: "#6b1e2a" },
    { label: "Forest Wool", color: "#1a3d2b" },
  ],
  Sleeves: [
    { label: "Bright White Leather", color: "#f5f5f0" },
    { label: "Black Leather", color: "#1a1a1a" },
    { label: "Caramel Leather", color: "#b07d3a" },
    { label: "Burgundy Leather", color: "#6b1e2a" },
    { label: "Navy Leather", color: "#1e2d5a" },
  ],
  Lining: [
    { label: "No Shoulder Inserts", color: "#e8e8e8" },
    { label: "Black Satin", color: "#1a1a1a" },
    { label: "White Satin", color: "#fafafa" },
    { label: "Gold Satin", color: "#c8a94a" },
  ],
  "Shoulder Inserts": [
    { label: "Bright White Leather", color: "#f5f5f0" },
    { label: "Black Leather", color: "#1a1a1a" },
    { label: "None", color: "#e8e8e8" },
  ],
  Collar: [
    { label: "Off White Snaps", color: "#f0ede6" },
    { label: "Black Snaps", color: "#1a1a1a" },
    { label: "Gold Snaps", color: "#c8a94a" },
  ],
  Snaps: [
    { label: "Solid Bright White", color: "#f5f5f0" },
    { label: "Solid Black", color: "#1a1a1a" },
    { label: "Two-Tone", color: "#888" },
  ],
};

const PATCH_ZONES = [
  { id: "right-chest", label: "Right Chest" },
  { id: "left-chest", label: "Left Chest" },
  { id: "right-shoulder", label: "Right Shoulder" },
  { id: "left-shoulder", label: "Left Shoulder" },
  { id: "sleeve-right-elbow", label: "Sleeve right elbow" },
  { id: "sleeve-left-elbow", label: "Sleeve left elbow" },
  { id: "sleeve-right-below", label: "Sleeve right below elbow" },
  { id: "sleeve-left-below", label: "Sleeve left below elbow" },
  { id: "bottom-right-pocket", label: "Bottom right pocket" },
  { id: "bottom-left-pocket", label: "Bottom left pocket" },
  { id: "above-right-pocket", label: "Above right pocket" },
  { id: "above-left-pocket", label: "Above left pocket" },
  { id: "back", label: "Back" },
  { id: "collar", label: "Collar" },
];


export function JacketBuilderPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"materials" | "patches">("materials");
  const [expandedSection, setExpandedSection] = useState<string | null>("Body");
  const [selections, setSelections] = useState<Record<string, string>>({
    Body: "Bright White Wool",
    Sleeves: "Bright White Leather",
    Lining: "No Shoulder Inserts",
    "Shoulder Inserts": "Bright White Leather",
    Collar: "Off White Snaps",
    Snaps: "Solid Bright White",
  });
  const bodyColor = SECTION_OPTIONS["Body"].find(o => o.label === selections["Body"])?.color ?? "#f5f5f0";
  const sleeveColor = SECTION_OPTIONS["Sleeves"].find(o => o.label === selections["Sleeves"])?.color ?? "#f5f5f0";
  const [showSizeModal, setShowSizeModal] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [wishlisted, setWishlisted] = useState(false);

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
            <div className="p-3 grid grid-cols-2 gap-2">
              {PATCH_ZONES.map((zone) => (
                <button
                  key={zone.id}
                  className="border border-gray-200 hover:border-black transition-colors rounded overflow-hidden group"
                >
                  <div className="bg-gray-100 aspect-square flex items-center justify-center">
                    <svg viewBox="0 0 60 60" className="w-10 h-10 opacity-40 group-hover:opacity-70 transition-opacity" fill="none">
                      <path d="M18 18 L12 24 L9 48 L51 48 L48 24 L42 18 Z" fill="#888" stroke="#555" strokeWidth="1"/>
                      <path d="M18 18 L9 21 L4 36 L12 39 L15 27 L20 22 Z" fill="#aaa" stroke="#555" strokeWidth="1"/>
                      <path d="M42 18 L51 21 L56 36 L48 39 L45 27 L40 22 Z" fill="#aaa" stroke="#555" strokeWidth="1"/>
                    </svg>
                  </div>
                  <div className="px-1.5 py-1.5 text-center">
                    <span className="text-[9px] tracking-wide text-gray-600 leading-tight block">{zone.label}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Jacket preview */}
        <div className="flex-1 relative bg-[#f0ede8] overflow-hidden">
          <JacketViewer3D
            bodyColor={bodyColor}
            sleeveColor={sleeveColor}
            collarColor={SECTION_OPTIONS["Collar"].find(o => o.label === selections["Collar"])?.color ?? "#e8e4dc"}
            cuffColor={SECTION_OPTIONS["Snaps"].find(o => o.label === selections["Snaps"])?.color ?? "#dddddd"}
          />

          {/* Drag hint */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] tracking-widest uppercase text-gray-400 pointer-events-none select-none">
            Drag to rotate · Scroll to zoom
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
              We accept all debit/credit cards, as well as payment via PayPal.{" "}
              <span className="font-semibold text-black">FREE DELIVERY</span> worldwide.
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
