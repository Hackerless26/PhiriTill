import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../lib/appContext";
import { formatZmw } from "../lib/currency";
import { stockAdjust } from "../lib/posApi";

type AdjustEntry = {
  quantity: string;
  reason: string;
};

export default function StockAdjust() {
  const { products, loadingProducts, reloadProducts, selectedBranchId } =
    useApp();
  const [search, setSearch] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showScannerTools, setShowScannerTools] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [entries, setEntries] = useState<Record<string, AdjustEntry>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const items = useMemo(() => {
    return products
      .filter((product) => product.is_active)
      .map((product) => {
        const entry = entries[product.id];
        const qty = entry ? Number(entry.quantity) : 0;
        if (!qty || Number.isNaN(qty)) return null;
        return {
          product_id: product.id,
          quantity: qty,
          reason: entry?.reason?.trim() || undefined,
        };
      })
      .filter(Boolean);
  }, [entries, products]);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    if (!items.length) {
      setError("Add at least one adjustment.");
      return;
    }
    setSaving(true);
    try {
      await stockAdjust({
        items: items as { product_id: string; quantity: number; reason?: string }[],
        branch_id: selectedBranchId ?? undefined,
      });
      setEntries({});
      setSuccess("Stock adjusted successfully.");
      await reloadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Adjust failed.");
    } finally {
      setSaving(false);
    }
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
          setSearch(barcodes[0].rawValue);
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

  return (
    <div className="page">
      <section className="card">
        <h2>Adjust stock</h2>
        <p className="muted">
          Use positive numbers to add stock, negative to remove.
        </p>
        <div className="barcode-row">
          <input
            type="search"
            placeholder="Search name or scan barcode"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {showScannerTools ? (
            <button className="app__ghost" onClick={() => setScannerOpen(true)}>
              Scan
            </button>
          ) : null}
        </div>
        <button
          className="app__ghost"
          type="button"
          onClick={() => setShowScannerTools((prev) => !prev)}
        >
          {showScannerTools ? "Hide barcode scanner" : "Show barcode scanner"}
        </button>
        <button
          className="app__ghost"
          type="button"
          onClick={() => setShowAdvanced((prev) => !prev)}
        >
          {showAdvanced ? "Hide advanced fields" : "Show advanced fields"}
        </button>
        {loadingProducts ? (
          <p className="muted">Loading products...</p>
        ) : products.length ? (
          <div className="list">
            {products
              .filter((product) => product.is_active)
              .filter((product) => {
                const term = search.trim().toLowerCase();
                if (!term) return true;
                return (
                  product.name.toLowerCase().includes(term) ||
                  (product.barcode ?? "").toLowerCase().includes(term) ||
                  (product.sku ?? "").toLowerCase().includes(term)
                );
              })
              .map((product) => (
              <div className="list__item list__item--stack" key={product.id}>
                <div>
                  <p className="list__title">{product.name}</p>
                  <p className="muted">
                    Stock {product.stock_on_hand} - {formatZmw(product.price)}
                  </p>
                </div>
                <div className="inline-inputs">
                  <input
                    type="number"
                    placeholder="Qty (+/-)"
                    value={entries[product.id]?.quantity ?? ""}
                    onChange={(event) =>
                      setEntries((prev) => ({
                        ...prev,
                        [product.id]: {
                          quantity: event.target.value,
                          reason: prev[product.id]?.reason ?? "",
                        },
                      }))
                    }
                  />
                  {showAdvanced ? (
                    <input
                      type="text"
                      placeholder="Reason (optional)"
                      value={entries[product.id]?.reason ?? ""}
                      onChange={(event) =>
                        setEntries((prev) => ({
                          ...prev,
                          [product.id]: {
                            quantity: prev[product.id]?.quantity ?? "",
                            reason: event.target.value,
                          },
                        }))
                      }
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No products available.</p>
        )}
        {error ? <p className="error">{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}
        <button
          className="app__primary"
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? "Saving..." : "Apply adjustment"}
        </button>
      </section>

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
    </div>
  );
}
