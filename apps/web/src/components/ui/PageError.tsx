interface PageErrorProps {
  title?: string;
  message?: string;
  action?: { label: string; onClick: () => void };
}

export function PageError({ title = 'Something went wrong', message, action }: PageErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] p-8 text-center">
      <div className="text-4xl mb-4">😕</div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
      {message && <p className="text-sm text-gray-500 mb-5 max-w-sm">{message}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
