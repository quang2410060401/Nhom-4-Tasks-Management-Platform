# Backend — Tasks Management Platform

Backend của dự án được xây bằng NestJS, MongoDB và Mongoose. App hiện phụ trách toàn bộ API cho xác thực, quản lý nhóm, quản lý công việc, dashboard tổng hợp và các cron job nhắc hạn công việc.

README này tập trung vào 2 mục tiêu:
- runbook local để một developer có thể tự chạy backend không cần Docker
- runbook production theo hướng `PM2 + Nginx`

## 1. Công nghệ và phạm vi

Stack chính:
- NestJS 11
- MongoDB + Mongoose
- JWT authentication
- Nodemailer cho email xác thực, lời mời và nhắc hạn
- Scheduler (`@nestjs/schedule`) cho reminder / overdue jobs
- Swagger tại `/api/docs`

Module nghiệp vụ hiện có:
- `auth`: đăng ký, đăng nhập, verify email, quên mật khẩu, reset mật khẩu
- `group`: create/edit aggregate, members, invites, group detail
- `task`: create/update/delete task, board/list, comments, attachments, notifications
- `dashboard`: dashboard theo group và dashboard cá nhân

Lưu ý:
- social login Google ở backend hiện chưa hoàn thiện thành endpoint production-ready, nên Firebase Admin được xem là cấu hình dự phòng/tương lai
- backend dùng transaction cho nhiều flow nghiệp vụ, nên MongoDB phải chạy ở chế độ replica set

## 2. Tính năng chính

- Xác thực bằng email/password, verify email, forgot/reset password
- Quản lý nhóm với aggregate save:
  - metadata nhóm
  - statuses
  - labels
  - invites
  - member removal
- Quản lý thành viên theo role `owner | admin | member`
- Quản lý task:
  - board
  - list
  - task detail
  - comments
  - attachments
  - delete task chỉ cho owner/admin
- Dashboard:
  - theo group
  - dashboard cá nhân theo user đăng nhập
- Cron jobs:
  - nhắc việc sắp đến hạn
  - thông báo việc quá hạn
- Swagger/OpenAPI docs

## 3. Cấu trúc project

```text
src/
  app.controller.ts
  app.module.ts
  main.ts
  common/
    decorators/
    guards/
    mail/
    strategies/
    types/
  modules/
    auth/
    dashboard/
    group/
    task/
test/
dist/
```

Ý nghĩa chính:

| Đường dẫn | Vai trò |
|---|---|
| `src/main.ts` | bootstrap app, global pipes, CORS, Swagger, global prefix `/api` |
| `src/app.module.ts` | root module, nạp `ConfigModule`, `ScheduleModule`, `MongooseModule` |
| `src/common/` | các thành phần dùng chung như mail service, guards, decorators, auth strategies |
| `src/modules/auth/` | auth flows, user schema, token logic, email verification/reset |
| `src/modules/group/` | group aggregate workflows, invites, members, statuses, labels |
| `src/modules/task/` | task CRUD, list/board, comments, attachments, reminder logic |
| `src/modules/dashboard/` | dashboard theo group và dashboard cá nhân |
| `test/` | e2e jest config |
| `dist/` | output sau khi build production |

## 4. Yêu cầu cài đặt local

Tối thiểu:
- Node.js LTS `>= 18`
- một package manager: `pnpm` hoặc `npm` hoặc `yarn`
- MongoDB local
- `mongosh`

Nếu muốn test đầy đủ email:
- SMTP account hoặc SMTP relay
- với Gmail nên dùng App Password 16 ký tự

Nếu muốn chuẩn bị sẵn cho social login:
- Firebase Admin credentials

## 5. Biến môi trường

Tạo file `.env` từ `.env.example` trong chính thư mục `apps/backend`.

```bash
cd apps/backend
cp .env.example .env
```

Nhóm biến chính:

### 5.1 App và HTTP

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `NODE_ENV` | Có | `development` hoặc `production` |
| `PORT` | Có | port backend lắng nghe |
| `APP_BASE_URL` | Nên có | URL public của backend; hiện ít dùng trực tiếp nhưng nên set đúng theo môi trường |
| `FRONTEND_URL` | Có | origin frontend được phép qua CORS, đồng thời dùng để tạo verify/invite links |
| `FRONTEND_URLS` | Không | danh sách origin frontend, ngăn cách bằng dấu phẩy |
| `ALLOW_VERCEL_PREVIEW_ORIGINS` | Không | `true/false`, cho phép `*.vercel.app` qua CORS khi cần preview frontend |
| `SWAGGER_ENABLED` | Không | `true/false`, mặc định không phải `false` thì Swagger sẽ bật |
| `ENABLE_INTERNAL_CRON` | Không | `true/false`, local có thể bật cron nội bộ; production Vercel nên tắt |

### 5.2 MongoDB

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `MONGODB_URI` | Có | connection string MongoDB |

