export default function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mono-label mb-5 flex items-center gap-3 text-current">
      <span aria-hidden className="h-px w-9 bg-gradient-to-r from-current to-transparent" />
      {children}
    </p>
  );
}
