import Sidebar from './Sidebar'
import Topbar from './Topbar'

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      <Sidebar />
      <div className="lg:ml-64 min-h-screen pb-16 lg:pb-0">
        <Topbar />
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}

export default Layout
