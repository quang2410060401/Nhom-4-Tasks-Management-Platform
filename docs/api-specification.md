# 📋 Tasks Management Platform — API Specification & SRS

> **Version:** 1.0 (MVP)
> **Tech Stack:** NestJS + MongoDB | ReactJS + Ant Design + TailwindCSS | Docker
> **Base URL:** `{{API_BASE_URL}}/api`

---

## 📑 Mục lục

1. [Quy ước chung](#1-quy-ước-chung)
2. [Epic 1 — Authentication](#2-epic-1--authentication)
3. [Epic 2 — Groups (Dự án)](#3-epic-2--groups-dự-án)
4. [Epic 3 — Tasks (Công việc)](#4-epic-3--tasks-công-việc)
5. [Epic 4 — Dashboard](#5-epic-4--dashboard)
6. [Epic 5 — Email Notifications](#6-epic-5--email-notifications)
7. [Statuses & Labels (Master Data)](#7-statuses--labels-master-data)
8. [Error Codes](#8-error-codes)
9. [Database Schema Summary](#9-database-schema-summary)

---

## 1. Quy ước chung

### 1.1 Authentication Header

Tất cả API yêu cầu xác thực sử dụng JWT Bearer token:

```
Authorization: Bearer <access_token>
```

### 1.2 Response Format

**Success Response:**
```json
{
  "statusCode": 200,
  "message": "Success",
  "data": { ... }
}
```

**Error Response:**
```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```

### 1.3 Pagination

Các API danh sách hỗ trợ pagination:

| Query Param | Type   | Default | Description        |
|-------------|--------|---------|--------------------|
| `page`      | number | 1       | Trang hiện tại     |
| `limit`     | number | 20      | Số items mỗi trang |

**Paginated Response:**
```json
{
  "statusCode": 200,
  "data": {
    "items": [...],
    "meta": {
      "totalItems": 100,
      "itemsPerPage": 20,
      "totalPages": 5,
      "currentPage": 1
    }
  }
}
```

---

## 2. Epic 1 — Authentication

### 2.1 Đăng ký tài khoản

| | |
|---|---|
| **Endpoint** | `POST /auth/register` |
| **Auth** | ❌ Public |
| **SRS Ref** | Epic 1 — 1.1 |

**Request Body:**
```json
{
  "name": "string (required)",
  "email": "string (required, valid email)",
  "password": "string (required, min 6 chars)"
}
```

**Success Response (201):**
```json
{
  "statusCode": 201,
  "message": "Vui lòng kiểm tra email để xác nhận",
  "data": {
    "userId": "ObjectId"
  }
}
```

**Business Rules:**
- Email phải unique
- Password tối thiểu 6 ký tự
- Password hash bằng bcrypt trước khi lưu
- Tạo `verifyToken` (random UUID), hết hạn sau 24h
- Gửi email xác nhận chứa link: `{{FRONTEND_URL}}/verify-email?token={{verifyToken}}`
- Mặc định `emailVerified = false`

**Error Cases:**

| Status | Condition | Message |
|--------|-----------|---------|
| 400 | Email đã tồn tại | "Email đã tồn tại" |
| 400 | Email sai format | "Email không đúng định dạng" |
| 400 | Password < 6 chars | "Password tối thiểu 6 ký tự" |

---

### 2.2 Xác nhận email

| | |
|---|---|
| **Endpoint** | `GET /auth/verify-email?token={{token}}` |
| **Auth** | ❌ Public |
| **SRS Ref** | Epic 1 — 1.2 |

**Success Response (200):**
```json
{
  "statusCode": 200,
  "message": "Email xác nhận thành công"
}
```

**Hành vi hệ thống:**
1. Tìm user theo `verifyToken`
2. Kiểm tra `verifyTokenExpires > now`
3. Set `emailVerified = true`
4. Xóa `verifyToken` và `verifyTokenExpires`

**Error Cases:**

| Status | Condition | Message |
|--------|-----------|---------|
| 400 | Token không tồn tại | "Token không hợp lệ" |
| 400 | Token hết hạn | "Token đã hết hạn, vui lòng đăng ký lại" |

---

### 2.3 Đăng nhập

| | |
|---|---|
| **Endpoint** | `POST /auth/login` |
| **Auth** | ❌ Public |
| **SRS Ref** | Epic 1 — 1.3 |

**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Success Response (200):**
```json
{
  "statusCode": 200,
  "message": "Đăng nhập thành công",
  "data": {
    "accessToken": "jwt_token",
    "user": {
      "_id": "ObjectId",
      "name": "string",
      "email": "string",
      "avatar": "string | null"
    }
  }
}
```

**Business Rules:**
- Kiểm tra `emailVerified === true` trước khi cho login
- JWT payload: `{ sub: userId, email }`
- Token expiry: configurable (mặc định 7 ngày)

**Error Cases:**

| Status | Condition | Message |
|--------|-----------|---------|
| 401 | Email/password sai | "Email và password sai, vui lòng thử lại" |
| 403 | Email chưa verify | "Vui lòng xác nhận email trước khi đăng nhập" |

---

### 2.4 Đăng nhập Google (Firebase)

| | |
|---|---|
| **Endpoint** | `POST /auth/google` |
| **Auth** | ❌ Public |
| **SRS Ref** | Epic 1 — 1.4 |

**Request Body:**
```json
{
  "idToken": "string (Firebase ID token)"
}
```

**Success Response (200):**
```json
{
  "statusCode": 200,
  "data": {
    "accessToken": "jwt_token",
    "user": {
      "_id": "ObjectId",
      "name": "string",
      "email": "string",
      "avatar": "string | null"
    }
  }
}
```

**Hành vi hệ thống:**
1. Verify `idToken` bằng Firebase Admin SDK
2. Extract `email`, `name`, `picture` từ decoded token
3. Tìm user theo `googleId` hoặc `email`
4. Nếu chưa tồn tại → tạo mới với `emailVerified = true`
5. Trả JWT access token

**Error Cases:**

| Status | Condition | Message |
|--------|-----------|---------|
| 401 | Token không hợp lệ | "Google token không hợp lệ" |

---

### 2.5 Lấy thông tin user hiện tại

| | |
|---|---|
| **Endpoint** | `GET /auth/me` |
| **Auth** | ✅ Bearer Token |

**Success Response (200):**
```json
{
  "statusCode": 200,
  "data": {
    "_id": "ObjectId",
    "name": "string",
    "email": "string",
    "avatar": "string | null",
    "emailVerified": true
  }
}
```

---

## 3. Epic 2 — Groups (Dự án)

### 3.1 Tạo nhóm

| | |
|---|---|
| **Endpoint** | `POST /groups` |
| **Auth** | ✅ Bearer Token |
| **SRS Ref** | Epic 2 — 2.1 |

**Request Body:**
```json
{
  "name": "string (required)",
  "description": "string | null",
  "startDate": "YYYY-MM-DD | null",
  "endDate": "YYYY-MM-DD | null",
  "statuses": [
    {
      "_id": "ObjectId (optional, chỉ dùng khi edit)",
      "name": "string (required)",
      "color": "#6B7280",
      "isCompleted": false
    }
  ],
  "labels": [
    {
      "_id": "ObjectId (optional, chỉ dùng khi edit)",
      "name": "string (required)",
      "color": "#6B7280"
    }
  ],
  "inviteEmails": ["member@example.com", "guest@example.com"]
}
```

**Success Response (201):**
```json
{
  "statusCode": 201,
  "data": {
    "_id": "ObjectId",
    "name": "string",
    "description": "string | null",
    "startDate": "ISO date | null",
    "endDate": "ISO date | null",
    "ownerId": "ObjectId",
    "createdAt": "ISO date",
    "inviteSummary": {
      "requested": 2,
      "sent": 1,
      "failedEmails": ["guest@example.com"]
    }
  }
}
```

**Hành vi hệ thống:**
1. Validate tên nhóm unique toàn hệ thống, không phân biệt hoa thường.
2. Tạo record trong `groups` với `ownerId = currentUser._id`.
3. Tạo record trong `group_members` với `role = "owner"`.
4. Nếu `statuses` không truyền, backend auto-seed 3 statuses mặc định.
5. Nếu `statuses` có truyền, backend dùng đúng workflow client gửi, tự gán `order` theo thứ tự mảng và ép item đầu tiên là `isDefault = true`.
6. Tạo `labels` nếu có.
7. Tạo pending invites từ `inviteEmails` nếu có.
8. Toàn bộ thay đổi DB nằm trong 1 transaction. Nếu bất kỳ bước nào lỗi thì rollback toàn bộ.
9. Email lời mời được gửi sau khi commit transaction. Nếu SMTP lỗi, DB không rollback; response phản ánh lỗi qua `inviteSummary.failedEmails`.

**Business Rules:**
- `name` là duy nhất toàn hệ thống, case-insensitive.
- `startDate` không được ở quá khứ.
- `endDate` không được nhỏ hơn `startDate`.
- Nếu không có `startDate` mà có `endDate`, thì `endDate` không được nhỏ hơn ngày hiện tại.
- `inviteEmails` được normalize `trim + lowercase + unique`.
- Nếu có email invite không đúng chuẩn, trả 400 `"Danh sách email mời có email không hợp lệ"`.
- Nếu người được mời đã là thành viên thì trả 400.

**Error Cases:**

| Status | Condition | Message |
|--------|-----------|---------|
| 400 | Tên nhóm bị trùng | "Tên nhóm đã tồn tại trong hệ thống" |
| 400 | `statuses` rỗng | "Nhóm phải có ít nhất 1 status" |
| 400 | `statuses` trùng tên/slug | "Danh sách statuses có tên hoặc slug bị trùng" |
| 400 | `labels` trùng tên | "Danh sách labels có tên bị trùng" |
| 400 | Email invite sai chuẩn | "Danh sách email mời có email không hợp lệ" |
| 400 | `startDate` ở quá khứ | "Ngày bắt đầu không được ở quá khứ" |
| 400 | `endDate < startDate` | "Ngày kết thúc không được nhỏ hơn ngày bắt đầu" |
| 400 | Không có `startDate` nhưng `endDate` ở quá khứ | "Ngày kết thúc không được ở quá khứ" |

---

### 3.2 Xem danh sách nhóm của tôi

| | |
|---|---|
| **Endpoint** | `GET /groups` |
| **Auth** | ✅ Bearer Token |
| **SRS Ref** | Epic 2 — 2.2 |

**Success Response (200):**
```json
{
  "statusCode": 200,
  "data": [
    {
      "_id": "ObjectId",
      "name": "string",
      "description": "string | null",
      "startDate": "ISO date | null",
      "endDate": "ISO date | null",
      "ownerId": "ObjectId",
      "role": "owner | admin | member",
      "memberCount": 5,
      "memberPreview": [
        {
          "userId": "ObjectId",
          "name": "string",
          "avatar": "string | null"
        }
      ],
      "completionRate": 42.5,
      "createdAt": "ISO date"
    }
  ]
}
```

**Business Rules:**
- Chỉ trả groups mà user là member (query qua `group_members`)
- Kèm `role` của user trong mỗi group
- `memberCount` được tính theo số thành viên distinct theo `userId`
- `memberPreview` trả tối đa 3 thành viên để frontend render `Avatar.Group`
- `completionRate` = phần trăm task đã hoàn thành của group, làm tròn 1 chữ số thập phân; trả `0` nếu group chưa có task
- Frontend standalone board route `/tasks` dùng payload này để render group selector và xác định group mặc định hợp lệ

---

### 3.2A Dữ liệu hỗ trợ Group Editor

#### GET /groups/status-presets

| | |
|---|---|
| **Endpoint** | `GET /groups/status-presets?search=&limit=` |
| **Auth** | ✅ Bearer Token |

**Success Response (200):**
```json
{
  "statusCode": 200,
  "data": [
    {
      "key": "todo",
      "name": "Todo",
      "slug": "todo",
      "color": "#3B82F6",
      "isCompleted": false,
      "usageCount": 12
    }
  ]
}
```

#### GET /groups/label-presets

| | |
|---|---|
| **Endpoint** | `GET /groups/label-presets?search=&limit=` |
| **Auth** | ✅ Bearer Token |

**Success Response (200):**
```json
{
  "statusCode": 200,
  "data": [
    {
      "key": "feature:#06B6D4",
      "name": "Feature",
      "color": "#06B6D4",
      "usageCount": 8
    }
  ]
}
```

#### GET /groups/member-candidates

| | |
|---|---|
| **Endpoint** | `GET /groups/member-candidates?search=&limit=` |
| **Auth** | ✅ Bearer Token |

**Success Response (200):**
```json
{
  "statusCode": 200,
  "data": [
    {
      "userId": "ObjectId",
      "name": "string",
      "email": "member@example.com",
      "avatar": "string | null"
    }
  ]
}
```

---

### 3.3 Xem chi tiết nhóm

| | |
|---|---|
| **Endpoint** | `GET /groups/:groupId` |
| **Auth** | ✅ Bearer Token + Member |

**Success Response (200):**
```json
{
  "statusCode": 200,
  "data": {
    "_id": "ObjectId",
    "name": "string",
    "description": "string | null",
    "startDate": "ISO date | null",
    "endDate": "ISO date | null",
    "ownerId": "ObjectId",
    "viewerRole": "owner | admin | member",
    "memberCount": 12,
    "pendingInviteCount": 2,
    "permissions": {
      "canEditGroup": true,
      "canDeleteGroup": false,
      "canInviteMembers": true,
      "canManageMembers": true,
      "canManageRoles": true,
      "canManageStatuses": true,
      "canManageLabels": true,
      "canCreateTasks": true,
      "canManageTasks": true
    },
    "members": [
      {
        "userId": "ObjectId",
        "name": "string",
        "email": "string",
        "avatar": "string | null",
        "role": "owner | admin | member",
        "joinedAt": "ISO date"
      }
    ],
    "invites": [
      {
        "_id": "ObjectId",
        "email": "pending@example.com",
        "role": "admin | member",
        "status": "pending",
        "invitedAt": "ISO date",
        "expiresAt": "ISO date",
        "userId": "ObjectId | null",
        "name": "string | null",
        "avatar": "string | null"
      }
    ],
    "createdAt": "ISO date"
  }
}
```

**Error Cases:**

| Status | Condition | Message |
|--------|-----------|---------|
| 403 | User không phải member | "Bạn không có quyền truy cập nhóm này" |
| 404 | Group không tồn tại | "Nhóm không tồn tại" |

**Business Rules:**
- `members` được dedupe theo `userId`, ưu tiên `owner` nếu dữ liệu membership cũ bị trùng.
- `viewerRole` và `permissions` được tính sẵn để frontend render nested routes `overview / tasks / members`.
- `invites` chỉ trả lời mời `pending` còn hạn, lấy bản ghi mới nhất theo từng email.
- Email đã trở thành thành viên thật sẽ không còn xuất hiện trong `invites`.

---

### 3.3A Cập nhật nhóm (Aggregate save)

| | |
|---|---|
| **Endpoint** | `PATCH /groups/:groupId` |
| **Auth** | ✅ Bearer Token + Owner/Admin |

**Request Body:**
```json
{
  "name": "string (optional)",
  "description": "string | null",
  "startDate": "YYYY-MM-DD | null",
  "endDate": "YYYY-MM-DD | null",
  "statuses": [
    {
      "_id": "ObjectId (optional)",
      "name": "string (required)",
      "color": "#6B7280",
      "isCompleted": false
    }
  ],
  "labels": [
    {
      "_id": "ObjectId (optional)",
      "name": "string (required)",
      "color": "#6B7280"
    }
  ],
  "inviteEmails": ["new.member@example.com"],
  "removeMemberUserIds": ["ObjectId"]
}
```

**Success Response (200):**
```json
{
  "statusCode": 200,
  "data": {
    "_id": "ObjectId",
    "name": "string",
    "description": "string | null",
    "startDate": "ISO date | null",
    "endDate": "ISO date | null",
    "ownerId": "ObjectId",
    "createdAt": "ISO date",
    "updatedAt": "ISO date",
    "inviteSummary": {
      "requested": 1,
      "sent": 1,
      "failedEmails": []
    }
  }
}
```

**Hành vi hệ thống:**
1. Backend diff server-side giữa dữ liệu hiện có và `statuses[]` / `labels[]` được gửi.
2. Item có `_id` thì update, item không có `_id` thì create, item cũ bị thiếu khỏi payload thì delete.
3. Nếu xóa member, backend xóa `group_members` và unassign toàn bộ tasks đang giao cho user đó trong group.
4. `removeMemberUserIds` không được chứa owner.
5. Toàn bộ thay đổi DB được bọc trong 1 transaction. Email mời tiếp tục được gửi sau commit và trả `inviteSummary`.
6. `inviteEmails` trong aggregate update cho phép resend lời mời đang pending; mỗi lần gửi lại tạo token mới.

**Error Cases:**

| Status | Condition | Message |
|--------|-----------|---------|
| 400 | Đổi tên thành tên đã tồn tại | "Tên nhóm đã tồn tại trong hệ thống" |
| 400 | Xóa owner khỏi nhóm | "Owner không thể tự xóa khỏi nhóm" |
| 400 | Xóa status còn task sử dụng | "Không thể xóa, còn N tasks đang sử dụng status này" |
| 400 | Email invite sai chuẩn | "Danh sách email mời có email không hợp lệ" |
| 400 | `startDate` ở quá khứ | "Ngày bắt đầu không được ở quá khứ" |
| 400 | `endDate < startDate` | "Ngày kết thúc không được nhỏ hơn ngày bắt đầu" |
| 404 | Group không tồn tại | "Nhóm không tồn tại" |

**Ghi chú:**
- Các endpoint granular `/groups/:groupId/statuses`, `/labels`, `/invites`, `/members/:userId` vẫn được giữ cho các thao tác đơn lẻ hoặc màn quản trị riêng.
- Modal create/edit group ở frontend phải dùng aggregate endpoint này, không tự orchestration nhiều request con.

---

### 3.4 Mời thành viên

| | |
|---|---|
| **Endpoint** | `POST /groups/:groupId/invites` |
| **Auth** | ✅ Bearer Token + Owner/Admin |
| **SRS Ref** | Epic 2 — 2.3 |

**Request Body:**
```json
{
  "email": "string (required)",
  "role": "admin | member (optional, default: member)"
}
```

**Success Response (201):**
```json
{
  "statusCode": 201,
  "message": "Lời mời đã được gửi"
}
```

**Hành vi hệ thống:**
1. Kiểm tra user hiện tại là owner hoặc admin của group
2. Nếu email đã là thành viên thật của nhóm thì chặn request
3. Nếu email đang có invite pending thì invite cũ bị expire và backend tạo invite mới với token mới nhất, role mới nhất
4. Tạo record `group_invites` với `inviteToken` (UUID), `role`, hết hạn 48h
5. Gửi email chứa link: `{{FRONTEND_URL}}/invite/accept?token={{inviteToken}}`

**Error Cases:**

| Status | Condition | Message |
|--------|-----------|---------|
| 403 | Không phải owner/admin | "Bạn không có quyền thực hiện hành động này" |
| 400 | Email đã là member | "Người dùng đã là thành viên của nhóm" |

---

### 3.5 Chấp nhận lời mời

| | |
|---|---|
| **Endpoint** | `POST /groups/invites/accept` |
| **Auth** | ✅ Bearer Token |
| **SRS Ref** | Epic 2 — 2.4 |

**Request Body:**
```json
{
  "token": "string (invite token)"
}
```

**Success Response (200):**
```json
{
  "statusCode": 200,
  "message": "Bạn đã tham gia nhóm thành công",
  "data": {
    "groupId": "ObjectId",
    "groupName": "string"
  }
}
```

**Hành vi hệ thống:**
1. Tìm invite theo `inviteToken`
2. Validate email của user hiện tại phải khớp email trên lời mời
3. Nếu user đã là member của nhóm thì trả success idempotent với `groupId`, `groupName`
4. Nếu invite còn `pending` và còn hạn, thêm user vào `group_members` với `role = invite.role`
5. Đánh dấu toàn bộ invite `pending` cùng `groupId + email` sang `accepted`

**Error Cases:**

| Status | Condition | Message |
|--------|-----------|---------|
| 400 | Token sai | "Token không hợp lệ" |
| 400 | Token hết hạn | "Lời mời đã hết hạn" |
| 400 | Đăng nhập sai email được mời | "Lời mời này thuộc về một tài khoản email khác. Vui lòng đăng nhập đúng email được mời" |

---

### 3.5A Cập nhật vai trò thành viên

| | |
|---|---|
| **Endpoint** | `PATCH /groups/:groupId/members/:userId/role` |
| **Auth** | ✅ Bearer Token + Owner/Admin |

**Request Body:**
```json
{
  "role": "admin | member"
}
```

**Business Rules:**
- Không thể thay đổi vai trò của owner.
- Chỉ thao tác trên thành viên đã accepted.

---

### 3.5B Thu hồi lời mời pending

| | |
|---|---|
| **Endpoint** | `DELETE /groups/:groupId/invites/:inviteId` |
| **Auth** | ✅ Bearer Token + Owner/Admin |

**Success Response (200):**
```json
{
  "statusCode": 200,
  "message": "Đã thu hồi lời mời"
}
```

---

### 3.6 Xóa nhóm

| | |
|---|---|
| **Endpoint** | `DELETE /groups/:groupId` |
| **Auth** | ✅ Bearer Token + Owner |

**Success Response (200):**
```json
{
  "statusCode": 200,
  "message": "Đã xóa nhóm"
}
```

**Hành vi hệ thống:**
1. Chỉ owner mới có quyền xóa nhóm
2. Xóa cascade toàn bộ dữ liệu liên quan của group: `tasks`, `task_labels`, `statuses`, `labels`, `group_members`, `group_invites`
3. Xóa record `groups`

**Error Cases:**

| Status | Condition | Message |
|--------|-----------|---------|
| 403 | Không phải owner | "Bạn không có quyền thực hiện hành động này" |
| 404 | Group không tồn tại | "Nhóm không tồn tại" |

---

### 3.7 Xóa thành viên khỏi nhóm

| | |
|---|---|
| **Endpoint** | `DELETE /groups/:groupId/members/:userId` |
| **Auth** | ✅ Bearer Token + Owner/Admin |

**Success Response (200):**
```json
{
  "statusCode": 200,
  "message": "Đã xóa thành viên khỏi nhóm"
}
```

**Error Cases:**

| Status | Condition | Message |
|--------|-----------|---------|
| 403 | Không phải owner/admin | "Bạn không có quyền thực hiện hành động này" |
| 400 | Xóa owner | "Owner không thể tự xóa khỏi nhóm" |

---

## 4. Epic 3 — Tasks (Công việc)

### 4.1 Tạo công việc

| | |
|---|---|
| **Endpoint** | `POST /groups/:groupId/tasks` |
| **Auth** | ✅ Bearer Token + Member |
| **SRS Ref** | Epic 3 — 3.1 |

**Request Body:**
```json
{
  "title": "string (required)",
  "description": "string | null (optional, sanitized HTML)",
  "statusId": "ObjectId (optional, default: group's Todo status)",
  "assigneeId": "ObjectId (optional, must be group member)",
  "deadline": "ISO 8601 datetime (optional, future only)",
  "labelIds": ["ObjectId"]
}
```

**Success Response (201):**
```json
{
  "statusCode": 201,
  "data": {
    "_id": "ObjectId",
    "title": "string",
    "description": "string | null",
    "groupId": "ObjectId",
    "statusId": "ObjectId",
    "status": { "_id": "...", "name": "Todo", "color": "#3B82F6" },
    "assigneeId": "ObjectId | null",
    "assignee": { "_id": "...", "name": "...", "avatar": "..." },
    "creatorId": "ObjectId",
    "deadline": "ISO 8601 datetime | null",
    "labels": [{ "_id": "...", "name": "...", "color": "..." }],
    "createdAt": "ISO date"
  }
}
```

**Business Rules:**
- Chỉ member trong group được tạo task
- `creatorId` tự động set = currentUser._id
- `title` được `trim()` trước khi validate, không cho phép rỗng/whitespace-only, tối đa `200` ký tự
- `description` là rich text tối giản, được sanitize theo whitelist tags: `p`, `br`, `strong`, `em`, `ul`, `ol`, `li`, `a`, `blockquote`, `code`
- `description` được giới hạn theo plain text tối đa `5000` ký tự; nội dung rỗng sau sanitize sẽ lưu `null`
- `statusId` nếu không truyền → lấy status có `isDefault = true` của group
- `statusId` phải thuộc cùng `groupId`
- `assigneeId` phải là accepted member của group
- `labelIds` là optional, được dedupe ở backend và tối đa `20` labels mỗi task
- `deadline` nếu truyền phải là thời điểm tương lai (`> now`)

**Error Cases:**

| Status | Condition | Message |
|--------|-----------|---------|
| 403 | Không phải member | "Bạn không phải thành viên của nhóm này" |
| 400 | statusId không thuộc group | "Status không hợp lệ cho nhóm này" |
| 400 | assigneeId không phải member | "Người được giao phải là thành viên của nhóm" |

---

### 4.2 Lấy danh sách tasks (Kanban View)

| | |
|---|---|
| **Endpoint** | `GET /groups/:groupId/tasks` |
| **Auth** | ✅ Bearer Token + Member |
| **SRS Ref** | Epic 3 — 3.4 |

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `assigneeIds` | string (comma-separated) | Lọc theo nhiều người được giao |
| `assigneeId` | ObjectId | Legacy fallback để tương thích URL cũ; backend sẽ merge cùng `assigneeIds` nếu có |
| `labelIds` | string (comma-separated) | Lọc theo labels |
| `statusIds` | string (comma-separated) | Lọc theo statuses |
| `dateFrom` | ISO 8601 datetime | Lọc `deadline >= dateFrom` |
| `dateTo` | ISO 8601 datetime | Lọc `deadline <= dateTo` |
| `search` | string | Tìm theo title |

**Success Response (200):**
```json
{
  "statusCode": 200,
  "data": {
    "statuses": [
      {
        "_id": "ObjectId",
        "name": "Todo",
        "slug": "todo",
        "color": "#3B82F6",
        "order": 1,
        "isCompleted": false,
        "tasks": [
          {
            "_id": "ObjectId",
            "title": "string",
            "description": "string | null",
            "assignee": { "_id": "...", "name": "...", "avatar": "..." },
            "deadline": "ISO 8601 datetime | null",
            "labels": [{ "_id": "...", "name": "...", "color": "..." }],
            "createdAt": "ISO date"
          }
        ]
      }
    ]
  }
}
```

**Hành vi hệ thống:**
- Lấy tất cả statuses của group.
- Backend trả statuses chưa hoàn thành trước, completed statuses ở cuối; trong cùng nhóm vẫn giữ `order`.
- Mỗi status kèm danh sách tasks thuộc status đó.
- Nếu đồng thời truyền `assigneeIds` và `assigneeId`, backend sẽ merge hai nguồn filter theo kiểu union.
- Populate `assignee`, `labels`.

---

### 4.2A Lấy danh sách tasks (List View)

| | |
|---|---|
| **Endpoint** | `GET /groups/:groupId/tasks/list` |
| **Auth** | ✅ Bearer Token + Member |
| **SRS Ref** | Epic 3 — 3.4A |

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `assigneeIds` | string (comma-separated) | Lọc theo nhiều người được giao |
| `assigneeId` | ObjectId | Legacy fallback để tương thích URL cũ; backend sẽ merge cùng `assigneeIds` nếu có |
| `labelIds` | string (comma-separated) | Lọc theo labels |
| `statusIds` | string (comma-separated) | Lọc theo statuses |
| `dateFrom` | ISO 8601 datetime | Lọc `deadline >= dateFrom` |
| `dateTo` | ISO 8601 datetime | Lọc `deadline <= dateTo` |
| `search` | string | Tìm theo title |

**Success Response (200):**
```json
{
  "statusCode": 200,
  "data": {
    "tasks": [
      {
        "_id": "ObjectId",
        "title": "string",
        "description": "string | null",
        "assignee": { "_id": "...", "name": "...", "avatar": "..." },
        "deadline": "ISO 8601 datetime | null",
        "labels": [{ "_id": "...", "name": "...", "color": "..." }],
        "createdAt": "ISO date",
        "updatedAt": "ISO date",
        "statusId": "ObjectId",
        "statusName": "Doing",
        "statusColor": "#F59E0B",
        "statusIsCompleted": false
      }
    ]
  }
}
```

**Hành vi hệ thống:**
- Dùng cùng bộ filter nghiệp vụ với kanban endpoint.
- Response được flatten sẵn theo item để phục vụ list mode.
- Frontend list mode không cần tự flatten từ board response nữa.

---

### 4.2B Lấy danh sách công việc được giao cho tôi

| | |
|---|---|
| **Endpoint** | `GET /tasks/my` |
| **Auth** | ✅ Bearer Token |

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Tìm theo title |
| `groupIds` | string (comma-separated) | Lọc theo nhiều group |
| `statusIds` | string (comma-separated) | Lọc theo nhiều status |
| `labelIds` | string (comma-separated) | Lọc theo nhiều label |
| `dateFrom` | ISO 8601 datetime | Lọc `deadline >= dateFrom` |
| `dateTo` | ISO 8601 datetime | Lọc `deadline <= dateTo` |

**Success Response (200):**
```json
{
  "statusCode": 200,
  "data": {
    "groups": [
      {
        "group": {
          "groupId": "ObjectId",
          "name": "Marketing Team",
          "role": "member",
          "memberCount": 6
        },
        "tasks": [
          {
            "taskId": "ObjectId",
            "groupId": "ObjectId",
            "title": "Thiết kế landing page",
            "deadline": "2026-03-20T10:00:00.000Z",
            "createdAt": "2026-03-15T02:00:00.000Z",
            "updatedAt": "2026-03-15T04:00:00.000Z",
            "status": {
              "statusId": "ObjectId",
              "name": "Doing",
              "color": "#F59E0B",
              "isCompleted": false
            },
            "labels": [
              { "_id": "ObjectId", "name": "SEO", "color": "#10B981" }
            ]
          }
        ],
        "total": 3
      }
    ],
    "filterOptions": {
      "groups": [
        {
          "groupId": "ObjectId",
          "name": "Marketing Team",
          "role": "member",
          "memberCount": 6
        }
      ],
      "statuses": [
        {
          "groupId": "ObjectId",
          "groupName": "Marketing Team",
          "statusId": "ObjectId",
          "name": "Doing",
          "color": "#F59E0B",
          "isCompleted": false
        }
      ],
      "labels": [
        {
          "groupId": "ObjectId",
          "groupName": "Marketing Team",
          "labelId": "ObjectId",
          "name": "SEO",
          "color": "#10B981"
        }
      ]
    },
    "totals": {
      "taskCount": 3,
      "groupCount": 1
    }
  }
}
```

**Hành vi hệ thống:**
- Chỉ trả các task có `assigneeId = currentUser._id`
- Chỉ trả task thuộc các group mà current user vẫn còn là member
- Response được group theo group để frontend render section list trực tiếp
- Tasks trong mỗi group được sort: quá hạn trước, sau đó `deadline asc`, rồi `createdAt desc`
- `filterOptions.statuses` và `filterOptions.labels` luôn mang kèm `groupId` + `groupName` vì status/label là group-scoped

---

### 4.3 Cập nhật công việc

| | |
|---|---|
| **Endpoint** | `PATCH /groups/:groupId/tasks/:taskId` |
| **Auth** | ✅ Bearer Token + Member |
| **SRS Ref** | Epic 3 — 3.2 |

**Request Body (partial update):**
```json
{
  "title": "string (optional)",
  "description": "string | null (optional, sanitized HTML)",
  "statusId": "ObjectId (optional)",
  "assigneeId": "ObjectId | null (optional)",
  "deadline": "ISO 8601 datetime | null (optional)",
  "labelIds": ["ObjectId"]
}
```

**Success Response (200):**
```json
{
  "statusCode": 200,
  "data": { "...task object..." }
}
```

**Business Rules:**
- Chỉ member trong group được sửa
- `updatedAt` tự động cập nhật
- `title` nếu được gửi sẽ `trim()` và validate như create
- `description` nếu được gửi sẽ sanitize và normalize như create; `null` dùng để xóa mô tả
- Validate `statusId` thuộc cùng `groupId`
- Validate `assigneeId` là accepted member; `null` dùng để unassign
- `labelIds` nếu được gửi sẽ thay thế toàn bộ labels cũ, backend dedupe và validate tối đa `20`
- `deadline` chỉ được validate khi client thực sự gửi field này; `null` dùng để xóa deadline
- Nếu task chuyển từ status `isCompleted=true` sang status `isCompleted=false`, backend reset `reminderSentAt` và `overdueSentAt`

---

### 4.4 Xóa công việc

| | |
|---|---|
| **Endpoint** | `DELETE /groups/:groupId/tasks/:taskId` |
| **Auth** | ✅ Bearer Token + Owner/Admin |
| **SRS Ref** | Epic 3 — 3.3 |

**Success Response (200):**
```json
{
  "statusCode": 200,
  "message": "Xóa task thành công"
}
```

**Business Rules:**
- Chỉ **owner** hoặc **admin** của group được xóa.
- Xóa luôn các records liên quan trong `task_labels`.

**Error Cases:**

| Status | Condition | Message |
|--------|-----------|---------|
| 403 | Không đủ quyền | "Bạn không có quyền xóa task này" |
| 404 | Task không tồn tại | "Task không tồn tại" |

---

### 4.5 Lấy chi tiết task

| | |
|---|---|
| **Endpoint** | `GET /groups/:groupId/tasks/:taskId` |
| **Auth** | ✅ Bearer Token + Member |

**Success Response (200):**
```json
{
  "statusCode": 200,
  "data": {
    "_id": "ObjectId",
    "title": "string",
    "description": "string | null",
    "groupId": "ObjectId",
    "status": { "_id": "...", "name": "...", "color": "..." },
    "assignee": { "_id": "...", "name": "...", "avatar": "..." },
    "creator": { "_id": "...", "name": "..." },
    "deadline": "ISO 8601 datetime | null",
    "labels": [{ "_id": "...", "name": "...", "color": "..." }],
    "attachments": [
      {
        "_id": "ObjectId",
        "originalName": "brief.pdf",
        "storedName": "1710400000-uuid.pdf",
        "mimeType": "application/pdf",
        "size": 124000,
        "uploadedBy": { "_id": "...", "name": "...", "avatar": "..." },
        "createdAt": "ISO date"
      }
    ],
    "commentCount": 3,
    "reminderSentAt": "ISO date | null",
    "overdueSentAt": "ISO date | null",
    "createdAt": "ISO date",
    "updatedAt": "ISO date"
  }
}
```

---

### 4.6 Lấy danh sách bình luận của task

| | |
|---|---|
| **Endpoint** | `GET /groups/:groupId/tasks/:taskId/comments` |
| **Auth** | ✅ Bearer Token + Member |

**Success Response (200):**
```json
{
  "statusCode": 200,
  "data": [
    {
      "_id": "ObjectId",
      "content": "Nội dung bình luận",
      "author": { "_id": "...", "name": "...", "avatar": "..." },
      "createdAt": "ISO date",
      "updatedAt": "ISO date",
      "isEdited": false
    }
  ]
}
```

**Business Rules:**
- Bình luận là text-only, không hỗ trợ HTML hay attachment trong phase này
- Danh sách được sort tăng dần theo `createdAt`

---

### 4.7 Tạo bình luận cho task

| | |
|---|---|
| **Endpoint** | `POST /groups/:groupId/tasks/:taskId/comments` |
| **Auth** | ✅ Bearer Token + Member |

**Request Body:**
```json
{
  "content": "string (required, text-only)"
}
```

**Business Rules:**
- `content` được `trim()` trước khi validate
- Không cho phép rỗng/whitespace-only
- Tối đa `2000` ký tự

---

### 4.8 Cập nhật bình luận

| | |
|---|---|
| **Endpoint** | `PATCH /groups/:groupId/tasks/:taskId/comments/:commentId` |
| **Auth** | ✅ Bearer Token + Member |

**Business Rules:**
- Chỉ author của comment mới được sửa
- Nếu nội dung sau trim giống hệt cũ, backend short-circuit và không đổi timestamp

---

### 4.9 Xóa bình luận

| | |
|---|---|
| **Endpoint** | `DELETE /groups/:groupId/tasks/:taskId/comments/:commentId` |
| **Auth** | ✅ Bearer Token + Member |

**Business Rules:**
- Author của comment được xóa comment của mình
- `owner/admin` của group được xóa comment của bất kỳ member nào

---

### 4.10 Tải tệp đính kèm cho task

| | |
|---|---|
| **Endpoint** | `POST /groups/:groupId/tasks/:taskId/attachments` |
| **Auth** | ✅ Bearer Token + Member |
| **Content-Type** | `multipart/form-data` |

**Request Body:**
- Field upload: `files`

**Business Rules:**
- Tối đa `10` tệp active trên mỗi task
- Tối đa `20MB` mỗi tệp
- Chặn file rỗng
- Tên tệp tối đa `255` ký tự sau normalize
- Chỉ chấp nhận:
  - documents: `pdf`, `doc`, `docx`, `xls`, `xlsx`, `ppt`, `pptx`, `txt`, `csv`
  - images: `png`, `jpg`, `jpeg`, `webp`, `gif`
  - archives: `zip`
- Backend validate theo `extension + mime type`

---

### 4.11 Tải xuống / xóa tệp đính kèm

| | |
|---|---|
| **Download** | `GET /groups/:groupId/tasks/:taskId/attachments/:attachmentId` |
| **Delete** | `DELETE /groups/:groupId/tasks/:taskId/attachments/:attachmentId` |
| **Auth** | ✅ Bearer Token + Member |

**Business Rules:**
- Uploader được xóa tệp của mình
- `owner/admin` được xóa tệp của bất kỳ member nào
- Ứng dụng hiện ưu tiên truy cập tệp qua endpoint có auth
- Khi triển khai production với Vercel Blob public, object vẫn có public URL nếu pathname bị lộ

---

## 5. Epic 4 — Dashboard

### 5.0 Dashboard cá nhân

| | |
|---|---|
| **Endpoint** | `GET /dashboard/me` |
| **Auth** | ✅ Bearer Token |
| **SRS Ref** | Epic 4 — Homepage dashboard cá nhân |

**Success Response (200):**
```json
{
  "statusCode": 200,
  "data": {
    "summary": {
      "assignedTasks": 12,
      "openTasks": 8,
      "completedTasks": 4,
      "dueTodayCount": 2,
      "overdueCount": 1,
      "groupCount": 3
    },
    "attentionTasks": [
      {
        "taskId": "ObjectId",
        "title": "Fix reminder cron",
        "deadline": "ISO 8601 datetime | null",
        "updatedAt": "ISO 8601 datetime",
        "kind": "overdue",
        "group": {
          "groupId": "ObjectId",
          "name": "TaskMaster",
          "role": "owner | admin | member"
        },
        "status": {
          "statusId": "ObjectId",
          "name": "Doing",
          "color": "#F59E0B",
          "isCompleted": false
        }
      }
    ],
    "recentTasks": [
      {
        "taskId": "ObjectId",
        "title": "Cập nhật tài liệu API",
        "deadline": "ISO 8601 datetime | null",
        "updatedAt": "ISO 8601 datetime",
        "group": {
          "groupId": "ObjectId",
          "name": "TaskMaster",
          "role": "owner | admin | member"
        },
        "status": {
          "statusId": "ObjectId",
          "name": "Done",
          "color": "#10B981",
          "isCompleted": true
        }
      }
    ],
    "groups": [
      {
        "groupId": "ObjectId",
        "name": "TaskMaster",
        "role": "owner",
        "assignedTasks": 6,
        "openTasks": 4,
        "completedTasks": 2,
        "dueTodayCount": 1,
        "overdueCount": 1,
        "completionRate": 33.3,
        "nextDeadline": "ISO 8601 datetime | null"
      }
    ]
  }
}
```

**Business Rules:**
- Chỉ tính task có `assigneeId = currentUser._id`
- Không tính task của group mà user không còn là member
- `attentionTasks`: tối đa `5` task chưa hoàn thành, chỉ gồm `overdue` hoặc `due hôm nay`
- `recentTasks`: tối đa `5` task, sort `updatedAt desc`
- `groups[]`: chỉ gồm group mà user đang có task được giao
- `completionRate` trong `groups[]` là tỷ lệ hoàn thành trên chính task được giao cho current user trong group đó

### 5.1 Dashboard nhóm

| | |
|---|---|
| **Endpoint** | `GET /groups/:groupId/dashboard` |
| **Auth** | ✅ Bearer Token + Member |
| **SRS Ref** | Epic 4 — 4.1 |

**Success Response (200):**
```json
{
  "statusCode": 200,
  "data": {
    "totalTasks": 50,
    "completedTasks": 15,
    "statusBreakdown": [
      { "statusId": "...", "name": "Todo", "color": "#3B82F6", "isCompleted": false, "count": 15 },
      { "statusId": "...", "name": "Doing", "color": "#F59E0B", "isCompleted": false, "count": 20 },
      { "statusId": "...", "name": "Done", "color": "#10B981", "isCompleted": true, "count": 15 }
    ],
    "overdueCount": 3,
    "completionRate": 30.0,
    "tasksByAssignee": [
      {
        "userId": "ObjectId",
        "name": "string",
        "avatar": "string | null",
        "total": 10,
        "done": 5
      }
    ],
    "recentTasks": [
      {
        "taskId": "ObjectId",
        "title": "string",
        "createdAt": "ISO 8601 datetime",
        "deadline": "ISO 8601 datetime | null",
        "assignee": {
          "userId": "ObjectId",
          "name": "string",
          "avatar": "string | null"
        },
        "status": {
          "statusId": "ObjectId",
          "name": "string",
          "color": "#3B82F6",
          "isCompleted": false
        }
      }
    ],
    "attentionTasks": [
      {
        "taskId": "ObjectId",
        "title": "string",
        "createdAt": "ISO 8601 datetime",
        "deadline": "ISO 8601 datetime | null",
        "assignee": null,
        "status": {
          "statusId": "ObjectId",
          "name": "string",
          "color": "#F59E0B",
          "isCompleted": false
        },
        "kind": "overdue"
      }
    ]
  }
}
```

**Business Rules:**
- `overdueCount`: tasks có `deadline < now` AND status `isCompleted = false`
- `completedTasks`: tổng tasks ở các status có `isCompleted = true`
- `completionRate`: `(completed_count / totalTasks) * 100` (làm tròn 1 chữ số), trong đó `completed_count` = tổng tasks có status `isCompleted = true`
- `statusBreakdown`: đếm tasks theo từng status của group (dynamic, không hardcode)
- `tasksByAssignee`: thống kê theo từng member, `done` = tasks ở các status có `isCompleted = true`
- `recentTasks`: lấy tối đa `5` task mới nhất theo `createdAt desc`
- `attentionTasks`: lấy tối đa `5` task chưa hoàn thành có `deadline != null`, ưu tiên `overdue` trước rồi đến `upcoming` đến hết hôm nay

---

## 6. Epic 5 — Email Notifications

> **Lưu ý:** Ở local/dev, cron có thể chạy bằng NestJS `@Cron` nếu `ENABLE_INTERNAL_CRON=true`. Ở production trên Vercel, ưu tiên dùng `Vercel Cron` gọi vào internal endpoint bảo vệ bằng `CRON_SECRET` nếu project không ở Hobby; `GitHub Actions schedule` chỉ là fallback cho Hobby.

### 6.1 Nhắc trước deadline (Cron Job)

| | |
|---|---|
| **Trigger** | `Vercel Cron` `*/15 * * * *` gọi internal endpoint khi project hỗ trợ; `GitHub Actions schedule` là fallback cho Hobby; local có thể dùng `@Cron('*/15 * * * *')` |
| **SRS Ref** | Epic 5 — 5.1 |

**Logic:**
```
Tìm tất cả tasks thỏa:
  - deadline <= now + 60 phút
  - deadline > now
  - reminderSentAt = null
  - status.isCompleted = false

Với mỗi task:
  1. Gửi email đến assignee (hoặc creator nếu không có assignee)
  2. Set reminderSentAt = now
```

**Email Template:**
- Subject: `[Nhắc hạn] Task "{title}" sắp đến hạn`
- Body: Tên task, deadline, link đến task

---

### 6.2 Thông báo trễ hạn (Cron Job)

| | |
|---|---|
| **Trigger** | Scheduler ngoài hệ thống / GitHub Actions `*/15 * * * *` gọi internal endpoint; local có thể dùng `@Cron('*/15 * * * *')` |
| **SRS Ref** | Epic 5 — 5.2 |

**Logic:**
```
Tìm tất cả tasks thỏa:
  - deadline < now
  - status.isCompleted = false
  - overdueSentAt = null

Với mỗi task:
  1. Gửi email đến assignee (hoặc creator)
  2. Set overdueSentAt = now
```

**Email Template:**
- Subject: `[Trễ hạn] Task "{title}" đã quá hạn`
- Body: Tên task, deadline (đã qua), link đến task

---

## 7. Statuses & Labels (Master Data)

### 7.1 Lấy danh sách statuses của group

| | |
|---|---|
| **Endpoint** | `GET /groups/:groupId/statuses` |
| **Auth** | ✅ Bearer Token + Member |

**Success Response (200):**
```json
{
  "statusCode": 200,
  "data": [
    {
      "_id": "ObjectId",
      "name": "Todo",
      "slug": "todo",
      "color": "#3B82F6",
      "order": 1,
      "isDefault": true,
      "isCompleted": false
    }
  ]
}
```

---

### 7.2 Tạo status mới

| | |
|---|---|
| **Endpoint** | `POST /groups/:groupId/statuses` |
| **Auth** | ✅ Bearer Token + Owner |

**Request Body:**
```json
{
  "name": "string (required)",
  "color": "string (hex color, optional, default: #6B7280)",
  "order": "number (optional, auto-increment)",
  "isCompleted": "boolean (optional, default: false)"
}
```

**Business Rules:**
- `slug` tự động generate từ `name` (lowercase, replace spaces with `-`)
- Unique constraint: `groupId + slug`
- Chỉ owner được tạo

---

### 7.3 Cập nhật status

| | |
|---|---|
| **Endpoint** | `PATCH /groups/:groupId/statuses/:statusId` |
| **Auth** | ✅ Bearer Token + Owner |

**Request Body:**
```json
{
  "name": "string (optional)",
  "color": "string (optional)",
  "order": "number (optional)",
  "isCompleted": "boolean (optional)"
}
```

---

### 7.4 Xóa status

| | |
|---|---|
| **Endpoint** | `DELETE /groups/:groupId/statuses/:statusId` |
| **Auth** | ✅ Bearer Token + Owner |

**Business Rules:**
- Không thể xóa status có `isDefault = true`
- Không thể xóa nếu còn tasks đang dùng status này
- Trả lỗi nếu vi phạm

**Error Cases:**

| Status | Condition | Message |
|--------|-----------|---------|
| 400 | Là default status | "Không thể xóa status mặc định" |
| 400 | Còn tasks sử dụng | "Không thể xóa, còn {count} tasks đang sử dụng status này" |

---

### 7.5 Lấy danh sách labels của group

| | |
|---|---|
| **Endpoint** | `GET /groups/:groupId/labels` |
| **Auth** | ✅ Bearer Token + Member |

**Success Response (200):**
```json
{
  "statusCode": 200,
  "data": [
    {
      "_id": "ObjectId",
      "name": "Bug",
      "color": "#EF4444"
    }
  ]
}
```

---

### 7.6 Tạo label

| | |
|---|---|
| **Endpoint** | `POST /groups/:groupId/labels` |
| **Auth** | ✅ Bearer Token + Member |

**Request Body:**
```json
{
  "name": "string (required)",
  "color": "string (hex color, optional, default: #6B7280)"
}
```

---

### 7.7 Cập nhật label

| | |
|---|---|
| **Endpoint** | `PATCH /groups/:groupId/labels/:labelId` |
| **Auth** | ✅ Bearer Token + Owner |

---

### 7.8 Xóa label

| | |
|---|---|
| **Endpoint** | `DELETE /groups/:groupId/labels/:labelId` |
| **Auth** | ✅ Bearer Token + Owner |

**Hành vi:** Xóa label + tất cả records liên quan trong `task_labels`.

---

## 8. Error Codes

### 8.1 HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Thành công |
| 201 | Tạo mới thành công |
| 400 | Bad Request — validation lỗi, business rule vi phạm |
| 401 | Unauthorized — token thiếu hoặc hết hạn |
| 403 | Forbidden — không đủ quyền |
| 404 | Not Found — resource không tồn tại |
| 500 | Internal Server Error |

### 8.2 Validation Rules Summary

| Field | Rule |
|-------|------|
| `email` | Valid email format, unique |
| `password` | Min 6 characters |
| `name` (user/group) | Required, non-empty; group name unique case-insensitive |
| `title` (task) | Required, `trim()`, non-empty, max 200 chars |
| `description` (task) | Sanitized HTML, max 5000 plain-text chars |
| `deadline` | Valid ISO 8601 datetime, must be in the future when field is submitted |
| `startDate` | Valid ISO date, today or future |
| `endDate` | Valid ISO date, không nhỏ hơn `startDate`; nếu không có `startDate` thì phải từ hôm nay trở đi |
| `color` | Valid hex color (e.g., `#FF5733`) |
| `assigneeId` | Must be an accepted member of the group |
| `statusId` | Must belong to the same group |
| `labelIds` (task) | Optional, max 20, deduped, must belong to the same group |
| `comment.content` | Required, trim, text-only, max 2000 chars |
| `attachments` | Max 10 files/task, max 20MB/file, whitelist by extension + mime type |

---

## 9. Database Schema Summary

### Collections & Indexes

| Collection | Indexes |
|------------|---------|
| `users` | `email` (unique), `googleId` (unique, sparse), `verifyToken` |
| `groups` | `ownerId`, `nameNormalized` (unique, partial) |
| `group_members` | `{ groupId, userId }` (unique compound), `userId` |
| `group_invites` | `inviteToken` (unique), `{ groupId, email }`, `expiresAt` (TTL) |
| `statuses` | `{ groupId, slug }` (unique compound), `{ groupId, order }` |
| `tasks` | `{ groupId, statusId }`, `assigneeId`, `creatorId`, `deadline` |
| `task_comments` | `{ taskId, createdAt }`, `authorId`, `groupId` |
| `task_attachments` | `{ taskId, createdAt }`, `uploadedBy`, `groupId` |
| `labels` | `{ groupId, name }` (unique compound) |
| `task_labels` | `{ taskId, labelId }` (unique compound), `taskId`, `labelId` |

### Relationships Diagram

```
users ─┬──< group_members >──┬─ groups
       │                      │
       │                      ├──< statuses
       │                      ├──< labels
       │                      └──< tasks ──< task_labels >── labels
       │                               ├──< task_comments
       │                               └──< task_attachments
       │
       └──< group_invites >───── groups
```

---

## 📎 Appendix

### A. API Endpoints Summary Table

| # | Method | Endpoint | Auth | SRS |
|---|--------|----------|------|-----|
| 1 | POST | `/auth/register` | ❌ | 1.1 |
| 2 | GET | `/auth/verify-email` | ❌ | 1.2 |
| 3 | POST | `/auth/login` | ❌ | 1.3 |
| 4 | POST | `/auth/google` | ❌ | 1.4 |
| 5 | GET | `/auth/me` | ✅ | — |
| 6 | POST | `/groups` | ✅ | 2.1 |
| 7 | GET | `/groups` | ✅ | 2.2 |
| 8 | GET | `/groups/:groupId` | ✅ Member | — |
| 9 | PATCH | `/groups/:groupId` | ✅ Owner/Admin | 2.2A |
| 10 | DELETE | `/groups/:groupId` | ✅ Owner | — |
| 11 | GET | `/groups/status-presets` | ✅ | — |
| 12 | GET | `/groups/label-presets` | ✅ | — |
| 13 | GET | `/groups/member-candidates` | ✅ | — |
| 14 | POST | `/groups/:groupId/invites` | ✅ Owner/Admin | 2.3 |
| 15 | POST | `/groups/invites/accept` | ✅ | 2.4 |
| 16 | PATCH | `/groups/:groupId/members/:userId/role` | ✅ Owner/Admin | — |
| 17 | DELETE | `/groups/:groupId/invites/:inviteId` | ✅ Owner/Admin | — |
| 18 | DELETE | `/groups/:groupId/members/:userId` | ✅ Owner/Admin | — |
| 19 | POST | `/groups/:groupId/tasks` | ✅ Member | 3.1 |
| 20 | GET | `/groups/:groupId/tasks` | ✅ Member | 3.4 |
| 21 | GET | `/groups/:groupId/tasks/list` | ✅ Member | 3.4A |
| 22 | GET | `/tasks/my` | ✅ Bearer Token | — |
| 23 | GET | `/groups/:groupId/tasks/:taskId` | ✅ Member | — |
| 24 | PATCH | `/groups/:groupId/tasks/:taskId` | ✅ Member | 3.2 |
| 25 | DELETE | `/groups/:groupId/tasks/:taskId` | ✅ Owner/Admin | 3.3 |
| 26 | GET | `/groups/:groupId/tasks/:taskId/comments` | ✅ Member | — |
| 27 | POST | `/groups/:groupId/tasks/:taskId/comments` | ✅ Member | — |
| 28 | PATCH | `/groups/:groupId/tasks/:taskId/comments/:commentId` | ✅ Member | — |
| 29 | DELETE | `/groups/:groupId/tasks/:taskId/comments/:commentId` | ✅ Member | — |
| 30 | POST | `/groups/:groupId/tasks/:taskId/attachments` | ✅ Member | — |
| 31 | GET | `/groups/:groupId/tasks/:taskId/attachments/:attachmentId` | ✅ Member | — |
| 32 | DELETE | `/groups/:groupId/tasks/:taskId/attachments/:attachmentId` | ✅ Member | — |
| 33 | GET | `/dashboard/me` | ✅ Bearer Token | 5.0 |
| 34 | GET | `/groups/:groupId/dashboard` | ✅ Member | 4.1 |
| 35 | GET | `/groups/:groupId/statuses` | ✅ Member | — |
| 36 | POST | `/groups/:groupId/statuses` | ✅ Owner/Admin | — |
| 37 | PATCH | `/groups/:groupId/statuses/:statusId` | ✅ Owner/Admin | — |
| 38 | DELETE | `/groups/:groupId/statuses/:statusId` | ✅ Owner/Admin | — |
| 39 | GET | `/groups/:groupId/labels` | ✅ Member | — |
| 40 | POST | `/groups/:groupId/labels` | ✅ Member | — |
| 41 | PATCH | `/groups/:groupId/labels/:labelId` | ✅ Owner | — |
| 42 | DELETE | `/groups/:groupId/labels/:labelId` | ✅ Owner | — |

### B. Environment Variables

```env
# Server
PORT=3000
NODE_ENV=production

# MongoDB
MONGODB_URI=mongodb://localhost:27017/tasks-management?replicaSet=rs0

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# Firebase (Google Login)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Frontend
FRONTEND_URL=http://localhost:5173
```
