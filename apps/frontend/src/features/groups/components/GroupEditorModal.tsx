import { useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import dayjs from 'dayjs';
import {
  Avatar,
  Button,
  Checkbox,
  DatePicker,
  Input,
  Modal,
  Popover,
  Select,
  Skeleton,
} from 'antd';
import {
  CloseOutlined,
  MailOutlined,
  PlusOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { toastService } from '@/services/ui';
import { createGroupSchema } from '../schemas';
import {
  buildLabelDraftFromLabel,
  buildStatusDraftFromStatus,
  createDefaultStatusDrafts,
  getInitials,
  type CreateGroupFormValues,
  type GroupDetail,
  type GroupEditorMode,
  type GroupLabelDraft,
  type GroupStatusDraft,
} from '../types';
import {
  useGroupLabels,
  useGroupStatuses,
  useLabelPresets,
  useMemberCandidates,
  useSaveGroupEditor,
  useStatusPresets,
} from '../hooks';

interface GroupEditorModalProps {
  open: boolean;
  onClose: () => void;
  mode: GroupEditorMode;
  groupId?: string;
  group?: GroupDetail;
}

interface GroupEditorFormContentProps {
  mode: GroupEditorMode;
  onClose: () => void;
  groupId?: string;
  group?: GroupDetail;
  initialValues: CreateGroupFormValues;
  initialStatuses: GroupStatusDraft[];
  initialLabels: GroupLabelDraft[];
}

interface StatusEditorState {
  name: string;
  color: string;
  isCompleted: boolean;
}

interface LabelEditorState {
  name: string;
  color: string;
}

const { TextArea } = Input;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NEW_STATUS_EDITOR_KEY = '__new-status__';
const NEW_LABEL_EDITOR_KEY = '__new-label__';

function createStatusEditorState(): StatusEditorState {
  return {
    name: '',
    color: '#2563EB',
    isCompleted: false,
  };
}

function createLabelEditorState(): LabelEditorState {
  return {
    name: '',
    color: '#0EA5E9',
  };
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return EMAIL_REGEX.test(value);
}

function hasDuplicateNames(values: string[]) {
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      continue;
    }

    if (seen.has(normalized)) {
      return true;
    }

    seen.add(normalized);
  }

  return false;
}

function normalizeDateInputValue(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const safeHex =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized.padEnd(6, '0').slice(0, 6);

  const bigint = Number.parseInt(safeHex, 16);
  const red = (bigint >> 16) & 255;
  const green = (bigint >> 8) & 255;
  const blue = bigint & 255;

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function buildPillStyle(color: string) {
  return {
    color,
    borderColor: hexToRgba(color, 0.18),
    backgroundColor: hexToRgba(color, 0.1),
  };
}

function FieldLabel({ children }: { children: string }) {
  return <label className="mb-1.5 block text-xs font-semibold text-slate-700">{children}</label>;
}

function ChipButton({
  label,
  color,
  onClick,
  onRemove,
  avatar,
}: {
  label: string;
  color: string;
  onClick?: () => void;
  onRemove?: () => void;
  avatar?: { src?: string | null; initials: string };
}) {
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[13px] font-semibold shadow-sm shadow-slate-200/40"
      style={buildPillStyle(color)}
    >
      {avatar && (
        <Avatar
          size={24}
          src={avatar.src ?? undefined}
          className="shrink-0 border border-white/70"
          style={{
            backgroundColor: hexToRgba(color, 0.18),
            color,
          }}
        >
          {!avatar.src ? avatar.initials : null}
        </Avatar>
      )}

      <button
        type="button"
        onClick={onClick}
        className="max-w-[170px] truncate text-left leading-5"
      >
        {label}
      </button>

      {onRemove && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="rounded-full p-0.5 opacity-70 transition hover:bg-black/5 hover:opacity-100"
          aria-label={`Remove ${label}`}
        >
          <CloseOutlined className="text-[10px]" />
        </button>
      )}
    </div>
  );
}

function AddPillButton({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-500 transition hover:border-primary/40 hover:text-primary"
    >
      <PlusOutlined className="text-xs" />
      {label}
    </button>
  );
}

