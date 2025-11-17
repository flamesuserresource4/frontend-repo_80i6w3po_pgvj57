import { useState } from 'react'
import { Menu, X } from 'lucide-react'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const navItems = [
    { name: 'Features', href: '#features' },
    { name: 'Docs', href: '/STANDALONE_AI_CALLING_SERVICE.md' },
    { name: 'Contact', href: '#contact' },
  ]

  return (
    <header className="fixed top-0 inset-x-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 py-4">
          <a href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-amber-400 shadow-lg" />
            <span className="text-white/90 text-lg font-semibold tracking-tight">Sync Assist</span>
          </a>
          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <a key={item.name} href={item.href} className="text-white/80 hover:text-white transition-colors">
                {item.name}
              </a>
            ))}
            <a href="#get-started" className="inline-flex items-center rounded-lg bg-white/90 hover:bg-white text-gray-900 px-4 py-2 text-sm font-semibold shadow-sm transition-colors">
              Get Started
            </a>
          </nav>
          <button className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-lg bg-white/10 text-white" onClick={() => setOpen(!open)}>
            {open ? <X size={20}/> : <Menu size={20}/>}
          </button>
        </div>
        {open && (
          <div className="md:hidden bg-white/10 backdrop-blur rounded-xl p-4 border border-white/10">
            <div className="flex flex-col gap-3">
              {navItems.map((item) => (
                <a key={item.name} href={item.href} className="text-white/90 hover:text-white" onClick={() => setOpen(false)}>
                  {item.name}
                </a>
              ))}
              <a href="#get-started" className="inline-flex items-center justify-center rounded-lg bg-white text-gray-900 px-4 py-2 text-sm font-semibold" onClick={() => setOpen(false)}>
                Get Started
              </a>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
