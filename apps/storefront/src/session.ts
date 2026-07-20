import { CART_ID_KEY, type Cart, type CartClient, type CartStorage, type Product } from "./api/cartClient.js";

export interface Session {
  cart: Cart;
  catalog: Product[];
}

/**
 * Session bootstrap (storefront-ui.md): read the persisted cartId; load that
 * cart or create a fresh one on first visit; then load the catalog to render
 * the grid. 404 recovery for a *stale* persisted id lives in the client, so a
 * getCart here already returns a usable cart even if the old one was evicted.
 */
export async function bootstrapSession(
  client: CartClient,
  storage: CartStorage,
): Promise<Session> {
  const existingId = storage.getItem(CART_ID_KEY);

  let cart: Cart;
  if (existingId === null) {
    cart = await client.createCart();
    storage.setItem(CART_ID_KEY, cart.cartId);
  } else {
    cart = await client.getCart(existingId);
  }

  const catalog = await client.getCatalog();
  return { cart, catalog };
}
