//landingPage.jsx

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
    <div className="relative min-h-screen bg-white overflow-hidden">

      {/* ===================================================================== */}
      {/* Background decoration: soft brand-colored blobs + light grain texture */}
      {/* Inline rgba styles used instead of Tailwind arbitrary-opacity classes */}
      {/* to avoid JIT/purge issues — guaranteed to render regardless of config */}
      {/* ===================================================================== */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full blur-3xl"
          style={{ backgroundColor: "rgba(210, 70, 43, 0.14)" }}
        />
        <div
          className="absolute -top-20 right-[-10%] h-[380px] w-[380px] rounded-full blur-3xl"
          style={{ backgroundColor: "rgba(5, 113, 132, 0.12)" }}
        />
        <div
          className="absolute top-[35%] -left-24 h-[320px] w-[320px] rounded-full blur-3xl"
          style={{ backgroundColor: "rgba(229, 151, 138, 0.16)" }}
        />
        <div
          className="absolute top-[55%] right-[-8%] h-[360px] w-[360px] rounded-full blur-3xl"
          style={{ backgroundColor: "rgba(130, 182, 192, 0.15)" }}
        />
        <div
          className="absolute bottom-[-10%] left-[20%] h-[450px] w-[450px] rounded-full blur-3xl"
          style={{ backgroundColor: "rgba(216, 90, 65, 0.10)" }}
        />
        <div
          className="absolute bottom-[-15%] right-[10%] h-[300px] w-[300px] rounded-full blur-3xl"
          style={{ backgroundColor: "rgba(238, 190, 179, 0.20)" }}
        />

        {/* Subtle grain/noise texture overlay */}
        <div
          className="absolute inset-0 mix-blend-multiply"
          style={{
            opacity: 0.035,
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
      </div>

      <div className="relative z-10">
        <Header />

        <main className="mx-auto max-w-7xl pb-8 lg:px-8 lg:pb-24">
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
    </div>
  );
}