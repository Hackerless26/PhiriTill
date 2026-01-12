import { supabase } from "./supabaseClient";

type CheckoutPayload = {
  payment_method: string;
  items: { product_id: string; quantity: number; price?: number }[];
  branch_id?: string;
};

type StockReceivePayload = {
  reference?: string;
  items: { product_id: string; quantity: number; cost?: number }[];
  branch_id?: string;
};

type StockAdjustPayload = {
  items: { product_id: string; quantity: number; reason?: string }[];
  branch_id?: string;
};

type ProductUpsertPayload = {
  id?: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  category?: string | null;
  price: number;
  cost?: number | null;
  stock_on_hand: number;
  low_stock_threshold: number;
  is_active?: boolean;
  branch_id?: string;
};

async function getAuthToken() {
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) {
    return data.session.access_token;
  }
  const refreshed = await supabase.auth.refreshSession();
  return refreshed.data.session?.access_token ?? null;
}

async function callFunction<T>(path: string, payload: unknown): Promise<T> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Not authenticated. Please sign in again.");
  }

  let response: Response;
  try {
    response = await fetch(`/.netlify/functions/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new Error("Network error. Please try again.");
  }

  const json = await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      await supabase.auth.signOut();
      throw new Error("Session expired. Please sign in again.");
    }
    throw new Error(json.error ?? "Request failed");
  }

  return json;
}

export function checkout(payload: CheckoutPayload) {
  return callFunction<{ sale: { sale_id: string; receipt_no: string } }>(
    "checkout",
    payload
  );
}

type ManualSalePayload = {
  items: { product_id: string; quantity: number; price: number }[];
  branch_id?: string;
};

export function manualSale(payload: ManualSalePayload) {
  return callFunction<{ sale: { sale_id: string; receipt_no: string } }>(
    "manual-sale",
    payload
  );
}

export function stockReceive(payload: StockReceivePayload) {
  return callFunction<{ status: string }>("stock-receive", payload);
}

export function stockAdjust(payload: StockAdjustPayload) {
  return callFunction<{ status: string }>("stock-adjust", payload);
}

export function productUpsert(payload: ProductUpsertPayload) {
  return callFunction<{ status: string; product_id: string }>(
    "product-upsert",
    payload
  );
}

type SupplierUpsertPayload = {
  id?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
};

export function supplierUpsert(payload: SupplierUpsertPayload) {
  return callFunction<{ status: string; supplier_id: string }>(
    "supplier-upsert",
    payload
  );
}

type PurchaseOrderCreatePayload = {
  supplier_id: string;
  reference?: string | null;
  items: { product_id: string; quantity: number; cost?: number }[];
  branch_id?: string;
};

export function purchaseOrderCreate(payload: PurchaseOrderCreatePayload) {
  return callFunction<{ status: string; purchase_order_id: string }>(
    "purchase-order-create",
    payload
  );
}

export function purchaseOrderReceive(purchaseOrderId: string) {
  return callFunction<{ status: string }>("purchase-order-receive", {
    purchase_order_id: purchaseOrderId,
  });
}

type ReturnProcessPayload = {
  return_type: "customer" | "supplier";
  reason?: string | null;
  items: { product_id: string; quantity: number; price?: number }[];
  branch_id?: string;
};

export function returnProcess(payload: ReturnProcessPayload) {
  return callFunction<{ status: string; return_id: string }>(
    "return-process",
    payload
  );
}

type BranchUpsertPayload = {
  id?: string;
  name: string;
  is_default?: boolean;
};

export function branchUpsert(payload: BranchUpsertPayload) {
  return callFunction<{ status: string; branch_id: string }>(
    "branch-upsert",
    payload
  );
}

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
};

const NOTIFICATIONS_KEY = "poxpos-notifications";
const LOW_STOCK_KEY = "poxpos-low-stock";
const LOW_STOCK_DATE_KEY = "poxpos-low-stock-date";

export function getNotifications(): NotificationItem[] {
  const raw = window.localStorage.getItem(NOTIFICATIONS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as NotificationItem[];
  } catch {
    return [];
  }
}

function setNotifications(notifications: NotificationItem[]) {
  window.localStorage.setItem(
    NOTIFICATIONS_KEY,
    JSON.stringify(notifications)
  );
}

export function addNotification(title: string, body: string) {
  const notifications = getNotifications();
  notifications.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    body,
    createdAt: Date.now(),
  });
  setNotifications(notifications.slice(0, 50));

  void supabase.auth.getSession().then(({ data }) => {
    const userId = data.session?.user?.id;
    if (!userId) return;
    supabase.from("notifications").insert({
      user_id: userId,
      title,
      body,
    });
  });
}

export function syncLowStockNotifications(
  lowStockIds: string[],
  lowStockNames: string[]
) {
  const prevRaw = window.localStorage.getItem(LOW_STOCK_KEY);
  const prevIds = prevRaw ? (JSON.parse(prevRaw) as string[]) : [];
  const newIds = lowStockIds.filter((id) => !prevIds.includes(id));
  if (newIds.length) {
    const names = lowStockNames
      .filter((_name, index) => newIds.includes(lowStockIds[index]))
      .join(", ");
    addNotification("Low stock alert", `Items low: ${names}`);
  }
  window.localStorage.setItem(LOW_STOCK_KEY, JSON.stringify(lowStockIds));

  const today = new Date().toISOString().slice(0, 10);
  const lastDate = window.localStorage.getItem(LOW_STOCK_DATE_KEY);
  if (lastDate !== today && lowStockIds.length) {
    addNotification(
      "Daily low stock summary",
      `${lowStockIds.length} items are below threshold today.`
    );
    window.localStorage.setItem(LOW_STOCK_DATE_KEY, today);
  }
}
