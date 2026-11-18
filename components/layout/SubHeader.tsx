import { site } from '@/lib/content';
import MagneticButton from '@/components/ui/MagneticButton';

/** Header for inner pages: the home page's nav links are in-page anchors. */
export default function SubHeader() {
  return (
    <header className="mx-auto flex max-w-content items-center justify-between px-5 py-6 sm:px-8">
      <a href="/" className="font-display text-lg font-bold text-paper">{site.name}</a>
      <MagneticButton href={site.booking} external variant="ghost" className="!px-5 !py-2.5">Book a call</MagneticButton>
    </header>
  );
}
