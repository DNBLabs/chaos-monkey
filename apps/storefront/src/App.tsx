import { useEffect, useState } from "react";

import {
  type Cart,
  type CartClient,
  type CartStorage,
  type Product,
  createCartClient,
} from "./api/cartClient.js";
import { bootstrapSession } from "./session.js";

export interface AppProps {
  client?: CartClient;
  storage?: CartStorage;
}

const defaultStorage = (): CartStorage => window.localStorage;

export function App({ client, storage }: AppProps = {}) {
  const store = storage ?? defaultStorage();
  const [api] = useState<CartClient>(() => client ?? createCartClient({ storage: store }));

  const [catalog, setCatalog] = useState<Product[]>([]);
  const [cart, setCart] = useState<Cart | null>(null);

  // Server-authoritative: every snapshot the client returns replaces UI state
  // wholesale (Decision 5). No optimistic local mutation, no client-side totals.
  useEffect(() => {
    let active = true;
    bootstrapSession(api, store).then((session) => {
      if (!active) return;
      setCatalog(session.catalog);
      setCart(session.cart);
    });
    return () => {
      active = false;
    };
  }, [api, store]);

  async function addToCart(product: Product) {
    if (cart === null) return;
    setCart(await api.addItem(cart.cartId, { ...product, quantity: 1 }));
  }

  async function removeFromCart(sku: string) {
    if (cart === null) return;
    setCart(await api.removeItem(cart.cartId, sku));
  }

  const subtotal = (cart?.items ?? []).reduce((sum, item) => sum + item.lineTotal, 0);

  return (
    <main>
      <h1>Chaos Monkey</h1>

      <section aria-label="Catalog" className="catalog-grid">
        {catalog.map((product) => (
          <article key={product.sku} data-testid={`product-${product.sku}`}>
            <img src={product.imageUrl} alt={product.name} />
            <h2>{product.name}</h2>
            <p>${product.price.toFixed(2)}</p>
            <button type="button" onClick={() => addToCart(product)}>
              Add to cart
            </button>
          </article>
        ))}
      </section>

      <aside data-testid="cart" aria-label="Cart">
        <h2>Your cart</h2>
        {cart && cart.items.length === 0 && <p>Cart is empty</p>}
        <ul>
          {cart?.items.map((item) => (
            <li key={item.sku}>
              <span>{item.name}</span>
              <span>×{item.quantity}</span>
              <span>${item.lineTotal.toFixed(2)}</span>
              <button type="button" onClick={() => removeFromCart(item.sku)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <p>Total: ${subtotal.toFixed(2)}</p>
      </aside>
    </main>
  );
}
