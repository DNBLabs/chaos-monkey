import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { App } from "../src/App.js";
import type { Cart, CartClient, CartStorage, ItemSnapshot, Product } from "../src/api/cartClient.js";

const CATALOG: Product[] = [
  { sku: "SKU-001", name: "Ergonomic Chair", price: 12.99, imageUrl: "/c.jpg" },
  { sku: "SKU-002", name: "Standing Desk", price: 20.0, imageUrl: "/d.jpg" },
];

function memoryStorage(seed: Record<string, string> = {}): CartStorage {
  const map = new Map(Object.entries(seed));
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

/** A stateful fake cart-service so the UI can be driven end-to-end without fetch. */
function fakeClient(): CartClient {
  let cart: Cart = { cartId: "c1", items: [] };
  return {
    getCatalog: vi.fn(async () => CATALOG),
    createCart: vi.fn(async () => cart),
    getCart: vi.fn(async () => cart),
    addItem: vi.fn(async (_id: string, item: ItemSnapshot) => {
      cart = {
        cartId: cart.cartId,
        items: [
          {
            sku: item.sku,
            name: item.name,
            price: item.price,
            imageUrl: item.imageUrl,
            quantity: item.quantity,
            lineTotal: Math.round(item.price * item.quantity * 100) / 100,
          },
        ],
      };
      return cart;
    }),
    removeItem: vi.fn(async () => {
      cart = { cartId: cart.cartId, items: [] };
      return cart;
    }),
  };
}

describe("App — catalog browse", () => {
  it("renders a card per seeded product", async () => {
    render(<App client={fakeClient()} storage={memoryStorage()} />);

    expect(await screen.findByText("Ergonomic Chair")).toBeDefined();
    expect(screen.getByText("Standing Desk")).toBeDefined();
  });
});

describe("App — add to cart", () => {
  it("adds a SKU to the cart and shows it in the cart region", async () => {
    render(<App client={fakeClient()} storage={memoryStorage()} />);
    await screen.findByText("Ergonomic Chair");

    const card = screen.getByTestId("product-SKU-001");
    await userEvent.click(within(card).getByRole("button", { name: /add/i }));

    const cart = await screen.findByTestId("cart");
    expect(within(cart).getByText("Ergonomic Chair")).toBeDefined();
  });
});

describe("App — remove line item", () => {
  it("removes the line item from the cart", async () => {
    render(<App client={fakeClient()} storage={memoryStorage()} />);
    await screen.findByText("Ergonomic Chair");
    await userEvent.click(within(screen.getByTestId("product-SKU-001")).getByRole("button", { name: /add/i }));

    const cart = await screen.findByTestId("cart");
    await userEvent.click(within(cart).getByRole("button", { name: /remove/i }));

    await waitFor(() => {
      expect(within(screen.getByTestId("cart")).queryByText("Ergonomic Chair")).toBeNull();
    });
  });
});
