// Storefront API client — the single seam for Catalog + Cart CRUD. All cart
// calls flow through here so 404 CART_NOT_FOUND recovery lives in exactly one
// place (Decision 5): evicted carts are normal (48h ephemeral TTL), so every
// call site must survive one without bespoke handling.

export interface Product {
  sku: string;
  name: string;
  price: number;
  imageUrl: string;
}

export interface CartItem extends Product {
  quantity: number;
  lineTotal: number;
}

export interface Cart {
  cartId: string;
  items: CartItem[];
}

/** Snapshot fields the storefront sends to Cart on add (Cart does not re-validate). */
export type ItemSnapshot = Omit<CartItem, "lineTotal">;

/** localStorage key for the server-issued cart id (api-contracts.md). */
export const CART_ID_KEY = "chaos-monkey:cartId";

/** Minimal Storage surface so tests need not touch real localStorage. */
export interface CartStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface CartClient {
  getCatalog(): Promise<Product[]>;
  createCart(): Promise<Cart>;
  getCart(cartId: string): Promise<Cart>;
  addItem(cartId: string, item: ItemSnapshot): Promise<Cart>;
  removeItem(cartId: string, sku: string): Promise<Cart>;
}

export interface CartClientOptions {
  baseUrl?: string;
  storage: CartStorage;
  /** Called when a cart was evicted and transparently replaced (UI signals "cart was reset"). */
  onCartReset?: () => void;
  fetch?: typeof fetch;
}

export function createCartClient(options: CartClientOptions): CartClient {
  const base = options.baseUrl ?? "/api/v1";
  const doFetch = options.fetch ?? fetch;
  const { storage, onCartReset } = options;

  async function request(path: string, init?: RequestInit): Promise<Response> {
    return doFetch(`${base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": crypto.randomUUID(),
        ...(init?.headers ?? {}),
      },
    });
  }

  async function isCartNotFound(res: Response): Promise<boolean> {
    if (res.status !== 404) return false;
    const body = (await res.clone().json().catch(() => null)) as
      | { error?: { code?: string } }
      | null;
    return body?.error?.code === "CART_NOT_FOUND";
  }

  /** Create a fresh cart, persist its id, and signal the reset. Returns the new cart. */
  async function recoverCart(): Promise<Cart> {
    const cart = await createCart();
    storage.setItem(CART_ID_KEY, cart.cartId);
    onCartReset?.();
    return cart;
  }

  async function createCart(): Promise<Cart> {
    const res = await request("/carts", { method: "POST" });
    return (await res.json()) as Cart;
  }

  async function getCatalog(): Promise<Product[]> {
    const res = await request("/catalog");
    const body = (await res.json()) as { products: Product[] };
    return body.products;
  }

  // Reads/removes recover to the fresh empty cart — never replayed against it
  // (a GET/DELETE on an evicted cart has nothing to replay). Only add replays.
  async function getCart(cartId: string): Promise<Cart> {
    const res = await request(`/carts/${cartId}`);
    if (await isCartNotFound(res)) return recoverCart();
    return (await res.json()) as Cart;
  }

  async function removeItem(cartId: string, sku: string): Promise<Cart> {
    const res = await request(`/carts/${cartId}/items/${sku}`, { method: "DELETE" });
    if (await isCartNotFound(res)) return recoverCart();
    return (await res.json()) as Cart;
  }

  async function addItem(cartId: string, item: ItemSnapshot): Promise<Cart> {
    const { sku, ...body } = item;
    const put = (id: string) =>
      request(`/carts/${id}/items/${sku}`, { method: "PUT", body: JSON.stringify(body) });

    const res = await put(cartId);
    if (await isCartNotFound(res)) {
      const fresh = await recoverCart();
      const replay = await put(fresh.cartId);
      return (await replay.json()) as Cart;
    }
    return (await res.json()) as Cart;
  }

  return { getCatalog, createCart, getCart, addItem, removeItem };
}
