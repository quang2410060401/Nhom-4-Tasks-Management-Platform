/**
 * Tạo trang HTML phản hồi tạm thời cho luồng xác thực email từ backend.
 *
 * Trang này được dùng khi frontend chưa sẵn sàng.
 * Sau khi frontend triển khai trang /verify-email, hãy:
 *  1. Trỏ verifyUrl trong AuthService về FRONTEND_URL thay vì APP_BASE_URL
 *  2. Đổi controller verifyEmail trả về JSON như các endpoint khác
 */

interface VerifyPageOptions {
  success: boolean;
  message: string;
  redirectUrl: string;
  /** Thời gian chờ trước khi redirect (ms), mặc định 3000 */
  delayMs?: number;
}

/**
 * Tạo một trang HTML đơn giản với thông báo và tự động redirect sau `delayMs` ms.
 */
export function buildVerifyEmailPage(options: VerifyPageOptions): string {
  const { success, message, redirectUrl, delayMs = 3000 } = options;

  const accentColor = success ? '#10B981' : '#EF4444';
  const icon = success ? '✅' : '❌';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${success ? 'Xác thực thành công' : 'Xác thực thất bại'} — Tasks Platform</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #F9FAFB;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      padding: 48px 40px;
      max-width: 420px;
      width: 100%;
      text-align: center;
    }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 22px; color: ${accentColor}; margin-bottom: 12px; }
    p { color: #6B7280; font-size: 15px; line-height: 1.6; margin-bottom: 24px; }
    .redirect-note { font-size: 13px; color: #9CA3AF; }
    .bar-wrap {
      height: 4px; background: #E5E7EB; border-radius: 2px;
      margin-top: 16px; overflow: hidden;
    }
    .bar {
      height: 100%; width: 0; background: ${accentColor}; border-radius: 2px;
      animation: fill ${delayMs}ms linear forwards;
    }
    @keyframes fill { to { width: 100%; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${message}</h1>
    <p>Bạn sẽ được chuyển hướng tự động sau ${delayMs / 1000} giây...</p>
    <div class="bar-wrap"><div class="bar"></div></div>
    <p class="redirect-note">
      Nếu không tự động chuyển, <a href="${redirectUrl}">nhấn vào đây</a>.
    </p>
  </div>
  <script>
    setTimeout(function () {
      window.location.href = ${JSON.stringify(redirectUrl)};
    }, ${delayMs});
  </script>
</body>
</html>`;
}
