import { Link, useSearchParams } from 'react-router-dom';
import { ROUTES } from '@/lib/constants/routes';
import { buildQueryString } from '@/lib/utils/queryString';
import { extractRedirectPath, loadPendingRedirectPath } from '@/lib/utils/navigation';
import LeftPanel from '../features/auth/components/LeftPanel';
import LoginForm from '../features/auth/components/LoginForm';
// import SocialLogin from '../features/auth/components/SocialLogin';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const redirectPath = extractRedirectPath(searchParams.toString()) ?? loadPendingRedirectPath();
  const registerHref = `${ROUTES.REGISTER}${buildQueryString({
    redirect: redirectPath ?? undefined,
  })}`;

  return (
    <div className="flex min-h-screen font-display bg-background-light text-slate-900 antialiased">
      <LeftPanel />

      {/* Right Side: Login Form Panel */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center px-6 py-12 bg-white">
        <div className="w-full max-w-md flex flex-col h-full">
          <div className="grow flex flex-col justify-center">
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center gap-2 mb-8">
              <div className="size-8 flex items-center justify-center bg-primary rounded-lg">
                <svg
                  className="text-white size-5"
                  fill="none"
                  viewBox="0 0 48 48"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M6 6H42L36 24L42 42H6L12 24L6 6Z" fill="currentColor"></path>
                </svg>
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">TaskMaster</span>
            </div>

            <div className="mb-10 text-left">
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Welcome Back</h2>
              <p className="text-slate-500">Please enter your details to sign in.</p>
            </div>

            <LoginForm />
            {/* <SocialLogin /> */}

            <p className="!mt-2 text-center text-sm text-slate-500">
              Don't have an account?{' '}
              <Link to={registerHref} className="font-bold text-primary hover:underline">
                Create an account
              </Link>
            </p>
          </div>

          {/* Footer Links */}
          <div className="mt-8 pt-8 flex gap-6 text-xs text-slate-400 justify-center lg:justify-start">
            <a href="#" className="hover:text-primary transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              Terms of Service
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              Help Center
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
