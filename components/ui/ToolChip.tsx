export default function ToolChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="mono-label rounded-md border border-line px-2.5 py-1.5 text-muted transition-colors duration-300 hover:border-current hover:text-current">
      {children}
    </span>
  );
}
