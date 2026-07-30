# Frontend — Tasks Management Platform

Frontend của dự án là một SPA React dùng Vite, TypeScript, Ant Design và Tailwind. App hiện tập trung vào các luồng quản lý nhóm, công việc và dashboard theo người dùng đăng nhập.

README này tập trung vào:
- runbook local không phụ thuộc Docker
- runbook production theo hướng `build static + Nginx`
- mô tả cấu trúc project theo frontend hiện tại

## 1. Công nghệ và phạm vi

Stack chính:
- React 19
- Vite 7
- TypeScript
- Ant Design 6
- Tailwind CSS
- TanStack Query
- React Router
- React Hook Form + Yup
- Zustand cho UI state cục bộ

Đặc điểm hiện tại:
- app là SPA
- routes được lazy load bằng `React.lazy` + `Suspense`
- API base URL lấy từ `VITE_API_BASE_URL`

## 2. Các trang và tính năng chính

Nhóm tính năng hiện có:
- auth:
  - đăng nhập
  - đăng ký
  - verify email
  - quên mật khẩu
  - reset mật khẩu
- dashboard cá nhân `/dashboard`
- danh sách nhóm `/groups`
- group detail:
  - `/groups/:groupId/overview`
  - `/groups/:groupId/tasks`
  - `/groups/:groupId/members`
- standalone board `/tasks`
- my tasks `/my-tasks`
- invite accept flow `/invite/accept`

Task UI hiện hỗ trợ:
- board
- list
- task detail modal
- comments
- attachments

## 3. Cấu trúc project

```text
src/
  app/
    layout/
    providers/
    router/
  assets/
  components/
    common/
  features/
    auth/
    dashboard/
    group-detail/
    groups/
    labels/
    statuses/
    tasks/
  lib/
    constants/
    query/
    utils/
  pages/
  services/
    auth/
    http/
    ui/
  store/
    ui/
  types/
```

Ý nghĩa chính:

| Đường dẫn | Vai trò |
|---|---|
| `src/app/` | bootstrap app, layout, providers, router |
| `src/pages/` | route-level composition only; page nên mỏng |
| `src/features/` | business logic, API hooks, feature components, schemas |
| `src/components/` | shared reusable UI component |
| `src/services/http/` | HTTP client và error normalization |
| `src/lib/query/` | query keys, invalidation helpers |
| `src/store/` | UI state cục bộ, không phải nơi chứa server state |
| `src/types/` | shared app/API types |

Nguyên tắc hiện tại:
- business logic không nên nằm dày trong `pages`
- server state đi qua TanStack Query
- feature UI như group/task/dashboard ưu tiên đặt trong `src/features/*`

## 4. Biến môi trường

Tạo `.env` trong `apps/frontend`:

```bash
cd apps/frontend
cp .env.example .env
```

Các biến hiện dùng:

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `VITE_API_BASE_URL` | Có | URL backend API, nên kết thúc bằng `/api` |
| `VITE_APP_NAME` | Không | tên ứng dụng hiển thị ở frontend |

Lưu ý quan trọng:
- Vite chỉ expose biến bắt đầu bằng `VITE_`
- đây là build-time env
- nếu đổi `VITE_API_BASE_URL`, anh phải rebuild frontend production

Ví dụ local:

```env
VITE_API_BASE_URL=http://localhost:6868/api
VITE_APP_NAME=Tasks Management Platform
```

## 5. Runbook local

### 5.1 Cài dependencies

Khuyến nghị của repo là `pnpm`.

Từ root:

```bash
pnpm install
```

Hoặc chỉ riêng frontend:

```bash
pnpm --filter frontend install
```

Nếu dùng `npm` hoặc `yarn`, chạy trong `apps/frontend`:

```bash
cd apps/frontend
npm install
```

```bash
cd apps/frontend
yarn install
```

### 5.2 Chuẩn bị `.env`

```bash
cd apps/frontend
cp .env.example .env
```

Đảm bảo:
- backend đang chạy
- `VITE_API_BASE_URL` trỏ đúng backend, ví dụ `http://localhost:6868/api`

### 5.3 Chạy frontend local

#### Với pnpm

Từ root:

```bash
pnpm dev:fe
```

Hoặc:

```bash
pnpm --filter frontend dev
```

Trong `apps/frontend`:

```bash
pnpm dev
```

#### Với npm

```bash
cd apps/frontend
npm run dev
```

#### Với yarn

```bash
cd apps/frontend
yarn dev
```

Mặc định frontend dev server chạy tại:

```text
http://localhost:5173
```

### 5.4 Verify local

