//BackgroundAmbience.jsx

// Minimal by design: two soft brand-color glows and nothing else.
// The foreground components now carry their own visual weight —
// this just keeps the canvas from being flat white.
export default function BackgroundAmbience() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-white">
      <div
        className="absolute -left-32 -top-32 h-[380px] w-[380px] rounded-full blur-[100px] sm:h-[500px] sm:w-[500px] lg:h-[620px] lg:w-[620px]"
        style={{ background: "radial-gradient(circle, rgba(4,112,132,0.10) 0%, rgba(4,112,132,0) 70%)" }}
      />
      <div
        className="absolute right-[-15%] top-[45%] h-[320px] w-[320px] rounded-full blur-[90px] sm:h-[440px] sm:w-[440px] lg:h-[560px] lg:w-[560px]"
        style={{ background: "radial-gradient(circle, rgba(210,70,43,0.08) 0%, rgba(210,70,43,0) 70%)" }}
      />
      <div
        className="absolute bottom-[-10%] left-[20%] h-[300px] w-[300px] rounded-full blur-[90px] sm:h-[420px] sm:w-[420px]"
        style={{ background: "radial-gradient(circle, rgba(127,179,189,0.09) 0%, rgba(127,179,189,0) 70%)" }}
      />
    </div>
  );
}