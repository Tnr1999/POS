// Shared error type for the Table Session lifecycle (openTableSession/
// closeTableSession in src/app/(staff)/admin/tables/actions.ts). Lives here
// rather than in that file because Next.js only allows a "use server" file
// to export async functions — an exported class (or any other non-function
// value) breaks the build even though plain `export type` declarations are
// fine there (types are erased, not real runtime exports).

export type TableSessionErrorCode =
  | "TABLE_NOT_FOUND"
  | "SESSION_NOT_FOUND"
  | "SESSION_HAS_OPEN_ORDER"
  | "SESSION_ALREADY_CLOSED"
  | "INVALID_IDEMPOTENCY_KEY"
  | "TABLE_HAS_LEGACY_OPEN_ORDER"
  | "UNKNOWN_ERROR";

/**
 * Thrown by openTableSession/closeTableSession for every rejection. Every
 * other server action in the codebase just throws a plain Error with a Thai
 * message for the existing toast-based error handling to display — that
 * still works unchanged here (`.message` is always a real Thai string) —
 * this only adds a machine-checkable `.code` on top, for a future UI that
 * needs to branch on *why* a call was rejected instead of parsing text.
 */
export class TableSessionError extends Error {
  code: TableSessionErrorCode;
  constructor(code: TableSessionErrorCode, message: string) {
    super(message);
    this.name = "TableSessionError";
    this.code = code;
  }
}
