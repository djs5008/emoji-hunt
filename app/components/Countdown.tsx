'use client';

interface CountdownProps {
  count: number;
}

export default function Countdown({ count }: CountdownProps) {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      <div className="text-white">
        {count > 0 ? (
          <div className="text-9xl font-bold animate-pulse">{count}</div>
        ) : (
          <div className="text-6xl font-bold animate-pulse">GO!</div>
        )}
      </div>
    </div>
  );
}