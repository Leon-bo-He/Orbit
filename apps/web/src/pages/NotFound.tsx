import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-surface">
      <svg
        width="160"
        height="120"
        viewBox="0 0 160 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="mb-8"
        aria-hidden="true"
      >
        <rect x="20" y="20" width="120" height="80" rx="8" fill="#e0e7ff" />
        <rect x="35" y="35" width="40" height="6" rx="3" fill="#a5b4fc" />
        <rect x="35" y="48" width="60" height="6" rx="3" fill="#c7d2fe" />
        <rect x="35" y="61" width="50" height="6" rx="3" fill="#c7d2fe" />
        <circle cx="115" cy="85" r="25" fill="#6366f1" />
        <text x="115" y="92" textAnchor="middle" fill="white" fontSize="22" fontWeight="bold">
          ?
        </text>
      </svg>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">Page not found</h1>
      <p className="text-gray-500 text-sm mb-8 max-w-xs">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/"
        className="px-6 py-2.5 bg-indigo-600 text-white font-medium text-sm rounded-lg hover:bg-indigo-700 transition-colors"
      >
        Back to Home
      </Link>
    </div>
  );
}
