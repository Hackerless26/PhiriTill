import { useEffect, useMemo, useState } from "react";
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

    let query = supabase
      .from("sales")
      .select("id,receipt_no,total,created_at,sale_items(id)")
      .order("created_at", { ascending: false });
    if (selectedBranchId) {
      query = query.eq("branch_id", selectedBranchId);
    }
    query
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError(fetchError.message);
          setSales([]);
        } else {
          setSales(data ?? []);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    let active = true;
    loadSales();

    return () => {
      active = false;
    };
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

  return (
    <div className="page">
      <section className="card">
        <div className="card__header">
          <div>
            <h2>Sales history</h2>
            <p className="muted">Receipts and transaction totals.</p>
          </div>
          <button className="app__ghost">Export</button>
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
