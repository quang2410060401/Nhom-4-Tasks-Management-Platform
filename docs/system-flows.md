# 🔄 System Flows — Tasks Management Platform

> **Version:** 1.0 (MVP)  
> Tài liệu mô tả chi tiết luồng xử lý logic của toàn bộ hệ thống, bao gồm tương tác giữa Frontend, Backend API, Database và các dịch vụ bên ngoài (Email, Firebase).

---

## 📑 Mục lục

1. [Flow 1 — Đăng ký tài khoản & Xác nhận email](#flow-1--đăng-ký-tài-khoản--xác-nhận-email)
2. [Flow 2 — Đăng nhập Email/Password](#flow-2--đăng-nhập-emailpassword)
3. [Flow 3 — Đăng nhập Google (Firebase)](#flow-3--đăng-nhập-google-firebase)
4. [Flow 4 — Tạo/Cập nhật Group (Aggregate save + transaction)](#flow-4--tạocập-nhật-group-aggregate-save--transaction)
5. [Flow 5 — Mời thành viên & Chấp nhận lời mời](#flow-5--mời-thành-viên--chấp-nhận-lời-mời)
6. [Flow 6 — Xóa thành viên khỏi Group](#flow-6--xóa-thành-viên-khỏi-group)
7. [Flow 6A — Xóa Group](#flow-6a--xóa-group)
8. [Flow 7 — Tạo Task mới](#flow-7--tạo-task-mới)
9. [Flow 8 — Cập nhật Task (Drag & Drop Kanban)](#flow-8--cập-nhật-task-drag--drop-kanban)
10. [Flow 8A — Quản lý Comments của Task](#flow-8a--quản-lý-comments-của-task)
11. [Flow 8B — Quản lý Attachments của Task](#flow-8b--quản-lý-attachments-của-task)
12. [Flow 9 — Xóa Task](#flow-9--xóa-task)
13. [Flow 10 — Quản lý Statuses (CRUD)](#flow-10--quản-lý-statuses-crud)
14. [Flow 11 — Quản lý Labels (CRUD)](#flow-11--quản-lý-labels-crud)
15. [Flow 11e — Dashboard cá nhân](#flow-11e--dashboard-cá-nhân)
16. [Flow 12 — Dashboard & Thống kê](#flow-12--dashboard--thống-kê)
17. [Flow 13 — Cron Job: Nhắc nhở trước deadline](#flow-13--cron-job-nhắc-nhở-trước-deadline)
18. [Flow 14 — Cron Job: Thông báo trễ hạn](#flow-14--cron-job-thông-báo-trễ-hạn)
19. [Flow 15 — JWT Authentication Guard](#flow-15--jwt-authentication-guard)

---

## Flow 1 — Đăng ký tài khoản & Xác nhận email

### Mô tả
Người dùng đăng ký tài khoản mới, hệ thống gửi email xác nhận. Tài khoản chỉ được phép đăng nhập sau khi xác nhận email thành công.

### Sequence Diagram

```
User          Frontend              Backend API              Database            Email Service
 │               │                       │                      │                     │
 │──(1) Nhập thông tin──►│               │                      │                     │
 │               │──(2) POST /auth/register──►│                 │                     │
 │               │                       │──(3) Validate────────►│                    │
 │               │                       │   • Email format?     │                    │
 │               │                       │   • Email đã tồn tại? │                    │
 │               │                       │   • Password >= 6?    │                    │
 │               │                       │◄──(3a) Kết quả validate│                   │
 │               │                       │                       │                    │
 │               │                       │  [Nếu hợp lệ]        │                    │
 │               │                       │──(4) Hash password────►│                   │
 │               │                       │──(5) Generate verifyToken (UUID)           │
 │               │                       │──(6) Insert user──────►│                   │
 │               │                       │   emailVerified=false  │                   │
 │               │                       │   verifyTokenExpires=now+24h               │
 │               │                       │◄──(6a) Created────────│                    │
 │               │                       │                       │                    │
 │               │                       │──(7) Gửi email verify────────────────────►│
 │               │                       │   Link: /verify-email?token=xxx           │
 │               │◄──(8) 201 "Kiểm tra email"──│                │                    │
 │◄──(9) Hiện thông báo──│               │                      │                    │
 │                                                                                    │
 │═══════════ Người dùng mở email ═══════════                                        │
 │                                                                                    │
 │──(10) Click link verify──►│            │                      │                    │
 │               │──(11) Redirect /verify-email?token=xxx        │                    │
 │               │──(12) GET /auth/verify-email?token=xxx──►│    │                    │
 │               │                       │──(13) Find user by verifyToken──►│         │
 │               │                       │◄──(13a) User found────│                    │
 │               │                       │──(14) Check token expiry                   │
 │               │                       │   verifyTokenExpires > now ?               │
 │               │                       │                                            │
 │               │                       │  [Token hợp lệ]                            │
 │               │                       │──(15) Update user─────►│                   │
 │               │                       │   emailVerified = true │                   │
 │               │                       │   verifyToken = null   │                   │
 │               │                       │   verifyTokenExpires = null                │
 │               │◄──(16) 200 "Xác nhận thành công"──│           │                    │
 │◄──(17) Redirect /login──│             │                       │                    │
```

### Luồng lỗi (Error Flows)

| Bước | Điều kiện lỗi | Xử lý |
|------|---------------|--------|
| 3 | Email đã tồn tại | Trả 400 "Email đã tồn tại" |
| 3 | Email sai format | Trả 400 "Email không đúng định dạng" |
| 3 | Password < 6 ký tự | Trả 400 "Password tối thiểu 6 ký tự" |
| 13 | Token không tồn tại | Trả 400 "Token không hợp lệ" |
| 14 | Token hết hạn (>24h) | Trả 400 "Token đã hết hạn, vui lòng đăng ký lại" |

---

## Flow 2 — Đăng nhập Email/Password

### Mô tả
Người dùng đã xác nhận email đăng nhập bằng email và password. Hệ thống trả JWT token để sử dụng cho các request tiếp theo.

### Sequence Diagram

```
User          Frontend              Backend API              Database
 │               │                       │                      │
 │──(1) Nhập email/password──►│          │                      │
 │               │──(2) POST /auth/login──►│                    │
 │               │                       │──(3) Find user by email──►│
 │               │                       │◄──(3a) User record───│
 │               │                       │                      │
 │               │                       │──(4) Kiểm tra emailVerified
 │               │                       │   [false] → 403 "Vui lòng xác nhận email"
 │               │                       │                      │
 │               │                       │──(5) bcrypt.compare(password, hash)
 │               │                       │   [Sai] → 401 "Email và password sai"
 │               │                       │                      │
 │               │                       │──(6) Generate JWT
 │               │                       │   Payload: { sub: userId, email }
 │               │                       │   Expiry: 7 ngày
 │               │                       │                      │
 │               │◄──(7) 200 { accessToken, user }──│           │
 │               │──(8) Lưu token vào localStorage  │           │
 │◄──(9) Redirect /dashboard──│          │                      │
```

### Luồng lỗi

| Bước | Điều kiện lỗi | Xử lý |
|------|---------------|--------|
| 3a | Email không tồn tại | Trả 401 (message chung, tránh leak thông tin) |
| 4 | emailVerified = false | Trả 403 "Vui lòng xác nhận email trước khi đăng nhập" |
| 5 | Password sai | Trả 401 "Email và password sai, vui lòng thử lại" |

---

## Flow 3 — Đăng nhập Google (Firebase)

### Mô tả
Người dùng đăng nhập qua Google. Frontend lấy `idToken` từ Firebase Auth, gửi lên Backend để verify và tạo/lấy tài khoản.

### Sequence Diagram

```
User         Frontend          Firebase Auth       Backend API          Database
 │              │                    │                   │                  │
 │──(1) Click "Đăng nhập Google"──►│ │                   │                  │
 │              │──(2) signInWithPopup()──►│              │                  │
 │              │◄──(3) { idToken }───────│               │                  │
 │              │                         │               │                  │
 │              │──(4) POST /auth/google { idToken }──►│  │                  │
 │              │                    │    │──(5) Verify idToken──►│           │
 │              │                    │    │   Firebase Admin SDK  │           │
 │              │                    │    │◄──(5a) Decoded: email, name, picture
 │              │                    │    │                       │           │
 │              │                    │    │──(6) Find user by googleId/email──►│
 │              │                    │    │◄──(6a) Result─────────│           │
 │              │                    │    │                       │           │
 │              │                    │    │  [User chưa tồn tại]             │
 │              │                    │    │──(7) Insert user──────►│          │
 │              │                    │    │   emailVerified = true │          │
 │              │                    │    │   googleId = xxx       │          │
 │              │                    │    │                        │          │
 │              │                    │    │  [User đã tồn tại, chưa link Google]
 │              │                    │    │──(7b) Update googleId──►│         │
 │              │                    │    │                         │         │
 │              │                    │    │──(8) Generate JWT                 │
 │              │◄──(9) 200 { accessToken, user }──│     │                   │
 │              │──(10) Lưu token, redirect──│       │     │                 │
 │◄──(11) Vào dashboard──│           │                   │                   │
```

### Đặc biệt: Merge tài khoản
- Nếu user đã đăng ký bằng email/password và sau đó login Google **cùng email** → hệ thống link `googleId` vào tài khoản hiện có, không tạo mới.

---

## Flow 4 — Tạo/Cập nhật Group (Aggregate save + transaction)

### Mô tả
Frontend modal create/edit group chỉ gửi **1 request aggregate**. Backend chịu trách nhiệm xử lý toàn bộ metadata nhóm, timeline, workflow statuses, labels, remove members và tạo invite records trong transaction.

Email lời mời được gửi **sau khi transaction commit**. Nếu SMTP lỗi, dữ liệu nhóm vẫn giữ nguyên và API trả `inviteSummary.failedEmails` để frontend cảnh báo.

### Sequence Diagram

```
User          Frontend                 Backend API                 Database                 Email
 │               │                          │                         │                      │
 │──(1) Nhập form group editor────────────►│                         │                      │
 │               │                          │                         │                      │
 │               │──(2) Validate client-side                            │                      │
 │               │   • name/description                                 │                      │
 │               │   • startDate/endDate                                │                      │
 │               │   • duplicate status/label                           │                      │
 │               │   • email invite format                              │                      │
 │               │                          │                         │                      │
 │               │──(3) POST /groups hoặc PATCH /groups/:id───────────►│                      │
 │               │   { name, description, startDate?, endDate?,        │                      │
 │               │     statuses[], labels[], inviteEmails[],           │                      │
 │               │     removeMemberUserIds[] }                         │                      │
 │               │                          │──(4) AuthGuard / OwnerGuard               │
 │               │                          │──(5) Validate business rules              │
 │               │                          │   • tên nhóm unique (case-insensitive)    │
 │               │                          │   • timeline hợp lệ                        │
 │               │                          │   • statuses/labels không trùng           │
 │               │                          │   • remove owner?                         │
 │               │                          │   • invite emails hợp lệ?                 │
 │               │                          │                         │                      │
 │               │                          │══════ Transaction Start ══════             │
 │               │                          │                         │                      │
 │               │                          │──(6) Upsert group metadata───────────────►│
 │               │                          │──(7) Upsert/delete statuses──────────────►│
 │               │                          │──(8) Upsert/delete labels────────────────►│
 │               │                          │──(9) Remove members + unassign tasks────►│
 │               │                          │──(10) Create pending invite records──────►│
 │               │                          │══════ Transaction Commit ══════           │
 │               │                          │                         │                      │
 │               │                          │──(11) Send invite emails after commit────────────────►│
 │               │                          │   • email fail => xóa invite record lỗi               │
 │               │◄──(12) 200/201 { group, inviteSummary }────────────│                      │
 │◄──(13) Redirect /groups/:id hoặc refresh detail────────────────────│                      │
```

### Luồng lỗi chính

| Bước | Điều kiện lỗi | Xử lý |
|------|---------------|--------|
| 5 | Tên nhóm trùng | Rollback và trả 400 `"Tên nhóm đã tồn tại trong hệ thống"` |
| 5 | `startDate` ở quá khứ / `endDate` không hợp lệ | Rollback và trả 400 |
| 5 | Email invite sai chuẩn | Rollback và trả 400 `"Danh sách email mời có email không hợp lệ"` |
| 7 | Xóa status còn tasks sử dụng | Rollback toàn bộ request |
| 9 | `removeMemberUserIds` chứa owner | Rollback và trả 400 |
| 11 | Gửi email thất bại | Không rollback DB, trả `inviteSummary.failedEmails` |

### Lưu ý kỹ thuật
- Frontend modal create/edit group **không orchestration** các request `statuses`, `labels`, `invites`, `members` riêng lẻ.
- MongoDB local/dev nên chạy **single-node replica set** để transaction hoạt động đúng. Standalone fallback chỉ là cơ chế an toàn tạm thời.

---

## Flow 5 — Mời thành viên & Chấp nhận lời mời

### Mô tả
Owner hoặc admin gửi lời mời qua email, có thể chọn role `admin/member`. Người được mời nhận email, click link, đăng nhập hoặc đăng ký đúng email được mời, rồi chấp nhận lời mời. Luồng accept là idempotent: nếu user đã là thành viên thì API vẫn trả thành công để frontend redirect về chi tiết nhóm.

### Sequence Diagram

```
Owner        Frontend          Backend API          Database        Email        Invitee
 │              │                   │                  │              │             │
 │══════ PHASE 1: GỬI LỜI MỜI ══════                                             │
 │              │                   │                  │              │             │
 │──(1) Nhập email mời──►│          │                  │              │             │
 │              │──(2) POST /groups/:id/invites──►│     │              │             │
 │              │                   │──(3) AuthGuard + Check owner/admin│            │
 │              │                   │──(4) Check email đã là member?──►│            │
 │              │                   │◄──(4a) Không────────│            │            │
 │              │                   │──(5) Nếu đang pending: expire cũ + tạo invite mới │
 │              │                   │                     │            │            │
 │              │                   │──(6) Insert group_invites───────►│            │
 │              │                   │   { groupId, email, role,        │            │
 │              │                   │     inviteToken: UUID,           │            │
 │              │                   │     status: "pending",           │            │
 │              │                   │     expiresAt: now+48h }         │            │
 │              │                   │                     │            │            │
 │              │                   │──(7) Send invite email──────────────►│        │
 │              │                   │   Link: /invite/accept?token=xxx │  │         │
 │              │                   │   Subject: "Bạn được mời vào nhóm {name}"    │
 │              │◄──(8) 201 "Lời mời đã gửi"──│         │            │   │         │
 │◄──(9) Thông báo──│              │            │         │          │   │         │
 │              │                   │            │         │          │   │         │
 │══════ PHASE 2: CHẤP NHẬN LỜI MỜI ══════                         │   │         │
 │              │                   │            │         │          │   │         │
 │              │                   │            │         │     ◄──(10) Mở email──│
 │              │                   │            │         │          │             │
 │              │              ◄──(11) Click link /invite/accept?token=xxx─────────│
 │              │                   │            │         │          │             │
 │              │   [Chưa đăng nhập / chưa có tài khoản] │         │    │         │
 │              │──(12) Redirect /login hoặc /register với redirect invite         │
 │              │              ◄──(13) Đăng nhập hoặc đăng ký + verify xong────────│
 │              │                   │            │         │          │             │
 │              │──(14) POST /groups/invites/accept { token }──►│    │             │
 │              │                   │──(15) Find invite by token──────►│            │
 │              │                   │◄──(15a) Invite record────────────│            │
 │              │                   │                     │            │            │
 │              │                   │──(16) Validate:                  │            │
 │              │                   │   • email user khớp invite?      │            │
 │              │                   │   • status == "pending"?         │            │
 │              │                   │   • expiresAt > now?             │            │
 │              │                   │   • nếu đã là member => success  │            │
 │              │                   │                     │            │            │
 │              │                   │══════ Transaction ══════         │            │
 │              │                   │──(17) Insert group_members──────►│            │
 │              │                   │   { groupId, userId, role:invite.role }       │
 │              │                   │──(18) Update tất cả pending invites──────────►│
 │              │                   │   cùng groupId + email = "accepted"           │
 │              │                   │══════ Commit ══════               │            │
 │              │                   │                     │             │            │
 │              │◄──(19) 200 { groupId, groupName }──│   │             │            │
 │              │──(20) Redirect /groups/:groupId───────────────────────────────────►│
```

### Luồng lỗi

| Bước | Điều kiện lỗi | Xử lý |
|------|---------------|--------|
| 3 | Không phải owner/admin | 403 "Bạn không có quyền mời thành viên vào nhóm này" |
| 4a | Đã là member | 400 "Người dùng đã là thành viên của nhóm" |
| 15a | Token không tồn tại | 400 "Token không hợp lệ" |
| 16 | Đăng nhập sai email được mời | 400 "Lời mời này thuộc về một tài khoản email khác..." |
| 16 | Token hết hạn | 400 "Lời mời đã hết hạn" |

### Ghi chú triển khai
- Frontend phải giữ `redirect` của invite qua login, register và verify-email để khi xác thực xong user quay lại `/invite/accept?token=...`.
- Nếu người dùng click lại cùng invite sau khi đã vào nhóm, frontend vẫn redirect thẳng đến `/groups/:groupId/overview` vì API accept trả success idempotent.
- Group detail frontend dùng nested routes: `/groups/:groupId/overview`, `/tasks`, `/members`.
- Nếu email được mời chưa có tài khoản, người dùng hoàn tất đăng ký và xác nhận email bằng đúng địa chỉ đó rồi mới accept thành công.

---

## Flow 6 — Xóa thành viên khỏi Group

### Mô tả
Owner hoặc admin xóa một thành viên khỏi group. Tasks được giao cho thành viên đó sẽ được unassign.

### Sequence Diagram

```
Owner        Frontend          Backend API          Database
 │              │                   │                  │
 │──(1) Click xóa member──►│        │                  │
 │              │──(2) Hiện confirm dialog              │
 │──(3) Xác nhận──►│               │                   │
 │              │──(4) DELETE /groups/:id/members/:userId──►│
 │              │                   │──(5) AuthGuard + Check owner/admin
 │              │                   │──(6) Check: userId != ownerId?
 │              │                   │   [Bằng nhau] → 400 "Owner không thể tự xóa"
 │              │                   │                  │
 │              │                   │══════ Transaction ══════
 │              │                   │──(7) Delete group_members record──►│
 │              │                   │──(8) Unassign tasks──►│
 │              │                   │   UPDATE tasks SET assigneeId=null
 │              │                   │   WHERE groupId=x AND assigneeId=userId
 │              │                   │══════ Commit ══════
 │              │                   │                  │
 │              │◄──(9) 200 "Đã xóa thành viên"──│    │
 │◄──(10) Cập nhật UI──│           │                   │
```

### Lưu ý
- Khi xóa member, tất cả tasks được assign cho member đó sẽ **unassign** (`assigneeId = null`), không xóa task.
- Owner không thể tự xóa chính mình.
- Admin không thể xóa owner.

---

## Flow 6A — Xóa Group

### Mô tả
Owner xóa toàn bộ group. Đây là thao tác cascade delete ở backend, không yêu cầu frontend tự dọn từng collection liên quan.

### Sequence Diagram

```
Owner        Frontend          Backend API          Database
 │              │                   │                  │
 │──(1) Click "Delete Group"──►│    │                  │
 │              │──(2) Hiện confirm dialog              │
 │──(3) Xác nhận──►│               │                   │
 │              │──(4) DELETE /groups/:id──────────────►│
 │              │                   │──(5) AuthGuard + Check owner
 │              │                   │══════ Transaction ══════
 │              │                   │──(6) Delete task_labels──►│
 │              │                   │──(7) Delete tasks────────►│
 │              │                   │──(8) Delete statuses─────►│
 │              │                   │──(9) Delete labels───────►│
 │              │                   │──(10) Delete group_members►│
 │              │                   │──(11) Delete group_invites►│
 │              │                   │──(12) Delete group────────►│
 │              │                   │══════ Commit ══════
 │              │◄──(13) 200 "Đã xóa nhóm"──│
 │◄──(14) Redirect /groups────────│
```

### Lưu ý
- Chỉ owner mới được xóa nhóm.
- Sau khi xóa thành công, frontend phải clear cache của list/detail/dashboard liên quan đến group đó.

---

## Flow 7 — Tạo Task mới

### Mô tả
Member tạo task mới trong group. Nếu không chọn status, hệ thống tự gán status mặc định (Todo). Attachments không đi chung JSON create task; frontend tạo task trước rồi upload file sau khi đã có `taskId`.

### Sequence Diagram

```
User          Frontend              Backend API              Database
 │               │                       │                      │
 │──(1) Điền thông tin task──►│           │                      │
 │   title, description(HTML),│           │                      │
 │   assigneeId, deadline,    │           │                      │
 │   labelIds, statusId       │           │                      │
 │               │──(2) POST /groups/:id/tasks──►│               │
 │               │                       │──(3) AuthGuard + Check member
 │               │                       │                      │
 │               │                       │──(4) Validate:                   
 │               │                       │   ┌─────────────────────────────┐
 │               │                       │   │ title: trim, required, <=200│
 │               │                       │   │ description: sanitize HTML  │
 │               │                       │   │ plain-text <= 5000 chars    │
 │               │                       │   │ statusId: thuộc groupId?    │
 │               │                       │   │ assigneeId: là member?      │
 │               │                       │   │ deadline: future datetime?  │
 │               │                       │   │ labelIds: thuộc groupId?    │
 │               │                       │   │ labelIds: dedupe, <=20      │
 │               │                       │   └─────────────────────────────┘
 │               │                       │                      │
 │               │                       │  [statusId == null]                 
 │               │                       │──(5) Get default status──►│       
 │               │                       │   WHERE groupId=x, isDefault=true
 │               │                       │◄──(5a) statusId──────│           
 │               │                       │                      │
 │               │                       │══════ Transaction ══════
 │               │                       │──(6) Insert tasks────►│
 │               │                       │   { title, groupId, statusId,
 │               │                       │     creatorId, assigneeId, deadline }
 │               │                       │◄──(6a) taskId────────│
 │               │                       │                      │
 │               │                       │──(7) Bulk insert task_labels──►│
 │               │                       │   [{ taskId, labelId }]       │
 │               │                       │══════ Commit ══════           │
 │               │                       │                      │
 │               │                       │──(8) Populate: status, assignee, labels
 │               │◄──(9) 201 { task }──│                        │
 │◄──(10) Thêm card vào Kanban──│        │                      │
 │               │                                              │
 │ [Có attachments?]                                            │
 │               │──(11) POST /groups/:id/tasks/:taskId/attachments──►│
 │               │                       │──(12) Validate file count/type/size
 │               │                       │──(13) Save metadata + file       │
 │               │◄──(14) 201 { attachments }──│                           │
```

### Lưu ý
- Nếu upload attachment lỗi sau khi task đã được tạo, task **không rollback**. Frontend phải báo warning và cho retry trong task detail.
- `deadline` được nhập và lưu theo `datetime`, dùng cho cron reminder/overdue.

---

## Flow 8 — Cập nhật Task (Drag & Drop Kanban)

### Mô tả
User kéo thả task giữa các cột trên Kanban board, hoặc mở task để sửa thông tin chi tiết.

### Sequence Diagram — Drag & Drop

```
User          Frontend              Backend API              Database
 │               │                       │                      │
 │──(1) Kéo task card──►│                │                      │
 │   từ cột "Todo"       │               │                      │
 │   sang cột "Doing"    │               │                      │
 │               │                       │                      │
 │──(2) Thả task card──►│                │                      │
 │               │──(3) Optimistic UI update                    │
 │               │   (di chuyển card trước)                     │
 │               │                       │                      │
 │               │──(4) PATCH /groups/:id/tasks/:taskId──►│     │
 │               │   { statusId: "doing_status_id" }      │     │
 │               │                       │──(5) Validate: statusId thuộc groupId
 │               │                       │──(6) Update task + reset notification flags
 │               │                       │   statusId = new
 │               │                       │   updatedAt = now
 │               │                       │   [Nếu chuyển sang status có isCompleted=true]
 │               │                       │   → Không cần reset reminder/overdue
 │               │                       │   [Nếu chuyển từ isCompleted=true sang isCompleted=false]
 │               │                       │   → Reset reminderSentAt = null
 │               │                       │   → Reset overdueSentAt = null
 │               │                       │   → Reset overdueSentAt = null
 │               │                       │──(6a) Update──────────►│
 │               │◄──(7) 200 { task }──│                         │
 │               │                       │                       │
 │               │  [Nếu API lỗi]                                │
 │               │──(8) Rollback UI (đưa card về cột cũ)         │
 │◄──(9) Thông báo lỗi──│               │                       │
```

### Sequence Diagram — Edit Task Details

```
User          Frontend              Backend API              Database
 │               │                       │                      │
 │──(1) Click task card──►│              │                      │
 │               │──(2) GET /groups/:id/tasks/:taskId──►│       │
 │               │◄──(3) Task detail──│                         │
 │               │──(4) Hiện modal/drawer edit                  │
 │               │                       │                      │
 │──(5) Sửa fields──►│                  │                      │
 │──(6) Click Save──►│                   │                      │
 │               │──(7) PATCH /groups/:id/tasks/:taskId──►│     │
 │               │   { title?, description?, assigneeId?,  │    │
 │               │     deadline?, labelIds?, statusId? }   │    │
 │               │                       │──(8) Validate submitted fields
 │               │                       │   • title trim <= 200
 │               │                       │   • description sanitize HTML
 │               │                       │   • deadline future datetime nếu field được gửi
 │               │                       │   • labelIds dedupe, <=20
 │               │                       │──(9) Update────────────►│
 │               │                       │   [labelIds changed]    │
 │               │                       │──(10) Delete old task_labels──►│
 │               │                       │──(11) Insert new task_labels──►│
 │               │◄──(12) 200 { task }──│                          │
 │◄──(13) Cập nhật card──│               │                         │
```

### Logic đặc biệt: Reset notification flags
Khi task thay đổi status:
- **Chuyển từ status `isCompleted=true` → status `isCompleted=false`**: Reset `reminderSentAt = null`, `overdueSentAt = null` (để cron job có thể gửi lại nếu sắp/quá deadline)
- **Chuyển sang status `isCompleted=true`**: Không cần gửi nhắc nhở nữa (cron job tự skip vì `status.isCompleted == true`)

### Lưu ý UI
- Board drag-and-drop và List inline status change dùng cùng rule confirm khi chuyển từ completed → non-completed.
- Frontend optimistic update task trên board/list/detail cache trước, rollback nếu mutation lỗi.
- Board mode dùng `GET /groups/:groupId/tasks`.
- List mode dùng endpoint riêng `GET /groups/:groupId/tasks/list`, không flatten board response ở frontend.

---

## Flow 8A — Quản lý Comments của Task

### Mô tả
Comment là text-only, hiển thị trong task detail modal. Author được sửa/xóa comment của mình; owner/admin của group được xóa comment của bất kỳ member nào.

```
Member/Admin    Frontend             Backend API             Database
 │                 │                      │                     │
 │──(1) Nhập comment──►│                 │                     │
 │                 │──(2) POST /comments──►│                  │
 │                 │                      │──(3) Validate trim, non-empty, <=2000
 │                 │                      │──(4) Insert task_comment──►│
 │                 │◄──(5) 201 { comment }──│                   │
 │◄──(6) Thread refresh──│               │                     │
```

### Lưu ý
- Không hỗ trợ HTML, attachment, mentions hay realtime trong phase này.
- `PATCH /comments/:commentId` chỉ cho author.
- `DELETE /comments/:commentId` cho author hoặc owner/admin.

---

## Flow 8B — Quản lý Attachments của Task

### Mô tả
Attachment là resource riêng của task. Metadata lưu trong Mongo, file vật lý lưu qua storage abstraction trên local disk trong phase đầu.

```
Member/Admin    Frontend             Backend API             Storage + DB
 │                 │                      │                     │
 │──(1) Chọn files──►│                   │                     │
 │                 │──(2) POST /attachments──►│               │
 │                 │                      │──(3) Validate:
 │                 │                      │   • <= 10 files/task
 │                 │                      │   • <= 20MB/file
 │                 │                      │   • extension + mime whitelist
 │                 │                      │──(4) Save file──►Storage
 │                 │                      │──(5) Insert task_attachment──►DB
 │                 │◄──(6) 201 { attachments }──│
 │◄──(7) Refresh attachment list──│     │
```

### Lưu ý
- Uploader có thể xóa file của mình.
- Owner/admin có thể xóa file của mọi member trong group.
- Ứng dụng vẫn ưu tiên download file qua endpoint có auth.
- Khi production dùng Vercel Blob public, object có thể được truy cập nếu URL blob bị lộ.

---

## Flow 9 — Xóa Task

### Mô tả
Owner hoặc admin xóa task. Xóa cascade các bản ghi liên quan.

### Sequence Diagram

```
User          Frontend              Backend API              Database
 │               │                       │                      │
 │──(1) Click xóa task──►│               │                      │
 │               │──(2) Hiện confirm "Bạn chắc chắn?"           │
 │──(3) Xác nhận──►│                     │                      │
 │               │──(4) DELETE /groups/:id/tasks/:taskId──►│    │
 │               │                       │──(5) AuthGuard + Check member
 │               │                       │──(6) Load task────────►│
 │               │                       │◄──(6a) task──────────│
 │               │                       │                      │
 │               │                       │──(7) Check permission:
 │               │                       │   user.role in {owner, admin}?
 │               │                       │   [Không] → 403
 │               │                       │                      │
 │               │                       │══════ Transaction ══════
 │               │                       │──(8) Delete task_labels──►│
 │               │                       │   WHERE taskId = x        │
 │               │                       │──(9) Delete task──────────►│
 │               │                       │══════ Commit ══════       │
 │               │                       │                           │
 │               │◄──(10) 200 "Xóa thành công"──│                   │
 │◄──(11) Xóa card khỏi Kanban──│       │                           │
```

---

## Flow 10 — Quản lý Statuses (CRUD)

### Mô tả
Owner quản lý các cột status (workflow) của group. Có thể thêm, sửa, xóa, sắp xếp lại thứ tự.

### Flow 10a — Tạo Status mới

```
Owner        Frontend          Backend API          Database
 │              │                   │                  │
 │──(1) Nhập name, color──►│        │                  │
 │              │──(2) POST /groups/:id/statuses──►│   │
 │              │                   │──(3) Check owner             
 │              │                   │──(4) Auto-generate slug:     
 │              │                   │   "In Review" → "in-review"  
 │              │                   │──(5) Check unique(groupId+slug)──►│
 │              │                   │   [Trùng] → 400 "Status đã tồn tại"
 │              │                   │──(6) Auto-calculate order:        │
 │              │                   │   MAX(order) + 1 trong group      │
 │              │                   │──(7) Insert status──►│            │
 │              │◄──(8) 201 { status }──│                  │            
 │◄──(9) Thêm cột mới vào Kanban──│    │                  │            
```

### Flow 10b — Xóa Status

```
Owner        Frontend          Backend API          Database
 │              │                   │                  │
 │──(1) Click xóa status──►│        │                  │
 │              │──(2) DELETE /groups/:id/statuses/:statusId──►│
 │              │                   │──(3) Check owner             
 │              │                   │──(4) Load status──►│         
 │              │                   │                  │           
 │              │                   │──(5) isDefault == true?      
 │              │                   │   [Có] → 400 "Không thể xóa status mặc định"
 │              │                   │                  │           
 │              │                   │──(6) Count tasks using status──►│
 │              │                   │◄──(6a) count───────│           
 │              │                   │   [count > 0] → 400 "Còn {n} tasks đang dùng"
 │              │                   │                  │           
 │              │                   │──(7) Delete status──►│       
 │              │◄──(8) 200 "Xóa thành công"──│        │           
 │◄──(9) Xóa cột khỏi Kanban──│    │                  │           
```

---

## Flow 11 — Quản lý Labels (CRUD)

### Mô tả
Member có thể tạo label, Owner có thể sửa/xóa label. Xóa label sẽ cascade xóa tất cả liên kết task_labels.

### Flow 11a — Tạo Label

```
User         Frontend          Backend API          Database
 │              │                   │                  │
 │──(1) Nhập name, color──►│        │                  │
 │              │──(2) POST /groups/:id/labels──►│      │
 │              │                   │──(3) Check member            
 │              │                   │──(4) Check unique(groupId+name)──►│
 │              │                   │   [Trùng] → 400 "Label đã tồn tại"
 │              │                   │──(5) Insert label──►│        │
 │              │◄──(6) 201 { label }──│                  │        
 │◄──(7) Thêm vào danh sách label──│   │                 │        
```

### Flow 11b — Xóa Label

```
Owner        Frontend          Backend API          Database
 │              │                   │                  │
 │──(1) Click xóa label──►│         │                  │
 │              │──(2) DELETE /groups/:id/labels/:labelId──►│
 │              │                   │──(3) Check owner
 │              │                   │══════ Transaction ══════
 │              │                   │──(4) Delete task_labels──►│
 │              │                   │   WHERE labelId = x       │
 │              │                   │──(5) Delete label──►│     │
 │              │                   │══════ Commit ══════       │
 │              │◄──(6) 200──│                                 │
 │◄──(7) Cập nhật UI──│    │                                   │
```

---

## Flow 11c — Standalone Task Board

### Mô tả
Trang `/tasks` là board công việc riêng ngoài group detail. Frontend dùng lại cùng task workspace với tab `/groups/:groupId/tasks`, chỉ thêm group selector để thao tác nhanh trên một group đang được chọn.

### Sequence Diagram

```
User          Frontend                 Backend API
 │               │                          │
 │──(1) Mở /tasks──►│                       │
 │               │──(2) GET /groups────────►│
 │               │◄──(3) groups list────────│
 │               │
 │               │──(4) Resolve selected group:
 │               │   priority:
 │               │   groupId query param
 │               │   → localStorage last selected
 │               │   → newest group by createdAt
 │               │
 │               │──(5) GET /groups/:groupId────────►│
 │               │──(6) GET /groups/:groupId/tasks (board)
 │               │   hoặc GET /groups/:groupId/tasks/list (list) ─────►│
 │               │◄──(7) group detail + task workspace data────────────│
 │◄──(8) Render board/list workspace─────────────────│
 │
 │──(9) Đổi group từ selector──►│
 │               │──(10) Update query param groupId
 │               │   + persist localStorage
 │               │   + reset assignee/status/label/date filters
 │               │──(11) Re-fetch /groups/:groupId + /tasks────────►│
 │               │◄──(12) Render workspace của group mới────────────│
```

### Lưu ý
- `/tasks` không phải board cross-group; mỗi thời điểm chỉ thao tác trên đúng 1 group.
- Toàn bộ create task, detail modal, comment, attachment, drag-and-drop và list mode dùng cùng logic với tab task trong group detail.
- Board và List dùng hai endpoint read riêng:
  - board: `GET /groups/:groupId/tasks`
  - list: `GET /groups/:groupId/tasks/list`
- Quyền hiển thị action vẫn lấy từ `GET /groups/:groupId`.

---

## Flow 11d — My Tasks

### Mô tả
Trang `/my-tasks` liệt kê toàn bộ công việc mà current user đang là `assignee`, group theo group và hiển thị ở dạng list. Trang này không có board, không có create task trong v1.

### Sequence Diagram

```
User          Frontend              Backend API              Database
 │               │                       │                      │
 │──(1) Mở /my-tasks──►│                 │                      │
 │               │──(2) Parse query params q/group/status/...   │
 │               │──(3) GET /tasks/my──────────────────────────►│
 │               │                       │──(4) AuthGuard       │
 │               │                       │──(5) Load memberships của user
 │               │                       │──(6) Load tasks có assigneeId = currentUser
 │               │                       │──(7) Join status/labels/group summaries
 │               │                       │──(8) Group theo group + sort việc gấp
 │               │◄──(9) 200 grouped result────────────────────│
 │◄──(10) Render grouped list───────────│                      │
 │               │                                              │
 │──(11) Gõ search / áp filter──►│                              │
 │               │──(12) Re-fetch /tasks/my với filters────────►│
 │               │◄──(13) 200 grouped result───────────────────│
 │◄──(14) Refresh sections────────│                             │
 │               │                                              │
 │──(15) Click một task row──►│                                │
 │               │──(16) GET /groups/:groupId──────────────────►│
 │               │──(17) GET /groups/:groupId/statuses─────────►│
 │               │──(18) GET /groups/:groupId/labels───────────►│
 │               │──(19) GET /groups/:groupId/tasks/:taskId────►│
 │               │◄──(20) Open Task Detail Modal───────────────│
```

### Lưu ý
- `/my-tasks` chỉ hiển thị task được giao cho current user; task user tạo nhưng không assign cho chính mình sẽ không xuất hiện.
- Kết quả được group theo group để frontend không phải regroup ở client.
- `status` và `label` filters là group-scoped; option UI phải hiển thị dạng `Tên group • Tên status/label`.
- Nếu task đổi assignee sang người khác trong Task Detail Modal, task sẽ biến mất khỏi `/my-tasks` sau khi refetch.

---

## Flow 11e — Dashboard cá nhân

### Mô tả
Trang `/dashboard` hiển thị dashboard cá nhân theo current user. Dữ liệu tập trung vào các task đang được giao cho user, những việc cần chú ý và snapshot theo từng group mà user đang có task được assign.

### Sequence Diagram

```
User          Frontend              Backend API              Database
 │               │                       │                      │
 │──(1) Mở /dashboard──►│                │                      │
 │               │──(2) GET /dashboard/me──────────────────────►│
 │               │                       │──(3) AuthGuard       │
 │               │                       │──(4) Load memberships của user
 │               │                       │──(5) Load tasks có assigneeId = currentUser
 │               │                       │──(6) Join groups + statuses
 │               │                       │──(7) Tính summary / attention / recent / group snapshots
 │               │◄──(8) 200 my dashboard data─────────────────│
 │◄──(9) Render header + KPI + attention + recent + groups────│
 │               │                                              │
 │──(10) Click một task preview──►│                            │
 │               │──(11) GET /groups/:groupId─────────────────►│
 │               │──(12) GET /groups/:groupId/statuses────────►│
 │               │──(13) GET /groups/:groupId/labels──────────►│
 │               │──(14) GET /groups/:groupId/tasks/:taskId───►│
 │               │◄──(15) Open Task Detail Modal──────────────│
 ```

### Lưu ý
- Dashboard cá nhân chỉ tính task có `assigneeId = currentUser._id`.
- `attentionTasks` chỉ gồm task chưa hoàn thành bị `overdue` hoặc `due hôm nay`.
- `recentTasks` sort theo `updatedAt desc`, tối đa `5`.
- `completionRate` trong phần theo nhóm là tỷ lệ hoàn thành trên chính task được giao cho current user trong group đó, không phải tiến độ toàn dự án.
- Task mutations như create/update/delete hoặc đổi assignee phải invalidate dashboard cá nhân để homepage tự refresh.

---

## Flow 12 — Dashboard & Thống kê

### Mô tả
Hiển thị tổng quan vận hành của group detail tab `Overview`, bao gồm hero nhóm, KPI cards, phân bổ theo status, khối lượng theo thành viên, công việc mới nhất và công việc cần chú ý.

### Sequence Diagram

```
User          Frontend              Backend API                    Database
 │               │                       │                            │
 │──(1) Mở Dashboard──►│                 │                            │
 │               │──(2) GET /groups/:id/dashboard──►│                 │
 │               │                       │──(3) AuthGuard + Check member
 │               │                       │                            │
 │               │                       │══════ Dashboard Queries ══════
 │               │                       │                            │
 │               │                       │──(4) Count total tasks──────►│
 │               │                       │◄──totalTasks────────────────│
 │               │                       │                            │
 │               │                       │──(5) Group by statusId──────►│
 │               │                       │   db.tasks.aggregate([      │
 │               │                       │     { $match: { groupId } },│
 │               │                       │     { $group: { _id: "$statusId", count: {$sum:1} }}
 │               │                       │   ])                        │
 │               │                       │◄──statusBreakdown───────────│
 │               │                       │                             │
 │               │                       │──(6) Count overdue───────────►│
 │               │                       │   deadline < now             │
 │               │                       │   AND status.isCompleted = false
 │               │                       │◄──overdueCount──────────────│
 │               │                       │                             │
 │               │                       │──(7) Calc completionRate:    │
 │               │                       │   completed = tasks ở status có isCompleted=true
 │               │                       │   (completed / total) * 100 │
 │               │                       │──(8) Group by assigneeId────►│
 │               │                       │   + count done per assignee  │
 │               │                       │◄──tasksByAssignee────────────│
 │               │                       │                             │
 │               │                       │──(9) Find recent tasks──────►│
 │               │                       │   sort createdAt desc, limit 5
 │               │                       │◄──recentTasks────────────────│
 │               │                       │                             │
 │               │                       │──(10) Find attention tasks──►│
 │               │                       │   overdue trước, sau đó upcoming
 │               │                       │   đến hết hôm nay, limit 5
 │               │                       │◄──attentionTasks─────────────│
 │               │                       │                             │
 │               │                       │══════ End Dashboard Queries ══════
 │               │                       │                             │
 │               │◄──(11) 200 { dashboard data }──│                    │
 │◄──(12) Render overview cards──│             │                       │
 │   • Hero nhóm + CTA quản trị                                         │
 │   • KPI cards: total, completed, overdue, completion rate            │
 │   • Status breakdown + workload by assignee                          │
 │   • Recent tasks + attention tasks                                   │
```

---

## Flow 13 — Cron Job: Nhắc nhở trước deadline

### Mô tả
Hệ thống tự động quét mỗi **15 phút** để tìm tasks sắp hết hạn (trong vòng 60 phút) và gửi email nhắc nhở. Trên production Vercel, job này ưu tiên được trigger bởi `Vercel Cron`; nếu backend project ở Hobby thì dùng scheduler ngoài hệ thống làm fallback. Một task sẽ không bị gửi lặp lại nếu trong **60 phút gần nhất** đã có reminder thành công.

### Sequence Diagram

```
                   CRON Scheduler          Backend Service          Database          Email Service
                        │                       │                      │                    │
 ──(trigger @15min)─────►│                       │                      │                    │
                        │──(1) Execute reminder job──►│                 │                    │
                        │                       │                      │                    │
                        │                       │──(2) Query tasks──────►│                   │
                        │                       │   WHERE:              │                    │
                        │                       │     deadline <= now + 60min               │
                        │                       │     AND deadline > now                    │
                        │                       │     AND (reminderSentAt IS NULL           │
                        │                       │          OR reminderSentAt <= now - 60min)│
 │                       │     AND status.isCompleted = false        │
                        │                       │◄──(2a) Tasks list─────│                   │
                        │                       │                      │                    │
                        │                       │  [Không có tasks] → Kết thúc              │
                        │                       │                      │                    │
                        │                       │  [Có tasks] Lặp mỗi task:                │
                        │                       │                      │                    │
                        │                       │──(3) Resolve recipient:                   │
                        │                       │   assignee ?? creator                     │
                        │                       │──(4) Load user email──►│                  │
                        │                       │◄──(4a) email──────────│                   │
                        │                       │                      │                    │
                        │                       │──(5) Send email────────────────────────────►│
                        │                       │   Subject: [Nhắc hạn] Task "xxx" sắp đến hạn
                        │                       │   Body: task name, deadline, link          │
                        │                       │◄──(5a) Sent OK────────────────────────────│
                        │                       │                      │                    │
                        │                       │──(6) Update task──────►│                   │
                        │                       │   reminderSentAt = now │                   │
                        │                       │                       │                    │
                        │                       │  [Lặp task tiếp theo]  │                   │
                        │                       │                       │                    │
                        │◄──(7) Job completed──│                        │                    │
```

### Logic chống spam

```
┌─────────────────────────────────────────────────────────┐
│               ANTI-SPAM MECHANISM                        │
│                                                          │
│  1. Cooldown "reminderSentAt":                           │
│     • NULL → chưa gửi → eligible                        │
│     • <= now - 60 phút → eligible lại                   │
│     • > now - 60 phút → SKIP                            │
│                                                          │
│  2. Khi task được re-open (Done → khác):                 │
 │     • Reset reminderSentAt = NULL (khi isCompleted → !isCompleted)
│     • Cho phép gửi lại nếu sắp hết hạn                  │
│                                                          │
│  3. Khi deadline thay đổi:                               │
│     • Reset reminderSentAt = NULL                        │
│     • Đảm bảo gửi nhắc nhở cho deadline mới             │
│                                                          │
│  4. Khi assignee thay đổi trên task chưa hoàn thành:     │
│     • Reset reminderSentAt = NULL                        │
│     • Reset overdueSentAt = NULL                         │
│     • Người phụ trách mới vẫn nhận reminder đúng         │
│                                                          │
│  5. Query condition đảm bảo:                             │
│     • Chỉ tasks chưa hoàn thành (status.isCompleted = false)
│     • Chỉ tasks trong window 60 phút                    │
│     • Chỉ tasks chưa gửi reminder trong 60 phút gần nhất│
│                                                          │
│  → Một task không bị spam email reminder trong 60 phút │
└─────────────────────────────────────────────────────────┘
```

---

## Flow 14 — Cron Job: Thông báo trễ hạn

### Mô tả
Hệ thống tự động quét mỗi **15 phút** để tìm tasks đã quá hạn và gửi email thông báo. Trên production Vercel, job này ưu tiên được trigger bởi `Vercel Cron`; nếu backend project ở Hobby thì dùng scheduler ngoài hệ thống làm fallback. Mỗi task chỉ gửi **đúng 1 lần** nhờ flag `overdueSentAt`.

### Sequence Diagram

```
                   CRON Scheduler          Backend Service          Database          Email Service
                        │                       │                      │                    │
 ──(trigger @15min)─────►│                       │                      │                    │
                        │──(1) Execute overdue job──►│                  │                    │
                        │                       │                      │                    │
                        │                       │──(2) Query tasks──────►│                   │
                        │                       │   WHERE:              │                    │
                        │                       │     deadline < now                        │
                        │                       │     AND overdueSentAt IS NULL             │
                        │                       │     AND status.isCompleted = false        │
                        │                       │◄──(2a) Tasks list─────│                   │
                        │                       │                      │                    │
                        │                       │  [Có tasks] Lặp mỗi task:                │
                        │                       │                      │                    │
                        │                       │──(3) Resolve recipient:                   │
                        │                       │   assignee ?? creator                     │
                        │                       │──(4) Load user email──►│                  │
                        │                       │                      │                    │
                        │                       │──(5) Send email────────────────────────────►│
                        │                       │   Subject: [Trễ hạn] Task "xxx" đã quá hạn │
                        │                       │   Body: task name, deadline (quá), link    │
                        │                       │                      │                    │
                        │                       │──(6) Update task──────►│                   │
                        │                       │   overdueSentAt = now  │                   │
                        │                       │                       │                    │
                        │◄──(7) Job completed──│                        │                    │
```

### Anti-spam tương tự Flow 13

- `overdueSentAt = NULL` → chưa gửi → gửi & set flag
- Re-open task → reset `overdueSentAt = NULL`
- Thay đổi deadline → reset `overdueSentAt = NULL`

---

## Flow 15 — JWT Authentication Guard

### Mô tả
Middleware/Guard xác thực JWT token cho mọi API yêu cầu đăng nhập. Áp dụng trước tất cả business logic.

### Sequence Diagram

```
Client              AuthGuard              JWT Service           Database
 │                      │                       │                   │
 │──(1) Request + Header──►│                    │                   │
 │   Authorization: Bearer <token>              │                   │
 │                      │                       │                   │
 │                      │  [Header thiếu/sai format]                │
 │                      │──► 401 "Token không được cung cấp"        │
 │                      │                       │                   │
 │                      │──(2) Extract token────►│                   │
 │                      │                       │──(3) Verify signature
 │                      │                       │   + Check expiry   │
 │                      │                       │                   │
 │                      │                       │  [Invalid/Expired] │
 │                      │◄──(3a) Error──────────│                   │
 │◄──401 "Token không hợp lệ hoặc đã hết hạn"──│                  │
 │                      │                       │                   │
 │                      │◄──(3b) Decoded payload│                   │
 │                      │   { sub: userId, email }                  │
 │                      │                       │                   │
 │                      │──(4) Find user by id───────────────────────►│
 │                      │◄──(4a) User record──────────────────────────│
 │                      │                       │                   │
 │                      │  [User not found / deleted]               │
 │                      │──► 401 "Tài khoản không tồn tại"          │
 │                      │                       │                   │
 │                      │──(5) Attach user to request               │
 │                      │   req.user = userDoc                      │
 │                      │                       │                   │
 │                      │──(6) next() → Business Logic              │
```

### Kiểm tra quyền bổ sung (Authorization)

Sau AuthGuard, một số API cần kiểm tra thêm:

```
┌────────────────────────────────────────────────────┐
│            AUTHORIZATION CHECKS                     │
│                                                     │
│  MemberGuard (Check member của group):              │
│    → Query group_members WHERE groupId AND userId   │
│    → 403 nếu không phải member                      │
│                                                     │
│  AdminGuard (Check owner/admin của group):          │
│    → ownerId == currentUser OR role in owner/admin  │
│    → 403 nếu không phải manager                     │
│                                                     │
│  OwnerGuard (Check owner của group):                │
│    → Query group_members WHERE role = "owner"       │
│    → 403 nếu không phải owner                       │
│                                                     │
│  TaskPermissionGuard (Xóa task):                    │
│    → Check user == group owner OR task creator       │
│    → 403 nếu không đủ quyền                         │
│                                                     │
│  Áp dụng:                                           │
│    @UseGuards(AuthGuard, MemberGuard)               │
│    @UseGuards(AuthGuard, AdminGuard)                │
│    @UseGuards(AuthGuard, OwnerGuard)                │
└────────────────────────────────────────────────────┘
```

---

## 📊 Tổng quan tất cả Flows

```
┌─────────────────────────────────────────────────────────────────┐
│                    SYSTEM FLOW MAP                               │
│                                                                  │
│  ┌─── AUTH ──────────────────────────────────────┐               │
│  │  Flow 1: Register → Verify Email → Login      │               │
│  │  Flow 2: Login (Email/Password)               │               │
│  │  Flow 3: Login (Google/Firebase)              │               │
│  │  Flow 15: JWT Guard (tất cả protected APIs)   │               │
│  └───────────────────────────────────────────────┘               │
│                          │                                       │
│                          ▼                                       │
│  ┌─── GROUPS ────────────────────────────────────┐               │
│  │  Flow 4: Create Group (+ auto-seed statuses)  │               │
│  │  Flow 5: Invite Member → Accept → Join        │               │
│  │  Flow 6: Remove Member (+ unassign tasks)     │               │
│  └───────────────────────────────────────────────┘               │
│                          │                                       │
│                          ▼                                       │
│  ┌─── TASKS & DATA ─────────────────────────────┐               │
│  │  Flow 7: Create Task                          │               │
│  │  Flow 8: Update Task / Drag-Drop Kanban       │               │
│  │  Flow 9: Delete Task (cascade)                │               │
│  │  Flow 10: Manage Statuses (CRUD)              │               │
│  │  Flow 11: Manage Labels (CRUD)                │               │
│  └───────────────────────────────────────────────┘               │
│                          │                                       │
│                          ▼                                       │
│  ┌─── MONITORING ────────────────────────────────┐               │
│  │  Flow 12: Dashboard (Aggregation)             │               │
│  │  Flow 13: Cron - Reminder (5min, anti-spam)   │               │
│  │  Flow 14: Cron - Overdue (10min, anti-spam)   │               │
│  └───────────────────────────────────────────────┘               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

> **Ghi chú:** Tài liệu này là phần bổ sung cho [API Specification](./api-specification.md) và [Database Diagram](./database-diagram.drawio.xml). Mọi thay đổi logic cần cập nhật đồng bộ cả 3 tài liệu.
