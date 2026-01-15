import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../lib/appContext";

type StockMovementRow = {
  id: string;
  product_id: string;
  qty_change: number;
  movement_type: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
  product_name?: string | null;
};

export default function StockMovements() {
  const { selectedBranchId } = useApp();
  const [movements, setMovements] = useState<StockMovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});

  const loadMovements = async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("stock_movements")
        .select(
          "id,product_id,qty_change,movement_type,reason,created_by,created_at"
        )
        .order("created_at", { ascending: false });
      if (selectedBranchId) {
        query = query.eq("branch_id", selectedBranchId);
      }
      const res = await query;
      if (res.error) {
        setError(res.error.message);
        setMovements([]);
      } else {
        const rows = res.data ?? [];
        const productIds = Array.from(
          new Set(rows.map((row) => row.product_id).filter(Boolean))
        );
        if (!productIds.length) {
          setMovements(rows);
          return;
        }
        const { data: productRows, error: productError } = await supabase
          .from("products")
          .select("id,name")
          .in("id", productIds);
        if (productError || !productRows) {
          setMovements(rows);
          return;
        }
        const nameMap = new Map(
          productRows.map((product) => [product.id, product.name])
        );
        setMovements(
          rows.map((row) => ({
            ...row,
            product_name: nameMap.get(row.product_id) ?? null,
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMovements();
  }, [selectedBranchId]);

  useEffect(() => {
    const ids = movements
      .map((move) => move.created_by)
      .filter((id): id is string => Boolean(id));
    if (!ids.length) return;

    supabase
      .from("profiles")
      .select("user_id,full_name")
      .in("user_id", ids)
      .then(({ data, error: fetchError }) => {
        if (fetchError || !data) return;
        const map: Record<string, string> = {};
        data.forEach((profile) => {
          if (profile.user_id) {
            map[profile.user_id] = profile.full_name ?? profile.user_id;
          }
        });
        setProfileNames(map);
      });
  }, [movements]);

  useEffect(() => {
    const channel = supabase
      .channel("movements-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stock_movements" },
        () => {
          loadMovements();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredMovements = useMemo(() => {
    const term = search.trim().toLowerCase();
    return movements.filter((move) => {
      const name = move.product_name ?? "";
      const matchesName = term ? name.toLowerCase().includes(term) : true;
      const matchesType =
        typeFilter === "all" ? true : move.movement_type === typeFilter;
      return matchesName && matchesType;
    });
  }, [movements, search, typeFilter]);

  return (
    <div className="page">
      <section className="card">
        <div className="card__header">
          <div>
            <h2>Stock movements</h2>
            <p className="muted">Track stock in, out, and adjustments.</p>
          </div>
          <button className="app__ghost">Export</button>
        </div>
        <div className="toolbar">
          <input
            type="search"
            placeholder="Search product..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="all">All types</option>
            <option value="sale">Sale</option>
            <option value="receive">Receive</option>
            <option value="adjustment">Adjustment</option>
          </select>
          <input type="date" />
        </div>
        {loading ? <p className="muted">Loading movements...</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Reason</th>
                <th>User</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.length ? (
                filteredMovements.map((move) => (
                  <tr key={move.id}>
                    <td>{new Date(move.created_at).toLocaleString()}</td>
                    <td>{move.product_name ?? "Unknown"}</td>
                    <td>{move.movement_type}</td>
                    <td>{move.qty_change}</td>
                    <td>{move.reason ?? "-"}</td>
                    <td>
                      {move.created_by
                        ? profileNames[move.created_by] ?? move.created_by
                        : "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="empty-row">
                    No stock movements found.
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
