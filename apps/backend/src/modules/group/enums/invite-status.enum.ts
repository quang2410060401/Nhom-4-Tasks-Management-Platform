/**
 * Trạng thái của lời mời vào nhóm.
 * - pending: lời mời đang chờ chấp nhận
 * - accepted: lời mời đã được chấp nhận
 * - expired: lời mời đã hết hạn (chưa chấp nhận sau 48h)
 */
export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
}
