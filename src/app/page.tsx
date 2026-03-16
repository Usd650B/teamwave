"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/home");
      }
    });
    return unsubscribe;
  }, [router]);

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Hero Section */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
           <div className="w-10 h-10 bg-[#2563EB] rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 overflow-hidden">
             <img src="/logo.png" alt="Logo" className="w-full h-full object-cover scale-110" />
           </div>
           <span className="text-2xl font-black text-gray-900 tracking-tighter">TeamWave</span>
        </div>
        <div className="flex items-center gap-4">
          <button id="install-button" className="hidden px-4 py-2 bg-blue-50 text-[#2563EB] text-[10px] font-black rounded-lg hover:bg-blue-100 transition-all uppercase tracking-widest">
            Install App
          </button>
          <div className="flex items-center gap-6">
            <a href="/login" className="text-sm font-bold text-gray-500 hover:text-[#2563EB] transition-colors">LOGIN</a>
            <a href="/signup" className="px-6 py-2.5 bg-[#1E293B] text-white text-sm font-bold rounded-xl hover:bg-black transition-all shadow-xl shadow-gray-200">
              GET STARTED
            </a>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-4 relative overflow-hidden">
        {/* PWA Installer Script */}
        <script dangerouslySetInnerHTML={{ __html: `
          let deferredPrompt;
          window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            const installBtn = document.getElementById('install-button');
            if (installBtn) {
              installBtn.classList.remove('hidden');
              installBtn.addEventListener('click', () => {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then((choiceResult) => {
                  if (choiceResult.outcome === 'accepted') {
                    installBtn.classList.add('hidden');
                  }
                  deferredPrompt = null;
                });
              });
            }
          });
        `}} />

        {/* Decorative Background Elements */}
        <div className="absolute top-20 left-10 w-64 h-64 bg-blue-100 rounded-full blur-3xl opacity-30 -z-10 animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-100 rounded-full blur-3xl opacity-20 -z-10"></div>

        <section className="max-w-4xl w-full text-center space-y-8 animate-in fade-in zoom-in duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 mb-4">
            <span className="flex h-2 w-2 rounded-full bg-[#2563EB] animate-ping"></span>
            <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest leading-none">PWA Support Enabled</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black text-[#1E293B] tracking-tight leading-[1.05]">
            Where teams <br /> 
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2563EB] to-blue-400">collaborate faster.</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 font-medium max-w-2xl mx-auto leading-relaxed">
            Fast, minimal, and premium workplace messaging. Install the app on your phone for lightning fast access.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <a href="/signup" className="w-full sm:w-auto px-10 py-4 bg-[#2563EB] text-white font-black text-lg rounded-2xl hover:bg-blue-600 transition-all shadow-2xl shadow-blue-500/40 hover:-translate-y-1">
              Start Chatting Free
            </a>
            <div className="flex items-center gap-2 text-gray-400 font-bold text-sm">
              <span className="material-icons text-green-500">check_circle</span>
              No credit card required
            </div>
          </div>

          {/* Tech stack removed */}
        </section>
      </main>

      <footer className="py-8 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:row justify-between items-center gap-4">
           <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">© 2026 TeamWave Inc. • Secure Payments Ready</p>
           <div className="flex gap-6">
             <a href="#" className="text-[10px] font-black text-gray-400 hover:text-gray-900 uppercase">Privacy</a>
             <a href="#" className="text-[10px] font-black text-gray-400 hover:text-gray-900 uppercase">Terms</a>
             <a href="#" className="text-[10px] font-black text-gray-400 hover:text-gray-900 uppercase">Support</a>
           </div>
        </div>
      </footer>
    </div>
  );
}
