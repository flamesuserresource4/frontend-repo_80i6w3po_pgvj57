export default function CTA() {
  return (
    <section className="relative bg-[#0B0B11] text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-600/30 via-fuchsia-600/20 to-amber-500/20 p-10 backdrop-blur">
          <h3 className="text-2xl font-bold">Build Sync Assist today</h3>
          <p className="mt-2 text-white/80">Follow the implementation guide and launch a secure AI calling workflow from end to end.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/STANDALONE_AI_CALLING_SERVICE.md" className="rounded-lg bg-white text-gray-900 px-5 py-3 text-sm font-semibold shadow hover:shadow-md">Read the Guide</a>
            <a href="#" className="rounded-lg bg-white/10 text-white px-5 py-3 text-sm font-semibold border border-white/10 hover:bg-white/15">Talk to Sales</a>
          </div>
        </div>
      </div>
    </section>
  )
}
