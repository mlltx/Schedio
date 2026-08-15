export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col items-center gap-6 px-8 text-center">
        <span className="text-sm font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Schedio
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-black sm:text-5xl dark:text-zinc-50">
          Welcome to Schedio
        </h1>
        <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          A visual model for scheduled work. See what&apos;s running, and why.
        </p>
      </main>
    </div>
  );
}
