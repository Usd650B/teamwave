"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const REQUIRED_ADMIN_EMAIL = "shabanimnango99@gmail.com";
    // Defer authorization to the dashboard to allow supervisors to access specific parts

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/admin");
    } catch (signInErr: any) {
      if (signInErr.code === "auth/user-not-found") {
        // Auto-provision the admin account
        try {
          const { createUserWithEmailAndPassword } = await import("firebase/auth");
          await createUserWithEmailAndPassword(auth, email, password);
          const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");
          const { db } = await import("@/lib/firebase/firebase");
          await setDoc(doc(db, "users", auth.currentUser?.uid || ""), {
            id: auth.currentUser?.uid, name: "System Admin",
            email: email.toLowerCase(), isAdmin: true,
            isActive: true, isVerified: true, createdAt: serverTimestamp()
          }, { merge: true });
          router.push("/admin");
        } catch (createErr: any) {
          setError(createErr.code === "auth/weak-password"
            ? "Password must be at least 6 characters."
            : "Failed to provision admin account.");
          setLoading(false);
        }
      } else if (signInErr.code === "auth/invalid-credential" || signInErr.code === "auth/wrong-password") {
        setError("Wrong password. Use the reset button below if you forgot it.");
        setLoading(false);
      } else {
        setError("Access Denied: " + signInErr.message);
        setLoading(false);
      }
    }
  };

  const resetPassword = async () => {
    const { sendPasswordResetEmail } = await import("firebase/auth");
    try {
      await sendPasswordResetEmail(auth, "shabanimnango99@gmail.com");
      setError("");
      alert("Password reset email sent to shabanimnango99@gmail.com. Check your inbox.");
    } catch (err: any) {
      alert("Failed to send reset email: " + err.message);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0F172A] selection:bg-blue-500/30">
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative">
        {/* Abstract Cyber Background */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 opacity-20">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600 rounded-full blur-[120px]"></div>
        </div>

        <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-10 duration-700">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-blue-500/40 border-2 border-white/10">
              <span className="material-icons text-white text-4xl">terminal</span>
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-black text-white tracking-tighter">Root Login</h1>
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.3em]">Administrator Terminal Access</p>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem] shadow-2xl">
            <form className="space-y-6" onSubmit={handleAdminLogin}>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest ml-1">Admin Identity</label>
                  <div className="relative group">
                    <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors">admin_panel_settings</span>
                    <input
                      type="email"
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 transition-all font-medium"
                      placeholder="Admin Terminal Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest ml-1">Access Key</label>
                  <div className="relative group">
                    <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors">lock</span>
                    <input
                      type="password"
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 transition-all font-medium"
                      placeholder="Terminal Security Key"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400 text-xs font-bold animate-shake text-center">
                  {error}
                </div>
              )}

              <button
                disabled={loading}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-900/40 relative overflow-hidden group active:scale-[0.98]"
              >
                <span className={loading ? "opacity-0" : "opacity-100"}>INITIALIZE DASHBOARD</span>
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    </div>
                )}
              </button>
            </form>
          </div>

          <div className="text-center space-y-3">
            <button 
              onClick={() => router.push("/")}
              className="text-[10px] font-black text-gray-500 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-2 mx-auto"
            >
               <span className="material-icons text-sm">arrow_back</span>
               Return to Landing
            </button>
            <button 
              onClick={resetPassword}
              className="text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest transition-colors flex items-center gap-2 mx-auto"
            >
               <span className="material-icons text-sm">lock_reset</span>
               Reset Admin Password
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
