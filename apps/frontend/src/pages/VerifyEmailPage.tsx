import {
  MdMarkEmailRead,
  MdCheckCircle,
  MdError,
  MdHelpOutline,
  MdDescription,
} from 'react-icons/md';
import { Button, Spin } from 'antd';
import { Link, useSearchParams } from 'react-router-dom';
import { useVerifyEmail } from '@/features/auth/hooks';
import { ROUTES } from '@/lib/constants/routes';
import { buildQueryString } from '@/lib/utils/queryString';
import { extractRedirectPath, loadPendingRedirectPath } from '@/lib/utils/navigation';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const redirectPath =
    extractRedirectPath(searchParams.toString()) ?? loadPendingRedirectPath();
  const loginHref = `${ROUTES.LOGIN}${buildQueryString({
    redirect: redirectPath ?? undefined,
  })}`;
  const { isPending, isSuccess, isError } = useVerifyEmail(token);
  const isVerifying = Boolean(token) && (isPending || (!isSuccess && !isError));

  // ──── Token present → verification flow ────
  if (token) {
    return (
      <div className="bg-background-light min-h-screen flex flex-col font-display">
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-120 w-full bg-white shadow-xl rounded-xl overflow-hidden border border-slate-200">
            <div className="p-8 md:p-12 flex flex-col items-center text-center">
              {isVerifying && (
                <>
                  <Spin size="large" className="mb-6" />
                  <h1 className="text-slate-900 text-2xl font-bold">Verifying your email…</h1>
                  <p className="text-slate-500 mt-2">Please wait while we confirm your account.</p>
                </>
              )}

              {isSuccess && (
                <>
                  <div className="mb-6 flex items-center justify-center w-20 h-20 bg-green-100 text-green-600 rounded-full">
                    <MdCheckCircle size={40} />
                  </div>
                  <h1 className="text-slate-900 text-3xl font-bold tracking-tight">
                    Email verified!
                  </h1>
                  <p className="text-slate-600 text-base leading-relaxed mt-4">
                    Your account has been activated. You can now sign in and start managing your
                    tasks.
                  </p>
                  <Link to={loginHref} className="mt-8 w-full">
                    <Button
                      type="primary"
                      size="large"
                      block
                      className="h-12 text-base font-semibold"
                    >
                      Go to Login
                    </Button>
                  </Link>
                </>
              )}

              {isError && (
                <>
                  <div className="mb-6 flex items-center justify-center w-20 h-20 bg-red-100 text-red-600 rounded-full">
                    <MdError size={40} />
                  </div>
                  <h1 className="text-slate-900 text-3xl font-bold tracking-tight">
                    Verification failed
                  </h1>
                  <p className="text-slate-600 text-base leading-relaxed mt-4">
                    The verification link is invalid or has expired. Please try registering again.
                  </p>
                  <Link to={ROUTES.REGISTER} className="mt-8 w-full">
                    <Button
                      type="primary"
                      size="large"
                      block
                      className="h-12 text-base font-semibold"
                    >
                      Back to Register
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </main>
        <footer className="py-6 text-center text-slate-400 text-sm">
          <p>© 2026 TaskMaster. Đồ án nhóm 2.</p>
        </footer>
      </div>
    );
  }

  // ──── No token → "Check your email" informational page ────
  return (
    <div className="bg-background-light min-h-screen flex flex-col font-display">
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-120 w-full bg-white shadow-xl rounded-xl overflow-hidden border border-slate-200">
          <div className="p-8 md:p-12 flex flex-col items-center text-center">
            {/* Icon Section */}
            <div className="mb-8 relative">
              <div className="absolute inset-0 bg-primary/10 rounded-full scale-150 blur-xl"></div>
              <div className="relative flex items-center justify-center w-20 h-20 bg-primary/10 text-primary rounded-full">
                <span className="text-4xl font-light flex items-center justify-center">
                  <MdMarkEmailRead />
                </span>
              </div>
            </div>

            {/* Text Content */}
            <div className="space-y-4">
              <h1 className="text-slate-900 text-3xl font-bold tracking-tight">Check your email</h1>
              <p className="text-slate-600 text-base leading-relaxed">
                We've sent a verification link to your email address. Please click the link to
                activate your account and start managing your tasks.
              </p>
            </div>

            {/* Actions */}
            <div className="mt-10 w-full space-y-4">
              <Button
                type="primary"
                size="large"
                block
                className="h-12 text-base font-semibold shadow-sm"
              >
                Resend Email
              </Button>
              <Link
                to={ROUTES.REGISTER}
                className="inline-block text-sm font-medium text-slate-500 hover:text-primary transition-colors"
              >
                Entered the wrong email?{' '}
                <span className="text-primary underline underline-offset-4">Change it here</span>
              </Link>
            </div>

            {/* Footer Links inside card */}
            <div className="mt-12 pt-8 border-t border-slate-100 w-full">
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">
                Need help?
              </p>
              <div className="mt-4 flex justify-center gap-6">
                <span className="text-slate-500 hover:text-primary text-sm flex items-center gap-1 cursor-pointer">
                  <span className="text-lg flex items-center justify-center">
                    <MdHelpOutline />
                  </span>
                  Support
                </span>
                <span className="text-slate-500 hover:text-primary text-sm flex items-center gap-1 cursor-pointer">
                  <span className="text-lg flex items-center justify-center">
                    <MdDescription />
                  </span>
                  Docs
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Page Footer */}
      <footer className="py-6 text-center text-slate-400 text-sm">
        <p>© 2026 TaskMaster. Đồ án nhóm 2</p>
      </footer>
    </div>
  );
}
