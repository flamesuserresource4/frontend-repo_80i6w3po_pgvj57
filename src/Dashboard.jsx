import { useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import { Activity, Clock, PhoneCall, TrendingUp, Database } from 'lucide-react'

function StatCard({ icon: Icon, label, value, delta }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-white/90">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-amber-400 flex items-center justify-center text-white shadow-lg">
            <Icon size={20} />
          </div>
          <div>
            <p className="text-sm text-white/60">{label}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </div>
        </div>
        {delta && (
          <span className={`text-xs px-2 py-1 rounded-md ${delta.startsWith('+') ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>{delta}</span>
        )}
      </div>
    </div>
  )
}

function RecentRow({ lead, status, score, time }) {
  const badge = status === 'Completed' ? 'bg-emerald-500/15 text-emerald-300' : status === 'Queued' ? 'bg-amber-500/15 text-amber-300' : 'bg-rose-500/15 text-rose-300'
  return (
    <div className="grid grid-cols-4 items-center py-3 px-3 rounded-lg hover:bg-white/5 text-white/80">
      <div className="truncate">{lead}</div>
      <div><span className={`text-xs px-2 py-1 rounded ${badge}`}>{status}</span></div>
      <div className="font-mono">{score}</div>
      <div className="text-white/60 text-sm">{time}</div>
    </div>
  )
}

export default function Dashboard() {
  const [hello, setHello] = useState('Loading...')
  const [health, setHealth] = useState(null)

  useEffect(() => {
    const run = async () => {
      try {
        const base = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
        const r1 = await fetch(`${base}/api/hello`).then(r => r.json())
        setHello(r1.message || 'OK')
        const r2 = await fetch(`${base}/test`).then(r => r.json())
        setHealth(r2)
      } catch (e) {
        setHello('Backend not reachable')
        setHealth(null)
      }
    }
    run()
  }, [])

  return (
    <div className="min-h-screen bg-[#0B0B11]">
      <Navbar />
      <div className="pt-24 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Sync Assist Dashboard</h1>
          <p className="text-white/60 mt-1">Live snapshot of calls, queues, and system health.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={PhoneCall} label="Calls Today" value="128" delta="+12%" />
          <StatCard icon={TrendingUp} label="Success Rate" value="78%" delta="+3%" />
          <StatCard icon={Clock} label="Avg Duration" value="02:34" delta="-8%" />
          <StatCard icon={Activity} label="In Queue" value="9" delta="+2" />
        </div>

        <div className="mt-8 grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold">Recent Activity</h2>
              <a href="#" className="text-xs text-white/60 hover:text-white">View all</a>
            </div>
            <div className="grid grid-cols-4 text-white/60 text-xs px-3">
              <div>Lead</div>
              <div>Status</div>
              <div>Score</div>
              <div>When</div>
            </div>
            <div className="mt-2 space-y-1">
              <RecentRow lead="John Carter" status="Completed" score="A" time="2m ago" />
              <RecentRow lead="Acme Holdings" status="Queued" score="B" time="12m ago" />
              <RecentRow lead="Mary W." status="Failed" score="-" time="25m ago" />
              <RecentRow lead="Blue Lake Apt 12" status="Completed" score="A-" time="1h ago" />
              <RecentRow lead="Riverside #202" status="Queued" score="B+" time="1h ago" />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-white/90">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-amber-400 flex items-center justify-center text-white shadow-lg">
                <Database size={18} />
              </div>
              <h2 className="font-semibold">System Health</h2>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-white/60">API</span>
                <span className="font-mono">{hello}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Backend</span>
                <span className="font-mono">{health?.backend || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Database</span>
                <span className="font-mono">{health?.database || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Connection</span>
                <span className="font-mono">{health?.connection_status || '—'}</span>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <a href="/test" className="rounded-lg bg-white text-gray-900 px-4 py-2 text-sm font-semibold shadow">Run Health Check</a>
              <a href="/" className="rounded-lg bg-white/10 text-white px-4 py-2 text-sm font-semibold border border-white/10">Go to Landing</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
