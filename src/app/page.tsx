// ...existing code...

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-[#F5F5F5]">
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#E5E7EB]">
        <h1 className="text-xl font-bold text-[#2563EB]">TeamWave</h1>
        <div className="w-8 h-8 rounded-full bg-[#E5E7EB]" /> {/* Placeholder for profile photo */}
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <h2 className="text-2xl font-semibold text-[#2563EB] mb-2">Welcome to TeamWave</h2>
        <p className="text-gray-700 mb-6 text-center">Fast, minimal workplace chat for teams.</p>
        <div className="flex gap-4">
          <a href="/login" className="px-6 py-2 rounded bg-[#2563EB] text-white font-medium">Login</a>
          <a href="/signup" className="px-6 py-2 rounded bg-[#E5E7EB] text-[#2563EB] font-medium">Sign Up</a>
        </div>
      </main>
      <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-[#E5E7EB] flex justify-around py-2">
        <a href="/home" className="flex flex-col items-center text-[#2563EB]">
          <span className="material-icons">chat</span>
          <span className="text-xs">Home</span>
        </a>
        <a href="/discover" className="flex flex-col items-center text-black">
          <span className="material-icons">search</span>
          <span className="text-xs">Discover</span>
        </a>
        <a href="/profile" className="flex flex-col items-center text-black">
          <span className="material-icons">person</span>
          <span className="text-xs">Profile</span>
        </a>
      </nav>
    </div>
  );
}
