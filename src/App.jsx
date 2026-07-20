import { useState } from "react";
import { Receipt, Package, LogOut, Tag, BarChart3, History } from "lucide-react";
import AuthGate from "./components/AuthGate";
import BillingScreen from "./pages/BillingScreen";
import ProductManagement from "./pages/ProductManagement";
import LabelPrinting from "./pages/LabelPrinting";
import Reports from "./pages/Reports";
import InvoiceHistory from "./pages/InvoiceHistory";
import { supabase } from "./lib/supabaseClient";

const rose = "#C9628A";
const roseSoft = "#FBE1E9";
const line = "#F3D6E0";

export default function App() {
  const [tab, setTab] = useState("billing"); // 'billing' | 'products'

  return (
    <AuthGate>
      <div className="min-h-screen flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: line, background: "#FFFDFB" }}>
          <div className="flex gap-2">
            <button
              onClick={() => setTab("billing")}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={tab === "billing" ? { background: rose, color: "white" } : { background: roseSoft, color: rose }}
            >
              <Receipt size={13} /> Billing
            </button>
            <button
              onClick={() => setTab("products")}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={tab === "products" ? { background: rose, color: "white" } : { background: roseSoft, color: rose }}
            >
              <Package size={13} /> Products
            </button>
            <button
              onClick={() => setTab("labels")}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={tab === "labels" ? { background: rose, color: "white" } : { background: roseSoft, color: rose }}
            >
              <Tag size={13} /> Labels
            </button>
            <button
              onClick={() => setTab("reports")}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={tab === "reports" ? { background: rose, color: "white" } : { background: roseSoft, color: rose }}
            >
              <BarChart3 size={13} /> Reports
            </button>
            <button
              onClick={() => setTab("history")}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={tab === "history" ? { background: rose, color: "white" } : { background: roseSoft, color: rose }}
            >
              <History size={13} /> Past bills
            </button>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg"
            style={{ color: "#B98CA0" }}
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>

        {tab === "billing" ? <BillingScreen /> : tab === "products" ? <ProductManagement /> : tab === "labels" ? <LabelPrinting /> : tab === "reports" ? <Reports /> : <InvoiceHistory />}
      </div>
    </AuthGate>
  );
}
