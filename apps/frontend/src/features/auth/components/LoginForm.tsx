import { Input, Button, Checkbox } from 'antd';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Link } from 'react-router-dom';
import { loginSchema, type LoginFormValues } from '../schemas';
import { useLogin } from '../hooks';
import { ROUTES } from '@/lib/constants/routes';

export default function LoginForm() {
  const { mutate: login, isPending } = useLogin();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: yupResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (values: LoginFormValues) => {
    login(values);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full flex flex-col gap-5">
      {/* Email */}
      <div>
        <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Email Address</label>
        <Controller
          name="email"
          control={control}
          render={({ field }) => (
            <Input
              size="large"
              placeholder="name@company.com"
              {...field}
              status={errors.email ? 'error' : ''}
            />
          )}
        />
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
      </div>

      {/* Password */}
      <div className="relative">
        <div className="absolute right-0 top-0 z-10">
          <Link
            to={ROUTES.FORGOT_PASSWORD}
            className="text-sm font-semibold text-primary hover:text-primary/80 leading-8"
          >
            Forgot password?
          </Link>
        </div>
        <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Password</label>
        <Controller
          name="password"
          control={control}
          render={({ field }) => (
            <Input.Password
              size="large"
              placeholder="Enter your password"
              {...field}
              status={errors.password ? 'error' : ''}
            />
          )}
        />
        {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
      </div>

      {/* Remember me */}
      <div className="mb-1">
        <Checkbox className="text-sm text-slate-700">Remember me</Checkbox>
      </div>

      {/* Submit */}
      <Button
        type="primary"
        htmlType="submit"
        block
        size="large"
        className="shadow-sm"
        loading={isPending}
      >
        Sign In
      </Button>
    </form>
  );
}
