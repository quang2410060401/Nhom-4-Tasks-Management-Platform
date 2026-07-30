import { useEffect } from 'react';
import { Button, Input, Modal, Select } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { inviteMemberSchema } from '../schemas';
import { useInviteMember } from '../hooks';
import type { InviteMemberFormValues } from '../types';

interface InviteMemberModalProps {
  groupId: string;
  open: boolean;
  onClose: () => void;
}

export function InviteMemberModal({ groupId, open, onClose }: InviteMemberModalProps) {
  const inviteMemberMutation = useInviteMember(groupId);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteMemberFormValues>({
    resolver: yupResolver(inviteMemberSchema),
    defaultValues: {
      email: '',
      role: 'member',
    },
  });

  useEffect(() => {
    if (!open) {
      reset({ email: '', role: 'member' });
    }
  }, [open, reset]);

  const onSubmit = (values: InviteMemberFormValues) => {
    inviteMemberMutation.mutate(values, {
      onSuccess: () => {
        onClose();
      },
    });
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      destroyOnHidden
      width={520}
      title={
        <div>
          <p className="text-xl font-bold text-slate-950">Mời thành viên</p>
          <p className="mt-1 text-sm font-normal text-slate-500">
            Thêm một người vào nhóm để bắt đầu cộng tác.
          </p>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-3">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Email thành viên
          </label>
          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                size="large"
                placeholder="name@example.com"
                prefix={<MailOutlined className="text-slate-400" />}
                status={errors.email ? 'error' : ''}
              />
            )}
          />
          {errors.email && <p className="mt-2 text-xs text-red-500">{errors.email.message}</p>}
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Vai trò</label>
          <Controller
            name="role"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                size="large"
                className="w-full"
                style={{ width: '100%' }}
                options={[
                  { value: 'member', label: 'Thành viên' },
                  { value: 'admin', label: 'Quản trị viên' },
                ]}
                status={errors.role ? 'error' : ''}
              />
            )}
          />
          {errors.role && <p className="mt-2 text-xs text-red-500">{errors.role.message}</p>}
          <p className="mt-2 text-xs italic text-slate-400">
            Quản trị viên có thể sửa nhóm, mời hoặc quản lý thành viên, nhưng không được xóa nhóm.
          </p>
        </div>

        <div className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3 text-sm leading-6 text-slate-600">
          Thành viên được mời sẽ nhận email hướng dẫn để tham gia nhóm của anh.
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
          <Button onClick={onClose}>Huỷ</Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={inviteMemberMutation.isPending}
            className="shadow-lg shadow-primary/20"
          >
            Gửi lời mời
          </Button>
        </div>
      </form>
    </Modal>
  );
}
