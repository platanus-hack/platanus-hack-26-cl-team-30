import { GuideAssistant } from "@/components/ui/guide-assistant";
import { Access } from "@/components/landing/access";
import { clinicProjections, landingExample, reliabilityTable } from "@/components/landing/data";
import { Example } from "@/components/landing/example";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { How } from "@/components/landing/how";
import { Interview } from "@/components/landing/interview";
import { Nav } from "@/components/landing/nav";
import { Origin } from "@/components/landing/origin";
import { Others } from "@/components/landing/others";
import { Reliability } from "@/components/landing/reliability";
import { Shielding } from "@/components/landing/shielding";

// Portada. Primero la idea general; los hospitales aparecen como un ejemplo. Los
// datos del ejemplo los calcula el servidor con las semillas y el motor de la sala.
export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <How />
        <Example example={landingExample()} />
        <Shielding projections={clinicProjections()} />
        <Others />
        <Reliability table={reliabilityTable()} />
        <Origin />
        <Interview />
        <Access />
      </main>
      <Footer />
      {/* Guía conversacional (src/components/ui/guide-assistant.tsx): solo se monta aquí, la portada es de Ramón. */}
      <GuideAssistant page="la portada" />
    </>
  );
}
