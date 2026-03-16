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
      <nav className="flex items-center justify-between px-6 py-5 max-w-7xl mx-auto w-full relative z-30">
        <div className="flex items-center gap-2">
           <div className="w-10 h-10 bg-[#2563EB] rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 overflow-hidden relative">
             <img src="/logo.png" alt="Logo" className="w-full h-full object-cover scale-110" loading="eager" />
           </div>
           <span className="text-2xl font-black text-gray-900 tracking-tighter">TeamWave</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            id="install-button" 
            className="hidden px-5 py-2.5 bg-[#2563EB] text-white text-[10px] font-black rounded-xl hover:bg-blue-600 transition-all uppercase tracking-widest shadow-lg shadow-blue-200"
          >
            Download App
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
          const installBtn = document.getElementById('install-button');

          window.addEventListener('beforeinstallprompt', (e) => {
            console.log('PWA: beforeinstallprompt fired');
            e.preventDefault();
            deferredPrompt = e;
            if (installBtn) {
              installBtn.classList.remove('hidden');
            }
          });

          if (installBtn) {
            installBtn.addEventListener('click', async () => {
              if (!deferredPrompt) {
                alert("To download: Tap the 'Share' icon and 'Add to Home Screen'");
                return;
              }
              deferredPrompt.prompt();
              const { outcome } = await deferredPrompt.userChoice;
              console.log('PWA: user choice', outcome);
              if (outcome === 'accepted') {
                installBtn.classList.add('hidden');
              }
              deferredPrompt = null;
            });
          }

          window.addEventListener('appinstalled', () => {
            console.log('PWA: installed');
            if (installBtn) installBtn.classList.add('hidden');
          });
        `}} />

        {/* Decorative Background Elements */}
        <div className="absolute top-20 left-10 w-64 h-64 bg-blue-100 rounded-full blur-3xl opacity-30 -z-10 animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-100 rounded-full blur-3xl opacity-20 -z-10"></div>

        <section className="max-w-4xl w-full text-center space-y-8 animate-in fade-in zoom-in duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 mb-4">
            <span className="flex h-2 w-2 rounded-full bg-[#2563EB] animate-ping"></span>
            <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest leading-none">Ready for Desktop & Mobile</span>
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black text-[#1E293B] tracking-tight leading-[0.95] mb-6">
            Premium <br /> 
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2563EB] to-blue-400">Team Play.</span>
          </h1>

          <p className="text-lg md:text-2xl text-gray-400 font-medium max-w-2xl mx-auto leading-relaxed">
            Fast, minimal messaging for high-performance teams. Download the app to your home screen for the full experience.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <a href="/signup" className="w-full sm:w-auto px-12 py-5 bg-[#2563EB] text-white font-black text-xl rounded-2xl hover:bg-blue-600 transition-all shadow-2xl shadow-blue-500/40 hover:-translate-y-1">
              Start Now — Free
            </a>
            <button 
              onClick={() => {
                const btn = document.getElementById('install-button');
                if (btn) btn.click();
              }}
              className="text-gray-500 font-bold text-sm hover:text-[#2563EB] transition-colors flex items-center gap-2"
            >
              <span className="material-icons">download</span>
              Download for Mobile
            </button>
          </div>

          {/* Tech stack removed */}
        </section>
      </main>

      <footer className="py-8 border-t border-gray-100 relative z-30">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
           <p className="text-xs text-gray-400 font-bold uppercase tracking-widest flex items-center gap-2">
             <img src="/logo.png" className="w-4 h-4" />
             © 2026 TeamWave Inc. • Premium Quality
           </p>
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
