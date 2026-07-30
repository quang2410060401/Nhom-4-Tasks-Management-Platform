import { useEffect, useState } from 'react';
import { Button, Input, Result } from 'antd';
import { PlusOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons';
import { AppPageContainer } from '@/app/layout';
import { AppEmpty, AppLoading } from '@/components';
import { normalizeApiError } from '@/services/http';
import { buildGroupCardViewModel } from '../types';
import { useGroups } from '../hooks';
import { CreateGroupModal } from './CreateGroupModal';
import { GroupGrid } from './GroupGrid';

interface GroupDashboardViewProps {
  eyebrow: string;
  title?: string;
  description?: string;
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
}

export function GroupDashboardView({ eyebrow, title, description }: GroupDashboardViewProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const groupsQuery = useGroups();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(normalizeSearchText(search));
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [search]);

  const groups = (groupsQuery.data ?? [])
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filteredGroups = groups
    .filter((group) => {
      if (!debouncedSearch) {
        return true;
      }

      const searchableText = normalizeSearchText(`${group.name} ${group.description ?? ''}`);
      return searchableText.includes(debouncedSearch);
    })
    .map(buildGroupCardViewModel);

  const error = groupsQuery.error ? normalizeApiError(groupsQuery.error) : null;

  return (
    <AppPageContainer size="wide" className="space-y-8">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-primary">{eyebrow}</p>
          {title && (
            <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">{title}</h1>
          )}
          {description && (
            <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-500">{description}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => setIsCreateModalOpen(true)}
            className="shadow-lg shadow-primary/20"
          >
            Tạo nhóm mới
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white/70 p-5 shadow-sm shadow-slate-200/70 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <Input
          size="large"
          allowClear
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          prefix={<SearchOutlined className="text-slate-400" />}
          placeholder="Tìm theo tên nhóm..."
          className="max-w-xl"
        />

        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm shadow-slate-200/50">
          <TeamOutlined className="text-primary" />
          <span>{groups.length} nhóm đang tham gia</span>
        </div>
      </section>

      {groupsQuery.isLoading ? (
        <AppLoading minHeight={360} tip="Đang tải danh sách nhóm..." />
      ) : error ? (
        <Result status="error" title="Không thể tải danh sách nhóm" subTitle={error.message} />
      ) : filteredGroups.length === 0 ? (
        <AppEmpty description={search ? 'Không tìm thấy nhóm phù hợp' : 'Chưa có nhóm nào'}>
          <Button type="primary" onClick={() => setIsCreateModalOpen(true)}>
            Tạo nhóm mới
          </Button>
        </AppEmpty>
      ) : (
        <GroupGrid groups={filteredGroups} />
      )}

      <CreateGroupModal open={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </AppPageContainer>
  );
}
