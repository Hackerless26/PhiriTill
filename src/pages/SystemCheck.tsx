import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type CheckResult = {
  name: string;
  status: "ok" | "warn" | "error";
  detail: string;
};

async function pingFunction(path: string) {
  try {
    const response = await fetch(`/api/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (response.status === 404) {
      return { status: "error" as const, detail: "Function not found" };
    }
    if (response.status >= 400) {
      return { status: "ok" as const, detail: "Reachable (expected error)" };
    }
    return { status: "ok" as const, detail: "Reachable" };
  } catch {
    return { status: "error" as const, detail: "Network error" };
  }
}

export default function SystemCheck() {
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    let active = true;
    const runChecks = async () => {
      setRunning(true);
      const results: CheckResult[] = [];

      const session = await supabase.auth.getSession();
      results.push({
        name: "Supabase session",
        status: session.data.session ? "ok" : "warn",
        detail: session.data.session ? "Signed in" : "No active session",
      });

      const products = await supabase
        .from("products_public")
        .select("id")
        .limit(1);
      results.push({
        name: "Products read",
        status: products.error ? "error" : "ok",
        detail: products.error ? products.error.message : "OK",
      });

      const branches = await supabase
        .from("branches")
        .select("id")
        .limit(1);
      results.push({
        name: "Branches read",
        status: branches.error ? "error" : "ok",
        detail: branches.error ? branches.error.message : "OK",
      });

      const movements = await supabase
        .from("stock_movements")
        .select("id")
        .limit(1);
      results.push({
        name: "Stock movements read",
        status: movements.error ? "warn" : "ok",
        detail: movements.error ? movements.error.message : "OK",
      });

      const functionChecks = [
        "checkout",
        "stock-receive",
        "stock-adjust",
        "product-upsert",
        "supplier-upsert",
        "purchase-order-create",
        "purchase-order-receive",
        "return-process",
        "branch-upsert",
      ];

      for (const fn of functionChecks) {
        const result = await pingFunction(fn);
        results.push({
          name: `Function ${fn}`,
          status: result.status,
          detail: result.detail,
        });
      }

      if (active) {
        setChecks(results);
        setRunning(false);
      }
    };

    void runChecks();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="page">
      <section className="card">
        <div className="card__header">
          <div>
            <h2>System Check</h2>
            <p className="muted">Quick diagnostics for backend connectivity.</p>
          </div>
          <button
            className="app__ghost"
            onClick={() => window.location.reload()}
          >
            Rerun
          </button>
        </div>
        {running ? <p className="muted">Running checks...</p> : null}
        <div className="list">
          {checks.map((check) => (
            <div className="list__item" key={check.name}>
              <div>
                <p className="list__title">{check.name}</p>
                <p className="muted">{check.detail}</p>
              </div>
              <span
                className={
                  check.status === "ok"
                    ? "badge badge--ok"
                    : check.status === "warn"
                      ? "badge badge--warn"
                      : "badge badge--danger"
                }
              >
                {check.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
