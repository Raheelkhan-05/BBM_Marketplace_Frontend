import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";
import HeroSection from "../components/landing/HeroSection.jsx";
import SearchBar from "../components/landing/SearchBar.jsx";
import InfoBanner from "../components/landing/InfoBanner.jsx";
import ShowcaseHub from "../components/landing/ShowcaseHub.jsx";
import CTASection from "../components/landing/CTASection.jsx";
import StatsSection from "../components/landing/StatsSection.jsx";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="mx-auto max-w-7xl pb-8 lg:px-8 lg:pb-24">
        {/* On desktop the hero splits into two columns: copy+search on the
            left, product showcase on the right — mobile keeps the exact
            single-column stack from the reference design. */}
        <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-8 lg:pt-12">
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
          <StatsSection />
        </div>
      </main>

      <div className="hidden md:block">
        <Footer />
    </div>
    </div>
  );
}