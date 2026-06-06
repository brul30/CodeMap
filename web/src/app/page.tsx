export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 px-4 py-12">
      <div className="flex flex-col items-center gap-4 max-w-2xl">
        <h1 className="text-5xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
          CodeMap
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-300 text-center">
          Google Maps for the codebase your AI agents wrote
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-8">
          Scaffold online — Step 0
        </p>
      </div>
    </main>
  );
}
