import AppLogo from '@/components/common/AppLogo';
import { AiFillDashboard } from 'react-icons/ai';
import { PiShieldCheckeredFill } from 'react-icons/pi';

export default function LeftPanel() {
  return (
    <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary items-center justify-center">
      {/* Background Decoration */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full mix-blend-overlay filter blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full mix-blend-overlay filter blur-3xl translate-x-1/2 translate-y-1/2"></div>
      </div>

      <div className="relative z-10 px-20 text-white">
        <div className="flex items-center gap-3 mb-12">
          <AppLogo />
        </div>

        <h1 className="text-5xl font-black leading-tight mb-6">
          Streamline your workflow effortlessly.
        </h1>

        <p className="text-lg text-white/80 max-w-md leading-relaxed">
          Join thousands of teams managing projects, tracking time, and delivering results faster
          with our unified workspace.
        </p>

        <div className="mt-12 grid grid-cols-2 gap-6">
          <div className="p-6 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
            <AiFillDashboard className="text-3xl mb-3 size-8" />
            <h3 className="font-bold">Fast Performance</h3>
            <p className="text-sm text-white/70">
              Optimized for speed and real-time collaboration.
            </p>
          </div>
          <div className="p-6 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
            <PiShieldCheckeredFill className="text-3xl mb-3 size-8" />
            <h3 className="font-bold">Enterprise Security</h3>
            <p className="text-sm text-white/70">Your data is protected with industry standards.</p>
          </div>
        </div>
      </div>

      {/* Abstract Visual */}
      <div
        className="absolute bottom-10 right-10 w-64 h-64 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCoCtCs_LftHKkj6F_9baaoI6CrgEeEYnac_dgfK6Da__DxQXaROvEuyBhiLDmeN6P4SY4Tj3UAeC30e-HTljGBbSVUvsMoi8R9RKRv7X3mOAGD0fwOVLvOK-8uV2qMdeQifFa0G4WNUv5J_6fwTfMutoIh_XRYIfQhaUP-jR375hBwmq7_EBAo9QXWVVJ5fohvjNdwAo_0PNMruKupVyOMxjbmINhVp7evMFuhzQKGNYPcojE9a2F_r4S5Jx3OwJv61PEx2xCKugw')",
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
        }}
      ></div>
    </div>
  );
}
