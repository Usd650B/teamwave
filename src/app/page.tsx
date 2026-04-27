"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/firebase";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check for errors in URL
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('error') === 'account_disabled') {
        setError("This account has been frozen by the administrator.");
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Only redirect to /home if not an admin. But we assume all users accessing root are workers.
        router.replace("/home");
      }
    });
    return unsubscribe;
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    const formattedUsername = username.trim().toLowerCase();
    const loginEmail = `${formattedUsername}@teamwave.com`;
    const formattedPassword = password.trim().toLowerCase();
    
    try {
      await signInWithEmailAndPassword(auth, loginEmail, formattedPassword);
      router.replace("/home");
    } catch (err: any) {
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        // Auto-provision worker account if not found
        try {
          const { createUserWithEmailAndPassword } = await import("firebase/auth");
          await createUserWithEmailAndPassword(auth, loginEmail, formattedPassword);
          const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");
          const { db } = await import("@/lib/firebase/firebase");
          
          // Try to extract first name and last name
          const nameParts = formattedUsername.split('.');
          let displayName = formattedUsername;
          if (nameParts.length >= 2) {
            displayName = nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
          }

          await setDoc(doc(db, "users", auth.currentUser?.uid || ""), {
            id: auth.currentUser?.uid,
            name: displayName,
            email: loginEmail,
            role: "worker",
            isActive: true,
            isVerified: true,
            createdAt: serverTimestamp()
          }, { merge: true });
          
          router.replace("/home");
        } catch (createErr: any) {
          if (createErr.code === "auth/weak-password") {
            setError("Password must be at least 6 characters.");
          } else {
             setError("Invalid credentials. Try again.");
          }
          setLoading(false);
        }
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many attempts. Locked 5m.");
        setLoading(false);
      } else {
        setError(err.message || "Login failed.");
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <main className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-50 rounded-full blur-[100px] -z-10 opacity-60"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-50 rounded-full blur-[100px] -z-10 opacity-60"></div>

        <div className="w-full max-w-sm space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="text-center space-y-6">
            <div 
              className="w-16 h-16 bg-[#2563EB] rounded-[1.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-blue-500/30 overflow-hidden p-3"
            >
              <img src="/logo.png" alt="TeamWave" className="w-full h-full object-contain" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-black text-[#1E293B] tracking-tight">TeamWave</h1>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">Employee Authentication</p>
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="space-y-4">
              <div className="group">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block group-focus-within:text-[#2563EB] transition-colors">Employee Username</label>
                <div className="relative">
                   <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 text-sm">person</span>
                   <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full bg-gray-50 border border-[#E2E8F0] rounded-2xl pl-11 pr-4 py-4 text-sm font-bold focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-[#2563EB] outline-none transition-all lowercase"
                    placeholder="firstname.lastname"
                  />
                </div>
              </div>

              <div className="group">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block group-focus-within:text-[#2563EB] transition-colors">Password</label>
                <div className="relative">
                   <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 text-sm">lock</span>
                   <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-gray-50 border border-[#E2E8F0] rounded-2xl pl-11 pr-4 py-4 text-sm font-bold focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-[#2563EB] outline-none transition-all lowercase"
                    placeholder="lastname"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-500 text-[10px] font-black uppercase tracking-widest animate-in zoom-in-95">
                <span className="material-icons text-sm">error</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1E293B] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-black transition-all shadow-xl shadow-gray-200 hover:-translate-y-1 disabled:opacity-50 disabled:translate-y-0"
            >
              {loading ? "AUTHENTICATING..." : "SIGN IN"}
            </button>
          </form>
        </div>
      </main>

      <footer className="p-8 text-center">
         <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest">TeamWave Security Protocol v2.5.0</p>
      </footer>
    </div>
  );
}
