import { useState, useEffect, useRef } from "react";
import { Search, Printer, Minus, Plus, Tag } from "lucide-react";
import JsBarcode from "jsbarcode";
import { supabase } from "../lib/supabaseClient";

const ink = "#3A2430";
const rose = "#8C2F49";
const roseSoft = "#F4E3E7";
const cream = "#FBF6F1";
const line = "#EAD9DC";
const muted = "#B48A94";

const LABEL_SIZES = {
  standard: { name: "Standard · 40×25mm (24/sheet)", w: "40mm", h: "25mm", cols: 3 },
  large: { name: "Large · 50×30mm (21/sheet)", w: "50mm", h: "30mm", cols: 3 },
  small: { name: "Small · 30×20mm (30/sheet)", w: "30mm", h: "20mm", cols: 4 },
};

function BarcodeSVG({ value, width = 1.4, height = 30 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && value) {
      try {
        JsBarcode(ref.current, value, {
          format: "CODE128",
          width,
          height,
          displayValue: true,
          fontSize: 11,
          margin: 2,
        });
      } catch (e) {
        // invalid value for barcode encoding — leave blank rather than crash
      }
    }
  }, [value]);
  return <svg ref={ref} />;
}

export default function LabelPrinting() {
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState({}); // variantId -> qty
  const [labelSize, setLabelSize] = useState("standard");
  const [showPrice, setShowPrice] = useState(true);

  useEffect(() => {
    loadVariants();
  }, []);

  async function loadVariants() {
    setLoading(true);
    setErrorMsg("");
    const { data, error } = await supabase
      .from("product_variants")
      .select("*, products(name)")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) setErrorMsg(error.message);
    else setVariants(data || []);
    setLoading(false);
  }

  const filtered = variants.filter((v) => {
    const name = v.products?.name || "";
    return (
      name.toLowerCase().includes(search.toLowerCase()) ||
      (v.sku || "").toLowerCase().includes(search.toLowerCase()) ||
      (v.barcode || "").includes(search)
    );
  });

  function toggle(variantId) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[variantId]) delete next[variantId];
      else next[variantId] = 1;
      return next;
    });
  }

  function setQty(variantId, qty) {
    setSelected((prev) => ({ ...prev, [variantId]: Math.max(1, qty) }));
  }

  function selectAllFiltered() {
    setSelected((prev) => {
      const next = { ...prev };
      filtered.forEach((v) => {
        if (!next[v.id]) next[v.id] = 1;
      });
      return next;
    });
  }

  function clearSelection() {
    setSelected({});
  }

  const selectedVariants = variants.filter((v) => selected[v.id]);
  const totalLabels = selectedVariants.reduce((sum, v) => sum + (selected[v.id] || 0), 0);
  const size = LABEL_SIZES[labelSize];

  // Build the flat list of labels to render (repeated per quantity)
  const labelList = [];
  selectedVariants.forEach((v) => {
    for (let i = 0; i < (selected[v.id] || 0); i++) {
      labelList.push(v);
    }
  });

  return (
    <div className="min-h-screen flex flex-col" style={{ background: cream, color: ink }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { display: grid !important; }
          body { background: white !important; }
        }
        .label-card {
          width: ${size.w};
          height: ${size.h};
          border: 1px dashed #ccc;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2mm;
          box-sizing: border-box;
          overflow: hidden;
          break-inside: avoid;
        }
        .label-name { font-size: 7px; line-height: 1.1; text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .label-meta { font-size: 6.5px; color: #555; }
      `}</style>

      <header className="no-print px-4 md:px-6 py-3.5 flex items-center justify-between shrink-0 border-b sticky top-0 z-10" style={{ borderColor: line, background: "#FFFDFB" }}>
        <div className="flex items-baseline gap-2 min-w-0">
          <h1 className="text-2xl leading-none tracking-tight shrink-0" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: rose, fontWeight: 600 }}>
            Ambrai
          </h1>
          <span className="text-[11px] uppercase tracking-widest truncate" style={{ color: muted }}>Print labels</span>
        </div>
        <button
          onClick={() => window.print()}
          disabled={totalLabels === 0}
          className="flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-xl text-white shrink-0 disabled:opacity-30"
          style={{ background: rose }}
        >
          <Printer size={16} /> Print {totalLabels > 0 && `(${totalLabels})`}
        </button>
      </header>

      {errorMsg && (
        <div className="no-print mx-4 mt-3 text-xs px-3 py-2 rounded-lg" style={{ background: "#F4DEDC", color: "#A3402F" }}>
          {errorMsg}
        </div>
      )}

      {/* Selection UI */}
      <div className="no-print p-4 md:p-6 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2" size={16} style={{ color: "#C89AA3" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, SKU, or barcode"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border-2 bg-white text-sm focus:outline-none"
              style={{ borderColor: line }}
            />
          </div>
          <select
            value={labelSize}
            onChange={(e) => setLabelSize(e.target.value)}
            className="px-3 py-2.5 rounded-xl border-2 bg-white text-sm focus:outline-none"
            style={{ borderColor: line }}
          >
            {Object.entries(LABEL_SIZES).map(([key, s]) => (
              <option key={key} value={key}>{s.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs px-3 rounded-xl border-2 bg-white shrink-0" style={{ borderColor: line, color: "#7A4A5A" }}>
            <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} />
            Show price
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={selectAllFiltered} className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: roseSoft, color: rose }}>
            Select all shown
          </button>
          <button onClick={clearSelection} className="text-xs font-medium px-3 py-1.5 rounded-lg border" style={{ borderColor: line, color: muted }}>
            Clear selection
          </button>
          <span className="text-xs ml-auto" style={{ color: muted }}>{totalLabels} label{totalLabels !== 1 ? "s" : ""} queued</span>
        </div>

        {loading ? (
          <p className="text-sm py-8 text-center" style={{ color: muted }}>Loading products…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: muted }}>No products found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {filtered.map((v) => {
              const isSelected = !!selected[v.id];
              return (
                <div
                  key={v.id}
                  className="flex items-center gap-3 p-3 rounded-xl border bg-white"
                  style={{ borderColor: isSelected ? rose : line }}
                >
                  <input type="checkbox" checked={isSelected} onChange={() => toggle(v.id)} className="shrink-0" />
                  <div className="flex-1 min-w-0" onClick={() => toggle(v.id)} style={{ cursor: "pointer" }}>
                    <p className="text-sm font-medium truncate">{v.products?.name}</p>
                    <p className="text-xs" style={{ color: muted }}>
                      {v.size} · {v.color} · ₹{v.selling_price} · {v.barcode}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => setQty(v.id, (selected[v.id] || 1) - 1)} className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: roseSoft, color: rose }}>
                        <Minus size={11} />
                      </button>
                      <span className="w-5 text-center text-sm font-medium">{selected[v.id]}</span>
                      <button onClick={() => setQty(v.id, (selected[v.id] || 1) + 1)} className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: roseSoft, color: rose }}>
                        <Plus size={11} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Print preview / actual print output */}
      {totalLabels > 0 && (
        <div className="p-4 md:p-6 border-t" style={{ borderColor: line }}>
          <p className="no-print text-xs mb-2 flex items-center gap-1.5" style={{ color: muted }}>
            <Tag size={12} /> Preview — this is what prints
          </p>
          <div
            className="print-area flex flex-wrap gap-2 bg-white p-3 rounded-xl border"
            style={{ borderColor: line }}
          >
            {labelList.map((v, idx) => (
              <div key={`${v.id}-${idx}`} className="label-card">
                <p className="label-name">{v.products?.name}</p>
                <p className="label-meta">{v.size} {v.color}</p>
                <BarcodeSVG value={v.barcode} />
                {showPrice && <p className="label-meta" style={{ fontWeight: 600 }}>₹{v.selling_price}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
