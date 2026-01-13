import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import { useApp } from "../lib/appContext";
import { formatZmw } from "../lib/currency";
import { supabase } from "../lib/supabaseClient";

type SaleItemRow = {
  product_id: string;
  quantity: number;
  price: number;
  cost: number;
  product: { name: string }[] | null;
};

type SaleRow = {
  id: string;
  receipt_no: string;
  total: number;
  created_at: string;
  sale_items: SaleItemRow[];
};

export default function Reports() {
  const { selectedBranchId } = useApp();
  const navigate = useNavigate();
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<"today" | "week" | "month">("today");

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      let salesPromise = supabase
        .from("sales")
        .select(
          "id,receipt_no,total,created_at,sale_items(product_id,quantity,price,cost,product:products(name))"
        )
        .order("created_at", { ascending: false });

      if (selectedBranchId) {
        salesPromise = salesPromise.eq("branch_id", selectedBranchId);
      }

      const salesResult = await salesPromise;
      if (salesResult.error) {
        setError(salesResult.error.message);
        setSales([]);
      } else {
        setSales(salesResult.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
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
        const name = item.product?.[0]?.name ?? "Unknown";
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

  const handleExportPdf = () => {
    const doc = new jsPDF();
    let y = 18;
    const lineHeight = 6;
    const sectionGap = 8;
    const rangeLabel =
      range === "today" ? "Today" : range === "week" ? "This week" : "This month";

    const ensureSpace = (extra: number) => {
      if (y + extra >= 280) {
        doc.addPage();
        y = 18;
      }
    };

    doc.setFontSize(16);
    doc.text("PoxPOS Report", 14, y);
    y += sectionGap;

    doc.setFontSize(10);
    doc.text(`Range: ${rangeLabel}`, 14, y);
    y += lineHeight;
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y);
    y += sectionGap;

    doc.setFontSize(12);
    doc.text(`Total sales: ${formatZmw(totalSales)}`, 14, y);
    y += lineHeight;
    doc.text(`Transactions: ${totalTransactions}`, 14, y);
    y += sectionGap;

    doc.setFontSize(12);
    doc.text("Best sellers", 14, y);
    y += lineHeight;
    doc.setFontSize(10);
    if (bestSellers.length) {
      bestSellers.forEach((item) => {
        ensureSpace(lineHeight);
        doc.text(
          `${item.name} | Qty ${item.qty} | ${formatZmw(item.revenue)}`,
          14,
          y
        );
        y += lineHeight;
      });
    } else {
      doc.text("No best sellers for this range.", 14, y);
      y += lineHeight;
    }

    y += sectionGap;
    ensureSpace(sectionGap);
    doc.setFontSize(12);
    doc.text("Sales history", 14, y);
    y += lineHeight;
    doc.setFontSize(10);
    if (filteredSales.length) {
      filteredSales.forEach((sale) => {
        ensureSpace(lineHeight);
        const itemCount = sale.sale_items?.length ?? 0;
        doc.text(
          `${sale.receipt_no} | ${new Date(sale.created_at).toLocaleString()} | Items ${itemCount} | ${formatZmw(sale.total)}`,
          14,
          y
        );
        y += lineHeight;
      });
    } else {
      doc.text("No sales in this range.", 14, y);
      y += lineHeight;
    }

    doc.save(`report-${range}.pdf`);
  };

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
          <div className="button-row">
            <button className="app__ghost" onClick={() => navigate("/sales")}>
              View all
            </button>
            <button className="app__ghost" onClick={handleExportPdf}>
              Export PDF
            </button>
          </div>
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