Yêu cầu quan trọng:
- URI phải trỏ tới MongoDB chạy replica set
- ví dụ dùng Docker local của repo:
  - `mongodb://root:SecurePassw0rd2024!Mongo@127.0.0.1:27018/tasks?authSource=admin&replicaSet=rs0&directConnection=true`
- ví dụ local đơn giản:
  - `mongodb://127.0.0.1:27017/tasks?replicaSet=rs0`

### 5.3 Auth

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `JWT_SECRET` | Có | secret ký access token |
| `JWT_EXPIRES_IN` | Có | ví dụ `3600s`, `1h` |

### 5.4 Firebase Admin

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `FIREBASE_PROJECT_ID` | Không | chỉ cần nếu triển khai social login bằng Firebase Admin |
| `FIREBASE_CLIENT_EMAIL` | Không | như trên |
| `FIREBASE_PRIVATE_KEY` | Không | như trên |

### 5.5 SMTP

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `SMTP_HOST` | Có nếu bật email | SMTP host |
| `SMTP_PORT` | Có nếu bật email | SMTP port |
| `SMTP_SECURE` | Có nếu bật email | `true/false` |
| `SMTP_USER` | Có nếu bật email | tài khoản gửi mail |
| `SMTP_PASS` | Có nếu bật email | mật khẩu hoặc app password |
| `SMTP_FROM_NAME` | Có nếu bật email | tên người gửi |
| `SMTP_FROM_EMAIL` | Có nếu bật email | email người gửi |

### 5.6 Internal scheduler

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `CRON_SECRET` | Có nếu trigger cron qua HTTP | secret để bảo vệ endpoint nội bộ chạy reminder/overdue |

### 5.7 File storage

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `FILE_STORAGE_DRIVER` | Không | `local` hoặc `vercel-blob` |
| `BLOB_ACCESS` | Không | `public` hoặc `private`; production Vercel hiện đang khuyến nghị `public` theo guide deploy |
| `BLOB_READ_WRITE_TOKEN` | Có nếu dùng Blob | token đọc/ghi cho Vercel Blob |

## 6. Runbook local

### 6.1 Cài dependencies

Khuyến nghị của repo là `pnpm`.

Từ root:

```bash
pnpm install
```

Hoặc chỉ riêng backend:

```bash
pnpm --filter backend install
```

Nếu dùng `npm` hoặc `yarn`, chạy trong `apps/backend`:

```bash
cd apps/backend
npm install
```

```bash
cd apps/backend
yarn install
```

### 6.2 Chuẩn bị `.env`

```bash
cd apps/backend
cp .env.example .env
```

Điều chỉnh tối thiểu:
- `MONGODB_URI`
- `JWT_SECRET`
- `FRONTEND_URL`
- SMTP nếu cần test email

Lưu ý:
- nếu máy đã có `mongod` local chạy ở `127.0.0.1:27017`, không dùng URI Docker cũ ở cổng `27017`
- flow Docker của repo map Mongo ra host port `27018` để tránh trùng cổng với Mongo local

### 6.3 Chạy MongoDB local không qua Docker

Ví dụ tối giản với process local:

```bash
mkdir -p ~/data/tasks-mongodb
mongod --dbpath ~/data/tasks-mongodb --replSet rs0 --bind_ip 127.0.0.1 --port 27017
```

Khởi tạo replica set:

```bash
mongosh "mongodb://127.0.0.1:27017/admin" --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
```

Nếu máy của anh đã chạy MongoDB như service:
- vẫn cần bật replica set trong config của Mongo
- sau đó chạy `rs.initiate(...)` một lần bằng `mongosh`

### 6.4 Chạy backend ở local

#### Với pnpm

Từ root:

```bash
pnpm dev:be
```

Hoặc:

```bash
pnpm --filter backend start:dev
```

Trong `apps/backend`:

```bash
pnpm start:dev
```

#### Với npm

```bash
cd apps/backend
npm run start:dev
```

#### Với yarn

```bash
cd apps/backend
yarn start:dev
```

### 6.5 Verify local

Sau khi boot thành công:
- backend mặc định chạy ở `http://localhost:6868`
- smoke check:
  - `GET http://localhost:6868/api`
  - `GET http://localhost:6868/api/docs` nếu `SWAGGER_ENABLED=true`

Log boot kỳ vọng:
- `Backend running on http://localhost:<PORT>`
- `Swagger docs available at http://localhost:<PORT>/api/docs` nếu bật Swagger

## 7. Command matrix

### 7.1 pnpm

| Mục tiêu | Từ root repo | Trong `apps/backend` |
|---|---|---|
| Install | `pnpm install` | `pnpm install` |
| Dev | `pnpm dev:be` hoặc `pnpm --filter backend start:dev` | `pnpm start:dev` |
| Build | `pnpm --filter backend build` | `pnpm build` |
| Start production | `pnpm --filter backend start:prod` | `pnpm start:prod` |
| Lint | `pnpm --filter backend lint` | `pnpm lint` |
| Typecheck | `pnpm --filter backend typecheck` | `pnpm typecheck` |
| Unit tests | `pnpm --filter backend test` | `pnpm test` |
| E2E tests | `pnpm --filter backend test:e2e` | `pnpm test:e2e` |

