import { Input, Button } from 'antd';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { MdLockReset, MdOutlineMail, MdArrowBack, MdMarkEmailRead } from 'react-icons/md';
import { Link } from 'react-router-dom';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '@/features/auth/schemas';
import { useForgotPassword } from '@/features/auth/hooks';
import { ROUTES } from '@/lib/constants/routes';

export default function ForgotPasswordPage() {
  const { mutate: forgotPassword, isPending, isSuccess } = useForgotPassword();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: yupResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = (values: ForgotPasswordFormValues) => {
    forgotPassword(values);
  };

  return (
    <div className="bg-background-light font-display text-slate-900 min-h-screen flex flex-col">
      <div className="layout-container flex h-full grow flex-col">
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-120 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-8 flex flex-col gap-6">
              {isSuccess ? (
                /* ──── Success state: Check your email ──── */
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="mx-auto size-12 flex items-center justify-center bg-green-100 rounded-full mb-2">
                    <MdMarkEmailRead size={28} className="text-green-600" />
                  </div>
                  <h1 className="text-slate-900 text-2xl font-bold leading-tight">
                    Check your email
                  </h1>
                  <p className="text-slate-500 text-sm">
                    If an account exists for that email, we've sent password reset instructions.
                    Please check your inbox.
                  </p>
                  <Link
                    to={ROUTES.LOGIN}
                    className="flex items-center gap-2 text-slate-500 text-sm font-medium hover:text-primary transition-colors group mt-4"
                  >
                    <span className="flex items-center group-hover:-translate-x-1 transition-transform">
                      <MdArrowBack size={18} />
                    </span>
                    Back to Login
                  </Link>
                </div>
              ) : (
                /* ──── Form state ──── */
                <>
                  <div className="flex flex-col gap-2 text-center">
                    <div className="mx-auto size-12 flex items-center justify-center bg-primary/10 rounded-full mb-2">
                      <span className="text-primary text-3xl flex items-center justify-center">
                        <MdLockReset size={30} />
                      </span>
                    </div>
                    <h1 className="text-slate-900 text-2xl font-bold leading-tight">
                      Forgot password?
                    </h1>
                    <p className="text-slate-500 text-sm font-normal">
                      No worries, we'll send you reset instructions to your inbox.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
                    <div>
                      <label className="text-slate-700 text-sm font-medium mb-1.5 block">
                        Email address
                      </label>
                      <Controller
                        name="email"
                        control={control}
                        render={({ field }) => (
                          <Input
                            size="large"
                            placeholder="name@company.com"
                            {...field}
                            status={errors.email ? 'error' : ''}
                            prefix={
                              <span className="text-slate-400 mr-2 flex items-center">
                                <MdOutlineMail size={20} />
                              </span>
                            }
                          />
                        )}
                      />
                      {errors.email && (
                        <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
                      )}
                    </div>

                    <Button
                      type="primary"
                      htmlType="submit"
                      size="large"
                      loading={isPending}
                      className="w-full shadow-lg shadow-primary/20"
                    >
                      Reset Password
                    </Button>
                  </form>

                  <div className="flex flex-col items-center gap-4">
                    <Link
                      to={ROUTES.LOGIN}
                      className="flex items-center gap-2 text-slate-500 text-sm font-medium hover:text-primary transition-colors group"
                    >
                      <span className="flex items-center group-hover:-translate-x-1 transition-transform">
                        <MdArrowBack size={18} />
                      </span>
                      Back to Login
                    </Link>
                  </div>
                </>
              )}
            </div>
            <div className="bg-slate-50 px-8 py-4 border-t border-slate-200 text-center">
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">
                Secure Task Management
              </p>
            </div>
          </div>
        </main>
        <footer className="py-6 text-center">
          <p className="text-slate-400 text-xs">© 2026 TaskMaster. Đồ án nhóm 2</p>
        </footer>
      </div>
    </div>
  );
}
