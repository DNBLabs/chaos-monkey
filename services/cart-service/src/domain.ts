// Domain vocabulary per CONTEXT.md: a Cart is a session-scoped collection of
// line items (SKU + quantity). Cart never calls Inventory, so name/price/
// imageUrl are a trusted snapshot supplied by the storefront on add-to-cart.

/** What Cart stores per SKU. The snapshot fields are trusted, not re-validated. */
export interface StoredLineItem {
  quantity: number;
  name: string;
  price: number;
  imageUrl: string;
}

/** A line item as returned in a Cart snapshot — stored fields plus derived lineTotal. */
export interface SnapshotLineItem extends StoredLineItem {
  sku: string;
  lineTotal: number;
}

/** The full server-authoritative Cart snapshot returned by every read/mutation. */
export interface CartSnapshot {
  cartId: string;
  items: SnapshotLineItem[];
}

/** lineTotal = price × quantity, rounded to cents so floating-point noise never leaks. */
export function lineTotal(price: number, quantity: number): number {
  return Math.round(price * quantity * 100) / 100;
}
