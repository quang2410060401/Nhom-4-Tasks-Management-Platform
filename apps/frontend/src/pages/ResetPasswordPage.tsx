import { Input, Button, Result } from 'antd';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { MdLockReset, MdOutlineLock, MdOutlineVerifiedUser, MdArrowBack } from 'react-icons/md';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPasswordSchema, type ResetPasswordFormValues } from '@/features/auth/schemas';
import { useResetPassword } from '@/features/auth/hooks';
import { ROUTES } from '@/lib/constants/routes';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { mutate: resetPassword, isPending } = useResetPassword();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: yupResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const onSubmit = (values: ResetPasswordFormValues) => {
    if (!token) return;
    resetPassword({ token, newPassword: values.newPassword });
  };

  // ──── Missing or invalid token ────
  if (!token) {
    return (
      <div className="bg-background-light font-display text-slate-900 min-h-screen flex flex-col">
        <main className="flex-1 flex items-center justify-center p-6">
          <Result
            status="error"
            title="Invalid reset link"
            subTitle="The password reset link is missing a token. Please request a new one."
            extra={
              <Link to={ROUTES.FORGOT_PASSWORD}>
                <Button type="primary">Request new link</Button>
              </Link>
            }
          />
        </main>
      </div>
    );
  }

  return (
    <div className="bg-background-light font-display text-slate-900 min-h-screen flex flex-col">
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-8">
              <div className="flex flex-col gap-2 mb-8">
                <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                  <span className="text-primary text-3xl flex items-center justify-center">
                    <MdLockReset size={30} />
                  </span>
                </div>
                <h1 className="text-slate-900 text-2xl font-bold leading-tight">Reset Password</h1>
                <p className="text-slate-500 text-sm font-normal">
                  Enter your new password below to regain access to your TaskMaster account.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
                <div>
                  <label className="text-slate-700 text-sm font-semibold leading-normal mb-1.5 block">
                    New Password
                  </label>
                  <Controller
                    name="newPassword"
                    control={control}
                    render={({ field }) => (
                      <Input.Password
                        size="large"
                        placeholder="6-12 characters"
                        {...field}
                        status={errors.newPassword ? 'error' : ''}
                        prefix={
                          <span className="text-slate-400 mr-2 flex items-center">
                            <MdOutlineLock size={20} />
                          </span>
                        }
                      />
                    )}
                  />
                  {errors.newPassword && (
                    <p className="text-red-500 text-xs mt-1">{errors.newPassword.message}</p>
                  )}
                </div>

                <div>
                  <label className="text-slate-700 text-sm font-semibold leading-normal mb-1.5 block">
                    Confirm New Password
                  </label>
                  <Controller
                    name="confirmPassword"
                    control={control}
                    render={({ field }) => (
                      <Input.Password
                        size="large"
                        placeholder="Repeat your password"
                        {...field}
                        status={errors.confirmPassword ? 'error' : ''}
                        prefix={
                          <span className="text-slate-400 mr-2 flex items-center">
                            <MdOutlineVerifiedUser size={20} />
                          </span>
                        }
                      />
                    )}
                  />
                  {errors.confirmPassword && (
                    <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>
                  )}
                </div>

                <div className="pt-2">
                  <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    loading={isPending}
                    className="w-full shadow-md"
                  >
                    Change Password
                  </Button>
                </div>
              </form>
            </div>
            <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 text-center">
              <Link
                to={ROUTES.LOGIN}
                className="text-primary hover:text-primary/80 text-sm font-medium flex items-center justify-center gap-1"
              >
                <span className="flex items-center">
                  <MdArrowBack size={16} />
                </span>
                Back to login
              </Link>
            </div>
          </div>
          <p className="text-slate-400 text-[12px] text-center mt-8">
            © 2026 TaskMaster. Đồ án nhóm 2 <br />
            Protected by industry standard encryption.
          </p>
        </div>
      </main>
    </div>
  );
}
