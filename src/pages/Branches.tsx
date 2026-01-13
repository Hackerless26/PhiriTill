import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { branchUpsert } from "../lib/posApi";

type BranchRow = {
  id: string;
  name: string;
  is_default: boolean;
};

export default function Branches() {
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: "",
    name: "",
    is_default: false,
  });

  const loadBranches = async () => {
    setLoading(true);
    try {
      const res = await supabase
        .from("branches")
        .select("id,name,is_default")
        .order("name", { ascending: true });
      setBranches(res.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const openModal = (branch?: BranchRow) => {
    if (branch) {
      setForm({
        id: branch.id,
        name: branch.name,
        is_default: branch.is_default,
      });
    } else {
      setForm({ id: "", name: "", is_default: false });
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
      await branchUpsert({
        id: form.id || undefined,
        name: form.name.trim(),
        is_default: form.is_default,
      });
      setShowModal(false);
      loadBranches();
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
            <h2>Branches</h2>
            <p className="muted">Manage store locations.</p>
          </div>
          <button className="app__primary" onClick={() => openModal()}>
            Add branch
          </button>
        </div>
        {loading ? <p className="muted">Loading branches...</p> : null}
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Default</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {branches.length ? (
                branches.map((branch) => (
                  <tr key={branch.id}>
                    <td>{branch.name}</td>
                    <td>{branch.is_default ? "Yes" : "No"}</td>
                    <td>
                      <button
                        className="link-button app__ghost"
                        onClick={() => openModal(branch)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="empty-row">
                    No branches found.
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
              <h3>{form.id ? "Edit branch" : "Add branch"}</h3>
              <button className="icon-button" onClick={() => setShowModal(false)}>
                X
              </button>
            </div>
            <div className="form-grid">
              <input
                type="text"
                placeholder="Branch name"
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
              <label className="field">
                <span>Default branch</span>
                <select
                  value={form.is_default ? "yes" : "no"}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      is_default: event.target.value === "yes",
                    }))
                  }
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </label>
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
                {saving ? "Saving..." : "Save branch"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
