"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase/firebase";
import { collection, getDocs, doc, updateDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

interface User {
  id: string;
  name: string;
  email: string;
  jobTitle?: string;
  isActive?: boolean;
  isVerified?: boolean;
  companyName?: string;
  role?: string;
  createdAt: any;
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  const ADMIN_EMAIL = "Admin@brainwave.com";

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/admin/login");
        return;
      }

      if (user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        setError("Unauthorized: Root access required.");
        setIsAdmin(false);
        setLoading(false);
        router.push("/admin/login");
        return;
      }

      setIsAdmin(true);
      // Real-time users listener
      const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
      const unsubscribeUsers = onSnapshot(q, (snapshot) => {
        const usersList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as User[];
        setUsers(usersList);
        setLoading(false);
      }, (err) => {
        setError("Failed to fetch users: " + err.message);
        setLoading(false);
      });

      return () => unsubscribeUsers();
    });

    return () => unsubscribeAuth();
  }, [router]);

  const toggleVerification = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "users", userId), {
        isVerified: !currentStatus
      });
    } catch (err: any) {
      alert("Verification update failed: " + err.message);
    }
  };

  const toggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "users", userId), {
        isActive: !currentStatus
      });
    } catch (err: any) {
      alert("Status update failed: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F172A]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent shadow-xl shadow-blue-500/20"></div>
          <p className="text-blue-400 font-bold text-[10px] uppercase tracking-[0.2em] animate-pulse">Initializing Root Session</p>
        </div>
      </div>
    );
  }

  if (error || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F172A] p-6">
        <div className="bg-white/5 backdrop-blur-xl border border-red-500/20 p-10 rounded-[2.5rem] max-w-sm w-full text-center space-y-6">
          <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto">
            <span className="material-icons text-red-500 text-4xl">gpp_maybe</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white tracking-tight">Access Denied</h2>
            <p className="text-gray-400 text-sm">{error || "This terminal is secured."}</p>
          </div>
          <button 
            onClick={() => router.push("/admin/login")}
            className="w-full py-4 bg-red-500/10 text-red-500 font-black rounded-2xl border border-red-500/20 hover:bg-red-500/20 transition-all text-sm"
          >
            RETURN TO COMMAND CENTER
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      {/* Top Protocol Bar */}
      <header className="bg-[#0F172A] border-b border-white/5 px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/40 p-2">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-white font-black text-lg tracking-tighter flex items-center gap-2">
              ADMIN DASHBOARD
              <span className="px-2 py-0.5 bg-blue-600 text-white text-[8px] font-black rounded-md uppercase tracking-widest">Root</span>
            </h1>
            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Protocol 1.0.4 • {ADMIN_EMAIL}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => auth.signOut().then(() => router.push("/admin/login"))}
            className="bg-white/5 hover:bg-red-500/10 border border-white/10 p-2.5 rounded-xl text-gray-400 hover:text-red-500 transition-all"
            title="Log out"
          >
            <span className="material-icons text-xl">power_settings_new</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-10">
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col md:row justify-between items-start md:items-end gap-4">
            <div className="space-y-1">
              <h2 className="text-3xl font-black text-[#1E293B] tracking-tight">Identity Control</h2>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Managed Network Users • {users.length} Nodes</p>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-xl shadow-blue-200/20 border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50/50 border-b border-gray-100">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Team Member</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Verification Status</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Organization</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Network Access</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-blue-50/30 transition-all group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center text-blue-600 font-black text-lg border border-blue-200/50 shadow-inner">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-gray-900 tracking-tight">{user.name}</span>
                              {user.isVerified && (
                                <span className="material-icons text-green-500 text-sm" title="Verified Member">verified</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 font-medium">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <button 
                          onClick={() => toggleVerification(user.id, !!user.isVerified)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            user.isVerified 
                            ? "bg-green-50 text-green-600 border border-green-100 hover:bg-green-100" 
                            : "bg-gray-50 text-gray-400 border border-gray-100 hover:bg-gray-100"
                          }`}
                        >
                          <span className="material-icons text-xs">{user.isVerified ? 'check_circle' : 'pending'}</span>
                          {user.isVerified ? 'Verified' : 'Unverified'}
                        </button>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-[10px] font-black text-gray-900 uppercase tracking-widest">{user.companyName || "N/A"}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest ${
                          user.isActive !== false 
                          ? "bg-blue-50 text-blue-600 border-blue-100" 
                          : "bg-red-50 text-red-600 border-red-100"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${user.isActive !== false ? "bg-blue-600" : "bg-red-600"}`}></span>
                          {user.isActive !== false ? "Active Node" : "Access Frozen"}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                           <button 
                            onClick={() => toggleStatus(user.id, user.isActive !== false)}
                            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 ${
                              user.isActive !== false 
                              ? "bg-white text-red-600 border border-red-100 hover:bg-red-50 shadow-red-200/20" 
                              : "bg-[#2563EB] text-white hover:bg-blue-600 shadow-blue-500/20"
                            }`}
                           >
                            {user.isActive !== false ? "Block Node" : "Restore Access"}
                           </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {users.length === 0 && (
              <div className="py-32 text-center space-y-4">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                    <span className="material-icons text-gray-300 text-4xl">inventory_2</span>
                </div>
                <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">No nodes registered in network</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="py-8 px-10 text-center">
         <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em]">© 2026 Admin@brainwave.com Terminal Control</p>
      </footer>
    </div>
  );
}
