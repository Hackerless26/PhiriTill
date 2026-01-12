import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import { AppProvider, useApp } from "./lib/appContext";
import { UiPreferencesProvider } from "./lib/uiPreferences";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Products from "./pages/Products";
import Reports from "./pages/Reports";
import SalesHistory from "./pages/SalesHistory";
import Sell from "./pages/Sell";
import Settings from "./pages/Settings";
import StockMovements from "./pages/StockMovements";
import StockAdjust from "./pages/StockAdjust";
import StockReceive from "./pages/StockReceive";
import Team from "./pages/Team";
import Profile from "./pages/Profile";
import Suppliers from "./pages/Suppliers";
import PurchaseOrders from "./pages/PurchaseOrders";
import Returns from "./pages/Returns";
import Branches from "./pages/Branches";
import Notifications from "./pages/Notifications";
import SystemCheck from "./pages/SystemCheck";

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loadingAuth } = useApp();

  if (loadingAuth) {
    return <div className="page">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <UiPreferencesProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="sell" element={<Sell />} />
              <Route path="products" element={<Products />} />
              <Route path="stock/receive" element={<StockReceive />} />
              <Route path="stock/adjust" element={<StockAdjust />} />
              <Route path="stock/movements" element={<StockMovements />} />
              <Route path="stock/returns" element={<Returns />} />
              <Route path="sales" element={<SalesHistory />} />
              <Route path="reports" element={<Reports />} />
              <Route path="users" element={<Team />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="purchase-orders" element={<PurchaseOrders />} />
              <Route path="branches" element={<Branches />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="system-check" element={<SystemCheck />} />
              <Route path="profile" element={<Profile />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </UiPreferencesProvider>
  );
}
