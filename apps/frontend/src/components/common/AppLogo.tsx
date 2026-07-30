import React from 'react';

const AppLogo: React.FC = () => (
  <div className="flex items-center space-x-3">
    <div className="size-10 flex items-center justify-center bg-white rounded-lg">
      <svg
        className="text-primary size-6"
        fill="none"
        viewBox="0 0 48 48"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M6 6H42L36 24L42 42H6L12 24L6 6Z" fill="currentColor"></path>
      </svg>
    </div>
    <span className="text-2xl font-bold tracking-tight">TaskMaster</span>
  </div>
);

export default AppLogo;
