import * as yup from 'yup';
import type { CreateGroupFormValues, InviteMemberFormValues } from '../types';

function normalizeDateValue(value?: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export const createGroupSchema: yup.ObjectSchema<CreateGroupFormValues> = yup
  .object({
    name: yup
      .string()
      .required('Vui lòng nhập tên nhóm')
      .transform((value) => (typeof value === 'string' ? value.trim() : value))
      .min(1, 'Tên nhóm không được để trống')
      .max(100, 'Tên nhóm tối đa 100 ký tự'),
    description: yup
      .string()
      .default('')
      .transform((value) => (typeof value === 'string' ? value.trim() : value))
      .max(500, 'Mô tả tối đa 500 ký tự'),
    startDate: yup
      .string()
      .default('')
      .test('start-date-format', 'Ngày bắt đầu không hợp lệ', (value) => {
        if (!value) return true;
        return !Number.isNaN(new Date(value).getTime());
      })
      .test('start-date-not-past', 'Ngày bắt đầu không được ở quá khứ', (value) => {
        if (!value) return true;
        const startDate = normalizeDateValue(value);
        if (!startDate) return true;
        return startDate.getTime() >= startOfToday().getTime();
      }),
    endDate: yup
      .string()
      .default('')
      .test('end-date-format', 'Ngày kết thúc không hợp lệ', (value) => {
        if (!value) return true;
        return !Number.isNaN(new Date(value).getTime());
      })
      .test('end-after-start', 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu', function (value) {
        if (!value || !this.parent.startDate) return true;
        const endDate = normalizeDateValue(value);
        const startDate = normalizeDateValue(this.parent.startDate);
        if (!endDate || !startDate) return true;
        return endDate.getTime() >= startDate.getTime();
      })
      .test(
        'end-after-today-without-start',
        'Nếu chưa chọn ngày bắt đầu thì ngày kết thúc phải từ hôm nay trở đi',
        function (value) {
          if (!value || this.parent.startDate) return true;
          const endDate = normalizeDateValue(value);
          if (!endDate) return true;
          return endDate.getTime() >= startOfToday().getTime();
        },
      ),
  })
  .required();

export const inviteMemberSchema: yup.ObjectSchema<InviteMemberFormValues> = yup
  .object({
    email: yup
      .string()
      .required('Vui lòng nhập email')
      .transform((value) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
      .email('Email không đúng định dạng'),
    role: yup
      .mixed<InviteMemberFormValues['role']>()
      .oneOf(['admin', 'member'], 'Vai trò không hợp lệ')
      .required('Vui lòng chọn vai trò'),
  })
  .required();
