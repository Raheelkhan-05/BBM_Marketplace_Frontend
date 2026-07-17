//landingPage.jsx

import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";
import HeroSection from "../components/landing/HeroSection.jsx";
import SearchBar from "../components/landing/SearchBar.jsx";
import InfoBanner from "../components/landing/InfoBanner.jsx";
import ShowcaseHub from "../components/landing/ShowcaseHub.jsx";
import CTASection from "../components/landing/CTASection.jsx";
// import StatsSection from "../components/landing/StatsSection.jsx";
import WhyBBMSection from "../components/landing/WhyBBMSection.jsx";
import BackgroundAmbience from "../components/landing/BackgroundAmbience.jsx";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-white overflow-x-clip">

      <div className="relative z-1">

        <main className="mx-auto max-w-7xl pb-8 lg:px-8 lg:pb-24">
          <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-8 lg:pt-12 lg:pt-6">
            <div>
              <HeroSection />
              <div className="px-4 sm:px-6 lg:px-0">
                <SearchBar />
                <InfoBanner />
              </div>
            </div>

            <div className="mt-2 lg:mt-0">
              <ShowcaseHub />
            </div>
          </div>

          <div className="px-4 sm:px-6 lg:px-0">
            <CTASection />
            <WhyBBMSection />
          </div>
        </main>

      </div>
    </div>
  );
}