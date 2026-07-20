import { useState, useEffect, useMemo } from "react";
import { TrendingUp, Package, AlertTriangle, Receipt, IndianRupee } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "../lib/supabaseClient";

const ink = "#3A2430";
const rose = "#8C2F49";
const roseSoft = "#F4E3E7";
const cream = "#FBF6F1";
const line = "#EAD9DC";
const muted = "#B48A94";

const RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "month", label: "This month" },
];

function currency(n) {
  return `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getRangeDates(key) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  let start = new Date(now);
  if (key === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (key === "7d") {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (key === "30d") {
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  } else if (key === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { start, end };
}

export default function Reports() {
  const [rangeKey, setRangeKey] = useState("7d");
  const [invoices, setInvoices] = useState([]);
  const [items, setItems] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    loadReport(rangeKey);
    loadLowStock();
    loadCategories();
  }, [rangeKey]);

  async function loadCategories() {
    const { data } = await supabase.from("categories").select("*");
    setCategories(data || []);
  }

  async function loadLowStock() {
    const { data, error } = await supabase
      .from("product_variants")
      .select("*, products(name)")
      .eq("is_active", true);
    if (!error) {
      setLowStock((data || []).filter((v) => v.current_stock <= (v.low_stock_threshold ?? 3)));
    }
  }

  async function loadReport(key) {
    setLoading(true);
    setErrorMsg("");
    const { start, end } = getRangeDates(key);
    try {
      const { data: invData, error: invErr } = await supabase
        .from("invoices")
        .select("*")
        .eq("status", "completed")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: true });
      if (invErr) throw invErr;
      setInvoices(invData || []);

      const { data: itemData, error: itemErr } = await supabase
        .from("invoice_items")
        .select("*, invoices!inner(created_at,status), product_variants(size,color,products(name,category_id))")
        .gte("invoices.created_at", start.toISOString())
        .lte("invoices.created_at", end.toISOString())
        .eq("invoices.status", "completed");
      if (itemErr) throw itemErr;
      setItems(itemData || []);
    } catch (err) {
      setErrorMsg(err.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  const kpis = useMemo(() => {
    const totalRevenue = invoices.reduce((s, i) => s + (i.total_amount || 0), 0);
    const orderCount = invoices.length;
    const avgOrder = orderCount ? totalRevenue / orderCount : 0;
    const itemsSold = items.reduce((s, i) => s + (i.quantity || 0), 0);
    return { totalRevenue, orderCount, avgOrder, itemsSold };
  }, [invoices, items]);

  const dailyTrend = useMemo(() => {
    const map = {};
    invoices.forEach((inv) => {
      const day = new Date(inv.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      map[day] = (map[day] || 0) + (inv.total_amount || 0);
    });
    return Object.entries(map).map(([day, total]) => ({ day, total }));
  }, [invoices]);

  const topProducts = useMemo(() => {
    const map = {};
    items.forEach((i) => {
      const name = i.product_variants?.products?.name || "Unknown";
      if (!map[name]) map[name] = { name, qty: 0, revenue: 0 };
      map[name].qty += i.quantity || 0;
      map[name].revenue += i.line_total || 0;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [items]);

  const categoryBreakdown = useMemo(() => {
    const map = {};
    items.forEach((i) => {
      const catId = i.product_variants?.products?.category_id;
      const catName = categories.find((c) => c.id === catId)?.name || "Uncategorized";
      if (!map[catName]) map[catName] = 0;
      map[catName] += i.line_total || 0;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [items, categories]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: cream, color: ink }}>
      <header className="px-4 md:px-6 py-3.5 flex items-center justify-between shrink-0 border-b sticky top-0 z-10" style={{ borderColor: line, background: "#FFFDFB" }}>
        <div className="flex items-baseline gap-2 min-w-0">
          <h1 className="text-2xl leading-none tracking-tight shrink-0" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: rose, fontWeight: 600 }}>
            Ambrai
          </h1>
          <span className="text-[11px] uppercase tracking-widest truncate" style={{ color: muted }}>Reports</span>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRangeKey(r.key)}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap"
              style={rangeKey === r.key ? { background: rose, color: "white" } : { background: roseSoft, color: rose }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {errorMsg && (
        <div className="mx-4 mt-3 text-xs px-3 py-2 rounded-lg" style={{ background: "#F4DEDC", color: "#A3402F" }}>
          {errorMsg}
        </div>
      )}

      <div className="p-4 md:p-6 space-y-5">
        {loading ? (
          <p className="text-sm text-center py-10" style={{ color: muted }}>Loading report…</p>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard icon={<IndianRupee size={15} />} label="Revenue" value={currency(kpis.totalRevenue)} />
              <KpiCard icon={<Receipt size={15} />} label="Orders" value={kpis.orderCount} />
              <KpiCard icon={<TrendingUp size={15} />} label="Avg order" value={currency(Math.round(kpis.avgOrder))} />
              <KpiCard icon={<Package size={15} />} label="Items sold" value={kpis.itemsSold} />
            </div>

            {/* Daily trend chart */}
            <div className="bg-white rounded-xl border p-4" style={{ borderColor: line }}>
              <h2 className="text-sm font-medium mb-3">Sales trend</h2>
              {dailyTrend.length === 0 ? (
                <p className="text-xs py-8 text-center" style={{ color: muted }}>No sales in this period yet.</p>
              ) : (
                <div style={{ width: "100%", height: 220 }}>
                  <ResponsiveContainer>
                    <BarChart data={dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3E7E9" />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: muted }} />
                      <YAxis tick={{ fontSize: 11, fill: muted }} />
                      <Tooltip formatter={(v) => currency(v)} contentStyle={{ borderRadius: 8, borderColor: line, fontSize: 12 }} />
                      <Bar dataKey="total" fill={rose} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top products */}
              <div className="bg-white rounded-xl border p-4" style={{ borderColor: line }}>
                <h2 className="text-sm font-medium mb-3">Top products</h2>
                {topProducts.length === 0 ? (
                  <p className="text-xs py-6 text-center" style={{ color: muted }}>No sales yet.</p>
                ) : (
                  <div className="space-y-2">
                    {topProducts.map((p, idx) => (
                      <div key={p.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs w-4 shrink-0" style={{ color: muted }}>{idx + 1}</span>
                          <span className="truncate">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs" style={{ color: muted }}>{p.qty} sold</span>
                          <span className="font-medium w-16 text-right">{currency(p.revenue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Category breakdown */}
              <div className="bg-white rounded-xl border p-4" style={{ borderColor: line }}>
                <h2 className="text-sm font-medium mb-3">By category</h2>
                {categoryBreakdown.length === 0 ? (
                  <p className="text-xs py-6 text-center" style={{ color: muted }}>No sales yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {categoryBreakdown.map(([name, revenue]) => {
                      const pct = kpis.totalRevenue ? Math.round((revenue / kpis.totalRevenue) * 100) : 0;
                      return (
                        <div key={name}>
                          <div className="flex justify-between text-xs mb-1">
                            <span style={{ color: "#7A4A5A" }}>{name}</span>
                            <span style={{ color: muted }}>{currency(revenue)} · {pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full" style={{ background: roseSoft }}>
                            <div className="h-1.5 rounded-full" style={{ background: rose, width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Low stock */}
            <div className="bg-white rounded-xl border p-4" style={{ borderColor: line }}>
              <h2 className="text-sm font-medium mb-3 flex items-center gap-1.5">
                <AlertTriangle size={14} style={{ color: "#A3402F" }} /> Low stock ({lowStock.length})
              </h2>
              {lowStock.length === 0 ? (
                <p className="text-xs py-4 text-center" style={{ color: muted }}>Nothing running low.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {lowStock.map((v) => (
                    <span key={v.id} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ background: "#F4DEDC", color: "#A3402F" }}>
                      {v.products?.name} · {v.size} · qty {v.current_stock}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value }) {
  return (
    <div className="bg-white rounded-xl border p-3.5" style={{ borderColor: line }}>
      <div className="flex items-center gap-1.5 text-xs" style={{ color: muted }}>
        {icon} {label}
      </div>
      <p className="text-lg font-semibold mt-1" style={{ color: ink }}>{value}</p>
    </div>
  );
}
