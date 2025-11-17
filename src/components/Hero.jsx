import Spline from '@splinetool/react-spline'

export default function Hero() {
  return (
    <section className="relative min-h-[90vh] overflow-hidden bg-[#0B0B11]">
      <div className="absolute inset-0">
        <Spline scene="https://prod.spline.design/4cHQr84zOGAHOehh/scene.splinecode" style={{ width: '100%', height: '100%' }} />
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.25),transparent_60%)] pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-28 pb-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Live AI Calling
        </div>
        <h1 className="mt-6 text-4xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-br from-white via-white to-white/70 bg-clip-text text-transparent">
          Sync Assist
        </h1>
        <p className="mt-4 text-base sm:text-lg text-white/70 max-w-2xl mx-auto">
          A cutting-edge AI calling dashboard for properties, leads, and automated follow-ups. Built for speed, clarity, and results.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4" id="get-started">
          <a href="#features" className="rounded-lg bg-white text-gray-900 px-5 py-3 text-sm font-semibold shadow-lg hover:shadow-xl transition-shadow">Explore Features</a>
          <a href="/STANDALONE_AI_CALLING_SERVICE.md" className="rounded-lg bg-white/10 text-white px-5 py-3 text-sm font-semibold border border-white/10 hover:bg-white/15 transition-colors">Implementation Guide</a>
        </div>
      </div>
    </section>
  )
}
