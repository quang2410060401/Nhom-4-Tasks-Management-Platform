import { useMemo } from 'react';
import { Button, Result } from 'antd';
import {
  InfoCircleOutlined,
  TeamOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { AppPageContainer } from '@/app/layout';
import { AppLoading } from '@/components';
import { groupDetailTabPath, ROUTES } from '@/lib/constants/routes';
import { normalizeApiError } from '@/services/http';
import { useGroupDetail } from '@/features/groups';

export default function GroupDetailPage() {
  const { groupId } = useParams();
  const groupDetailQuery = useGroupDetail(groupId);

  const tabs = useMemo(
    () =>
      groupId
        ? [
            {
              key: 'overview',
              label: 'Tổng quan',
              to: groupDetailTabPath(groupId, 'overview'),
              icon: <InfoCircleOutlined />,
            },
            {
              key: 'tasks',
              label: 'Công việc',
              to: groupDetailTabPath(groupId, 'tasks'),
              icon: <UnorderedListOutlined />,
            },
            {
              key: 'members',
              label: 'Thành viên',
              to: groupDetailTabPath(groupId, 'members'),
              icon: <TeamOutlined />,
            },
          ]
        : [],
    [groupId],
  );

  if (!groupId) {
    return (
      <AppPageContainer>
        <Result
          status="warning"
          title="Thiếu định danh nhóm"
          subTitle="Đường dẫn hiện tại không chứa groupId hợp lệ."
          extra={
            <Link to={ROUTES.GROUPS}>
              <Button type="primary">Quay lại danh sách nhóm</Button>
            </Link>
          }
        />
      </AppPageContainer>
    );
  }

  if (groupDetailQuery.isLoading) {
    return <AppLoading minHeight={420} tip="Đang tải thông tin nhóm..." />;
  }

  if (groupDetailQuery.error || !groupDetailQuery.data) {
    const error = normalizeApiError(groupDetailQuery.error);

    return (
      <AppPageContainer>
        <Result
          status="error"
          title="Không thể tải chi tiết nhóm"
          subTitle={error.message}
          extra={
            <Link to={ROUTES.GROUPS}>
              <Button type="primary">Quay lại danh sách nhóm</Button>
            </Link>
          }
        />
      </AppPageContainer>
    );
  }

  const group = groupDetailQuery.data;

  return (
    <AppPageContainer size="wide" className="space-y-3">
      <section className="border-b border-slate-200 px-1">
        <nav className="flex flex-wrap items-center gap-4 md:gap-7">
          {tabs.map((tab) => (
            <NavLink
              key={tab.key}
              to={tab.to}
              className={({ isActive }) =>
                clsx(
                  'inline-flex items-center gap-2 border-b-2 px-1 pb-3 pt-1 text-[15px] font-semibold transition-colors',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-700',
                )
              }
            >
              <span className="text-sm">{tab.icon}</span>
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </section>

      <Outlet context={{ groupId, group }} />
    </AppPageContainer>
  );
}
