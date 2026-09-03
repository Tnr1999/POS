import "dotenv/config";
import { vi } from "vitest";

// Server actions call these Next.js request-scoped APIs, which don't exist
// outside an actual request (e.g. under vitest). Stub them so the actions'
// real transaction/DB logic under test still runs unmodified.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ name: "pos_staff_session", value: "mock" }),
  }),
}));

vi.mock("@/lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session")>();
  return {
    ...actual,
    requireStaff: vi.fn(async () => {}),
  };
});
