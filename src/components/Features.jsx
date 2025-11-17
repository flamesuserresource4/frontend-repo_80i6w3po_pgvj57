import { Phone, FileAudio, FileText, Gauge, ShieldCheck, Sparkles } from 'lucide-react'

export default function Features() {
  const items = [
    {
      icon: Phone,
      title: 'AI Outbound Calls',
      desc: 'Initiate and track AI-powered calls with dynamic variables fed securely to the agent.',
    },
    {
      icon: FileAudio,
      title: 'Recording Storage',
      desc: 'Store and replay call recordings via secure, time-limited URLs.',
    },
    {
      icon: FileText,
      title: 'Transcripts & Notes',
      desc: 'Create detailed call summaries and transcripts automatically after each call.',
    },
    {
      icon: Gauge,
      title: 'Interest Scoring',
      desc: 'Automatically classify lead interest levels and maintain scores over time.',
    },
    {
      icon: ShieldCheck,
      title: 'Secure Webhooks',
      desc: 'Verify signatures, process asynchronously, and ensure reliable delivery.',
    },
    {
      icon: Sparkles,
      title: 'Developer Docs',
      desc: 'Follow a complete, copy-paste ready guide to implement the entire stack.',
    },
  ]

  return (
    <section id="features" className="relative bg-[#0F0F17] text-white/90">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur transition hover:bg-white/[0.06]">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-amber-400 flex items-center justify-center text-white shadow-lg">
                <Icon size={20} />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-white/70 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
