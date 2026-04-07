export function FullPageSpinner() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-white z-50">
      <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin mb-4" />
      <span className="text-indigo-600 font-semibold text-lg tracking-tight">ContentFlow</span>
    </div>
  );
}
