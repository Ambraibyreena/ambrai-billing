import { useState, useRef, useEffect } from "react";
import { Search, Trash2, Pause, Play, User, Percent, X, Check, Printer, Receipt, CreditCard } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { printInvoice } from "../lib/printInvoice";

const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Wallet"];

function currency(n) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const ink = "#3D2A32";
const rose = "#C9628A";
const roseSoft = "#FBE1E9";
const cream = "#FFF8FA";
const line = "#F3D6E0";
const muted = "#B98CA0";

export default function BillingScreen() {
  const [variants, setVariants] = useState([]); // live product_variants + product name
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const [cart, setCart] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanMsg, setScanMsg] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [billDiscountType, setBillDiscountType] = useState("flat");
  const [billDiscountValue, setBillDiscountValue] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [heldBills, setHeldBills] = useState([]);
  const [payments, setPayments] = useState([]);
  const [activePayMethod, setActivePayMethod] = useState("Cash");
  const [payAmountInput, setPayAmountInput] = useState("");
  const [mobileTab, setMobileTab] = useState("bill");
  const [showPayPanel, setShowPayPanel] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);
  const barcodeRef = useRef(null);

  useEffect(() => {
    loadCatalog();
    barcodeRef.current?.focus();
  }, []);

  async function loadCatalog() {
    setLoadingCatalog(true);
    setErrorMsg("");
    const { data, error } = await supabase
      .from("product_variants")
      .select("*, products(name, gst_percent)")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      setErrorMsg(error.message);
    } else {
      setVariants(data || []);
    }
    setLoadingCatalog(false);
  }

  function flashMsg(text, tone = "error") {
    setScanMsg({ text, tone });
    setTimeout(() => setScanMsg(null), 1800);
  }

  function toCartItem(variant) {
    return {
      variantId: variant.id,
      name: variant.products?.name || "Unnamed",
      size: variant.size,
      color: variant.color,
      qty: 1,
      price: variant.selling_price,
      gst: variant.products?.gst_percent || 0,
      stock: variant.current_stock,
      discountType: "flat",
      discountValue: 0,
    };
  }

  function addVariantToCart(variant) {
    setCart((prev) => {
      const existing = prev.find((i) => i.variantId === variant.id);
      if (existing) {
        if (existing.qty >= variant.current_stock) {
          flashMsg(`Only ${variant.current_stock} in stock`);
          return prev;
        }
        return prev.map((i) => (i.variantId === variant.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, toCartItem(variant)];
    });
  }

  async function handleScan(e) {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;
    let variant = variants.find((v) => v.barcode === code);
    if (!variant) {
      // fall back to a live lookup in case it's not in the recent-30 cache
      const { data } = await supabase
        .from("product_variants")
        .select("*, products(name, gst_percent)")
        .eq("barcode", code)
        .eq("is_active", true)
        .maybeSingle();
      variant = data;
    }
    if (!variant) {
      flashMsg("Barcode not found");
    } else if (variant.current_stock <= 0) {
      flashMsg(`${variant.products?.name} is out of stock`);
    } else {
      addVariantToCart(variant);
      flashMsg(`Added ${variant.products?.name} · ${variant.size}`, "success");
    }
    setBarcodeInput("");
  }

  function updateQty(variantId, delta) {
    setCart((prev) =>
      prev.map((i) => (i.variantId === variantId ? { ...i, qty: Math.max(0, i.qty + delta) } : i)).filter((i) => i.qty > 0)
    );
  }

  function removeItem(variantId) {
    setCart((prev) => prev.filter((i) => i.variantId !== variantId));
  }

  function setItemDiscount(variantId, type, value) {
    setCart((prev) => prev.map((i) => (i.variantId === variantId ? { ...i, discountType: type, discountValue: value } : i)));
  }

  function lineTotal(item) {
    const base = item.price * item.qty;
    const discount = item.discountType === "percent" ? (base * (item.discountValue || 0)) / 100 : item.discountValue || 0;
    return Math.max(0, base - discount);
  }

  const subtotal = cart.reduce((sum, i) => sum + lineTotal(i), 0);
  const billDiscountAmount = billDiscountType === "percent" ? (subtotal * (billDiscountValue || 0)) / 100 : billDiscountValue || 0;
  const afterBillDiscount = Math.max(0, subtotal - billDiscountAmount);
  const gstAmount = cart.reduce((sum, i) => {
    const share = subtotal > 0 ? lineTotal(i) / subtotal : 0;
    const taxableAfterDiscount = afterBillDiscount * share;
    return sum + (taxableAfterDiscount * i.gst) / 100;
  }, 0);
  const roundedTotal = Math.round(afterBillDiscount);
  const itemCount = cart.reduce((s, i) => s + i.qty, 0);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const balanceDue = +(roundedTotal - totalPaid).toFixed(2);

  function addPayment() {
    const amt = parseFloat(payAmountInput);
    if (!amt || amt <= 0) return;
    setPayments((prev) => [...prev, { method: activePayMethod, amount: amt }]);
    setPayAmountInput("");
  }

  function removePayment(idx) {
    setPayments((prev) => prev.filter((_, i) => i !== idx));
  }

  function holdBill() {
    if (cart.length === 0) return;
    setHeldBills((prev) => [...prev, { id: Date.now(), cart, customer, billDiscountType, billDiscountValue, couponCode }]);
    resetBill();
    flashMsg("Bill held", "success");
  }

  function resumeBill(held) {
    setCart(held.cart);
    setCustomer(held.customer);
    setBillDiscountType(held.billDiscountType);
    setBillDiscountValue(held.billDiscountValue);
    setCouponCode(held.couponCode);
    setHeldBills((prev) => prev.filter((b) => b.id !== held.id));
    setMobileTab("bill");
  }

  function resetBill() {
    setCart([]);
    setCustomer(null);
    setBillDiscountType("flat");
    setBillDiscountValue(0);
    setCouponCode("");
    setPayments([]);
    setShowPayPanel(false);
    setMobileTab("bill");
    barcodeRef.current?.focus();
  }

  async function findOrCreateCustomer() {
    if (!customer) return null;
    if (customer.id) return customer.id;
    // customer was typed fresh (no id) — try match by name/phone, else create
    const { data: existing } = await supabase.from("customers").select("id").eq("name", customer.name).maybeSingle();
    if (existing) return existing.id;
    const { data, error } = await supabase.from("customers").insert({ name: customer.name, phone: customer.phone !== "—" ? customer.phone : null }).select().single();
    if (error) throw error;
    return data.id;
  }

  async function completeSale() {
    setSaving(true);
    setErrorMsg("");
    try {
      const customerId = await findOrCreateCustomer();
      const invoiceNumber = `AMB-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

      const { data: invoice, error: invErr } = await supabase
        .from("invoices")
        .insert({
          invoice_number: invoiceNumber,
          customer_id: customerId,
          invoice_type: "gst",
          status: "completed",
          subtotal,
          bill_discount_type: billDiscountType,
          bill_discount_value: billDiscountValue,
          coupon_code: couponCode || null,
          gst_amount: gstAmount,
          total_amount: roundedTotal,
          paid_amount: totalPaid,
          balance_amount: balanceDue,
        })
        .select()
        .single();
      if (invErr) throw invErr;

      const itemRows = cart.map((item) => ({
        invoice_id: invoice.id,
        variant_id: item.variantId,
        quantity: item.qty,
        unit_price: item.price,
        item_discount_type: item.discountType,
        item_discount_value: item.discountValue,
        gst_percent: item.gst,
        line_total: lineTotal(item),
      }));
      const { error: itemErr } = await supabase.from("invoice_items").insert(itemRows);
      if (itemErr) throw itemErr;
      // Note: stock is auto-decremented by the trg_decrement_stock trigger on invoice_items insert

      const paymentRows = payments.map((p) => ({ invoice_id: invoice.id, method: p.method.toLowerCase(), amount: p.amount }));
      const { error: payErr } = await supabase.from("payments").insert(paymentRows);
      if (payErr) throw payErr;

      setLastInvoice({
        invoiceNumber,
        total: roundedTotal,
        subtotal,
        billDiscountAmount,
        gstAmount,
        customer,
        items: cart.map((i) => ({ ...i, lineTotal: lineTotal(i) })),
        payments,
        date: new Date(),
      });
      resetBill();
      loadCatalog(); // refresh stock numbers
    } catch (err) {
      setErrorMsg(err.message || "Failed to complete sale");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: cream, color: ink }}>
      <header className="px-5 py-3.5 flex items-center justify-between shrink-0 border-b" style={{ borderColor: line, background: "#FFFDFB" }}>
        <div className="flex items-baseline gap-2 min-w-0">
          <h1 className="text-2xl leading-none tracking-tight shrink-0" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: rose, fontWeight: 600 }}>
            Ambrai
          </h1>
          <span className="text-[11px] uppercase tracking-widest truncate" style={{ color: muted }}>Reena Mahendru</span>
        </div>
        {heldBills.length > 0 && (
          <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full shrink-0" style={{ background: roseSoft, color: rose }}>
            <Pause size={12} /> {heldBills.length}
          </span>
        )}
      </header>

      {errorMsg && (
        <div className="mx-4 mt-2 text-xs px-3 py-2 rounded-lg shrink-0" style={{ background: "#F4DEDC", color: "#A3402F" }}>
          {errorMsg}
        </div>
      )}

      <div className="flex md:hidden border-b shrink-0" style={{ borderColor: line, background: "#FFFDFB" }}>
        <button onClick={() => setMobileTab("bill")} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium" style={{ color: mobileTab === "bill" ? rose : muted, borderBottom: mobileTab === "bill" ? `2px solid ${rose}` : "2px solid transparent" }}>
          <Receipt size={15} /> Bill {itemCount > 0 && `(${itemCount})`}
        </button>
        <button onClick={() => setMobileTab("summary")} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium" style={{ color: mobileTab === "summary" ? rose : muted, borderBottom: mobileTab === "summary" ? `2px solid ${rose}` : "2px solid transparent" }}>
          <CreditCard size={15} /> Pay · {currency(roundedTotal)}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        <div className={`flex-1 flex-col p-4 md:p-6 gap-3 overflow-hidden min-w-0 ${mobileTab === "bill" ? "flex" : "hidden md:flex"}`}>
          <form onSubmit={handleScan} className="relative shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2" size={17} style={{ color: "#C89AA3" }} />
            <input
              ref={barcodeRef}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Scan or enter barcode"
              className="w-full pl-10 pr-3 py-3 rounded-xl border-2 bg-white text-sm focus:outline-none transition"
              style={{ borderColor: line }}
            />
            {scanMsg && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-medium px-2 py-1 rounded-full whitespace-nowrap" style={{ background: scanMsg.tone === "success" ? "#E1EFE4" : "#F4DEDC", color: scanMsg.tone === "success" ? "#3F7A50" : "#A3402F" }}>
                {scanMsg.text}
              </div>
            )}
          </form>

          <div className="flex gap-2 overflow-x-auto shrink-0 pb-1 -mx-1 px-1">
            {loadingCatalog ? (
              <span className="text-xs" style={{ color: muted }}>Loading catalog…</span>
            ) : variants.length === 0 ? (
              <span className="text-xs" style={{ color: muted }}>No products yet — add some in Product Management</span>
            ) : (
              variants.slice(0, 12).map((v) => (
                <button
                  key={v.id}
                  onClick={() => addVariantToCart(v)}
                  disabled={v.current_stock <= 0}
                  className="text-xs px-3 py-2 rounded-lg border whitespace-nowrap shrink-0 disabled:opacity-30 transition"
                  style={{ borderColor: line, background: "#FFFDFB", color: "#7A4A5A" }}
                >
                  {v.products?.name} <span style={{ color: "#C89AA3" }}>· {v.size}</span>
                </button>
              ))
            )}
          </div>

          <div className="flex-1 overflow-y-auto rounded-xl border" style={{ borderColor: line, background: "#FFFDFB" }}>
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-1 py-16" style={{ color: "#C89AA3" }}>
                <Receipt size={22} strokeWidth={1.5} />
                <p className="text-sm mt-1">No items yet</p>
                <p className="text-xs" style={{ color: "#DDBFC7" }}>Scan a barcode to begin</p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={item.variantId} className="p-3.5 flex items-center gap-2.5" style={{ borderTop: idx === 0 ? "none" : "1px solid #F3E7E9" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs" style={{ color: muted }}>{item.size} · {item.color} · {currency(item.price)}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Percent size={10} style={{ color: "#C89AA3" }} />
                      <input type="number" min="0" value={item.discountValue} onChange={(e) => setItemDiscount(item.variantId, item.discountType, +e.target.value)} className="w-12 text-xs px-1.5 py-0.5 rounded border focus:outline-none" style={{ borderColor: line }} />
                      <select value={item.discountType} onChange={(e) => setItemDiscount(item.variantId, e.target.value, item.discountValue)} className="text-xs px-1 py-0.5 rounded border bg-white" style={{ borderColor: line }}>
                        <option value="flat">₹</option>
                        <option value="percent">%</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => updateQty(item.variantId, -1)} className="w-7 h-7 rounded-full font-medium" style={{ background: roseSoft, color: rose }}>−</button>
                    <span className="w-4 text-center text-sm font-medium">{item.qty}</span>
                    <button onClick={() => updateQty(item.variantId, 1)} className="w-7 h-7 rounded-full font-medium" style={{ background: roseSoft, color: rose }}>+</button>
                  </div>
                  <div className="w-16 text-right text-sm font-semibold shrink-0">{currency(lineTotal(item))}</div>
                  <button onClick={() => removeItem(item.variantId)} className="shrink-0" style={{ color: "#DDBFC7" }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </div>

          {heldBills.length > 0 && (
            <div className="flex gap-2 overflow-x-auto shrink-0 pb-1">
              {heldBills.map((h) => (
                <button key={h.id} onClick={() => resumeBill(h)} className="flex items-center gap-1.5 shrink-0 text-xs px-2.5 py-1.5 rounded-lg border whitespace-nowrap" style={{ borderColor: line, background: "#FFFDFB", color: "#7A4A5A" }}>
                  <Play size={11} style={{ color: rose }} />
                  {h.customer?.name || "Walk-in"} · {h.cart.length}
                </button>
              ))}
            </div>
          )}

          <button onClick={() => setMobileTab("summary")} disabled={cart.length === 0} className="md:hidden shrink-0 w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-30 flex items-center justify-center gap-2" style={{ background: rose }}>
            Review & pay · {currency(roundedTotal)}
          </button>
        </div>

        <div className={`w-full md:w-[380px] flex-col p-4 md:p-6 gap-4 overflow-y-auto shrink-0 border-t md:border-t-0 md:border-l ${mobileTab === "summary" ? "flex" : "hidden md:flex"}`} style={{ borderColor: line, background: "#FFFDFB" }}>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-widest" style={{ color: muted }}>Customer</label>
            {customer ? (
              <div className="mt-1.5 flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: roseSoft }}>
                <div>
                  <p className="text-sm font-medium">{customer.name}</p>
                  <p className="text-xs" style={{ color: muted }}>{customer.phone}</p>
                </div>
                <button onClick={() => setCustomer(null)} style={{ color: "#C89AA3" }}><X size={14} /></button>
              </div>
            ) : (
              <div className="mt-1.5 relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2" size={15} style={{ color: "#C89AA3" }} />
                <input
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customerSearch.trim()) {
                      setCustomer({ name: customerSearch.trim(), phone: "—" });
                      setCustomerSearch("");
                    }
                  }}
                  placeholder="Name or phone, then Enter"
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border focus:outline-none"
                  style={{ borderColor: line }}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-medium uppercase tracking-widest" style={{ color: muted }}>Bill discount</label>
              <div className="mt-1.5 flex gap-1">
                <input type="number" min="0" value={billDiscountValue} onChange={(e) => setBillDiscountValue(+e.target.value)} className="w-full min-w-0 px-2 py-2.5 text-sm rounded-xl border focus:outline-none" style={{ borderColor: line }} />
                <select value={billDiscountType} onChange={(e) => setBillDiscountType(e.target.value)} className="px-1 rounded-xl border bg-white text-sm shrink-0" style={{ borderColor: line }}>
                  <option value="flat">₹</option>
                  <option value="percent">%</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-widest" style={{ color: muted }}>Coupon</label>
              <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Code" className="mt-1.5 w-full px-2.5 py-2.5 text-sm rounded-xl border focus:outline-none" style={{ borderColor: line }} />
            </div>
          </div>

          <div className="border-t pt-3 space-y-1.5 text-sm" style={{ borderColor: "#F3E7E9" }}>
            <div className="flex justify-between" style={{ color: "#7A4A5A" }}>
              <span>Subtotal</span><span>{currency(subtotal)}</span>
            </div>
            {billDiscountAmount > 0 && (
              <div className="flex justify-between" style={{ color: "#A3402F" }}>
                <span>Bill discount</span><span>−{currency(billDiscountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs" style={{ color: muted }}>
              <span>Incl. GST</span><span>{currency(gstAmount)}</span>
            </div>
            <div className="flex justify-between text-xl font-semibold pt-2 border-t" style={{ borderColor: "#F3E7E9", color: rose, fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
              <span>Total</span><span>{currency(roundedTotal)}</span>
            </div>
          </div>

          {showPayPanel ? (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-1.5">
                {PAYMENT_METHODS.map((m) => (
                  <button key={m} onClick={() => setActivePayMethod(m)} className="text-xs py-2 rounded-lg font-medium transition" style={activePayMethod === m ? { background: rose, color: "white" } : { background: roseSoft, color: rose }}>
                    {m}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input type="number" value={payAmountInput} onChange={(e) => setPayAmountInput(e.target.value)} placeholder={`Amount (bal ${currency(balanceDue)})`} className="flex-1 min-w-0 px-3 py-2.5 text-sm rounded-xl border focus:outline-none" style={{ borderColor: line }} />
                <button onClick={addPayment} className="px-3 rounded-xl shrink-0" style={{ background: roseSoft, color: rose }}><Check size={16} /></button>
              </div>
              {payments.length > 0 && (
                <div className="space-y-1">
                  {payments.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs rounded-lg px-2.5 py-1.5" style={{ background: cream }}>
                      <span style={{ color: "#7A4A5A" }}>{p.method}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{currency(p.amount)}</span>
                        <button onClick={() => removePayment(idx)} style={{ color: "#DDBFC7" }}><X size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between text-xs px-1">
                <span style={{ color: muted }}>Balance due</span>
                <span className="font-medium" style={{ color: balanceDue > 0 ? "#A3402F" : "#3F7A50" }}>{currency(balanceDue)}</span>
              </div>
              <button onClick={completeSale} disabled={cart.length === 0 || balanceDue > 0 || saving} className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-30 transition" style={{ background: rose }}>
                {saving ? "Completing…" : "Complete sale"}
              </button>
            </div>
          ) : (
            <div className="mt-auto space-y-2 pt-1">
              <button onClick={() => setShowPayPanel(true)} disabled={cart.length === 0} className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-30 transition" style={{ background: rose }}>
                Proceed to payment
              </button>
              <button onClick={holdBill} disabled={cart.length === 0} className="w-full py-2.5 rounded-xl border text-sm font-medium disabled:opacity-30 flex items-center justify-center gap-1.5" style={{ borderColor: line, color: rose }}>
                <Pause size={14} /> Hold bill
              </button>
            </div>
          )}
        </div>
      </div>

      {lastInvoice && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "#E1EFE4", color: "#3F7A50" }}>
              <Check size={22} />
            </div>
            <p className="text-sm" style={{ color: muted }}>Sale completed</p>
            <p className="text-lg font-semibold mt-0.5" style={{ color: rose }}>{lastInvoice.invoiceNumber}</p>
            <p className="text-2xl font-bold mt-2">{currency(lastInvoice.total)}</p>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setLastInvoice(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: roseSoft, color: rose }}>New sale</button>
              <button onClick={() => printInvoice(lastInvoice)} className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-1.5" style={{ background: rose }}><Printer size={14} /> Print</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
