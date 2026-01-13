import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { purchaseOrderCreate, purchaseOrderReceive } from "../lib/posApi";
import { useApp } from "../lib/appContext";

type SupplierRow = {
  id: string;
  name: string;
};

type PurchaseOrderRow = {
  id: string;
  status: string;
  reference: string | null;
  created_at: string;
  suppliers: { name: string }[] | null;
};

type PoItemInput = {
  product_id: string;
  quantity: string;
  cost: string;
};

export default function PurchaseOrders() {
  const { products, selectedBranchId, reloadProducts } = useApp();
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<PoItemInput[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [suppliersResult, ordersResult] = await Promise.all([
        supabase.from("suppliers").select("id,name").order("name"),
        supabase
          .from("purchase_orders")
          .select("id,status,reference,created_at,suppliers(name)")
          .order("created_at", { ascending: false }),
      ]);
      setSuppliers(suppliersResult.data ?? []);
      setPurchaseOrders(ordersResult.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      { product_id: "", quantity: "", cost: "" },
    ]);
  };

  const handleSave = async () => {
    setError(null);
    if (!supplierId) {
      setError("Supplier is required.");
      return;
    }
    const payloadItems = items
      .map((item) => ({
        product_id: item.product_id,
        quantity: Number(item.quantity),
        cost: item.cost ? Number(item.cost) : undefined,
      }))
      .filter((item) => item.product_id && item.quantity > 0);

    if (!payloadItems.length) {
      setError("Add at least one item.");
      return;
    }

    setSaving(true);
    try {
      await purchaseOrderCreate({
        supplier_id: supplierId,
        reference: showAdvanced ? reference.trim() || null : null,
        items: payloadItems,
        branch_id: selectedBranchId ?? undefined,
      });
      setShowModal(false);
      setItems([]);
      setReference("");
      setSupplierId("");
      setShowAdvanced(false);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleReceive = async (purchaseOrderId: string) => {
    await purchaseOrderReceive(purchaseOrderId);
    loadData();
    await reloadProducts();
  };

  const hasProducts = products.length > 0;

  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        id: product.id,
        name: product.name,
      })),
    [products]
  );

  return (
    <div className="page">
      <section className="card">
        <div className="card__header">
          <div>
            <h2>Purchase Orders</h2>
            <p className="muted">Create and receive supplier deliveries.</p>
          </div>
          <button className="app__primary" onClick={() => setShowModal(true)}>
            New PO
          </button>
        </div>
        {loading ? <p className="muted">Loading purchase orders...</p> : null}
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.length ? (
                purchaseOrders.map((po) => (
                  <tr key={po.id}>
                    <td>{po.suppliers?.[0]?.name ?? "-"}</td>
                    <td>{po.status}</td>
                    <td>{new Date(po.created_at).toLocaleString()}</td>
                    <td>
                      <button
                        className="link-button app__ghost"
                        onClick={() => handleReceive(po.id)}
                        disabled={po.status === "received"}
                      >
                        {po.status === "received" ? "Received" : "Receive"}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="empty-row">
                    No purchase orders found.
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
              <h3>Create purchase order</h3>
              <button className="icon-button" onClick={() => setShowModal(false)}>
                X
              </button>
            </div>
            <div className="form-grid">
              <select
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
              >
                <option value="">Select supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
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
                    {showAdvanced ? (
                      <input
                        type="number"
                        placeholder="Cost (optional)"
                        value={item.cost}
                        onChange={(event) => {
                          const value = event.target.value;
                          setItems((prev) =>
                            prev.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, cost: value } : row
                            )
                          );
                        }}
                      />
                    ) : null}
                  </div>
                </div>
              ))}
              {!items.length ? (
                <p className="muted">No items added yet.</p>
              ) : null}
            </div>
            <button
              className="app__ghost"
              onClick={addItemRow}
              disabled={!hasProducts}
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
                  placeholder="Reference (optional)"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
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
                {saving ? "Saving..." : "Create PO"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
