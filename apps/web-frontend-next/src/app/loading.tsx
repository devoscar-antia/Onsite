export default function Loading() {
  return (
    <div className="h-screen overflow-hidden bg-app">
      <div className="flex h-full">
        <div className="hidden h-screen w-60 shrink-0 animate-pulse bg-surface md:block" />
        <main className="flex flex-1 flex-col overflow-hidden md:ml-60">
          <div className="mx-auto flex h-full w-full max-w-[1500px] flex-col gap-4 px-4 py-4 md:px-8 md:py-6">
            <div className="h-14 shrink-0 animate-pulse rounded-2xl bg-surface" />
            <div className="flex-1 animate-pulse rounded-2xl bg-surface" />
          </div>
        </main>
      </div>
    </div>
  );
}
