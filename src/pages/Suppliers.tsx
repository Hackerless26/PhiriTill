import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { supplierUpsert } from "../lib/posApi";

type SupplierRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: "",
    name: "",
    phone: "",
    email: "",
  });

  const loadSuppliers = () => {
    setLoading(true);
    supabase
      .from("suppliers")
      .select("id,name,phone,email")
      .order("name", { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setSuppliers([]);
        } else {
          setSuppliers(data ?? []);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const openModal = (supplier?: SupplierRow) => {
    if (supplier) {
      setForm({
        id: supplier.id,
        name: supplier.name,
        phone: supplier.phone ?? "",
        email: supplier.email ?? "",
      });
    } else {
      setForm({ id: "", name: "", phone: "", email: "" });
    }
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await supplierUpsert({
        id: form.id || undefined,
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      });
      setShowModal(false);
      loadSuppliers();
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
            <h2>Suppliers</h2>
            <p className="muted">Manage supplier contacts.</p>
          </div>
          <button className="app__primary" onClick={() => openModal()}>
            Add supplier
          </button>
        </div>
        {loading ? <p className="muted">Loading suppliers...</p> : null}
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length ? (
                suppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>{supplier.name}</td>
                    <td>{supplier.phone ?? "-"}</td>
                    <td>{supplier.email ?? "-"}</td>
                    <td>
                      <button
                        className="link-button app__ghost"
                        onClick={() => openModal(supplier)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="empty-row">
                    No suppliers found.
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
              <h3>{form.id ? "Edit supplier" : "Add supplier"}</h3>
              <button className="icon-button" onClick={() => setShowModal(false)}>
                X
              </button>
            </div>
            <div className="form-grid">
              <input
                type="text"
                placeholder="Supplier name"
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
              <input
                type="text"
                placeholder="Phone"
                value={form.phone}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, phone: event.target.value }))
                }
              />
              <input
                type="text"
                placeholder="Email"
                value={form.email}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, email: event.target.value }))
                }
              />
            </div>
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
                {saving ? "Saving..." : "Save supplier"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
