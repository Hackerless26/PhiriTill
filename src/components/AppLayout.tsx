import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "../lib/appContext";
import { useUiPreferences } from "../lib/uiPreferences";
import { supabase } from "../lib/supabaseClient";
import { syncLowStockNotifications } from "../lib/posApi";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/sell", label: "Daily Sales" },
  { to: "/products", label: "Products" },
  { to: "/stock/receive", label: "Receive" },
  { to: "/stock/adjust", label: "Adjust" },
  { to: "/stock/movements", label: "Stock Movements" },
  { to: "/stock/returns", label: "Returns" },
  { to: "/purchase-orders", label: "Purchase Orders" },
  { to: "/suppliers", label: "Suppliers" },
  { to: "/sales", label: "Sales History" },
  { to: "/reports", label: "Reports" },
  { to: "/users", label: "Users & Roles" },
  { to: "/branches", label: "Branches" },
  { to: "/notifications", label: "Notifications" },
  { to: "/system-check", label: "System Check" },
  { to: "/profile", label: "Profile" },
  { to: "/settings", label: "Settings" },
];

const mobileNavItems = navItems;

export default function AppLayout() {
  const { user, signOut, branches, selectedBranchId, setSelectedBranchId, products } =
    useApp();
  const { prefs } = useUiPreferences();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const lowStockCount = useMemo(
    () =>
      products.filter(
        (product) => product.stock_on_hand <= product.low_stock_threshold
      ).length,
    [products]
  );

  useEffect(() => {
    const lowStock = products.filter(
      (product) => product.stock_on_hand <= product.low_stock_threshold
    );
    const ids = lowStock.map((product) => product.id);
    const names = lowStock.map((product) => product.name);
    if (products.length) {
      syncLowStockNotifications(ids, names);
    }
  }, [products]);

  useEffect(() => {
    window.localStorage.removeItem("poxpos-pending-queue");
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setAvatarUrl(data?.avatar_url ?? null);
      });
  }, [user]);

  return (
    <div
      className="shell"
      data-theme={prefs.theme}
      data-layout={prefs.layout}
      data-sidebar={prefs.sidebarVariant}
      data-sidebar-position={prefs.sidebarPosition}
      data-header={prefs.headerPosition}
    >
      <aside className="shell__nav">
        <div className="shell__brand">
          <img className="brand-logo" src="/logo.png" alt="PhiriTill logo" />
          <div>
            <p className="app__name">PoxPOS</p>
            <p className="app__tagline">POS + Inventory</p>
          </div>
        </div>
        <nav className="nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? "nav__link active" : "nav__link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="shell__content">
        <header className="shell__header">
          <div>
            <p className="shell__title">Welcome back</p>
            <p className="muted">{user?.email}</p>
          </div>
          <div className="header__actions">
            <div className="branch-pill">
              <span>Branch</span>
              <select
                value={selectedBranchId ?? ""}
                onChange={(event) => setSelectedBranchId(event.target.value)}
              >
                <option value="" disabled>
                  Select branch
                </option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="icon-button" aria-label="Notifications">
              {lowStockCount ? (
                <span className="icon-dot">{lowStockCount}</span>
              ) : null}
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 5a4 4 0 0 0-4 4v3l-1.5 2h11L16 12V9a4 4 0 0 0-4-4z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M9.5 18a2.5 2.5 0 0 0 5 0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
            <button className="icon-button" aria-label="Messages">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M5 6h14v9H8l-3 3V6z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
            <div className="profile-pill">
              <span className="profile-pill__avatar">
                {avatarUrl ? <img src={avatarUrl} alt="Avatar" /> : "PP"}
              </span>
              <span>Hello, {user?.email?.split("@")[0] ?? "User"}</span>
            </div>
            <button className="app__ghost" onClick={signOut}>
              Sign out
            </button>
          </div>
        </header>
        <main className="shell__main">
          <Outlet />
        </main>
      </div>

      <nav className="mobile-nav">
        {mobileNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? "mobile-nav__link active" : "mobile-nav__link"
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
