import { useState } from "react";
import { Receipt, Package, LogOut } from "lucide-react";
import AuthGate from "./components/AuthGate";
import BillingScreen from "./pages/BillingScreen";
import ProductManagement from "./pages/ProductManagement";
import { supabase } from "./lib/supabaseClient";

const rose = "#8C2F49";
const roseSoft = "#F4E3E7";
const line = "#EAD9DC";

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
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg"
            style={{ color: "#B48A94" }}
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>

        {tab === "billing" ? <BillingScreen /> : <ProductManagement />}
      </div>
    </AuthGate>
  );
}
