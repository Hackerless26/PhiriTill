import { useEffect, useState } from "react";
import { getNotifications, type NotificationItem } from "../lib/posApi";
import { supabase } from "../lib/supabaseClient";

export default function Notifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const res = await supabase
          .from("notifications")
          .select("id,title,body,created_at")
          .order("created_at", { ascending: false });
        if (!active) return;
        const { data, error } = res as any;
        if (error || !data) {
          setNotifications(getNotifications());
        } else {
          setNotifications(
            data.map((row: any) => ({
              id: row.id,
              title: row.title,
              body: row.body,
              createdAt: new Date(row.created_at).getTime(),
            }))
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="page">
      <section className="card">
        <div className="card__header">
          <div>
            <h2>Notifications</h2>
            <p className="muted">Low stock alerts and summaries.</p>
          </div>
        </div>
        {loading ? <p className="muted">Loading notifications...</p> : null}
        <div className="list">
          {notifications.length ? (
            notifications.map((note) => (
              <div className="list__item list__item--stack" key={note.id}>
                <div>
                  <p className="list__title">{note.title}</p>
                  <p className="muted">{note.body}</p>
                </div>
                <span className="badge badge--ok">
                  {new Date(note.createdAt).toLocaleString()}
                </span>
              </div>
            ))
          ) : (
            <p className="muted">No notifications yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
