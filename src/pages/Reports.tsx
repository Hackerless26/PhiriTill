import { useEffect, useMemo, useState } from "react";
import { useApp } from "../lib/appContext";
import { formatZmw } from "../lib/currency";
import { supabase } from "../lib/supabaseClient";

type SaleItemRow = {
  product_id: string;
  quantity: number;
  price: number;
  cost: number;
  products: { name: string } | null;
};

type SaleRow = {
  id: string;
  total: number;
  created_at: string;
  sale_items: SaleItemRow[];
};

export default function Reports() {
  const { selectedBranchId } = useApp();
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<"today" | "week" | "month">("today");

  const loadReports = () => {
    setLoading(true);
    setError(null);
    let salesPromise = supabase
      .from("sales")
      .select(
        "id,total,created_at,sale_items(product_id,quantity,price,cost,products(name))"
      )
      .order("created_at", { ascending: false });

    if (selectedBranchId) {
      salesPromise = salesPromise.eq("branch_id", selectedBranchId);
    }

    salesPromise
      .then((salesResult) => {
        if (salesResult.error) {
          setError(salesResult.error.message);
          setSales([]);
        } else {
          setSales(salesResult.data ?? []);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    let active = true;
    loadReports();

    return () => {
      active = false;
    };
  }, [selectedBranchId]);

  useEffect(() => {
    const channel = supabase
      .channel("reports-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales" },
        () => {
          loadReports();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const rangeStart = useMemo(() => {
    const now = new Date();
    if (range === "today") {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    if (range === "week") {
      const day = now.getDay();
      const diff = now.getDate() - day;
      return new Date(now.getFullYear(), now.getMonth(), diff);
    }
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, [range]);

  const filteredSales = useMemo(
    () => sales.filter((sale) => new Date(sale.created_at) >= rangeStart),
    [rangeStart, sales]
  );

  const totalSales = useMemo(
    () => filteredSales.reduce((sum, sale) => sum + sale.total, 0),
    [filteredSales]
  );

  const totalTransactions = filteredSales.length;

  const bestSellers = useMemo(() => {
    const productMap = new Map<
      string,
      { name: string; qty: number; revenue: number }
    >();
    filteredSales.forEach((sale) => {
      (sale.sale_items ?? []).forEach((item) => {
        const name = item.products?.name ?? "Unknown";
        const entry = productMap.get(item.product_id) ?? {
          name,
          qty: 0,
          revenue: 0,
        };
        entry.qty += item.quantity;
        entry.revenue += item.price * item.quantity;
        productMap.set(item.product_id, entry);
      });
    });
    return Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredSales]);

  return (
    <div className="page">
      <section className="card">
        <div className="card__header">
          <div>
            <h2>Reports</h2>
            <p className="muted">Sales, profit, and best sellers.</p>
          </div>
          <div className="range-toggle">
            <button
              className={range === "today" ? "app__primary" : "app__ghost"}
              onClick={() => setRange("today")}
            >
              Today
            </button>
            <button
              className={range === "week" ? "app__primary" : "app__ghost"}
              onClick={() => setRange("week")}
            >
              Week
            </button>
            <button
              className={range === "month" ? "app__primary" : "app__ghost"}
              onClick={() => setRange("month")}
            >
              Month
            </button>
          </div>
        </div>
        {loading ? <p className="muted">Loading reports...</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <div className="stats">
          <div>
            <p className="stat__label">Sales</p>
            <p className="stat__value">{formatZmw(totalSales)}</p>
          </div>
          <div>
            <p className="stat__label">Transactions</p>
            <p className="stat__value">{totalTransactions}</p>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card__header">
          <div>
            <h3>Best sellers</h3>
            <p className="muted">Top products by revenue.</p>
          </div>
          <button className="app__ghost">View all</button>
        </div>
        {bestSellers.length ? (
          <div className="list">
            {bestSellers.map((item) => (
              <div className="list__item" key={item.name}>
                <div>
                  <p className="list__title">{item.name}</p>
                  <p className="muted">Qty {item.qty}</p>
                </div>
                <span className="badge badge--ok">{formatZmw(item.revenue)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>Run a few sales to populate reports.</p>
          </div>
        )}
      </section>
    </div>
  );
}
