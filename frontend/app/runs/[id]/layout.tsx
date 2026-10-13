import { RunProvider } from "@/components/RunProvider";

export default async function RunLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const runId = decodeURIComponent(id);
  // `key` remounts the provider when the user switches to another run.
  return (
    <RunProvider key={runId} runId={runId}>
      {children}
    </RunProvider>
  );
}
