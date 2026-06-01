import { Outlet } from 'react-router-dom'
import Navbar from '../components/Navbar'

function Layout() {
  return (
    <div className="h-screen overflow-hidden bg-surface-bg flex flex-col">
      <Navbar />
      <div className="flex flex-1 overflow-hidden pt-14">
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout
