import { useState, useEffect } from "react";
import { Search, ChevronLeft, Receipt, Printer, Calendar } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { printInvoice } from "../lib/printInvoice";

const ink = "#3D2A32";
const rose = "#C9628A";
const roseSoft = "#FBE1E9";
const cream = "#FFF8FA";
const line = "#F3D6E0";
const muted = "#B98CA0";

function currency(n) {
  return `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function InvoiceHistory() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null); // invoice being viewed in detail
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, []);

  async function loadInvoices() {
    setLoading(true);
    setErrorMsg("");
    const { data, error } = await supabase
      .from("invoices")
      .select("*, customers(name, phone)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) setErrorMsg(error.message);
    else setInvoices(data || []);
    setLoading(false);
  }

  async function openInvoice(inv) {
    setDetailLoading(true);
    setErrorMsg("");
    try {
      const [{ data: items, error: itemErr }, { data: pays, error: payErr }] = await Promise.all([
        supabase.from("invoice_items").select("*, product_variants(size, color, products(name))").eq("invoice_id", inv.id),
        supabase.from("payments").select("*").eq("invoice_id", inv.id),
      ]);
      if (itemErr) throw itemErr;
      if (payErr) throw payErr;
      setSelected({ ...inv, itemRows: items || [], paymentRows: pays || [] });
    } catch (err) {
      setErrorMsg(err.message || "Failed to load invoice");
    } finally {
      setDetailLoading(false);
    }
  }

  function handlePrint(inv) {
    printInvoice({
      invoiceNumber: inv.invoice_number,
      date: inv.created_at,
      customer: inv.customers ? { name: inv.customers.name, phone: inv.customers.phone } : null,
      items: (inv.itemRows || []).map((r) => ({
        name: r.product_variants?.products?.name || "Item",
        size: r.product_variants?.size,
        color: r.product_variants?.color,
        qty: r.quantity,
        price: r.unit_price,
        lineTotal: r.line_total,
      })),
      subtotal: inv.subtotal,
      billDiscountAmount: inv.bill_discount_value && inv.bill_discount_type === "percent"
        ? (inv.subtotal * inv.bill_discount_value) / 100
        : inv.bill_discount_value,
      gstAmount: inv.gst_amount,
      total: inv.total_amount,
      payments: (inv.paymentRows || []).map((p) => ({ method: p.method, amount: p.amount })),
    });
  }

  const filtered = invoices.filter((inv) => {
    const q = search.toLowerCase();
    return (
      inv.invoice_number.toLowerCase().includes(q) ||
      (inv.customers?.name || "").toLowerCase().includes(q) ||
      (inv.customers?.phone || "").includes(search)
    );
  });

  // ---------------- DETAIL VIEW ----------------
  if (selected) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: cream, color: ink }}>
        <header className="px-4 md:px-6 py-3.5 flex items-center gap-3 shrink-0 border-b sticky top-0 z-10" style={{ borderColor: line, background: "#FFFDFB" }}>
          <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg" style={{ color: rose }}>
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-lg font-medium truncate flex-1">{selected.invoice_number}</h1>
          <button
            onClick={() => handlePrint(selected)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-white shrink-0"
            style={{ background: rose }}
          >
            <Printer size={14} /> Print
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-2xl w-full mx-auto space-y-4">
          <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: line }}>
            <div className="flex justify-between text-sm">
              <span style={{ color: muted }}>Date</span>
              <span>{new Date(selected.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <div className="flex justify-between text-sm mt-1.5">
              <span style={{ color: muted }}>Customer</span>
              <span>{selected.customers?.name || "Walk-in"}</span>
            </div>
            <div className="flex justify-between text-sm mt-1.5">
              <span style={{ color: muted }}>Status</span>
              <span className="capitalize">{selected.status}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: line }}>
            <h2 className="text-sm font-medium mb-3">Items</h2>
            <div className="space-y-2.5">
              {selected.itemRows.map((r) => (
                <div key={r.id} className="flex justify-between text-sm">
                  <div>
                    <p>{r.product_variants?.products?.name || "Item"}</p>
                    <p className="text-xs" style={{ color: muted }}>
                      {r.product_variants?.size} · {r.product_variants?.color} · qty {r.quantity} × {currency(r.unit_price)}
                    </p>
                  </div>
                  <span className="font-medium shrink-0">{currency(r.line_total)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border p-4 shadow-sm space-y-1.5 text-sm" style={{ borderColor: line }}>
            <div className="flex justify-between"><span style={{ color: muted }}>Subtotal</span><span>{currency(selected.subtotal)}</span></div>
            {selected.bill_discount_value > 0 && (
              <div className="flex justify-between" style={{ color: "#A3402F" }}>
                <span>Discount</span><span>−{selected.bill_discount_type === "percent" ? `${selected.bill_discount_value}%` : currency(selected.bill_discount_value)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs" style={{ color: muted }}><span>GST (incl.)</span><span>{currency(selected.gst_amount)}</span></div>
            <div className="flex justify-between text-lg font-semibold pt-2 border-t" style={{ borderColor: line, color: rose, fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
              <span>Total</span><span>{currency(selected.total_amount)}</span>
            </div>
          </div>

          {selected.paymentRows.length > 0 && (
            <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: line }}>
              <h2 className="text-sm font-medium mb-2">Payments</h2>
              {selected.paymentRows.map((p) => (
                <div key={p.id} className="flex justify-between text-sm py-1">
                  <span className="capitalize" style={{ color: "#7A4A5A" }}>{p.method}</span>
                  <span className="font-medium">{currency(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
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
          <span className="text-[11px] uppercase tracking-widest truncate" style={{ color: muted }}>Past bills</span>
        </div>
      </header>

      {errorMsg && (
        <div className="mx-4 mt-3 text-xs px-3 py-2 rounded-lg" style={{ background: "#F4DEDC", color: "#A3402F" }}>
          {errorMsg}
        </div>
      )}

      <div className="p-4 md:p-6 space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2" size={16} style={{ color: "#C89AA3" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice number, customer name, or phone"
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border-2 bg-white text-sm focus:outline-none"
            style={{ borderColor: line }}
          />
        </div>

        {loading || detailLoading ? (
          <p className="text-sm text-center py-10" style={{ color: muted }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16" style={{ color: "#C89AA3" }}>
            <Receipt size={24} strokeWidth={1.5} />
            <p className="text-sm">No bills found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((inv) => (
              <button
                key={inv.id}
                onClick={() => openInvoice(inv)}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border bg-white text-left shadow-sm"
                style={{ borderColor: line }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{inv.invoice_number}</p>
                  <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: muted }}>
                    <Calendar size={11} />
                    {new Date(inv.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    {" · "}
                    {inv.customers?.name || "Walk-in"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{currency(inv.total_amount)}</p>
                  <p className="text-[11px] capitalize" style={{ color: inv.status === "completed" ? "#3F7A50" : muted }}>{inv.status}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
