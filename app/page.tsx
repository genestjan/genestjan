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

export default function Page() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <Gap />
        <SystemSection />
        <About />
        <Services />
        <Work />
        <Industries />
        <Stack />
        <Process />
        <Experience />
        <Testimonials />
        <Faq />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
