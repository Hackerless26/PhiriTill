import { useEffect, useMemo, useState } from "react";
import { returnProcess } from "../lib/posApi";
import { useApp } from "../lib/appContext";
import { supabase } from "../lib/supabaseClient";

type ReturnRow = {
  id: string;
  return_type: "customer" | "supplier";
  reason: string | null;
  created_at: string;
};

type ReturnItemInput = {
  product_id: string;
  quantity: string;
  price: string;
};

export default function Returns() {
  const { products, selectedBranchId, reloadProducts } = useApp();
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returnType, setReturnType] = useState<"customer" | "supplier">(
    "customer"
  );
  const [reason, setReason] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [items, setItems] = useState<ReturnItemInput[]>([]);

  const loadReturns = () => {
    setLoading(true);
    supabase
      .from("returns")
      .select("id,return_type,reason,created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setReturns(data ?? []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReturns();
  }, []);

  const productOptions = useMemo(() => {
    return products.map((product) => ({
      id: product.id,
      name: product.name,
    }));
  }, [products]);

  const handleSave = async () => {
    setError(null);
    const payloadItems = items
      .map((item) => ({
        product_id: item.product_id,
        quantity: Number(item.quantity),
        price: item.price ? Number(item.price) : undefined,
      }))
      .filter((item) => item.product_id && item.quantity > 0);

    if (!payloadItems.length) {
      setError("Add at least one item.");
      return;
    }

    setSaving(true);
    try {
      await returnProcess({
        return_type: returnType,
        reason: showAdvanced ? reason.trim() || null : null,
        items: payloadItems,
        branch_id: selectedBranchId ?? undefined,
      });
      setShowModal(false);
      setItems([]);
      setReason("");
      setShowAdvanced(false);
      loadReturns();
      await reloadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <section className="card">
        <div className="card__header">
          <div>
            <h2>Returns</h2>
            <p className="muted">Customer and supplier returns.</p>
          </div>
          <button className="app__primary" onClick={() => setShowModal(true)}>
            New return
          </button>
        </div>
        {loading ? <p className="muted">Loading returns...</p> : null}
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Reason</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {returns.length ? (
                returns.map((ret) => (
                  <tr key={ret.id}>
                    <td>{ret.return_type}</td>
                    <td>{ret.reason ?? "-"}</td>
                    <td>{new Date(ret.created_at).toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="empty-row">
                    No returns found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showModal ? (
        <div className="modal">
          <div className="modal__card">
            <div className="modal__header">
              <h3>Create return</h3>
              <button className="icon-button" onClick={() => setShowModal(false)}>
                X
              </button>
            </div>
            <div className="range-toggle">
              <button
                className={returnType === "customer" ? "app__primary" : "app__ghost"}
                onClick={() => setReturnType("customer")}
              >
                Customer return
              </button>
              <button
                className={returnType === "supplier" ? "app__primary" : "app__ghost"}
                onClick={() => setReturnType("supplier")}
              >
                Supplier return
              </button>
            </div>
            <p className="muted">
              {returnType === "customer"
                ? "Customer returns add stock back."
                : "Supplier returns remove stock."}
            </p>
            <div className="list">
              {items.map((item, index) => (
                <div className="list__item list__item--stack" key={index}>
                  <select
                    value={item.product_id}
                    onChange={(event) => {
                      const value = event.target.value;
                      setItems((prev) =>
                        prev.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, product_id: value }
                            : row
                        )
                      );
                    }}
                  >
                    <option value="">Select product</option>
                    {productOptions.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                  <div className="inline-inputs">
                    <input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(event) => {
                        const value = event.target.value;
                        setItems((prev) =>
                          prev.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, quantity: value } : row
                          )
                        );
                      }}
                    />
                    <input
                      type="number"
                      placeholder="Price"
                      value={item.price}
                      onChange={(event) => {
                        const value = event.target.value;
                        setItems((prev) =>
                          prev.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, price: value } : row
                          )
                        );
                      }}
                    />
                  </div>
                </div>
              ))}
              {!items.length ? (
                <p className="muted">No items added yet.</p>
              ) : null}
            </div>
            <button
              className="app__ghost"
              onClick={() =>
                setItems((prev) => [
                  ...prev,
                  { product_id: "", quantity: "", price: "" },
                ])
              }
            >
              Add item
            </button>
            <button
              className="app__ghost"
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
            >
              {showAdvanced ? "Hide advanced fields" : "Show advanced fields"}
            </button>
            {showAdvanced ? (
              <div className="form-grid">
                <input
                  type="text"
                  placeholder="Reason (optional)"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
            ) : null}
            {error ? <p className="error">{error}</p> : null}
            <div className="modal__actions">
              <button className="app__ghost" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button
                className="app__primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : "Create return"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
