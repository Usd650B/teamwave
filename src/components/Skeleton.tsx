import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  circle?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', width, height, circle }) => {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded-lg ${className}`}
      style={{
        width,
        height,
        borderRadius: circle ? '50%' : undefined,
      }}
    />
  );
};

export const MessageSkeleton = () => (
  <div className="flex flex-col gap-3 w-full">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'} w-full`}>
        <Skeleton width={i % 2 === 0 ? '60%' : '45%'} height={40} className={i % 2 === 0 ? 'rounded-tr-none' : 'rounded-tl-none'} />
      </div>
    ))}
  </div>
);

export const ChatListItemSkeleton = () => (
  <div className="flex items-center gap-4 p-5 w-full border border-gray-100 rounded-3xl">
    <Skeleton width={56} height={56} circle />
    <div className="flex-1 space-y-2">
      <div className="flex justify-between">
        <Skeleton width="40%" height={16} />
        <Skeleton width="15%" height={10} />
      </div>
      <Skeleton width="70%" height={12} />
    </div>
  </div>
);
