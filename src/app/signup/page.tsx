"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase/firebase";
import { createUserWithEmailAndPassword, updateProfile, onAuthStateChanged } from "firebase/auth";
import { setDoc, doc, serverTimestamp } from "firebase/firestore";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/home");
      }
    });
    return unsubscribe;
  }, [router]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Name is required for the directory.");
      return;
    }
    if (password.length < 6) {
      setError("Security code must be 6+ chars.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Codes do not match.");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
      await setDoc(doc(db, "users", userCredential.user.uid), {
        id: userCredential.user.uid,
        name: name.trim(),
        email,
        profilePhoto: "",
        jobTitle: "New Team Member",
        createdAt: serverTimestamp(),
      });
      router.replace("/home");
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") {
        setError("Email protocol already registered.");
      } else if (err.code === "auth/invalid-email") {
        setError("Invalid email format.");
      } else {
        setError(err.message || "Enrollment failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <main className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50 rounded-full blur-[100px] -z-10 opacity-60"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-50 rounded-full blur-[100px] -z-10 opacity-60"></div>

        <div className="w-full max-w-sm space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="text-center space-y-6">
            <div 
              onClick={() => router.push("/")}
              className="w-16 h-16 bg-[#2563EB] rounded-[1.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-blue-500/30 cursor-pointer hover:rotate-6 transition-all"
            >
              <span className="material-icons text-white text-3xl">waves</span>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-black text-[#1E293B] tracking-tight">Team Enrollment</h1>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">Create your digital identity</p>
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleSignup}>
            <div className="space-y-4">
               <div className="group">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block group-focus-within:text-[#2563EB] transition-colors">Full Identity</label>
                  <div className="relative">
                    <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 text-sm">person</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full bg-gray-50 border border-[#E2E8F0] rounded-2xl pl-11 pr-4 py-4 text-sm font-bold focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-[#2563EB] outline-none transition-all"
                      placeholder="e.g. Alex Rivera"
                    />
                  </div>
               </div>

               <div className="group">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block group-focus-within:text-[#2563EB] transition-colors">Terminal Email</label>
                  <div className="relative">
                    <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 text-sm">alternate_email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full bg-gray-50 border border-[#E2E8F0] rounded-2xl pl-11 pr-4 py-4 text-sm font-bold focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-[#2563EB] outline-none transition-all"
                      placeholder="name@company.com"
                    />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-3">
                  <div className="group">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block group-focus-within:text-[#2563EB] transition-colors">Access Code</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full bg-gray-50 border border-[#E2E8F0] rounded-2xl px-4 py-4 text-sm font-bold focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-[#2563EB] outline-none transition-all"
                      placeholder="••••••"
                    />
                  </div>
                  <div className="group">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block group-focus-within:text-[#2563EB] transition-colors">Verify Code</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full bg-gray-50 border border-[#E2E8F0] rounded-2xl px-4 py-4 text-sm font-bold focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-[#2563EB] outline-none transition-all"
                      placeholder="••••••"
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
              {loading ? "PROCESSING..." : "ACTIVATE ACCOUNT"}
            </button>
          </form>

          <p className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Already registered?{" "}
            <a href="/login" className="text-[#2563EB] border-b border-blue-100 hover:border-blue-500 transition-all">
              Initialize Portal
            </a>
          </p>
        </div>
      </main>

      <footer className="p-8 text-center">
         <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest">TeamWave Open Enrollment Protocol v1.2</p>
      </footer>
    </div>
  );
}
