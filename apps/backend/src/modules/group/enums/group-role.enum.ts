/**
 * Vai trò của thành viên trong một nhóm.
 * - owner: người tạo nhóm, có toàn quyền quản lý
 * - admin: quản trị viên nhóm, có quyền quản lý gần như owner trừ xóa nhóm
 * - member: thành viên thông thường, chỉ xem/tạo task
 */
export enum GroupRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
}
