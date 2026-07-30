import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Result, Spin } from 'antd';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/app/providers';
import { useLogout } from '@/features/auth';
import { useAcceptInvite } from '@/features/groups';
import { ROUTES, groupDetailPath } from '@/lib/constants/routes';
import {
  buildInviteAcceptUrl,
  buildLoginRedirectUrl,
  savePendingRedirectPath,
} from '@/lib/utils/navigation';
import { buildQueryString } from '@/lib/utils/queryString';
import { normalizeApiError, type NormalizedApiError } from '@/services/http';
import { toastService } from '@/services/ui';

const INVITE_EMAIL_MISMATCH_MESSAGE =
  'Lời mời này thuộc về một tài khoản email khác. Vui lòng đăng nhập đúng email được mời';

export default function InviteAcceptPage() {
  const [searchParams] = useSearchParams();
  const { isLoading, isAuthenticated, user } = useAuth();
  const { logout } = useLogout();
  const acceptInviteMutation = useAcceptInvite();
  const startedRef = useRef(false);
  const [pageError, setPageError] = useState<NormalizedApiError | null>(null);
  const [acceptedGroupId, setAcceptedGroupId] = useState<string | null>(null);
  const token = searchParams.get('token');

  const invitePath = useMemo(() => {
    if (!token) {
      return null;
    }

    return buildInviteAcceptUrl(token);
  }, [token]);

  const loginHref = useMemo(() => {
    if (!invitePath) {
      return ROUTES.LOGIN;
    }

    return buildLoginRedirectUrl(invitePath);
  }, [invitePath]);

  const registerHref = useMemo(() => {
    if (!invitePath) {
      return ROUTES.REGISTER;
    }

    return `${ROUTES.REGISTER}${buildQueryString({ redirect: invitePath })}`;
  }, [invitePath]);

  useEffect(() => {
    if (invitePath) {
      savePendingRedirectPath(invitePath);
    }
  }, [invitePath]);

  useEffect(() => {
    if (!token || !isAuthenticated || isLoading || startedRef.current || acceptedGroupId || pageError) {
      return;
    }

    startedRef.current = true;

    void (async () => {
      try {
        const data = await acceptInviteMutation.mutateAsync(token);
        toastService.success('Bạn đã tham gia nhóm thành công');
        savePendingRedirectPath(null);
        setAcceptedGroupId(data.groupId);
      } catch (error) {
        setPageError(normalizeApiError(error));
      }
    })();
  }, [acceptedGroupId, acceptInviteMutation, isAuthenticated, isLoading, pageError, token]);

  const handleRetry = () => {
    startedRef.current = false;
    setPageError(null);
  };

  const handleSwitchAccount = () => {
    logout(loginHref);
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-light px-6 py-10">
        <Result
          status="warning"
          title="Thiếu token lời mời"
          subTitle="Link lời mời không hợp lệ hoặc đã bị cắt mất tham số token."
          extra={
            <Link to={ROUTES.GROUPS}>
              <Button type="primary">Về Groups</Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-light px-6 py-10">
        <Result
          icon={<Spin size="large" />}
          title="Đang kiểm tra phiên đăng nhập"
          subTitle="Vui lòng chờ trong giây lát để hệ thống xác định tài khoản hiện tại."
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-light px-6 py-10">
        <Result
          status="info"
          title="Cần đăng nhập để chấp nhận lời mời"
          subTitle="Nếu anh chưa có tài khoản, hãy đăng ký bằng đúng email đã nhận được lời mời. Hệ thống sẽ giữ lại link này và tự quay lại sau khi đăng nhập."
          extra={[
            <Link key="login" to={loginHref}>
              <Button type="primary">Đăng nhập</Button>
            </Link>,
            <Link key="register" to={registerHref}>
              <Button>Đăng ký tài khoản</Button>
            </Link>,
          ]}
        />
      </div>
    );
  }

  if (pageError) {
    const isWrongAccount = pageError.message === INVITE_EMAIL_MISMATCH_MESSAGE;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background-light px-6 py-10">
        <Result
          status="error"
          title={isWrongAccount ? 'Đang đăng nhập sai tài khoản' : 'Không thể tham gia nhóm'}
          subTitle={
            isWrongAccount
              ? `Tài khoản hiện tại là ${user?.email ?? 'không xác định'}. Vui lòng đăng xuất và đăng nhập bằng đúng email được mời.`
              : pageError.message
          }
          extra={
            isWrongAccount
              ? [
                  <Button key="switch" type="primary" onClick={handleSwitchAccount}>
                    Đăng xuất và đăng nhập lại
                  </Button>,
                  <Link key="home" to={ROUTES.DASHBOARD}>
                    <Button>Về Dashboard</Button>
                  </Link>,
                ]
              : [
                  <Button key="retry" type="primary" onClick={handleRetry}>
                    Thử lại
                  </Button>,
                  <Link key="groups" to={ROUTES.GROUPS}>
                    <Button>Về Groups</Button>
                  </Link>,
                ]
          }
        />
      </div>
    );
  }

  if (acceptedGroupId) {
    return <Navigate to={groupDetailPath(acceptedGroupId)} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background-light px-6 py-10">
      <Result
        icon={<Spin size="large" />}
        title="Đang xác nhận lời mời"
        subTitle="Hệ thống đang kiểm tra token và thêm anh vào nhóm. Vui lòng chờ trong giây lát."
      />
    </div>
  );
}
