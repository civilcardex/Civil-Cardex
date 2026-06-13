import { Outlet } from 'react-router-dom'
import Navbar from '../components/Navbar'

function Layout() {
  return (
    <>
      <a href="#main-content" style={{
        position: 'absolute',
        left: '-9999px',
        zIndex: 9999,
      }}
        className="skip-link"
        onFocus={(e) => { e.currentTarget.style.left = '16px'; e.currentTarget.style.top = '16px'; }}
        onBlur={(e) => { e.currentTarget.style.left = '-9999px'; }}
      >
        Saltar al contenido principal
      </a>
      <div className="h-screen overflow-hidden bg-surface-bg flex flex-col">
        <Navbar />
        <div className="flex flex-1 overflow-hidden pt-14">
          <main id="main-content" className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </>
  )
}

export default Layout
