# Tasks Management Platform

Tasks Management Platform là hệ thống hỗ trợ tổ chức công việc theo nhóm hoặc dự án, tập trung vào luồng giao việc, theo dõi tiến độ và cộng tác giữa các thành viên. Hệ thống cho phép người dùng quản lý nhóm làm việc, phân quyền thành viên, thiết lập trạng thái xử lý riêng cho từng nhóm và theo dõi công việc từ góc nhìn cá nhân lẫn góc nhìn tổng quan.

README này là tài liệu bắt đầu nhanh ở mức root repo. Mục tiêu của nó là:
- hướng dẫn chạy dự án ở local theo **hiện trạng Docker của repo**
- mô tả ngắn gọn các tính năng nghiệp vụ chính
- dẫn người đọc sang tài liệu chi tiết của backend và frontend khi cần

## 1. Tổng quan nghiệp vụ

Hệ thống hiện hỗ trợ các nhóm tính năng chính sau:

- Quản lý tài khoản người dùng:
  - đăng ký
  - đăng nhập
  - xác thực email
  - quên mật khẩu và đặt lại mật khẩu
- Quản lý nhóm làm việc hoặc dự án:
  - tạo nhóm
  - cập nhật thông tin nhóm
  - thiết lập khoảng thời gian thực hiện
  - theo dõi thành viên và tiến độ chung
- Mời và quản lý thành viên:
  - mời qua email
  - phân quyền `owner`, `admin`, `member`
  - theo dõi lời mời đang chờ phản hồi
  - loại thành viên khỏi nhóm khi cần
- Quản lý công việc:
  - giao việc theo từng nhóm
  - tổ chức công việc theo board hoặc list
  - thay đổi trạng thái xử lý
  - gắn nhãn cho công việc
  - bình luận và đính kèm tệp
- Theo dõi công việc cá nhân:
  - xem danh sách toàn bộ việc được giao cho tôi
  - xem dashboard cá nhân theo user đăng nhập
- Theo dõi tiến độ:
  - dashboard theo nhóm
  - dashboard cá nhân
  - công việc cần chú ý, sắp đến hạn, quá hạn
- Nhắc việc qua email:
  - email xác thực tài khoản
  - email lời mời tham gia nhóm
  - email nhắc việc sắp đến hạn
  - email thông báo việc quá hạn

## 2. Kiến trúc chạy local theo hiện trạng repo

Trong local environment hiện tại:

- Docker chỉ dùng để khởi chạy hạ tầng MongoDB local:
  - `mongo`
  - `mongo-express`
  - `mongo-init-replica`
- Backend chạy local bằng package manager
- Frontend chạy local bằng package manager

Điều này có nghĩa:
- `docker compose up -d` **không** chạy backend/frontend
- Docker hiện chỉ phục vụ MongoDB local và replica set init để transaction hoạt động đúng

## 3. Quick links

- Backend README: [apps/backend/README.md](./apps/backend/README.md)
- Frontend README: [apps/frontend/README.md](./apps/frontend/README.md)
- API spec: [docs/api-specification.md](./docs/api-specification.md)
- System flows: [docs/system-flows.md](./docs/system-flows.md)

## 4. Start project ở local bằng Docker

Phần này mô tả đúng theo hiện trạng repo: dùng Docker cho MongoDB local, còn backend/frontend chạy riêng bằng `pnpm`.

### Bước 1. Cài prerequisites

Cần có:
- Docker Desktop hoặc Docker Engine + Docker Compose
- Node.js LTS `>= 18`
- `pnpm`

Khuyến nghị cài `pnpm`:

```bash
npm install -g pnpm
```

Lưu ý:
- root repo dùng `pnpm` làm package manager mặc định
- nếu muốn dùng `npm` hoặc `yarn` cho từng app, xem hướng dẫn riêng trong:
  - [apps/backend/README.md](./apps/backend/README.md)
  - [apps/frontend/README.md](./apps/frontend/README.md)

### Bước 2. Cài dependencies ở root

```bash
pnpm install
```

### Bước 3. Khởi chạy Docker services

Từ root repo:

```bash
docker compose up -d
```

Hoặc dùng script có sẵn:

```bash
pnpm docker:up
```

Các service được khởi chạy:
- `mongo`
- `mongo-express`
- `mongo-init-replica`

