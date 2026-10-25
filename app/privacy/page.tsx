import type { Metadata } from 'next';
import LegalPage, { H, L } from '@/components/layout/LegalPage';
import { site } from '@/lib/content';

export const metadata: Metadata = {
  title: `Privacy notice | ${site.name}`,
  description: 'What genestjanramirez.com collects, why, who it is shared with, and your rights.',
  alternates: { canonical: `${site.domain}/privacy/` },
};

const Ul = ({ children }: { children: React.ReactNode }) => <ul className="grid list-disc gap-2 pl-5">{children}</ul>;

export default function Privacy() {
  return (
    <LegalPage title="Privacy notice" updated="25 October 2026">
      <p>
        This notice explains what information this website (genestjanramirez.com, including the RideWise planner at
        genestjanramirez.com/ridewise) collects, why, who it is shared with, and what you can ask me to do with it.
      </p>

      <H>Who I am</H>
      <p>
        I am {site.name}, a freelance digital marketing and operations specialist based in {site.location}. I am responsible
        for the information described here. You can reach me at <L href={`mailto:${site.email}`}>{site.email}</L>.
      </p>

      <H>What I collect, and why</H>
      <Ul>
        <li>
          <b>The contact form.</b> Your name, email address and your answers (your business or website, what you want fixed,
          what you have tried and where you are based, if you fill those in). I use them only to reply to you and to talk about
          possible work. The form either opens your own email app with the message ready to send, or delivers the message to my
          email through Web3Forms, a form delivery service.
        </li>
        <li>
          <b>Emails you send me.</b> Your email address and what you write, to reply and to work with you.
        </li>
        <li>
          <b>Booking a call.</b> The booking link opens Calendly, which handles the booking under its own{' '}
          <L href="https://calendly.com/legal/privacy-notice">privacy notice</L>. I receive the name, email address and any answers
          you give there, to prepare for the call.
        </li>
        <li>
          <b>Clients.</b> If we work together, I keep what is needed to do the work and to invoice you, such as contact details,
          the agreement and invoices.
        </li>
      </Ul>

      <H>What this website does not do</H>
      <Ul>
        <li>No analytics or visitor tracking, no advertising pixels (for example no Meta Pixel), and no cookies.</li>
        <li>The fonts and images come from this site itself, not from Google or other font services.</li>
        <li>
          The site is hosted on GitHub Pages. Like any web host, GitHub may record technical details of visits, such as your IP
          address, for security. See the <L href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub privacy statement</L>.
        </li>
      </Ul>

      <H>RideWise (the cycling planner)</H>
      <p>
        RideWise keeps your rider accounts, rides and routes on your own phone or computer, encrypted. They are not sent to me
        and I cannot see them. To plan a route, RideWise sends the places you search for and the map area of your route to free
        map and weather services: OpenStreetMap services (place search, routing, map pictures, and places such as water and food
        stops) and Open-Meteo (weather and height). They see your device&apos;s internet address, as any website does. If you tap
        a link to navigate, Google Maps opens and its own privacy terms apply. Deleting RideWise&apos;s data from your browser, or
        deleting your account in RideWise, removes it.
      </p>

      <H>Work I do for clients</H>
      <p>
        When I run ads, funnels, email or CRM systems for a client, any information about the client&apos;s own customers is handled
        for that client, following their instructions and their privacy notice. Questions about that information are best sent to
        the business concerned; I will help them answer.
      </p>

      <H>Who I share information with</H>
      <p>
        I do not sell your information or share it for advertising. It is only handled by the services that help me run the
        business: my email provider, Web3Forms (form delivery), Calendly (bookings) and, for clients, the tools we agree to use
        together. Some of these services are outside the Philippines; they protect information under their own terms.
      </p>

      <H>How long I keep it</H>
      <p>
        Enquiries that do not become work: up to 2 years, so I can follow up on our conversation, unless you ask me to delete
        them sooner. Client records: as long as we work together, and invoices for as long as tax rules require.
      </p>

      <H>Your rights</H>
      <p>
        You can ask to see the information I hold about you, to correct it, to delete it, or to stop me using it. Email{' '}
        <L href={`mailto:${site.email}`}>{site.email}</L> and I will reply within 30 days. These rights come from the Philippine
        Data Privacy Act of 2012 (Republic Act 10173) and, if you are in the UK or the European Union, the UK GDPR or GDPR. If
        you are not happy with my answer, you can complain to the{' '}
        <L href="https://privacy.gov.ph">National Privacy Commission</L> in the Philippines or to the data protection authority
        where you live.
      </p>

      <H>Children</H>
      <p>This website is for businesses and adults. I do not knowingly collect information from children.</p>

      <H>Changes</H>
      <p>If this notice changes, the new version will be on this page with a new date at the top.</p>
    </LegalPage>
  );
}
