import Nav from '@/components/layout/Nav';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/sections/Hero';
import Gap from '@/components/sections/Gap';
import SystemSection from '@/components/sections/SystemSection';
import About from '@/components/sections/About';
import Services from '@/components/sections/Services';
import Work from '@/components/sections/Work';
import Industries from '@/components/sections/Industries';
import Stack from '@/components/sections/Stack';
import Process from '@/components/sections/Process';
import Experience from '@/components/sections/Experience';
import Testimonials from '@/components/sections/Testimonials';
import Faq from '@/components/sections/Faq';
import Contact from '@/components/sections/Contact';
import CtaBand from '@/components/sections/CtaBand';

export default function Page() {
  return (
    <>
      <Nav />
      <main id="main">
        {/* Problem, then approach, then offer, then proof, then who, then
            objections, then the ask. Testimonials previously sat at position
            11, roughly 2,800 words in, so the social proof arrived long after
            the decision was made. They now follow the case studies so the two
            proof blocks reinforce each other.

            Booking is asked for three times: the hero, the band straight after
            the proof, and the contact section. */}
        <Hero />
        <Gap />
        <SystemSection />
        <Services />
        <Work />
        <Testimonials />
        <CtaBand />
        <About />
        <Process />
        <Industries />
        <Stack />
        <Experience />
        <Faq />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
