/** Static gradient poster shown while the canvas loads, and permanently
 *  under prefers-reduced-motion. BRIEF 6.7 and 6.8. */
export default function CanvasFallback() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 65% 35%, rgba(30,58,95,0.5), transparent 62%),' +
            'radial-gradient(ellipse 50% 40% at 25% 70%, rgba(79,209,224,0.10), transparent 60%),' +
            'radial-gradient(circle at 80% 20%, rgba(255,176,58,0.07), transparent 45%)',
        }}
      />
      <div
        className="blueprint-grid absolute inset-0 opacity-40"
        style={{
          maskImage: 'radial-gradient(ellipse 75% 60% at 50% 40%, #000, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 75% 60% at 50% 40%, #000, transparent)',
        }}
      />
    </div>
  );
}
