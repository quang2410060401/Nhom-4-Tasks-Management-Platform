/* ─────────────────────────────────────────────────────────────────
 * Route Constants — tất cả route paths dùng trong app
 * ─────────────────────────────────────────────────────────────────
 * Tập trung route paths để:
 * 1. Tránh hardcode string rải rác
 * 2. Dễ rename / refactor
 * 3. Dùng chung cho router config, navigate(), Link, redirect helpers
 *
 * QUAN TRỌNG: Giữ đồng bộ với router config (src/app/router/index.tsx)
 * và invite email link format từ api-specification.md §3.4.
 * ───────────────────────────────────────────────────────────────── */

// ──── Auth routes (public) ────

export const ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  VERIFY_EMAIL: '/verify-email',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',

  // ──── App routes (authenticated) ────

  HOME: '/',
  DASHBOARD: '/dashboard',
  GROUPS: '/groups',
  TASKS: '/tasks',
  MY_TASKS: '/my-tasks',
  GROUP_DETAIL: '/groups/:groupId',
  GROUP_DETAIL_OVERVIEW: '/groups/:groupId/overview',
  GROUP_DETAIL_TASKS: '/groups/:groupId/tasks',
  GROUP_DETAIL_MEMBERS: '/groups/:groupId/members',

  // ──── Invite route ────
  // Link gửi qua email: /invite/accept?token=xxx
  // Xem: system-flows.md — Flow 5, bước (11)
  INVITE_ACCEPT: '/invite/accept',
} as const;

// ──── Route builder helpers (tạo path có params) ────

/** Tạo path chi tiết group: /groups/abc123 */
export function groupDetailPath(groupId: string): string {
  return `/groups/${encodeURIComponent(groupId)}`;
}

export type GroupDetailTab = 'overview' | 'tasks' | 'members';

export function groupDetailTabPath(groupId: string, tab: GroupDetailTab): string {
  return `${groupDetailPath(groupId)}/${tab}`;
}

// ──── Query param keys dùng trong URL ────

export const QUERY_PARAMS = {
  /** Token verify email: /verify-email?token=xxx */
  TOKEN: 'token',
  /** Redirect path sau login: /login?redirect=/invite/accept&token=xxx */
  REDIRECT: 'redirect',
  /** Filter task theo assignee: ?assigneeId=xxx */
  ASSIGNEE_ID: 'assigneeId',
  /** Filter task theo labels: ?labelIds=id1,id2 */
  LABEL_IDS: 'labelIds',
  /** Search task theo title: ?search=keyword */
  SEARCH: 'search',
} as const;