Trong đó:
- `mongo` mở cổng `27018` trên host để tránh đụng `mongod` local ở `27017`
- `mongo-express` mở cổng `8081`
- `mongo-init-replica` chạy một lần để khởi tạo replica set `rs0`

### Bước 4. Verify Docker local

Checklist nhanh:

- MongoDB local:
  - `mongodb://127.0.0.1:27018`
- Mongo Express:
  - `http://localhost:8081`
- Replica set:
  - Docker compose hiện đã có service `mongo-init-replica` để init `rs0`

Nếu cần kiểm tra sâu hơn:

```bash
docker compose ps
```

### Bước 5. Chuẩn bị env cho từng app

Nguồn cấu hình runtime thật của ứng dụng là:
- backend: `apps/backend/.env`
- frontend: `apps/frontend/.env`

Root README **không dùng** `root/.env` làm source of truth cho backend/frontend runtime.

Tạo env cho backend:

```bash
cd apps/backend
cp .env.example .env
```

Tạo env cho frontend:

```bash
cd apps/frontend
cp .env.example .env
```

Những điểm tối thiểu cần kiểm tra:

- backend:
  - `MONGODB_URI` phải trỏ đúng Mongo local có replica set
  - nếu dùng Docker của repo, dùng host port `27018`
  - `FRONTEND_URL=http://localhost:5173`
- frontend:
  - `VITE_API_BASE_URL=http://localhost:6868/api`

Chi tiết đầy đủ xem:
- [apps/backend/README.md](./apps/backend/README.md)
- [apps/frontend/README.md](./apps/frontend/README.md)

### Bước 6. Khởi chạy backend và frontend

Nhanh nhất từ root repo:

```bash
pnpm dev
```

Lệnh này sẽ chạy đồng thời:
- backend
- frontend

Nếu muốn tách riêng từng process, anh vẫn có thể mở 2 terminal:

Terminal 1:

```bash
pnpm dev:be
```

Terminal 2:

```bash
pnpm dev:fe
```

Lưu ý:
- backend và frontend hiện không chạy trong Docker
- Docker local ở đây chỉ cấp hạ tầng MongoDB

### Bước 7. Verify toàn hệ thống

Sau khi chạy thành công:

- Frontend:
  - `http://localhost:5173`
- Backend API:
  - `http://localhost:6868/api`
- Swagger:
  - `http://localhost:6868/api/docs`
- Mongo Express:
  - `http://localhost:8081`

Smoke check gợi ý:
- mở frontend và đăng nhập
- mở Swagger để xác nhận backend boot thành công
- mở Mongo Express để xác nhận MongoDB container đang chạy

### Bước 8. Dừng Docker

Khi không cần Mongo local nữa:

```bash
docker compose down
```

Hoặc:

```bash
pnpm docker:down
```

## 5. Command nhanh ở root

Các script root hiện có:

| Mục tiêu | Command |
|---|---|
| Cài dependencies | `pnpm install` |
| Chạy backend + frontend cùng lúc | `pnpm dev` hoặc `pnpm dev:all` |
| Chạy backend local | `pnpm dev:be` |
| Chạy frontend local | `pnpm dev:fe` |
| Build toàn workspace | `pnpm build` |
| Lint toàn workspace | `pnpm lint` |
| Start Docker local infra | `pnpm docker:up` |
| Stop Docker local infra | `pnpm docker:down` |

## 6. Ghi chú quan trọng

- Docker local hiện tại **không** chạy full stack
- backend dùng prefix `/api`
- swagger nằm ở `/api/docs`
- backend mặc định local ở `6868`
- frontend mặc định local ở `5173`
- MongoDB local được cấu hình replica set để các flow transaction của backend hoạt động đúng

## 7. Khi nào nên đọc README chi tiết của từng app

Đọc backend README nếu anh cần:
- cấu hình `.env` backend chi tiết
- runbook local/backend production
- PM2 + Nginx cho backend
- Mongo replica set local không qua Docker

Đọc frontend README nếu anh cần:
- cấu hình `.env` frontend chi tiết
- Vite build-time env
- runbook frontend production
- static hosting + Nginx

Tài liệu chi tiết:
- [apps/backend/README.md](./apps/backend/README.md)
- [apps/frontend/README.md](./apps/frontend/README.md)
