export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  trackStock: boolean;
  stock: number;
  isFeatured: boolean;
  supportsCustomization: boolean;
};

export type MenuGroup = { id: string; name: string; items: MenuItem[] };

export type OrderItemState = { id: string; name: string; price: number; qty: number; status: string };

export type OpenOrderState = { id: string; status: string; items: OrderItemState[] } | null;

/** One line of the customer's in-progress cart, keyed uniquely per
 *  distinct customization so "ผัดกะเพรา เผ็ดมาก" and "ผัดกะเพรา ไม่เผ็ด"
 *  are two separate rows instead of merging into one. */
export type CartEntry = {
  key: string;
  menuItemId: string;
  name: string;
  unitPrice: number; // base price + selected add-ons, in satang
  qty: number;
  spiceLevel?: string;
  addOnIds: string[];
  addOnNames: string[];
  note?: string;
};
