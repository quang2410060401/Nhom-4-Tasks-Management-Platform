import { MdOutlineCheckCircle, MdOutlineCircle } from 'react-icons/md';

export default function RegisterLeftPanel() {
  return (
    <div className="hidden lg:flex lg:w-1/2 relative bg-primary/10 flex-col justify-between p-12 overflow-hidden">
      <div className="relative z-10">
        <div className="flex items-center gap-3 text-primary mb-12">
          <span className="w-10 h-10 flex items-center justify-center">
            <MdOutlineCheckCircle size={40} />
          </span>
          <h1 className="text-2xl font-bold tracking-tight">TaskMaster</h1>
        </div>
        <div className="max-w-md">
          <h2 className="text-4xl font-black leading-tight mb-6">
            Master your workflow, one task at a time.
          </h2>
          <p className="text-lg text-slate-600">
            Join over 50,000 professionals who use TaskMaster to stay organized and hit every
            deadline with ease.
          </p>
        </div>
      </div>

      {/* Illustration Area */}
      <div className="relative z-10 flex justify-center items-center">
        <div className="w-full max-w-lg aspect-square bg-white rounded-xl shadow-2xl p-8 border border-slate-200">
          <div className="flex flex-col gap-4">
            <div className="h-8 w-1/3 bg-primary/20 rounded"></div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-green-500 w-6 h-6 flex items-center justify-center">
                  <MdOutlineCheckCircle size={24} />
                </span>
                <div className="h-2 w-full bg-slate-200 rounded"></div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-primary w-6 h-6 flex items-center justify-center">
                  <MdOutlineCircle size={24} />
                </span>
                <div className="h-2 w-3/4 bg-slate-200 rounded"></div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-300 w-6 h-6 flex items-center justify-center">
                  <MdOutlineCircle size={24} />
                </span>
                <div className="h-2 w-1/2 bg-slate-200 rounded"></div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white"></div>
                <div className="w-8 h-8 rounded-full bg-primary/40 border-2 border-white"></div>
                <div className="w-8 h-8 rounded-full bg-slate-300 border-2 border-white"></div>
              </div>
              <div className="h-8 w-20 bg-primary rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 text-sm text-slate-500">© 2026 TaskMaster. Đồ án nhóm 2</div>

      {/* Background Decoration */}
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
      <div className="absolute top-1/2 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-2xl"></div>
    </div>
  );
}