Checklist nhanh:
- mở `http://localhost:5173`
- login/register pages load được
- app gọi đúng backend qua `VITE_API_BASE_URL`
- refresh route SPA như `/groups`, `/tasks`, `/my-tasks` vẫn hoạt động trong dev

## 6. Command matrix

### 6.1 pnpm

| Mục tiêu | Từ root repo | Trong `apps/frontend` |
|---|---|---|
| Install | `pnpm install` | `pnpm install` |
| Dev | `pnpm dev:fe` hoặc `pnpm --filter frontend dev` | `pnpm dev` |
| Build | `pnpm --filter frontend build` | `pnpm build` |
| Lint | `pnpm --filter frontend lint` | `pnpm lint` |
| Preview | `pnpm --filter frontend preview` | `pnpm preview` |

### 6.2 npm

Chạy trong `apps/frontend`:

| Mục tiêu | Command |
|---|---|
| Install | `npm install` |
| Dev | `npm run dev` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Preview | `npm run preview` |

### 6.3 yarn

Chạy trong `apps/frontend`:

| Mục tiêu | Command |
|---|---|
| Install | `yarn install` |
| Dev | `yarn dev` |
| Build | `yarn build` |
| Lint | `yarn lint` |
| Preview | `yarn preview` |

## 7. Runbook production

Frontend production trong tài liệu này là:
- build static assets
- serve `dist/` bằng Nginx
- không dùng `vite preview` làm production server

### 7.1 Build production bundle

```bash
cd apps/frontend
pnpm install --frozen-lockfile
pnpm build
```

Output nằm ở:

```text
apps/frontend/dist
```

### 7.2 Lưu ý về biến môi trường production

Frontend dùng build-time env. Điều này có nghĩa:
- muốn đổi backend URL production
- anh phải set lại `VITE_API_BASE_URL`
- rồi build lại `dist`

Ví dụ:

```bash
VITE_API_BASE_URL=https://app.example.com/api pnpm build
```

hoặc nếu frontend gọi API qua subdomain riêng:

```bash
VITE_API_BASE_URL=https://api.example.com/api pnpm build
```

### 7.3 Nginx config mẫu cho SPA

Ví dụ serve frontend tại `app.example.com`:

```nginx
server {
    listen 80;
    server_name app.example.com;

    root /var/www/tasks-frontend/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:6868;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Ý nghĩa:
- `try_files $uri /index.html;` để React Router không bị 404 khi refresh route
- `/api/` được reverse proxy sang backend

Nếu frontend và backend khác domain:
- giữ Nginx frontend chỉ để serve static files
- set `VITE_API_BASE_URL` đúng domain API trước khi build

### 7.4 Preview chỉ để smoke test

`vite preview` hữu ích để test nhanh bundle sau khi build, nhưng:
- không phải production server
- không thay thế Nginx/CDN/static hosting

## 8. Cấu trúc tính năng theo frontend hiện tại

### `features/auth`
- API auth
- login/register/verify/reset flows
- schemas validate cho business forms

### `features/groups`
- group list
- group create/edit modal
- invites
- member actions

### `features/group-detail`
- overview UI
- shared group detail presentation

### `features/tasks`
- task APIs
- task hooks
- task detail modal
- task editor / comments / attachments
- board/list workspace logic

### `features/dashboard`
- dashboard cá nhân
- overview cards và task previews

## 9. Troubleshooting

### Env không load

Kiểm tra:
- file `.env` nằm trong `apps/frontend`
- biến có prefix `VITE_`
- đã restart dev server sau khi sửa env

### Frontend gọi sai backend

Kiểm tra:
- `VITE_API_BASE_URL`
- backend có đang chạy không
- URL có bao gồm `/api` không

Ví dụ đúng:

```env
VITE_API_BASE_URL=http://localhost:6868/api
```

### Bị CORS khi gọi backend

Kiểm tra:
- backend `FRONTEND_URL` có khớp domain frontend không
- frontend có gọi đúng `VITE_API_BASE_URL` không

### Refresh route bị 404 trên production

Nguyên nhân:
- Nginx chưa cấu hình SPA fallback

Cách xử lý:
- thêm `try_files $uri /index.html;` trong `location /`

### Build chunking / lazy loading

Đây là behavior bình thường của production build hiện tại:
- routes được lazy load
- Vite tách bundle thành nhiều chunks vendor/route

Miễn là `pnpm build` pass và Nginx serve đúng `dist/`, đây không phải lỗi.

## 10. Ghi chú cuối

- Docker flow vẫn tồn tại ở root repo, nhưng README này không lấy Docker làm hướng vận hành chính
- nếu cần deploy frontend lên CDN/object storage thay vì Nginx, anh chỉ cần giữ nguyên bước `build` và thay lớp static hosting