function SectionBlock({
  title,
  children,
  action,
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="mb-2">
      <div className="flex items-center justify-between gap-2.5">
        {title && <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>}
        {action}
      </div>
      {children}
    </section>
  );
}

function StatusEditorPopoverContent({
  value,
  onChange,
  onSubmit,
  onCancel,
  onPresetSearch,
  presetOptions,
  loading,
  submitLabel,
}: {
  value: StatusEditorState;
  onChange: (patch: Partial<StatusEditorState>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onPresetSearch: (value: string) => void;
  presetOptions: Array<{
    value: string;
    label: string;
    name: string;
    color: string;
    isCompleted: boolean;
  }>;
  loading: boolean;
  submitLabel: string;
}) {
  return (
    <div className="w-[300px] space-y-2.5">
      <div>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Load Existing
        </p>
        <Select
          showSearch
          filterOption={false}
          value={undefined}
          placeholder="Chọn status có sẵn trong hệ thống"
          onSearch={onPresetSearch}
          onSelect={(selectedKey) => {
            const preset = presetOptions.find((item) => item.value === selectedKey);
            if (!preset) return;

            onChange({
              name: preset.name,
              color: preset.color,
              isCompleted: preset.isCompleted,
            });
          }}
          options={presetOptions}
          loading={loading}
          className="w-full"
        />
      </div>

      <div>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Status Name
        </p>
        <Input
          value={value.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="Ví dụ: In Review"
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Color
          </span>
          <input
            type="color"
            value={value.color}
            onChange={(event) => onChange({ color: event.target.value })}
            className="h-9 w-12 cursor-pointer rounded border-none bg-transparent p-0"
          />
        </label>
        <div className="rounded-xl border border-slate-200 px-3 py-2">
          <Checkbox
            checked={value.isCompleted}
            onChange={(event) => onChange({ isCompleted: event.target.checked })}
          >
            Completed
          </Checkbox>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-0.5">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" onClick={onSubmit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

function LabelEditorPopoverContent({
  value,
  onChange,
  onSubmit,
  onCancel,
  onPresetSearch,
  presetOptions,
  loading,
  submitLabel,
}: {
  value: LabelEditorState;
  onChange: (patch: Partial<LabelEditorState>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onPresetSearch: (value: string) => void;
  presetOptions: Array<{ value: string; label: string; name: string; color: string }>;
  loading: boolean;
  submitLabel: string;
}) {
  return (
    <div className="w-[300px] space-y-2.5">
      <div>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Load Existing
        </p>
        <Select
          showSearch
          filterOption={false}
          value={undefined}
          placeholder="Chọn label có sẵn trong hệ thống"
          onSearch={onPresetSearch}
          onSelect={(selectedKey) => {
            const preset = presetOptions.find((item) => item.value === selectedKey);
            if (!preset) return;

            onChange({
              name: preset.name,
              color: preset.color,
            });
          }}
          options={presetOptions}
          loading={loading}
          className="w-full"
        />
      </div>

      <div>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Label Name
        </p>
        <Input
          value={value.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="Ví dụ: Urgent"
        />
      </div>

      <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Color
        </span>
        <input
          type="color"
          value={value.color}
          onChange={(event) => onChange({ color: event.target.value })}
          className="h-9 w-12 cursor-pointer rounded border-none bg-transparent p-0"
        />
      </label>

      <div className="flex justify-end gap-2 pt-0.5">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" onClick={onSubmit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

function GroupEditorFormContent({
  mode,
  onClose,
  groupId,
  group,
  initialValues,
  initialStatuses,
  initialLabels,
}: GroupEditorFormContentProps) {
  const [statuses, setStatuses] = useState<GroupStatusDraft[]>(initialStatuses);
  const [labels, setLabels] = useState<GroupLabelDraft[]>(initialLabels);
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [removedMemberUserIds, setRemovedMemberUserIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [statusPresetSearch, setStatusPresetSearch] = useState('');
  const [labelPresetSearch, setLabelPresetSearch] = useState('');
  const [isMemberPopoverOpen, setIsMemberPopoverOpen] = useState(false);
  const [statusEditorKey, setStatusEditorKey] = useState<string | null>(null);
  const [labelEditorKey, setLabelEditorKey] = useState<string | null>(null);
  const [statusEditor, setStatusEditor] = useState<StatusEditorState>(createStatusEditorState());
  const [labelEditor, setLabelEditor] = useState<LabelEditorState>(createLabelEditorState());

  const deferredStatusPresetSearch = useDeferredValue(statusPresetSearch.trim());
  const deferredLabelPresetSearch = useDeferredValue(labelPresetSearch.trim());
  const deferredMemberSearch = useDeferredValue(memberSearch.trim());

  const statusPresetsQuery = useStatusPresets(deferredStatusPresetSearch, true);
  const labelPresetsQuery = useLabelPresets(deferredLabelPresetSearch, true);
  const memberCandidatesQuery = useMemberCandidates(deferredMemberSearch, true);
  const saveGroupEditorMutation = useSaveGroupEditor();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateGroupFormValues>({
    resolver: yupResolver(createGroupSchema),
    defaultValues: initialValues,
  });

  const watchedStartDate = useWatch({ control, name: 'startDate' });
  const watchedEndDate = useWatch({ control, name: 'endDate' });
  const startDateValue = watchedStartDate ? dayjs(watchedStartDate, 'YYYY-MM-DD') : null;
  const endDateValue = watchedEndDate ? dayjs(watchedEndDate, 'YYYY-MM-DD') : null;
  const today = dayjs().startOf('day');

  const visibleMembers = useMemo(() => {
    const removedIds = new Set(removedMemberUserIds);
    return (group?.members ?? []).filter((member) => !removedIds.has(member.userId));
  }, [group?.members, removedMemberUserIds]);

  const statusPresetOptions = useMemo(
    () =>
      (statusPresetsQuery.data ?? []).map((preset) => ({
        value: preset.key,
        label: `${preset.name}${preset.usageCount > 0 ? ` (${preset.usageCount})` : ''}`,
        name: preset.name,
        color: preset.color,
        isCompleted: preset.isCompleted,
      })),
    [statusPresetsQuery.data],
  );

  const labelPresetOptions = useMemo(
    () =>
      (labelPresetsQuery.data ?? []).map((preset) => ({
        value: preset.key,
        label: `${preset.name}${preset.usageCount > 0 ? ` (${preset.usageCount})` : ''}`,
        name: preset.name,
        color: preset.color,
      })),
    [labelPresetsQuery.data],
  );

  const memberOptions = useMemo(() => {
    const takenEmails = new Set([
      ...visibleMembers.map((member) => normalizeEmail(member.email)),
      ...inviteEmails.map((email) => normalizeEmail(email)),
    ]);

    return (memberCandidatesQuery.data ?? [])
      .filter((candidate) => !takenEmails.has(candidate.email.toLowerCase()))
      .map((candidate) => ({
        value: candidate.email,
        label: (
          <div className="flex items-center gap-3">
            <Avatar
              size={28}
              src={candidate.avatar ?? undefined}
              className="bg-slate-100 text-slate-600"
            >
              {!candidate.avatar ? getInitials(candidate.name) : null}
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{candidate.name}</p>
              <p className="truncate text-xs text-slate-500">{candidate.email}</p>
            </div>
          </div>
        ),
      }));
  }, [inviteEmails, memberCandidatesQuery.data, visibleMembers]);

  const openNewStatusEditor = () => {
    setStatusEditor(createStatusEditorState());
    setStatusPresetSearch('');
    setStatusEditorKey(NEW_STATUS_EDITOR_KEY);
  };

  const openExistingStatusEditor = (status: GroupStatusDraft) => {
    setStatusEditor({
      name: status.name,
      color: status.color,
      isCompleted: status.isCompleted,
    });
    setStatusPresetSearch('');
    setStatusEditorKey(status.key);
  };

  const closeStatusEditor = () => {
    setStatusEditorKey(null);
    setStatusEditor(createStatusEditorState());
    setStatusPresetSearch('');
  };

  const openNewLabelEditor = () => {
    setLabelEditor(createLabelEditorState());
    setLabelPresetSearch('');
    setLabelEditorKey(NEW_LABEL_EDITOR_KEY);
  };

  const openExistingLabelEditor = (label: GroupLabelDraft) => {
    setLabelEditor({
      name: label.name,
      color: label.color,
    });
    setLabelPresetSearch('');
    setLabelEditorKey(label.key);
  };

  const closeLabelEditor = () => {
    setLabelEditorKey(null);
    setLabelEditor(createLabelEditorState());
    setLabelPresetSearch('');
  };

  const removeStatusDraft = (key: string) => {
    if (statuses.length === 1) {
      toastService.error('Nhóm phải có ít nhất 1 status');
      return;
    }

    setStatuses((current) => current.filter((status) => status.key !== key));
    if (statusEditorKey === key) {
      closeStatusEditor();
    }
  };

  const removeLabelDraft = (key: string) => {
    setLabels((current) => current.filter((label) => label.key !== key));
    if (labelEditorKey === key) {
      closeLabelEditor();
    }
  };

  const handleSubmitStatusEditor = () => {
    const trimmedName = statusEditor.name.trim();
    if (!trimmedName) {
      toastService.error('Vui lòng nhập tên status');
      return;
    }

    const duplicate = statuses.some(
      (status) =>
        status.key !== statusEditorKey &&
        status.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    );

    if (duplicate) {
      toastService.error('Tên status đang bị trùng');
      return;
    }

    if (statusEditorKey === NEW_STATUS_EDITOR_KEY) {
      setStatuses((current) => [
        ...current,
        {
          key: `status-${Math.random().toString(36).slice(2, 10)}`,
          name: trimmedName,
          color: statusEditor.color,
          isCompleted: statusEditor.isCompleted,
          isDefault: false,
          source: 'manual',
        },
      ]);
    } else if (statusEditorKey) {
      setStatuses((current) =>
        current.map((status) =>
          status.key === statusEditorKey
            ? {
                ...status,
                name: trimmedName,
                color: statusEditor.color,
                isCompleted: statusEditor.isCompleted,
              }
            : status,
        ),
      );
    }

    closeStatusEditor();
  };

  const handleSubmitLabelEditor = () => {
    const trimmedName = labelEditor.name.trim();
    if (!trimmedName) {
      toastService.error('Vui lòng nhập tên label');
      return;
    }

    const duplicate = labels.some(
      (label) =>
        label.key !== labelEditorKey &&
        label.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    );

    if (duplicate) {
      toastService.error('Tên label đang bị trùng');
      return;
    }

    if (labelEditorKey === NEW_LABEL_EDITOR_KEY) {
      setLabels((current) => [
        ...current,
        {
          key: `label-${Math.random().toString(36).slice(2, 10)}`,
          name: trimmedName,
          color: labelEditor.color,
          source: 'manual',
        },
      ]);
    } else if (labelEditorKey) {
      setLabels((current) =>
        current.map((label) =>
          label.key === labelEditorKey
            ? {
                ...label,
                name: trimmedName,
                color: labelEditor.color,
              }
            : label,
        ),
      );
    }

    closeLabelEditor();
  };

  const handleInviteEmailsChange = (values: Array<string | number>) => {
    const existingMemberEmails = new Set(
      visibleMembers.map((member) => normalizeEmail(member.email)),
    );
    const normalizedValues = values.map((value) => normalizeEmail(String(value))).filter(Boolean);
    const nextInviteEmails: string[] = [];
    const invalidEmails: string[] = [];
    const alreadyMemberEmails: string[] = [];

    normalizedValues.forEach((email) => {
      if (existingMemberEmails.has(email)) {
        alreadyMemberEmails.push(email);
        return;
      }

      if (!isValidEmail(email)) {
        invalidEmails.push(email);
        return;
      }

      if (!nextInviteEmails.includes(email)) {
        nextInviteEmails.push(email);
      }
    });

    if (invalidEmails.length > 0) {
      toastService.error(`Email không đúng định dạng: ${invalidEmails.join(', ')}`);
    }

    if (alreadyMemberEmails.length > 0) {
      toastService.warning(`Email đã là thành viên của nhóm: ${alreadyMemberEmails.join(', ')}`);
    }

    setInviteEmails(nextInviteEmails);
  };

  const removeInviteEmail = (email: string) => {
    setInviteEmails((current) => current.filter((item) => item !== email));
  };

  const onSubmit = (values: CreateGroupFormValues) => {
    if (statuses.length === 0) {
      toastService.error('Nhóm phải có ít nhất 1 status');
      return;
    }

    if (statuses.some((status) => !status.name.trim())) {
      toastService.error('Mỗi status cần có tên trước khi lưu');
      return;
    }

    if (labels.some((label) => !label.name.trim())) {
      toastService.error('Mỗi label cần có tên trước khi lưu');
      return;
    }

    if (hasDuplicateNames(statuses.map((status) => status.name))) {
      toastService.error('Tên status đang bị trùng');
      return;
    }

    if (hasDuplicateNames(labels.map((label) => label.name))) {
      toastService.error('Tên label đang bị trùng');
      return;
    }

    const invalidInviteEmails = inviteEmails.filter((email) => !isValidEmail(email));
    if (invalidInviteEmails.length > 0) {
      toastService.error(`Email không đúng định dạng: ${invalidInviteEmails.join(', ')}`);
      return;
    }

    saveGroupEditorMutation.mutate(
      {
        mode,
        groupId,
        name: values.name,
        description: values.description,
        startDate: values.startDate,
        endDate: values.endDate,
        statuses,
        labels,
        inviteEmails,
        removedMemberUserIds,
      },
      {
        onSuccess: () => {
          onClose();
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-1">
      <div className="space-y-6 border-t border-slate-100 px-1 pt-5">
        <SectionBlock title="Group Name">
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                placeholder="Product Development"
                status={errors.name ? 'error' : ''}
              />
            )}
          />
          {errors.name && <p className="mt-2 text-xs text-red-500">{errors.name.message}</p>}
        </SectionBlock>

        <SectionBlock title="Description">
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextArea
                {...field}
                rows={3}
                placeholder="Handling all core product engineering tasks and roadmap items."
                status={errors.description ? 'error' : ''}
                showCount
                maxLength={500}
              />
            )}
          />
          {errors.description && (
            <p className="mt-2 text-xs text-red-500">{errors.description.message}</p>
          )}
        </SectionBlock>

        <SectionBlock>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <FieldLabel>START DATE</FieldLabel>
              <Controller
                name="startDate"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    value={field.value ? dayjs(field.value, 'YYYY-MM-DD') : null}
                    onChange={(value) => field.onChange(value ? value.format('YYYY-MM-DD') : '')}
                    format="YYYY-MM-DD"
                    allowClear
                    disabledDate={(current) => {
                      if (!current) return false;
                      if (current.isBefore(today, 'day')) {
                        return true;
                      }
                      return Boolean(endDateValue && current.isAfter(endDateValue, 'day'));
                    }}
                    className="!w-full"
                  />
                )}
              />
              {errors.startDate && (
                <p className="mt-2 text-xs text-red-500">{errors.startDate.message}</p>
              )}
            </div>

            <div>
              <FieldLabel>END DATE</FieldLabel>
              <Controller
                name="endDate"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    value={field.value ? dayjs(field.value, 'YYYY-MM-DD') : null}
                    onChange={(value) => field.onChange(value ? value.format('YYYY-MM-DD') : '')}
                    format="YYYY-MM-DD"
                    allowClear
                    disabledDate={(current) => {
                      if (!current) return false;
                      if (startDateValue) {
                        return current.isBefore(startDateValue, 'day');
                      }
                      return current.isBefore(today, 'day');
                    }}
                    className="!w-full"
                  />
                )}
              />
              {errors.endDate && (
                <p className="mt-2 text-xs text-red-500">{errors.endDate.message}</p>
              )}
            </div>
          </div>
        </SectionBlock>

        <SectionBlock
          title="Members"
          action={
            <Popover
              trigger="click"
              open={isMemberPopoverOpen}
              onOpenChange={setIsMemberPopoverOpen}
              content={
                <div className="w-[320px] space-y-2.5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <MailOutlined />
                    Add member or invite by email
                  </div>
                  <Select
                    mode="tags"
                    value={inviteEmails}
                    onChange={handleInviteEmailsChange}
                    onSearch={setMemberSearch}
                    filterOption={false}
                    tokenSeparators={[',', ';', ' ']}
                    placeholder="Nhập email hoặc tìm thành viên có sẵn"
                    options={memberOptions}
                    className="w-full"
                    suffixIcon={<UserAddOutlined />}
                    notFoundContent={
                      memberCandidatesQuery.isLoading ? (
                        <div className="px-3 py-2">
                          <Skeleton active paragraph={false} title={{ width: '100%' }} />
                        </div>
                      ) : (
                        'Không có gợi ý phù hợp'
                      )
                    }
                  />
                  <p className="text-xs leading-5 text-slate-500">
                    Email hợp lệ sẽ được thêm vào danh sách lời mời khi anh lưu nhóm.
                  </p>
                </div>
              }
            >
              <button
                type="button"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
              >
                <UserAddOutlined />
                Add Member
              </button>
            </Popover>
          }
        >
          <div className="flex flex-wrap gap-2.5">
            {visibleMembers.map((member) => (
              <ChipButton
                key={member.userId}
                label={member.name}
                color="#94A3B8"
                avatar={{
                  src: member.avatar,
                  initials: getInitials(member.name),
                }}
                onRemove={
                  member.role === 'owner'
                    ? undefined
                    : () =>
                        setRemovedMemberUserIds((current) =>
                          current.includes(member.userId) ? current : [...current, member.userId],
                        )
                }
              />
            ))}

            {inviteEmails.map((email) => (
              <ChipButton
                key={email}
                label={email}
                color="#2563EB"
                avatar={{ initials: getInitials(email.split('@')[0] ?? email) }}
                onRemove={() => removeInviteEmail(email)}
              />
            ))}

            {visibleMembers.length === 0 && inviteEmails.length === 0 && (
              <p className="text-sm text-slate-400">
                Chưa có thành viên hoặc email lời mời nào được chọn.
              </p>
            )}
          </div>
        </SectionBlock>

        <SectionBlock title="Statuses">
          <div className="flex flex-wrap gap-2.5">
            {statuses.map((status) => (
              <Popover
                key={status.key}
                trigger="click"
                open={statusEditorKey === status.key}
                onOpenChange={(open) => {
                  if (open) {
                    openExistingStatusEditor(status);
                  } else if (statusEditorKey === status.key) {
                    closeStatusEditor();
                  }
                }}
                content={
                  <StatusEditorPopoverContent
                    value={statusEditor}
                    onChange={(patch) => setStatusEditor((current) => ({ ...current, ...patch }))}
                    onSubmit={handleSubmitStatusEditor}
                    onCancel={closeStatusEditor}
                    onPresetSearch={setStatusPresetSearch}
                    presetOptions={statusPresetOptions}
                    loading={statusPresetsQuery.isLoading}
                    submitLabel="Save"
                  />
                }
              >
                <span>
                  <ChipButton
                    label={status.name.toUpperCase()}
                    color={status.color}
                    onClick={() => openExistingStatusEditor(status)}
                    onRemove={() => removeStatusDraft(status.key)}
                  />
                </span>
              </Popover>
            ))}

            <Popover
              trigger="click"
              open={statusEditorKey === NEW_STATUS_EDITOR_KEY}
              onOpenChange={(open) => {
                if (open) {
                  openNewStatusEditor();
                } else {
                  closeStatusEditor();
                }
              }}
              content={
                <StatusEditorPopoverContent
                  value={statusEditor}
                  onChange={(patch) => setStatusEditor((current) => ({ ...current, ...patch }))}
                  onSubmit={handleSubmitStatusEditor}
                  onCancel={closeStatusEditor}
                  onPresetSearch={setStatusPresetSearch}
                  presetOptions={statusPresetOptions}
                  loading={statusPresetsQuery.isLoading}
                  submitLabel="Add Status"
                />
              }
            >
              <span>
                <AddPillButton label="Add Status" onClick={openNewStatusEditor} />
              </span>
            </Popover>
          </div>
        </SectionBlock>

        <SectionBlock title="Labels">
          <div className="flex flex-wrap gap-2.5">
            {labels.map((label) => (
              <Popover
                key={label.key}
                trigger="click"
                open={labelEditorKey === label.key}
                onOpenChange={(open) => {
                  if (open) {
                    openExistingLabelEditor(label);
                  } else if (labelEditorKey === label.key) {
                    closeLabelEditor();
                  }
                }}
                content={
                  <LabelEditorPopoverContent
                    value={labelEditor}
                    onChange={(patch) => setLabelEditor((current) => ({ ...current, ...patch }))}
                    onSubmit={handleSubmitLabelEditor}
                    onCancel={closeLabelEditor}
                    onPresetSearch={setLabelPresetSearch}
                    presetOptions={labelPresetOptions}
                    loading={labelPresetsQuery.isLoading}
                    submitLabel="Save"
                  />
                }
              >
                <span>
                  <ChipButton
                    label={label.name}
                    color={label.color}
                    onClick={() => openExistingLabelEditor(label)}
                    onRemove={() => removeLabelDraft(label.key)}
                  />
                </span>
              </Popover>
            ))}

            <Popover
              trigger="click"
              open={labelEditorKey === NEW_LABEL_EDITOR_KEY}
              onOpenChange={(open) => {
                if (open) {
                  openNewLabelEditor();
                } else {
                  closeLabelEditor();
                }
              }}
              content={
                <LabelEditorPopoverContent
                  value={labelEditor}
                  onChange={(patch) => setLabelEditor((current) => ({ ...current, ...patch }))}
                  onSubmit={handleSubmitLabelEditor}
                  onCancel={closeLabelEditor}
                  onPresetSearch={setLabelPresetSearch}
                  presetOptions={labelPresetOptions}
                  loading={labelPresetsQuery.isLoading}
                  submitLabel="Add Label"
                />
              }
            >
              <span>
                <AddPillButton label="Add Label" onClick={openNewLabelEditor} />
              </span>
            </Popover>
          </div>
        </SectionBlock>
      </div>

      <div className="mt-6 flex justify-end gap-2.5 border-t border-slate-100 px-1 pt-4">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          type="primary"
          htmlType="submit"
          loading={saveGroupEditorMutation.isPending}
          className="shadow-lg shadow-primary/20"
        >
          {mode === 'create' ? 'Create Group' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}

export function GroupEditorModal({ open, onClose, mode, groupId, group }: GroupEditorModalProps) {
  const groupStatusesQuery = useGroupStatuses(groupId, open && mode === 'edit');
  const groupLabelsQuery = useGroupLabels(groupId, open && mode === 'edit');

  const isEditLoading =
    mode === 'edit' && (groupStatusesQuery.isLoading || groupLabelsQuery.isLoading || !group);

  const initialValues: CreateGroupFormValues =
    mode === 'create'
      ? {
          name: '',
          description: '',
          startDate: '',
          endDate: '',
        }
      : {
          name: group?.name ?? '',
          description: group?.description ?? '',
          startDate: normalizeDateInputValue(group?.startDate),
          endDate: normalizeDateInputValue(group?.endDate),
        };

  const initialStatuses =
    mode === 'create'
      ? createDefaultStatusDrafts()
      : (groupStatusesQuery.data ?? []).map(buildStatusDraftFromStatus);

  const initialLabels =
    mode === 'create' ? [] : (groupLabelsQuery.data ?? []).map(buildLabelDraftFromLabel);

  const formKey =
    mode === 'create'
      ? 'create-group-editor'
      : `edit-group-editor-${groupId ?? 'unknown'}-${(groupStatusesQuery.data ?? [])
          .map((status) => status._id)
          .join('-')}-${(groupLabelsQuery.data ?? []).map((label) => label._id).join('-')}`;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      destroyOnHidden
      width={820}
      title={
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <TeamOutlined className="text-lg" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">
              {mode === 'create' ? 'Create Group' : 'Edit Group'}
            </h2>
          </div>
        </div>
      }
    >
      {isEditLoading ? (
        <div className="space-y-3 py-4">
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      ) : (
        <GroupEditorFormContent
          key={formKey}
          mode={mode}
          onClose={onClose}
          groupId={groupId}
          group={group}
          initialValues={initialValues}
          initialStatuses={initialStatuses}
          initialLabels={initialLabels}
        />
      )}
    </Modal>
  );
}
