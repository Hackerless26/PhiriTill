import { useEffect, useState } from "react";
import { useApp } from "../lib/appContext";
import { supabase } from "../lib/supabaseClient";

type Profile = {
  user_id: string;
  full_name: string | null;
  role: string;
};

export default function Team() {
  const { profileRole } = useApp();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [roleEdits, setRoleEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    supabase
      .from("profiles")
      .select("user_id,full_name,role")
      .then(({ data, error: fetchError }) => {
        if (!active) return;
        if (fetchError) {
          setError("Admins can view the full team list.");
          return;
        }
        setProfiles(data ?? []);
        setRoleEdits(
          (data ?? []).reduce<Record<string, string>>((acc, profile) => {
            acc[profile.user_id] = profile.role;
            return acc;
          }, {})
        );
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="page">
      <section className="card">
        <h2>Users & roles</h2>
        <p className="muted">Assign roles and keep accountability clear.</p>
        <div className="stats">
          <div>
            <p className="stat__label">Admin</p>
            <p className="stat__value">Full access</p>
          </div>
          <div>
            <p className="stat__label">Manager</p>
            <p className="stat__value">Reports + stock</p>
          </div>
          <div>
            <p className="stat__label">Cashier</p>
            <p className="stat__value">Sales only</p>
          </div>
        </div>
        {profileRole !== "admin" ? (
          <p className="muted">
            Only admins can change roles. Ask an admin to update your access.
          </p>
        ) : null}
      </section>

      <section className="card">
        <h3>Users</h3>
        {error ? (
          <p className="muted">{error}</p>
        ) : profiles.length ? (
          <div className="list">
            {profiles.map((profile) => (
              <div className="list__item" key={profile.user_id}>
                <div>
                  <p className="list__title">
                    {profile.full_name || "Unnamed user"}
                  </p>
                  <p className="muted">{profile.user_id}</p>
                </div>
                {profileRole === "admin" ? (
                  <div className="inline-inputs">
                    <select
                      value={roleEdits[profile.user_id] ?? profile.role}
                      onChange={(event) =>
                        setRoleEdits((prev) => ({
                          ...prev,
                          [profile.user_id]: event.target.value,
                        }))
                      }
                    >
                      <option value="admin">admin</option>
                      <option value="manager">manager</option>
                      <option value="cashier">cashier</option>
                    </select>
                    <button
                      className="app__ghost"
                      disabled={saving[profile.user_id] === true}
                      onClick={async () => {
                        const nextRole =
                          roleEdits[profile.user_id] ?? profile.role;
                        if (nextRole === profile.role) return;
                        setSaving((prev) => ({
                          ...prev,
                          [profile.user_id]: true,
                        }));
                        const { error: updateError } = await supabase
                          .from("profiles")
                          .update({ role: nextRole })
                          .eq("user_id", profile.user_id);
                        if (updateError) {
                          setError(updateError.message);
                          setRoleEdits((prev) => ({
                            ...prev,
                            [profile.user_id]: profile.role,
                          }));
                        } else {
                          setProfiles((prev) =>
                            prev.map((row) =>
                              row.user_id === profile.user_id
                                ? { ...row, role: nextRole }
                                : row
                            )
                          );
                        }
                        setSaving((prev) => ({
                          ...prev,
                          [profile.user_id]: false,
                        }));
                      }}
                    >
                      {saving[profile.user_id] ? "Saving..." : "Save"}
                    </button>
                  </div>
                ) : (
                  <span className="badge badge--ok">{profile.role}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No users found.</p>
        )}
      </section>
    </div>
  );
}