Lưu ý:
- `lint` hiện có `--fix`, nên command này có thể tự sửa file

### 7.2 npm

Chạy trong `apps/backend`:

| Mục tiêu | Command |
|---|---|
| Install | `npm install` |
| Dev | `npm run start:dev` |
| Build | `npm run build` |
| Start production | `npm run start:prod` |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Unit tests | `npm test` |
| E2E tests | `npm run test:e2e` |

### 7.3 yarn

Chạy trong `apps/backend`:

| Mục tiêu | Command |
|---|---|
| Install | `yarn install` |
| Dev | `yarn start:dev` |
| Build | `yarn build` |
| Start production | `yarn start:prod` |
| Lint | `yarn lint` |
| Typecheck | `yarn typecheck` |
| Unit tests | `yarn test` |
| E2E tests | `yarn test:e2e` |

## 8. Runbook production

Production trong tài liệu này dùng:
- Node.js LTS
- MongoDB replica set hoặc Mongo managed service
- PM2 để quản lý process
- Nginx để reverse proxy

### 8.1 Build

```bash
cd apps/backend
pnpm install --frozen-lockfile
pnpm build
```

Output nằm ở:

```text
apps/backend/dist
```

### 8.2 Chuẩn bị env production

Các biến tối thiểu cần đúng:
- `NODE_ENV=production`
- `PORT`
- `MONGODB_URI`
- `JWT_SECRET`
- `FRONTEND_URL`

Các biến rất nên set đầy đủ:
- SMTP
- `SWAGGER_ENABLED=false` nếu không muốn public docs
- `ENABLE_INTERNAL_CRON=false` nếu production chạy bằng `Vercel Cron` hoặc scheduler ngoài
- `FILE_STORAGE_DRIVER=vercel-blob`
- `BLOB_ACCESS=public`
- `BLOB_READ_WRITE_TOKEN`
- `CRON_SECRET`

Lưu ý:
- `FRONTEND_URL` phải trỏ đúng domain frontend public vì verify/invite links sẽ dùng giá trị này
- Mongo production phải là replica set hoặc managed cluster hỗ trợ transaction
- Nếu dùng Vercel Blob public, ứng dụng vẫn có thể tải file qua endpoint backend nhưng object sẽ có public URL nếu pathname bị lộ
- Nếu backend deploy trên Vercel, ưu tiên dùng `Vercel Cron` cho reminder/overdue khi project không ở Hobby; `GitHub Actions schedule` chỉ là fallback

### 8.3 Chạy bằng PM2

Ví dụ chạy trực tiếp từ `apps/backend`:

```bash
cd /path/to/repo/apps/backend
pm2 start dist/main.js --name tasks-backend
```

Cấu hình PM2 để restart sau reboot:

```bash
pm2 save
pm2 startup
```

Các lệnh PM2 thường dùng:

```bash
pm2 status
pm2 logs tasks-backend
pm2 restart tasks-backend
pm2 stop tasks-backend
```

### 8.4 Nginx reverse proxy mẫu

Ví dụ backend public qua `api.example.com`:

```nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://127.0.0.1:6868;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Sau đó:
- backend API sẽ có prefix `/api`
- swagger sẽ ở `https://api.example.com/api/docs` nếu vẫn bật

### 8.5 Checklist production tối thiểu

- dùng `NODE_ENV=production`
- không dùng secret mặc định
- Mongo có replica set
- SMTP credentials dùng secret manager hoặc env thực
- log PM2/Nginx được rotate hoặc ship đi nơi khác
- firewall chỉ mở các port cần thiết

## 9. Troubleshooting

### MongoDB không hỗ trợ transaction

Biểu hiện:
- create/edit group hoặc task báo lỗi liên quan transaction

Nguyên nhân:
- Mongo đang chạy standalone, không có replica set

Cách xử lý:
- bật replica set
- kiểm tra `MONGODB_URI` có `?replicaSet=rs0`

### Swagger không hiện

Kiểm tra:
- `SWAGGER_ENABLED` có đang là `false` không
- truy cập đúng path `/api/docs`

### Frontend gọi API bị CORS

Kiểm tra:
- `FRONTEND_URL` trong backend có khớp origin thật của frontend không
- frontend có đang chạy đúng domain/port dự kiến không

### SMTP verify thất bại

Kiểm tra:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`

Với Gmail:
- dùng App Password 16 ký tự
- không copy password có dấu cách

### Verify / invite link bị sai domain

Kiểm tra:
- `FRONTEND_URL`

Backend hiện dùng `FRONTEND_URL` để sinh các link người dùng mở từ email.

## 10. Ghi chú cuối

- Flow Docker vẫn tồn tại ở root repo, nhưng README này không lấy Docker làm hướng vận hành chính
- Nếu anh cần health endpoint riêng cho monitoring production, đó là batch kỹ thuật khác; hiện tại smoke-check chủ yếu là log boot, `GET /api`, và `GET /api/docs` khi bật Swagger
