export default function ToolChip({ children }: { children: React.ReactNode }) {
  return (
    // inline-block, not inline: a label long enough to wrap used to break its
    // own border, leaving the second line hanging outside the box.
    <span className="mono-label inline-block rounded-md border border-line px-2.5 py-1.5 leading-snug text-muted transition-colors duration-300 hover:border-current hover:text-current">
      {children}
    </span>
  );
}
