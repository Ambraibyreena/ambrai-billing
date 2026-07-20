import { useState, useEffect } from "react";
import { Plus, Search, X, Pencil, Trash2, Tag, ChevronLeft, Package, Barcode } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

function emptyVariant() {
  return { id: null, sku: "", barcode: "", size: "", color: "", mrp: "", selling_price: "", cost_price: "", current_stock: "" };
}

function emptyProduct() {
  return { id: null, name: "", category_id: "", brand_id: "", hsn_code: "", gst_percent: 5, variants: [emptyVariant()] };
}

function generateBarcode() {
  return String(Math.floor(1000000 + Math.random() * 8999999));
}

function generateSku(productName, size, color) {
  const base = (productName || "").trim().slice(0, 3).toUpperCase() || "SKU";
  const c = (color || "").trim().slice(0, 2).toUpperCase();
  const s = (size || "").trim().slice(0, 2).toUpperCase();
  return [base, c, s].filter(Boolean).join("-") + "-" + Math.floor(Math.random() * 900 + 100);
}

const ink = "#3A2430";
const rose = "#8C2F49";
const roseSoft = "#F4E3E7";
const cream = "#FBF6F1";
const line = "#EAD9DC";
const muted = "#B48A94";

export default function ProductManagement() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setErrorMsg("");
    try {
      const [{ data: cats, error: catErr }, { data: brs, error: brErr }] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase.from("brands").select("*").order("name"),
      ]);
      if (catErr) throw catErr;
      if (brErr) throw brErr;
      setCategories(cats || []);
      setBrands(brs || []);
      await loadProducts();
    } catch (err) {
      setErrorMsg(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("*, product_variants(*)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    setProducts(data || []);
  }

  async function ensureCategory(name) {
    if (!name) return null;
    const existing = categories.find((c) => c.name === name);
    if (existing) return existing.id;
    const { data, error } = await supabase.from("categories").insert({ name }).select().single();
    if (error) throw error;
    setCategories((prev) => [...prev, data]);
    return data.id;
  }

  async function ensureBrand(name) {
    if (!name) return null;
    const existing = brands.find((b) => b.name === name);
    if (existing) return existing.id;
    const { data, error } = await supabase.from("brands").insert({ name }).select().single();
    if (error) throw error;
    setBrands((prev) => [...prev, data]);
    return data.id;
  }

  function openNew() {
    setErrorMsg("");
    setEditing({ ...emptyProduct(), categoryName: categories[0]?.name || "", brandName: brands[0]?.name || "" });
  }

  function openEdit(product) {
    setErrorMsg("");
    setEditing({
      id: product.id,
      name: product.name,
      categoryName: categories.find((c) => c.id === product.category_id)?.name || "",
      brandName: brands.find((b) => b.id === product.brand_id)?.name || "",
      hsn_code: product.hsn_code || "",
      gst_percent: product.gst_percent ?? 5,
      variants: (product.product_variants || []).map((v) => ({ ...v })),
    });
  }

  async function saveProduct() {
    if (!editing.name.trim()) return;
    setSaving(true);
    setErrorMsg("");
    try {
      const category_id = await ensureCategory(editing.categoryName);
      const brand_id = await ensureBrand(editing.brandName);

      const productPayload = {
        name: editing.name.trim(),
        category_id,
        brand_id,
        hsn_code: editing.hsn_code || null,
        gst_percent: +editing.gst_percent || 0,
      };

      let productId = editing.id;
      if (productId) {
        const { error } = await supabase.from("products").update(productPayload).eq("id", productId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert(productPayload).select().single();
        if (error) throw error;
        productId = data.id;
      }

      const cleanVariants = editing.variants.filter((v) => v.size || v.color || v.selling_price);

      for (const v of cleanVariants) {
        const variantPayload = {
          product_id: productId,
          sku: v.sku || generateSku(editing.name, v.size, v.color),
          barcode: v.barcode || generateBarcode(),
          size: v.size || null,
          color: v.color || null,
          mrp: +v.mrp || 0,
          selling_price: +v.selling_price || 0,
          cost_price: +v.cost_price || 0,
          current_stock: +v.current_stock || 0,
        };
        if (v.id) {
          const { error } = await supabase.from("product_variants").update(variantPayload).eq("id", v.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("product_variants").insert(variantPayload);
          if (error) throw error;
        }
      }

      await loadProducts();
      setEditing(null);
    } catch (err) {
      setErrorMsg(err.message || "Failed to save product");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(id) {
    setErrorMsg("");
    try {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setErrorMsg(err.message || "Failed to delete product");
    } finally {
      setConfirmDelete(null);
    }
  }

  async function deleteVariantRow(idx) {
    const v = editing.variants[idx];
    if (v.id) {
      const { error } = await supabase.from("product_variants").delete().eq("id", v.id);
      if (error) {
        setErrorMsg(error.message);
        return;
      }
    }
    setEditing((prev) => ({ ...prev, variants: prev.variants.filter((_, i) => i !== idx) }));
  }

  function updateVariant(idx, field, value) {
    setEditing((prev) => ({
      ...prev,
      variants: prev.variants.map((v, i) => (i === idx ? { ...v, [field]: value } : v)),
    }));
  }

  function addVariantRow() {
    setEditing((prev) => ({ ...prev, variants: [...prev.variants, emptyVariant()] }));
  }

  const filtered = products.filter((p) => {
    const catName = categories.find((c) => c.id === p.category_id)?.name;
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.product_variants || []).some(
        (v) => (v.barcode || "").includes(search) || (v.sku || "").toLowerCase().includes(search.toLowerCase())
      );
    const matchesCategory = categoryFilter === "All" || catName === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // ---------------- EDIT / CREATE VIEW ----------------
  if (editing) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: cream, color: ink }}>
        <header className="px-4 md:px-6 py-3.5 flex items-center gap-3 shrink-0 border-b sticky top-0 z-10" style={{ borderColor: line, background: "#FFFDFB" }}>
          <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg" style={{ color: rose }}>
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-lg font-medium truncate">{editing.id ? "Edit product" : "New product"}</h1>
        </header>

        {errorMsg && (
          <div className="mx-4 md:mx-6 mt-3 text-xs px-3 py-2 rounded-lg" style={{ background: "#F4DEDC", color: "#A3402F" }}>
            {errorMsg}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-2xl w-full mx-auto space-y-5">
          <div className="bg-white rounded-xl border p-4 space-y-3" style={{ borderColor: line }}>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-widest" style={{ color: muted }}>Product name</label>
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="e.g. Anarkali Suit"
                className="mt-1.5 w-full px-3 py-2.5 text-sm rounded-xl border focus:outline-none"
                style={{ borderColor: line }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium uppercase tracking-widest" style={{ color: muted }}>Category</label>
                <input
                  list="category-options"
                  value={editing.categoryName}
                  onChange={(e) => setEditing({ ...editing, categoryName: e.target.value })}
                  placeholder="Type or pick"
                  className="mt-1.5 w-full px-3 py-2.5 text-sm rounded-xl border bg-white focus:outline-none"
                  style={{ borderColor: line }}
                />
                <datalist id="category-options">
                  {categories.map((c) => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>
              <div>
                <label className="text-[11px] font-medium uppercase tracking-widest" style={{ color: muted }}>Brand</label>
                <input
                  list="brand-options"
                  value={editing.brandName}
                  onChange={(e) => setEditing({ ...editing, brandName: e.target.value })}
                  placeholder="Type or pick"
                  className="mt-1.5 w-full px-3 py-2.5 text-sm rounded-xl border bg-white focus:outline-none"
                  style={{ borderColor: line }}
                />
                <datalist id="brand-options">
                  {brands.map((b) => <option key={b.id} value={b.name} />)}
                </datalist>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium uppercase tracking-widest" style={{ color: muted }}>HSN code</label>
                <input
                  value={editing.hsn_code}
                  onChange={(e) => setEditing({ ...editing, hsn_code: e.target.value })}
                  placeholder="e.g. 6204"
                  className="mt-1.5 w-full px-3 py-2.5 text-sm rounded-xl border focus:outline-none"
                  style={{ borderColor: line }}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium uppercase tracking-widest" style={{ color: muted }}>GST %</label>
                <input
                  type="number"
                  value={editing.gst_percent}
                  onChange={(e) => setEditing({ ...editing, gst_percent: e.target.value })}
                  className="mt-1.5 w-full px-3 py-2.5 text-sm rounded-xl border focus:outline-none"
                  style={{ borderColor: line }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border p-4" style={{ borderColor: line }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium flex items-center gap-1.5">
                <Tag size={14} style={{ color: rose }} /> Size & color variants
              </h2>
              <button onClick={addVariantRow} className="text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1" style={{ background: roseSoft, color: rose }}>
                <Plus size={13} /> Add variant
              </button>
            </div>

            <div className="space-y-3">
              {editing.variants.map((v, idx) => (
                <div key={v.id || idx} className="rounded-lg border p-3 space-y-2.5" style={{ borderColor: line, background: cream }}>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={v.size || ""}
                      onChange={(e) => updateVariant(idx, "size", e.target.value)}
                      placeholder="Size (e.g. M)"
                      className="px-2.5 py-2 text-sm rounded-lg border bg-white focus:outline-none"
                      style={{ borderColor: line }}
                    />
                    <input
                      value={v.color || ""}
                      onChange={(e) => updateVariant(idx, "color", e.target.value)}
                      placeholder="Color"
                      className="px-2.5 py-2 text-sm rounded-lg border bg-white focus:outline-none"
                      style={{ borderColor: line }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wide" style={{ color: muted }}>MRP</label>
                      <input type="number" value={v.mrp || ""} onChange={(e) => updateVariant(idx, "mrp", e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-sm rounded-lg border bg-white focus:outline-none" style={{ borderColor: line }} />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide" style={{ color: muted }}>Selling</label>
                      <input type="number" value={v.selling_price || ""} onChange={(e) => updateVariant(idx, "selling_price", e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-sm rounded-lg border bg-white focus:outline-none" style={{ borderColor: line }} />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide" style={{ color: muted }}>Cost</label>
                      <input type="number" value={v.cost_price || ""} onChange={(e) => updateVariant(idx, "cost_price", e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-sm rounded-lg border bg-white focus:outline-none" style={{ borderColor: line }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                    <div>
                      <label className="text-[10px] uppercase tracking-wide" style={{ color: muted }}>Stock</label>
                      <input type="number" value={v.current_stock || ""} onChange={(e) => updateVariant(idx, "current_stock", e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-sm rounded-lg border bg-white focus:outline-none" style={{ borderColor: line }} />
                    </div>
                    <button onClick={() => deleteVariantRow(idx)} className="p-2 rounded-lg" style={{ color: "#C23636" }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: line }}>
                    <span className="text-[11px] flex items-center gap-1" style={{ color: muted }}>
                      <Barcode size={12} />
                      {v.barcode || "auto-generated on save"}
                    </span>
                    <span className="text-[11px]" style={{ color: muted }}>SKU: {v.sku || "auto"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t p-4 sticky bottom-0" style={{ borderColor: line, background: "#FFFDFB" }}>
          <div className="max-w-2xl w-full mx-auto flex gap-2">
            <button onClick={() => setEditing(null)} className="flex-1 py-3 rounded-xl border text-sm font-medium" style={{ borderColor: line, color: rose }}>
              Cancel
            </button>
            <button
              onClick={saveProduct}
              disabled={!editing.name.trim() || saving}
              className="flex-1 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-30"
              style={{ background: rose }}
            >
              {saving ? "Saving…" : "Save product"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- LIST VIEW ----------------
  return (
    <div className="min-h-screen flex flex-col" style={{ background: cream, color: ink }}>
      <header className="px-4 md:px-6 py-3.5 flex items-center justify-between shrink-0 border-b sticky top-0 z-10" style={{ borderColor: line, background: "#FFFDFB" }}>
        <div className="flex items-baseline gap-2 min-w-0">
          <h1 className="text-2xl leading-none tracking-tight shrink-0" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: rose, fontWeight: 600 }}>
            Ambrai
          </h1>
          <span className="text-[11px] uppercase tracking-widest truncate" style={{ color: muted }}>Products</span>
        </div>
        <button onClick={openNew} className="flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-xl text-white shrink-0" style={{ background: rose }}>
          <Plus size={16} /> <span className="hidden sm:inline">New product</span>
        </button>
      </header>

      {errorMsg && (
        <div className="mx-4 md:mx-6 mt-3 text-xs px-3 py-2 rounded-lg" style={{ background: "#F4DEDC", color: "#A3402F" }}>
          {errorMsg}
        </div>
      )}

      <div className="p-4 md:p-6 space-y-3">
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
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {["All", ...categories.map((c) => c.name)].map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className="text-xs px-3 py-2 rounded-lg whitespace-nowrap shrink-0 font-medium"
                style={categoryFilter === c ? { background: rose, color: "white" } : { background: "white", color: "#7A4A5A", border: `1px solid ${line}` }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20" style={{ color: "#C89AA3" }}>
            <p className="text-sm">Loading products…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20" style={{ color: "#C89AA3" }}>
            <Package size={26} strokeWidth={1.5} />
            <p className="text-sm">No products found</p>
            <button onClick={openNew} className="text-xs font-medium px-3 py-1.5 rounded-lg mt-1" style={{ background: roseSoft, color: rose }}>
              Add your first product
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((p) => {
              const variants = p.product_variants || [];
              const totalStock = variants.reduce((s, v) => s + (v.current_stock || 0), 0);
              const lowStock = variants.some((v) => v.current_stock <= (v.low_stock_threshold ?? 3));
              const catName = categories.find((c) => c.id === p.category_id)?.name || "—";
              const brandName = brands.find((b) => b.id === p.brand_id)?.name || "—";
              return (
                <div key={p.id} className="bg-white rounded-xl border p-4" style={{ borderColor: line }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{p.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: muted }}>
                        {catName} · {brandName} · HSN {p.hsn_code || "—"}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg" style={{ background: roseSoft, color: rose }}>
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setConfirmDelete(p)} className="p-1.5 rounded-lg" style={{ background: "#F4DEDC", color: "#A3402F" }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {variants.map((v) => (
                      <span key={v.id} className="text-[11px] px-2 py-1 rounded-md" style={{ background: cream, color: "#7A4A5A", border: `1px solid ${line}` }}>
                        {v.size} · {v.color} · ₹{v.selling_price} · qty {v.current_stock}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t text-xs" style={{ borderColor: line }}>
                    <span style={{ color: muted }}>{variants.length} variant{variants.length !== 1 ? "s" : ""}</span>
                    <span className="font-medium" style={{ color: lowStock ? "#A3402F" : "#3F7A50" }}>
                      {totalStock} in stock{lowStock ? " · low" : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full">
            <p className="text-sm font-medium">Delete "{confirmDelete.name}"?</p>
            <p className="text-xs mt-1" style={{ color: muted }}>This removes all its variants and stock records.</p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl border text-sm font-medium" style={{ borderColor: line, color: rose }}>
                Cancel
              </button>
              <button onClick={() => deleteProduct(confirmDelete.id)} className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium" style={{ background: "#A3402F" }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
