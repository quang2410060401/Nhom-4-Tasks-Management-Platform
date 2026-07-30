import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/lib/constants/routes';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Result
        status="404"
        title="404"
        subTitle="Trang bạn tìm không tồn tại."
        extra={
          <Button type="primary" onClick={() => navigate(ROUTES.HOME)}>
            Về trang chủ
          </Button>
        }
      />
    </div>
  );
}
