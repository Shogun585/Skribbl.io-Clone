import React from 'react';

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Matching you into an active room...'
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-[#010413]/90 backdrop-blur-md flex flex-col items-center justify-center gap-5">
      <div className="relative flex items-center justify-center">
        <div className="loading-circle-1" />
        <div className="loading-circle-2 absolute" />
      </div>
      <p className="text-sm font-semibold text-[#2CF08A] tracking-wide animate-pulse">
        {message}
      </p>
    </div>
  );
};
