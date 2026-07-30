import { Input, Button } from 'antd';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { MdPersonOutline, MdOutlineMail, MdOutlineLock, MdArrowForward } from 'react-icons/md';
import { registerSchema, type RegisterFormValues } from '../schemas';
import { useRegister } from '../hooks';

export default function RegisterForm() {
  const { mutate: register, isPending } = useRegister();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: yupResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = ({ name, email, password }: RegisterFormValues) => {
    register({ name, email, password });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full flex flex-col gap-5">
      {/* Full Name */}
      <div>
        <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Full Name</label>
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <Input
              size="large"
              placeholder="John Doe"
              {...field}
              status={errors.name ? 'error' : ''}
              prefix={
                <span className="text-slate-400 mr-2 flex items-center">
                  <MdPersonOutline size={20} />
                </span>
              }
            />
          )}
        />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>

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
              prefix={
                <span className="text-slate-400 mr-2 flex items-center">
                  <MdOutlineMail size={20} />
                </span>
              }
            />
          )}
        />
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
      </div>

      {/* Password */}
      <div>
        <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Password</label>
        <Controller
          name="password"
          control={control}
          render={({ field }) => (
            <Input.Password
              size="large"
              placeholder="••••••••"
              {...field}
              status={errors.password ? 'error' : ''}
              prefix={
                <span className="text-slate-400 mr-2 flex items-center">
                  <MdOutlineLock size={20} />
                </span>
              }
            />
          )}
        />
        {errors.password ? (
          <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
        ) : (
          <p className="text-xs text-slate-500 mt-1">
            6-12 characters, uppercase, lowercase, digit &amp; special character.
          </p>
        )}
      </div>

      {/* Confirm Password */}
      <div>
        <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
          Confirm Password
        </label>
        <Controller
          name="confirmPassword"
          control={control}
          render={({ field }) => (
            <Input.Password
              size="large"
              placeholder="••••••••"
              {...field}
              status={errors.confirmPassword ? 'error' : ''}
              prefix={
                <span className="text-slate-400 mr-2 flex items-center">
                  <MdOutlineLock size={20} />
                </span>
              }
            />
          )}
        />
        {errors.confirmPassword && (
          <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>
        )}
      </div>

      {/* Terms */}
      {/* <div>
        <Checkbox className="text-sm text-slate-600">
          I agree to the{' '}
          <span className="text-primary hover:underline font-medium">Terms of Service</span> and{' '}
          <span className="text-primary hover:underline font-medium">Privacy Policy</span>.
        </Checkbox>
      </div> */}

      {/* Submit */}
      <Button
        type="primary"
        htmlType="submit"
        block
        size="large"
        loading={isPending}
        className="shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
      >
        Sign Up{' '}
        <span className="flex items-center">
          <MdArrowForward size={20} />
        </span>
      </Button>
    </form>
  );
}
