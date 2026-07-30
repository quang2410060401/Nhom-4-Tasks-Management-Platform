import { MdOutlineCheckCircle } from 'react-icons/md';
import { Link, useSearchParams } from 'react-router-dom';
import { ROUTES } from '@/lib/constants/routes';
import { buildQueryString } from '@/lib/utils/queryString';
import { extractRedirectPath, loadPendingRedirectPath } from '@/lib/utils/navigation';
import RegisterLeftPanel from '../features/auth/components/RegisterLeftPanel';
import RegisterForm from '../features/auth/components/RegisterForm';
// import RegisterSocialLogin from '../features/auth/components/RegisterSocialLogin';

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const redirectPath =
    extractRedirectPath(searchParams.toString()) ?? loadPendingRedirectPath();
  const loginHref = `${ROUTES.LOGIN}${buildQueryString({
    redirect: redirectPath ?? undefined,
  })}`;

  return (
    <div className="flex min-h-screen font-display bg-background-light text-slate-900 antialiased">
      <RegisterLeftPanel />

      {/* Right Side: Registration Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 py-12 lg:px-24 bg-white">
        <div className="max-w-md w-full mx-auto">
          {/* Mobile Header */}
          <div className="flex items-center gap-3 text-primary mb-8 lg:hidden">
            <span className="w-8 h-8 flex items-center justify-center">
              <MdOutlineCheckCircle size={32} />
            </span>
            <h1 className="text-xl font-bold tracking-tight">TaskMaster</h1>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Create an account</h2>
            <p className="text-slate-600">Start managing your projects like a pro today.</p>
          </div>

          <RegisterForm />
          {/* <RegisterSocialLogin /> */}

          {/* Footer Link */}
          <div className="mt-8 text-center">
            <p className="text-slate-600">
              Already have an account?{' '}
              <Link to={loginHref} className="text-primary hover:underline font-bold">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
