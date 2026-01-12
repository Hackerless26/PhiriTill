import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../lib/appContext";
import { formatZmw } from "../lib/currency";
import { productUpsert } from "../lib/posApi";
import type { Product } from "../lib/types";

export default function Products() {
  const {
    products,
    loadingProducts,
    reloadProducts,
    selectedBranchId,
    profileRole,
  } = useApp();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [form, setForm] = useState({
    id: "",
    name: "",
    sku: "",
    barcode: "",
    category: "",
    price: "",
    cost: "",
    stock_on_hand: "",
    low_stock_threshold: "",
    is_active: true,
  });

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      if (!product.is_active) return false;
      const matchesTerm = term
        ? product.name.toLowerCase().includes(term)
        : true;
      const matchesCategory =
        categoryFilter === "all"
          ? true
          : (product.category ?? "General") === categoryFilter;
      return matchesTerm && matchesCategory;
    });
  }, [products, search, categoryFilter]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((product) => {
      if (!product.is_active) return;
      set.add(product.category ?? "General");
    });
    return Array.from(set).sort();
  }, [products]);

  const openModal = (product?: Product) => {
    setShowAdvanced(false);
    if (product) {
      setForm({
        id: product.id,
        name: product.name,
        sku: product.sku ?? "",
        barcode: product.barcode ?? "",
        category: product.category ?? "",
        price: String(product.price),
        cost: "",
        stock_on_hand: String(product.stock_on_hand),
        low_stock_threshold: String(product.low_stock_threshold),
        is_active: product.is_active,
      });
    } else {
      setForm({
        id: "",
        name: "",
        sku: "",
        barcode: "",
        category: "",
        price: "",
        cost: "",
        stock_on_hand: "",
        low_stock_threshold: "",
        is_active: true,
      });
    }
    setError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setShowAdvanced(false);
  };

  useEffect(() => {
    if (!scannerOpen) return;
    if (!videoRef.current) return;

    let active = true;
    let stream: MediaStream | null = null;

    const startScan = async () => {
      setScanError(null);
      if (!("BarcodeDetector" in window)) {
        setScanError("Barcode scanning is not supported on this device.");
        return;
      }
      const detector = new (window as any).BarcodeDetector({
        formats: ["ean_13", "ean_8", "code_128", "upc_a", "upc_e", "qr_code"],
      });
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const scanLoop = async () => {
        if (!active || !videoRef.current) return;
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes.length) {
          setForm((prev) => ({ ...prev, barcode: barcodes[0].rawValue }));
          setScannerOpen(false);
          return;
        }
        requestAnimationFrame(scanLoop);
      };

      scanLoop();
    };

    startScan().catch(() => {
      setScanError("Camera access failed.");
    });

    return () => {
      active = false;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [scannerOpen]);

  const handleSave = async () => {
    setError(null);
    if (!form.name.trim() || !form.price.trim()) {
      setError("Name and price are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        id: form.id || undefined,
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        barcode: form.barcode.trim() || null,
        category: form.category.trim() || null,
        price: Number(form.price),
        cost: form.cost.trim() ? Number(form.cost) : undefined,
        stock_on_hand: Number(form.stock_on_hand || "0"),
        low_stock_threshold: Number(form.low_stock_threshold || "0"),
        is_active: form.is_active,
        branch_id: selectedBranchId ?? undefined,
      };
      await productUpsert(payload);
      setToast(form.id ? "Product updated." : "Product created.");
      setShowModal(false);
      setTimeout(() => setToast(null), 2400);
      void reloadProducts();
      setForm({
        id: "",
        name: "",
        sku: "",
        barcode: "",
        category: "",
        price: "",
        cost: "",
        stock_on_hand: "",
        low_stock_threshold: "",
        is_active: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!form.id) return;
    const confirmed = window.confirm(
      "Delete this product? It will be marked inactive."
    );
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    try {
      await productUpsert({
        id: form.id,
        name: form.name.trim() || "Deleted product",
        price: Number(form.price || "0"),
        stock_on_hand: Number(form.stock_on_hand || "0"),
        low_stock_threshold: Number(form.low_stock_threshold || "0"),
        is_active: false,
        sku: form.sku.trim() || null,
        barcode: form.barcode.trim() || null,
        category: form.category.trim() || null,
        cost: form.cost.trim() ? Number(form.cost) : undefined,
        branch_id: selectedBranchId ?? undefined,
      });
      setToast("Product deleted.");
      setShowModal(false);
      setShowAdvanced(false);
      setTimeout(() => setToast(null), 2400);
      void reloadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page">
      <section className="card">
        <div className="card__header">
          <div>
            <h2>Products</h2>
            <p className="muted">Manage pricing, stock, and categories.</p>
          </div>
          <button className="app__primary" onClick={() => openModal()}>
            Add product
          </button>
        </div>
        <div className="toolbar">
          <input
            type="search"
            placeholder="Search product..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <button className="app__ghost">Export</button>
        </div>

        {loadingProducts ? <p className="muted">Loading products...</p> : null}
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length ? (
                filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td>{product.sku ?? "-"}</td>
                    <td>{product.category ?? "General"}</td>
                    <td>{formatZmw(product.price)}</td>
                    <td>{product.stock_on_hand}</td>
                    <td>
                      <span
                        className={
                          !product.is_active
                            ? "badge badge--danger"
                            : product.stock_on_hand <= product.low_stock_threshold
                              ? "badge"
                              : "badge badge--ok"
                        }
                      >
                        {!product.is_active
                          ? "Inactive"
                          : product.stock_on_hand <= product.low_stock_threshold
                            ? "Low"
                            : "In stock"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="link-button app__ghost"
                        onClick={() => openModal(product)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="empty-row">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h3>Stock alerts</h3>
        <p className="muted">Items below minimum threshold.</p>
        <div className="list">
          {products
            .filter(
              (product) =>
                product.is_active &&
                product.stock_on_hand <= product.low_stock_threshold
            )
            .slice(0, 5)
            .map((product) => (
              <div className="list__item" key={product.id}>
                <div>
                  <p className="list__title">{product.name}</p>
                  <p className="muted">Stock {product.stock_on_hand}</p>
                </div>
                <span className="badge">Low</span>
              </div>
            ))}
          {!products.some(
            (product) =>
              product.is_active &&
              product.stock_on_hand <= product.low_stock_threshold
          ) ? (
            <p className="muted">No low stock alerts.</p>
          ) : null}
        </div>
      </section>

      {showModal ? (
        <div className="modal">
          <div className="modal__card">
            <div className="modal__header">
              <h3>{form.id ? "Edit product" : "Add product"}</h3>
              <button className="icon-button" onClick={closeModal}>
                X
              </button>
            </div>
            <div className="form-grid form-grid--compact">
              <input
                type="text"
                placeholder="Product name"
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
              <input
                type="text"
                placeholder="Category"
                value={form.category}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, category: event.target.value }))
                }
              />
              <input
                type="number"
                placeholder="Price"
                value={form.price}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, price: event.target.value }))
                }
              />
              <input
                type="number"
                placeholder="Quantity on hand"
                value={form.stock_on_hand}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    stock_on_hand: event.target.value,
                  }))
                }
              />
              <label className="field">
                <span>Status</span>
                <select
                  value={form.is_active ? "active" : "inactive"}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      is_active: event.target.value === "active",
                    }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
            <button
              className="app__ghost"
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
            >
              {showAdvanced ? "Hide advanced fields" : "Show advanced fields"}
            </button>
            {showAdvanced ? (
              <div className="form-grid form-grid--compact">
                <input
                  type="text"
                  placeholder="SKU (optional)"
                  value={form.sku}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, sku: event.target.value }))
                  }
                />
                <input
                  type="text"
                  placeholder="Barcode (optional)"
                  value={form.barcode}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, barcode: event.target.value }))
                  }
                />
                <button
                  className="app__ghost"
                  type="button"
                  onClick={() => setScannerOpen(true)}
                >
                  Scan barcode
                </button>
                {profileRole !== "cashier" ? (
                  <input
                    type="number"
                    placeholder="Cost (optional)"
                    value={form.cost}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        cost: event.target.value,
                      }))
                    }
                  />
                ) : null}
                <input
                  type="number"
                  placeholder="Low stock threshold"
                  value={form.low_stock_threshold}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      low_stock_threshold: event.target.value,
                    }))
                  }
                />
              </div>
            ) : null}
            {error ? <p className="error">{error}</p> : null}
            <div className="modal__actions">
              {form.id ? (
                <button
                  className="app__ghost"
                  onClick={handleDelete}
                  disabled={deleting || saving}
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              ) : null}
              <button className="app__ghost" onClick={closeModal}>
                Cancel
              </button>
              <button
                className="app__primary"
                onClick={handleSave}
                disabled={saving || deleting}
              >
                {saving ? "Saving..." : "Save product"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {scannerOpen ? (
        <div className="modal">
          <div className="modal__card">
            <div className="modal__header">
              <h3>Scan barcode</h3>
              <button className="icon-button" onClick={() => setScannerOpen(false)}>
                X
              </button>
            </div>
            {scanError ? <p className="error">{scanError}</p> : null}
            <div className="scanner">
              <video ref={videoRef} />
            </div>
            <p className="muted">Point the camera at the barcode.</p>
          </div>
        </div>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
