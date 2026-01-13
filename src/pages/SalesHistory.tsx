import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { useApp } from "../lib/appContext";
import { formatZmw } from "../lib/currency";
import { supabase } from "../lib/supabaseClient";

type SaleRow = {
  id: string;
  receipt_no: string;
  total: number;
  created_at: string;
  sale_items: { id: string }[];
};

export default function SalesHistory() {
  const { selectedBranchId } = useApp();
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadSales = () => {
    setLoading(true);
    setError(null);
    (async () => {
      try {
        let query = supabase
          .from("sales")
          .select("id,receipt_no,total,created_at,sale_items(id)")
          .order("created_at", { ascending: false });
        if (selectedBranchId) {
          query = query.eq("branch_id", selectedBranchId);
        }
        const res = await query;
        if (res.error) {
          setError(res.error.message);
          setSales([]);
        } else {
          setSales(res.data ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  };

  useEffect(() => {
    loadSales();
  }, [selectedBranchId]);

  useEffect(() => {
    const channel = supabase
      .channel("sales-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales" },
        () => {
          loadSales();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredSales = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sales.filter((sale) =>
      term ? sale.receipt_no.toLowerCase().includes(term) : true
    );
  }, [sales, search]);

  const handleExportPdf = () => {
    const doc = new jsPDF();
    let y = 18;
    const lineHeight = 6;
    const sectionGap = 8;

    const ensureSpace = (extra: number) => {
      if (y + extra >= 280) {
        doc.addPage();
        y = 18;
      }
    };

    doc.setFontSize(16);
    doc.text("Sales history report", 14, y);
    y += sectionGap;

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y);
    y += sectionGap;

    doc.setFontSize(12);
    doc.text(`Total transactions: ${filteredSales.length}`, 14, y);
    y += sectionGap;

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
      doc.text("No sales found.", 14, y);
      y += lineHeight;
    }

    doc.save("sales-history.pdf");
  };

  return (
    <div className="page">
      <section className="card">
        <div className="card__header">
          <div>
            <h2>Sales history</h2>
            <p className="muted">Receipts and transaction totals.</p>
          </div>
          <button className="app__ghost" onClick={handleExportPdf}>
            Export PDF
          </button>
        </div>
        <div className="toolbar">
          <input
            type="search"
            placeholder="Search receipt..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <input type="date" />
        </div>
        {loading ? <p className="muted">Loading sales...</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Date</th>
                <th>Items</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length ? (
                filteredSales.map((sale) => (
                  <tr key={sale.id}>
                    <td>{sale.receipt_no}</td>
                    <td>{new Date(sale.created_at).toLocaleString()}</td>
                    <td>{sale.sale_items?.length ?? 0}</td>
                    <td>{formatZmw(sale.total)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="empty-row">
                    No sales found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
