/* ─────────────────────────────────────────────────────────────────
 * Storage Key Constants — keys cho localStorage / sessionStorage
 * ─────────────────────────────────────────────────────────────────
 * Tập trung tất cả storage keys để:
 * 1. Tránh typo khi đọc/ghi storage
 * 2. Dễ tìm tất cả data được persist
 * 3. Dễ clear khi logout
 *
 * QUAN TRỌNG: TOKEN_STORAGE_KEY canonical nằm ở
 * src/services/auth/authConstants.ts (đã có sẵn).
 * File này re-export nó và thêm các keys khác.
 * ───────────────────────────────────────────────────────────────── */

export { TOKEN_STORAGE_KEY } from '@/services/auth/authConstants';

/** Key lưu sidebar collapsed state */
export const SIDEBAR_COLLAPSED_KEY = 'sidebarCollapsed';

/** Key lưu preferred locale / language (dự phòng cho i18n sau) */
export const LOCALE_KEY = 'locale';

/** Key lưu theme preference (dự phòng cho dark mode sau) */
export const THEME_KEY = 'theme';
