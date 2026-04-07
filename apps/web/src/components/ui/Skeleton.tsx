interface SkeletonProps {
  variant?: 'text' | 'card' | 'avatar';
  className?: string;
}

const VARIANT_CLASSES: Record<NonNullable<SkeletonProps['variant']>, string> = {
  text: 'h-4 w-full rounded',
  card: 'h-32 w-full rounded-xl',
  avatar: 'h-10 w-10 rounded-full flex-shrink-0',
};

export function Skeleton({ variant = 'text', className = '' }: SkeletonProps) {
  return (
    <div
      className={`bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] ${VARIANT_CLASSES[variant]} ${className}`}
      style={{ animation: 'shimmer 1.5s infinite linear' }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3 ${className}`}>
      <Skeleton variant="text" className="w-1/2" />
      <Skeleton variant="text" className="w-3/4" />
      <Skeleton variant="text" className="w-1/3" />
    </div>
  );
}
