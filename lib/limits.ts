/** Input bounds, enforced server-side before any provider call is made. */

/** ~2k tokens. Far above a realistic process description, and well inside
 *  the token-per-minute ceiling on free model endpoints. */
export const MAX_PROSE_CHARS = 8000;

/** Below this there is nothing to extract, and a call would be wasted. */
export const MIN_PROSE_CHARS = 50;
