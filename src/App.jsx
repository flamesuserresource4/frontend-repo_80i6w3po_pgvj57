import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Features from './components/Features'
import CTA from './components/CTA'

function App() {
  return (
    <div className="min-h-screen bg-[#0B0B11]">
      <div className="relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(147,51,234,0.2),transparent_60%)]" />
        <Navbar />
        <main className="relative">
          <Hero />
          <Features />
          <CTA />
        </main>
      </div>
    </div>
  )
}

export default App
