import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function Layout() {
  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <Sidebar />
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <Navbar />
        <main style={{ flex:1, overflowY:'auto', padding:'24px', background:'var(--bg-base)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
