import Hero from "@/components/Hero";
import Demo from "@/components/Demo";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import Quickstart from "@/components/Quickstart";
import Configuration from "@/components/Configuration";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="pl-0 md:pl-[260px] pt-14 md:pt-0">
      <Hero />
      <Demo />
      <div className="max-w-4xl mx-auto px-6">
        <Features />
        <HowItWorks />
        <Quickstart />
        <Configuration />
      </div>
      <div className="max-w-4xl mx-auto px-6">
        <Footer />
      </div>
    </main>
  );
}
