import { useMemo, useState } from "react";
import { useApp } from "../lib/appContext";
import { formatZmw } from "../lib/currency";
import { manualSale } from "../lib/posApi";
import { generateReceiptPdf, type ReceiptData } from "../lib/receiptPdf";
import type { Product } from "../lib/types";

type SaleEntry = {
  quantity: string;
  price: string;
};

export default function Sell() {
  const {
    products,
    loadingProducts,
    reloadProducts,
    selectedBranchId,
    profileFullName,
    user,
  } =
    useApp();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [entries, setEntries] = useState<Record<string, SaleEntry>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptNo, setReceiptNo] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

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

  const productMap = useMemo(() => {
    return new Map(products.map((product) => [product.id, product]));
  }, [products]);

  const updateEntry = (product: Product, next: Partial<SaleEntry>) => {
    setEntries((prev) => {
      const current = prev[product.id] ?? { quantity: "", price: "" };
      const merged = { ...current, ...next };
      if (!merged.price.trim() && merged.quantity.trim()) {
        merged.price = product.price.toFixed(2);
      }
      return { ...prev, [product.id]: merged };
    });
  };

  const total = useMemo(() => {
    return Object.entries(entries).reduce((sum, [productId, entry]) => {
      const product = productMap.get(productId);
      if (!product) return sum;
      const qty = Number(entry.quantity);
      if (!qty || Number.isNaN(qty)) return sum;
      const price = entry.price.trim()
        ? Number(entry.price)
        : product.price;
      if (!price || Number.isNaN(price)) return sum;
      return sum + qty * price;
    }, 0);
  }, [entries, productMap]);

  const handleSubmit = async () => {
    setError(null);
    setReceiptNo(null);

    const items = Object.entries(entries)
      .map(([productId, entry]) => {
        const product = productMap.get(productId);
        if (!product) return null;
        const qty = Number(entry.quantity);
        if (!qty || Number.isNaN(qty)) return null;
        const price = entry.price.trim()
          ? Number(entry.price)
          : product.price;
        return {
          product,
          product_id: productId,
          quantity: qty,
          price,
        };
      })
      .filter(Boolean) as {
      product: Product;
      product_id: string;
      quantity: number;
      price: number;
    }[];

    if (!items.length) {
      setError("Enter at least one sold quantity.");
      return;
    }

    for (const item of items) {
      if (item.quantity < 0) {
        setError("Quantities must be 0 or more.");
        return;
      }
      if (item.quantity > item.product.stock_on_hand) {
        setError(`Not enough stock for ${item.product.name}.`);
        return;
      }
      if (!item.price || Number.isNaN(item.price) || item.price <= 0) {
        setError(`Enter a valid price for ${item.product.name}.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const result = await manualSale({
        items: items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
        })),
        branch_id: selectedBranchId ?? undefined,
      });
      setReceiptNo(result.sale.receipt_no);
      setReceipt({
        receipt_no: result.sale.receipt_no,
        payment_method: "cash",
        total,
        created_at: new Date().toISOString(),
        cashier: profileFullName ?? user?.email ?? "User",
        items: items.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.price,
        })),
      });
      setEntries({});
      void reloadProducts();
    } catch (checkoutError) {
      if (checkoutError instanceof Error) {
        setError(checkoutError.message);
      } else {
        setError("Sales entry failed.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <section className="card">
        <div className="card__header">
          <div>
            <h2>Daily Sales Entry</h2>
            <p className="muted">
              Enter quantities sold and unit prices to deduct stock.
            </p>
          </div>
          <button
            className="app__ghost"
            onClick={() => setEntries({})}
            disabled={submitting}
          >
            Clear
          </button>
        </div>
        <div className="toolbar">
          <input
            type="search"
            placeholder="Search products..."
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
        </div>

        {loadingProducts ? (
          <p className="muted">Loading products...</p>
        ) : filteredProducts.length ? (
          <div className="list">
            {filteredProducts.map((product) => {
              const entry = entries[product.id] ?? { quantity: "", price: "" };
              const qty = Number(entry.quantity);
              const price = entry.price.trim()
                ? Number(entry.price)
                : product.price;
              const lineTotal =
                qty && price && !Number.isNaN(qty) && !Number.isNaN(price)
                  ? qty * price
                  : 0;
              return (
                <div className="list__item sales-entry__row" key={product.id}>
                  <div className="sales-entry__meta">
                    <p className="list__title">{product.name}</p>
                    <p className="muted">
                      Stock {product.stock_on_hand} · Price{" "}
                      {formatZmw(product.price)}
                    </p>
                  </div>
                  <div className="sales-entry__inputs">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Qty sold"
                      value={entry.quantity}
                      onChange={(event) =>
                        updateEntry(product, {
                          quantity: event.target.value,
                        })
                      }
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Unit price"
                      value={entry.price}
                      onChange={(event) =>
                        updateEntry(product, {
                          price: event.target.value,
                        })
                      }
                    />
                    <div className="sales-entry__total">
                      {formatZmw(lineTotal)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted">No products found.</p>
        )}

        {error ? <p className="error">{error}</p> : null}
        {receiptNo ? (
          <p className="success">Sales posted: {receiptNo}</p>
        ) : null}
        <div className="cart__total sales-entry__summary">
          <span>Total</span>
          <strong>{formatZmw(total)}</strong>
        </div>
        <button
          className="app__primary"
          onClick={handleSubmit}
          disabled={submitting || loadingProducts}
        >
          {submitting ? "Posting..." : "Post sales"}
        </button>
      </section>

      {receipt ? (
        <div className="modal">
          <div className="modal__card">
            <div className="modal__header">
              <h3>Daily sales receipt</h3>
              <button className="icon-button" onClick={() => setReceipt(null)}>
                X
              </button>
            </div>
            <div className="receipt">
              <p className="receipt__title">PoxPOS Receipt</p>
              <p className="muted">Receipt: {receipt.receipt_no}</p>
              <p className="muted">
                Date: {new Date(receipt.created_at).toLocaleString()}
              </p>
              {receipt.cashier ? (
                <p className="muted">Cashier: {receipt.cashier}</p>
              ) : null}
              <div className="list">
                {receipt.items.map((item, index) => (
                  <div className="list__item" key={`${item.name}-${index}`}>
                    <div>
                      <p className="list__title">{item.name}</p>
                      <p className="muted">Qty {item.quantity}</p>
                    </div>
                    <span className="badge badge--ok">
                      {formatZmw(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="cart__total">
                <span>Total</span>
                <strong>{formatZmw(receipt.total)}</strong>
              </div>
            </div>
            <div className="modal__actions">
              <button
                className="app__ghost"
                onClick={() => void generateReceiptPdf(receipt)}
              >
                Download PDF
              </button>
              <button
                className="app__ghost"
                onClick={async () => {
                  const text = `Receipt ${receipt.receipt_no}\nTotal: ${formatZmw(
                    receipt.total
                  )}`;
                  if (navigator.share) {
                    await navigator.share({ text });
                  } else {
                    await navigator.clipboard.writeText(text);
                  }
                }}
              >
                Share receipt
              </button>
              <button className="app__primary" onClick={() => setReceipt(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
