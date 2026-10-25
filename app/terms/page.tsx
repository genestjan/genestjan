import type { Metadata } from 'next';
import LegalPage, { H, L } from '@/components/layout/LegalPage';
import { site } from '@/lib/content';

export const metadata: Metadata = {
  title: `Terms of use | ${site.name}`,
  description: 'The terms for using genestjanramirez.com and the RideWise planner.',
  alternates: { canonical: `${site.domain}/terms/` },
};

const Ul = ({ children }: { children: React.ReactNode }) => <ul className="grid list-disc gap-2 pl-5">{children}</ul>;

export default function Terms() {
  return (
    <LegalPage title="Terms of use" updated="25 October 2026">
      <p>
        These terms cover your use of this website, genestjanramirez.com, including the free RideWise planner at
        genestjanramirez.com/ridewise. By using the site you agree to them. How I handle personal information is explained in
        the <L href="/privacy/">privacy notice</L>.
      </p>

      <H>Who runs this site</H>
      <p>
        {site.name}, freelance digital marketing and operations specialist, {site.location}.
        Contact: <L href={`mailto:${site.email}`}>{site.email}</L>.
      </p>

      <H>Working together</H>
      <Ul>
        <li>
          The site describes my services. A message, call or quote is not a contract. Paid work starts only when we both agree
          the scope, price and terms in writing (for example a signed proposal or agreement), and those terms then apply to the
          work.
        </li>
        <li>
          Case studies and results show what happened for those clients. They are examples, not a promise of the same results
          for your business.
        </li>
        <li>The information on this site is general. It is not legal, financial or tax advice.</li>
      </Ul>

      <H>Content on this site</H>
      <Ul>
        <li>
          The words, design, images and videos on this site belong to me unless stated otherwise. You may share links to the
          site, but please do not copy its content for your own business without asking.
        </li>
        <li>Client names, brands and logos belong to their owners and are shown to describe work I did.</li>
        <li>
          Links to other websites (such as Calendly, LinkedIn and client websites) are for your convenience. I am not responsible
          for their content or how they handle your information.
        </li>
      </Ul>

      <H>RideWise</H>
      <Ul>
        <li>RideWise is free, provided as it is, and may change or stop at any time.</li>
        <li>
          Routes, distances, heights, weather and places such as water stops come from free third-party map and weather services.
          They can be wrong or out of date. Always check the road, the weather and local rules yourself, ride within your limits,
          and follow traffic laws. You are responsible for your own safety.
        </li>
        <li>
          Your RideWise data stays on your device. Keep your password safe: if you forget it, I cannot recover your encrypted
          data.
        </li>
      </Ul>

      <H>Using the site fairly</H>
      <p>Please do not misuse the site, for example by trying to break it, overload it, or send spam through the contact form.</p>

      <H>Responsibility</H>
      <p>
        I work to keep the site accurate and available, but I cannot promise it will always be error free or online. As far as
        the law allows, I am not liable for any loss that comes from using this site or RideWise. Nothing in these terms limits
        rights you have under the law that cannot be limited.
      </p>

      <H>Law</H>
      <p>
        These terms are governed by the laws of the Philippines. If there is a disagreement, please contact me first and we will
        try to sort it out together.
      </p>

      <H>Changes</H>
      <p>If these terms change, the new version will be on this page with a new date at the top.</p>
    </LegalPage>
  );
}
