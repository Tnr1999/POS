/**
 * Customer-facing customization options (spice level, add-ons). These are a
 * small, restaurant-wide static config rather than a per-menu-item DB
 * relation — there's no admin UI to manage per-item modifiers yet, and
 * inventing one is out of scope for the ordering-page redesign. Add-on
 * prices are looked up here on the SERVER inside placeOrder (never trusted
 * from the client), so a selected add-on always reflects in both the price
 * charged and the kitchen ticket.
 *
 * Spice level and add-ons only make sense for cooked dishes, not drinks —
 * `supportsCustomization` hides the whole section for items in a
 * drink/dessert-like category.
 */

export const SPICE_LEVELS = ["ไม่เผ็ด", "เผ็ดน้อย", "เผ็ดปกติ", "เผ็ดมาก"] as const;
export type SpiceLevel = (typeof SPICE_LEVELS)[number];

export type AddOn = { id: string; name: string; price: number };

/** Prices in satang, matching every other money value in this app. */
export const ADD_ONS: AddOn[] = [
  { id: "egg", name: "เพิ่มไข่ดาว", price: 1000 },
  { id: "crispy-pork", name: "เพิ่มหมูกรอบ", price: 3000 },
  { id: "extra-rice", name: "เพิ่มข้าว", price: 1000 },
];

const NON_FOOD_CATEGORY_KEYWORDS = ["เครื่องดื่ม", "ของหวาน"];

export function supportsCustomization(categoryName: string | null): boolean {
  if (!categoryName) return true;
  return !NON_FOOD_CATEGORY_KEYWORDS.some((keyword) => categoryName.includes(keyword));
}

export function addOnById(id: string): AddOn | undefined {
  return ADD_ONS.find((a) => a.id === id);
}
