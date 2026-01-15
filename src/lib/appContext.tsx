import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import type { Branch, Product } from "./types";

type UserInfo = {
  id: string;
  email: string | null;
};

type AppContextValue = {
  user: UserInfo | null;
  loadingAuth: boolean;
  signIn: (identifier: string, password: string) => Promise<string | null>;
  signUp: (
    firstName: string,
    lastName: string,
    email: string,
    password: string
  ) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
  products: Product[];
  loadingProducts: boolean;
  reloadProducts: () => Promise<void>;
  branches: Branch[];
  selectedBranchId: string | null;
  setSelectedBranchId: (branchId: string) => void;
  profileRole: "admin" | "manager" | "cashier" | null;
  profileFullName: string | null;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(
    null
  );
  const [profileRole, setProfileRole] = useState<
    "admin" | "manager" | "cashier" | null
  >(null);
  const [profileFullName, setProfileFullName] = useState<string | null>(null);

  const updateSelectedBranchId = (branchId: string) => {
    setSelectedBranchIdState(branchId);
    window.localStorage.setItem("poxpos-branch-id", branchId);
  };

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        const sessionUser = data.session?.user ?? null;
        setUser(
          sessionUser
            ? { id: sessionUser.id, email: sessionUser.email ?? null }
            : null
        );
      })
      .finally(() => {
        if (active) setLoadingAuth(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const sessionUser = session?.user ?? null;
        setUser(
          sessionUser
            ? { id: sessionUser.id, email: sessionUser.email ?? null }
            : null
        );
      }
    );

    return () => {
      active = false;
      subscription?.subscription.unsubscribe();
    };
  }, []);

  const reloadProducts = async () => {
    if (!user) {
      setProducts([]);
      return;
    }

    setLoadingProducts(true);
    const { data, error } = await supabase
      .from("products_public")
      .select(
        "id,name,sku,barcode,category,price,stock_on_hand,low_stock_threshold,is_active"
      )
      .order("name", { ascending: true });

    if (error || !data) {
      setProducts([]);
      setLoadingProducts(false);
      return;
    }

    if (selectedBranchId) {
      const { data: stockRows } = await supabase
        .from("product_stock")
        .select("product_id,stock_on_hand,low_stock_threshold")
        .eq("branch_id", selectedBranchId);

      const stockMap = new Map(
        (stockRows ?? []).map((row) => [row.product_id, row])
      );

      const merged = data.map((product) => {
        const stock = stockMap.get(product.id);
        if (!stock) return product;
        return {
          ...product,
          stock_on_hand: stock.stock_on_hand,
          low_stock_threshold: stock.low_stock_threshold,
        };
      });
      setProducts(merged);
    } else {
      setProducts(data);
    }
    setLoadingProducts(false);
  };

  useEffect(() => {
    if (!user) {
      setProducts([]);
      return;
    }
    void reloadProducts();
  }, [user, selectedBranchId]);

  useEffect(() => {
    if (!user) {
      setBranches([]);
      setProfileRole(null);
      setProfileFullName(null);
      return;
    }
    supabase
      .from("branches")
      .select("id,name,is_default")
      .order("name", { ascending: true })
      .then(({ data }) => {
        setBranches(data ?? []);
        const stored = window.localStorage.getItem("poxpos-branch-id");
        if (stored) {
          setSelectedBranchIdState(stored);
          return;
        }
        const defaultBranch = (data ?? []).find((row) => row.is_default);
        if (defaultBranch) {
          setSelectedBranchIdState(defaultBranch.id);
        }
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("role,full_name")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setProfileRole(data.role);
        setProfileFullName(data.full_name ?? null);
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const productsChannel = supabase
      .channel("products")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
        },
        () => {
          void reloadProducts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(productsChannel);
    };
  }, [user, selectedBranchId]);

  useEffect(() => {
    if (!user || !selectedBranchId) return;

    const stockChannel = supabase
      .channel(`stock-${selectedBranchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "product_stock",
          filter: `branch_id=eq.${selectedBranchId}`,
        },
        () => {
          void reloadProducts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(stockChannel);
    };
  }, [user, selectedBranchId]);

  const value = useMemo(
    () => ({
      user,
      loadingAuth,
      signIn: async (identifier: string, password: string) => {
        const trimmed = identifier.trim();
        const payload = trimmed.includes("@")
          ? { email: trimmed, password }
          : { phone: normalizePhone(trimmed), password };
        if (!payload.phone && !payload.email) {
          return "Enter a valid email or phone number.";
        }
        const { error } = await supabase.auth.signInWithPassword(payload);
        return error ? error.message : null;
      },
      signUp: async (
        firstName: string,
        lastName: string,
        email: string,
        password: string
      ) => {
        const first = firstName.trim();
        const last = lastName.trim();
        const trimmedEmail = email.trim();
        if (!first || !last) {
          return { error: "Enter your first and last name." };
        }
        if (!trimmedEmail || !trimmedEmail.includes("@")) {
          return { error: "Enter a valid email address." };
        }
        if (!password.trim()) {
          return { error: "Password cannot be empty." };
        }
        const fullName = `${first} ${last}`.trim();
        const { error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              full_name: fullName,
              first_name: first,
              last_name: last,
            },
          },
        });
        if (error) {
          return { error: error.message };
        }
        return { error: null };
      },
      signInWithGoogle: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: window.location.origin,
          },
        });
        return error ? error.message : null;
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
      products,
      loadingProducts,
      reloadProducts,
      branches,
      selectedBranchId,
      setSelectedBranchId: updateSelectedBranchId,
      profileRole,
      profileFullName,
    }),
    [
      loadingAuth,
      products,
      loadingProducts,
      user,
      branches,
      selectedBranchId,
      profileRole,
      profileFullName,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function normalizePhone(input: string) {
  if (!input) return "";
  const cleaned = input.replace(/[\s()-]/g, "");
  if (cleaned.startsWith("+")) {
    return /^\+\d{8,15}$/.test(cleaned) ? cleaned : "";
  }
  if (cleaned.startsWith("00")) {
    const normalized = `+${cleaned.slice(2)}`;
    return /^\+\d{8,15}$/.test(normalized) ? normalized : "";
  }
  if (cleaned.startsWith("260")) {
    const normalized = `+${cleaned}`;
    return /^\+\d{8,15}$/.test(normalized) ? normalized : "";
  }
  if (cleaned.startsWith("0") && cleaned.length >= 9 && cleaned.length <= 10) {
    const normalized = `+260${cleaned.slice(1)}`;
    return /^\+\d{8,15}$/.test(normalized) ? normalized : "";
  }
  return "";
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}
