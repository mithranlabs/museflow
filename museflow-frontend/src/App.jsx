import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Navbar from './components/common/Navbar'
import Footer from './components/common/Footer'
import Home from './pages/Home'
import About from './pages/About'
import Playlist from './pages/Playlist'
import StudioWorkspace from './pages/StudioWorkspace'
import MySongs from './pages/MySongs'
import AIAgents from './pages/AIAgents'
import Profile from './pages/Profile'
import Settings from './pages/Settings'

function App() {
  const location = useLocation()
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 page-enter">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/playlist" element={<Playlist />} />
            <Route path="/studio" element={<StudioWorkspace />} />
            <Route path="/my-songs" element={<MySongs />} />
            <Route path="/ai-agents" element={<AIAgents />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  )
}

export default App