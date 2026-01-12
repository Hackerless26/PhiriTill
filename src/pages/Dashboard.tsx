import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../lib/appContext";
import { formatZmw } from "../lib/currency";
import { supabase } from "../lib/supabaseClient";

export default function Dashboard() {
  const { products, loadingProducts, selectedBranchId, user } = useApp();
  const [usdToZmwRate, setUsdToZmwRate] = useState<number | null>(null);
  const [rateUpdatedAt, setRateUpdatedAt] = useState<string | null>(null);
  const [rateSource, setRateSource] = useState<string | null>(null);
  const [rateTrend, setRateTrend] = useState<"up" | "down" | "flat" | null>(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [todaySales, setTodaySales] = useState(0);
  const [todayTransactions, setTodayTransactions] = useState(0);
  const [todayProfit, setTodayProfit] = useState(0);
  const [statsLoading, setStatsLoading] = useState(false);

  const lowStockCount = useMemo(
    () =>
      products.filter(
        (product) => product.stock_on_hand <= product.low_stock_threshold
      ).length,
    [products]
  );

  const totalStock = useMemo(
    () => products.reduce((sum, product) => sum + product.stock_on_hand, 0),
    [products]
  );

  const fetchWithTimeout = async (url: string, timeoutMs: number) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      return response;
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const loadUsdToZmwRate = async () => {
    setRateLoading(true);
    setRateError(null);
    try {
      const providers = [
        {
          name: "exchangerate.host",
          url: "https://api.exchangerate.host/latest?base=USD&symbols=ZMW",
          parse: (data: any) => ({
            rate: data?.rates?.ZMW as number | undefined,
            updatedAt: data?.date ? `${data.date} UTC` : null,
          }),
        },
        {
          name: "open.er-api.com",
          url: "https://open.er-api.com/v6/latest/USD",
          parse: (data: any) => ({
            rate: data?.rates?.ZMW as number | undefined,
            updatedAt: data?.time_last_update_utc ?? null,
          }),
        },
      ];

      let foundRate: number | null = null;
      let foundUpdatedAt: string | null = null;
      let foundSource: string | null = null;

      for (const provider of providers) {
        const response = await fetchWithTimeout(provider.url, 8000);
        if (!response.ok) continue;
        const data = await response.json();
        const parsed = provider.parse(data);
        if (parsed.rate) {
          foundRate = parsed.rate;
          foundUpdatedAt = parsed.updatedAt ?? null;
          foundSource = provider.name;
          break;
        }
      }

      if (foundRate == null) {
        throw new Error("USD/ZMW rate unavailable.");
      }

      setUsdToZmwRate((prev) => {
        if (prev != null) {
          if (foundRate > prev) setRateTrend("up");
          else if (foundRate < prev) setRateTrend("down");
          else setRateTrend("flat");
        }
        return foundRate;
      });
      setRateUpdatedAt(foundUpdatedAt);
      setRateSource(foundSource);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load exchange rate.";
      setRateError(message);
    } finally {
      setRateLoading(false);
    }
  };

  const formatUpdatedAt = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return parsed.toLocaleString();
  };

  useEffect(() => {
    void loadUsdToZmwRate();
    const intervalId = window.setInterval(() => {
      void loadUsdToZmwRate();
    }, 15 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const loadTodayStats = async () => {
    if (!user) {
      setTodaySales(0);
      setTodayTransactions(0);
      setTodayProfit(0);
      return;
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startIso = start.toISOString();

    setStatsLoading(true);
    try {
      let salesQuery = supabase
        .from("sales")
        .select("id,total,created_at,branch_id")
        .gte("created_at", startIso);
      if (selectedBranchId) {
        salesQuery = salesQuery.eq("branch_id", selectedBranchId);
      }
      const { data: salesData, error: salesError } = await salesQuery;
      if (salesError) throw salesError;

      const salesRows = salesData ?? [];
      setTodaySales(
        salesRows.reduce((sum, sale) => sum + Number(sale.total ?? 0), 0)
      );
      setTodayTransactions(salesRows.length);

      let itemsQuery = supabase
        .from("sale_items")
        .select("quantity,price,cost,sales!inner(created_at,branch_id)")
        .gte("sales.created_at", startIso);
      if (selectedBranchId) {
        itemsQuery = itemsQuery.eq("sales.branch_id", selectedBranchId);
      }
      const { data: itemRows, error: itemsError } = await itemsQuery;
      if (itemsError) throw itemsError;

      const profitTotal = (itemRows ?? []).reduce((sum, item) => {
        const price = Number(item.price ?? 0);
        const cost = Number(item.cost ?? 0);
        const qty = Number(item.quantity ?? 0);
        return sum + (price - cost) * qty;
      }, 0);
      setTodayProfit(profitTotal);
    } catch {
      setTodaySales(0);
      setTodayTransactions(0);
      setTodayProfit(0);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    void loadTodayStats();
  }, [user, selectedBranchId]);

  useEffect(() => {
    if (!user) return;

    const salesChannel = supabase
      .channel("dashboard-sales")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales" },
        () => {
          void loadTodayStats();
        }
      )
      .subscribe();

    const itemsChannel = supabase
      .channel("dashboard-sale-items")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sale_items" },
        () => {
          void loadTodayStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(salesChannel);
      supabase.removeChannel(itemsChannel);
    };
  }, [user, selectedBranchId]);

  return (
    <div className="page">
      <section className="kpi-grid">
        <div className="kpi-card">
          <div>
            <p className="stat__label">Today sales</p>
            <p className="stat__value">
              {statsLoading ? "Loading..." : formatZmw(todaySales)}
            </p>
          </div>
          <span className="kpi-card__icon">K</span>
        </div>
        <div className="kpi-card">
          <div>
            <p className="stat__label">Transactions</p>
            <p className="stat__value">
              {statsLoading ? "..." : todayTransactions}
            </p>
          </div>
          <span className="kpi-card__icon">#</span>
        </div>
        <div className="kpi-card">
          <div>
            <p className="stat__label">Low stock</p>
            <p className="stat__value">{lowStockCount}</p>
          </div>
          <span className="kpi-card__icon">!</span>
        </div>
        <div className="kpi-card">
          <div>
            <p className="stat__label">Profit</p>
            <p className="stat__value">
              {statsLoading ? "Loading..." : formatZmw(todayProfit)}
            </p>
          </div>
          <span className="kpi-card__icon">%</span>
        </div>
      </section>

      <section className="card">
        <div className="card__header">
          <div>
            <h2>Today</h2>
            <p className="muted">Quick snapshot (live)</p>
          </div>
          <Link className="app__ghost" to="/reports">
            View details
          </Link>
        </div>
        <div className="stats">
          <div>
            <p className="stat__label">Sales</p>
            <p className="stat__value">
              {statsLoading ? "Loading..." : formatZmw(todaySales)}
            </p>
          </div>
          <div>
            <p className="stat__label">Transactions</p>
            <p className="stat__value">
              {statsLoading ? "..." : todayTransactions}
            </p>
          </div>
          <div>
            <p className="stat__label">Low stock</p>
            <p className="stat__value">{lowStockCount}</p>
          </div>
          <div>
            <p className="stat__label">Units in stock</p>
            <p className="stat__value">{totalStock}</p>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card__header">
          <div>
            <h2>Exchange rate</h2>
            <p className="muted">Live USD to ZMW reference rate.</p>
          </div>
          <button
            className="app__ghost"
            onClick={() => void loadUsdToZmwRate()}
            disabled={rateLoading}
          >
            {rateLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <div className="stats">
          <div>
            <p className="stat__label">USD to ZMW</p>
            <p className="stat__value">
              {rateLoading
                ? "Loading..."
                : usdToZmwRate
                  ? `1 USD = ${formatZmw(usdToZmwRate)}`
                  : "Unavailable"}
            </p>
            {rateTrend ? (
              <p className="muted">
                {rateTrend === "up"
                  ? "Rate increased since last update."
                  : rateTrend === "down"
                    ? "Rate decreased since last update."
                    : "Rate unchanged since last update."}
              </p>
            ) : null}
            {rateUpdatedAt ? (
              <p className="muted">Updated {formatUpdatedAt(rateUpdatedAt)}</p>
            ) : null}
            <p className="muted">Source: {rateSource ?? "public API"}</p>
            {rateError ? <p className="error">{rateError}</p> : null}
          </div>
        </div>
      </section>

      <section className="card card--grid">
        <div>
          <h3>Sell</h3>
          <p className="muted">Fast checkout and live receipts.</p>
        </div>
        <div>
          <h3>Stock</h3>
          <p className="muted">Receive goods and adjust counts.</p>
        </div>
        <div>
          <h3>Reports</h3>
          <p className="muted">Daily, weekly, monthly snapshots.</p>
        </div>
        <div>
          <h3>Team</h3>
          <p className="muted">Roles, users, and audit trails.</p>
        </div>
      </section>

      <section className="card">
        <div className="card__header">
          <div>
            <h2>Inventory health</h2>
            <p className="muted">Low stock items to review.</p>
          </div>
          <button className="app__ghost">Review</button>
        </div>
        {loadingProducts ? (
          <p className="muted">Loading products...</p>
        ) : products.length ? (
          <div className="list">
            {products.slice(0, 6).map((product) => (
              <div className="list__item" key={product.id}>
                <div>
                  <p className="list__title">{product.name}</p>
                  <p className="muted">
                    Stock {product.stock_on_hand} - {formatZmw(product.price)}
                  </p>
                </div>
                {product.stock_on_hand <= product.low_stock_threshold ? (
                  <span className="badge">Low</span>
                ) : (
                  <span className="badge badge--ok">OK</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Add products to see stock health.</p>
        )}
      </section>

    </div>
  );
}
