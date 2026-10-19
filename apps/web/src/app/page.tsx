import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { ClosingCall } from '@/features/home/ClosingCall';
import { Directory } from '@/features/home/Directory';
import { Faq } from '@/features/home/Faq';
import { Guarantees } from '@/features/home/Guarantees';
import { HomeHero } from '@/features/home/HomeHero';
import { Marquee } from '@/features/home/Marquee';
import { Process } from '@/features/home/Process';
import { Services } from '@/features/home/Services';

/**
 * Home page: dark hero, principles ribbon, services, the request path, the
 * roles directory, guarantees, FAQ and a closing call to action.
 */
export default function HomePage() {
  return (
    <>
      <SiteHeader overlay />
      <main id="main">
        <HomeHero />
        <Marquee />
        <Services />
        <Process />
        <Directory />
        <Guarantees />
        <Faq />
        <ClosingCall />
      </main>
      <SiteFooter />
    </>
  );
}
