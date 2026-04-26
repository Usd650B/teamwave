"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, onSnapshot } from "firebase/firestore";

interface NavItem {
  href: string;
  icon: string;
  label: string;
  badge?: number;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [userName, setUserName] = useState("");
  const [userPhoto, setUserPhoto] = useState("");
  const [userJob, setUserJob] = useState("");
  const [pendingRequests, setPendingRequests] = useState(0);
  const [unreadEscalations, setUnreadEscalations] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [supervisorName, setSupervisorName] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const d = userDoc.data();
          setUserName(d.name || user.displayName || "User");
          setUserPhoto(d.profilePhoto || user.photoURL || "");
          setUserJob(d.jobTitle || "Team Member");
          setUserRole(d.role || "");
          if (d.supervisorId) {
            const supDoc = await getDoc(doc(db, "users", d.supervisorId));
            if (supDoc.exists()) setSupervisorName(supDoc.data().name || "Supervisor");
          }
        }
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "friendRequests"), where("toId", "==", currentUser.uid), where("status", "==", "pending"));
    const unsub = onSnapshot(q, (snap) => setPendingRequests(snap.size));
    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "escalations"), where("workerId", "==", currentUser.uid), where("hasNewReply", "==", true));
    const unsub = onSnapshot(q, (snap) => setUnreadEscalations(snap.size));
    return () => unsub();
  }, [currentUser]);

  const navItems: NavItem[] = [
    { href: "/home", icon: "campaign", label: "Updates" },
    { href: "/escalations", icon: "headset_mic", label: "Contact Center", badge: unreadEscalations },
    { href: "/chats", icon: "chat", label: "Messages" },
    { href: "/schedule", icon: "event", label: "My Schedule" },
    { href: "/friends", icon: "people", label: "Friends", badge: pendingRequests },
    { href: "/discover", icon: "person_search", label: "Directory" },
    { href: "/activity", icon: "history", label: "Activity" },
  ];

  // Add supervisor link if user is a supervisor
  if (userRole === "supervisor") {
    navItems.push({ href: "/supervisor", icon: "shield", label: "Supervisor" });
  }

  const isActive = (href: string) => pathname === href;

  return (
    <div className="flex h-screen bg-[#F1F3F9] overflow-hidden">
      {/* Sidebar */}
      <aside className={`flex flex-col bg-[#0B1121] text-white transition-all duration-300 flex-shrink-0 ${collapsed ? "w-[72px]" : "w-[260px]"}`}>
        {/* Brand */}
        <div className={`flex items-center gap-3 px-5 py-6 border-b border-white/5 ${collapsed ? "justify-center px-0" : ""}`}>
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 overflow-hidden flex-shrink-0">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover scale-110" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-black tracking-tight leading-none">TeamWave</h1>
              <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest mt-0.5">Enterprise</p>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className={`text-white/30 hover:text-white/70 transition-colors ${collapsed ? "hidden" : ""}`}>
            <span className="material-icons text-lg">menu</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {!collapsed && (
            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] px-3 mb-3">Workspace</p>
          )}
          {navItems.map((item) => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group relative ${
                isActive(item.href)
                  ? "bg-blue-600/15 text-blue-400"
                  : "text-white/50 hover:bg-white/5 hover:text-white/80"
              } ${collapsed ? "justify-center px-0" : ""}`}
            >
              <span className={`material-icons text-xl ${isActive(item.href) ? "text-blue-400" : "text-white/40 group-hover:text-white/70"}`}>
                {item.icon}
              </span>
              {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
              {!collapsed && (item.badge ?? 0) > 0 && (
                <span className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-black rounded-full min-w-[18px] text-center">
                  {item.badge}
                </span>
              )}
              {collapsed && (item.badge ?? 0) > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>
          ))}

          {!collapsed && (
            <div className="pt-6">
              <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] px-3 mb-3">Account</p>
            </div>
          )}
          <button
            onClick={() => router.push("/profile")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group ${
              isActive("/profile")
                ? "bg-blue-600/15 text-blue-400"
                : "text-white/50 hover:bg-white/5 hover:text-white/80"
            } ${collapsed ? "justify-center px-0" : ""}`}
          >
            <span className={`material-icons text-xl ${isActive("/profile") ? "text-blue-400" : "text-white/40 group-hover:text-white/70"}`}>settings</span>
            {!collapsed && <span className="flex-1 text-left">Settings</span>}
          </button>
        </nav>

        {/* User Card */}
        <div className={`border-t border-white/5 p-4 ${collapsed ? "px-2" : ""}`}>
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {userPhoto ? (
                <img src={userPhoto} alt="User" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-black text-sm">{userName?.charAt(0)?.toUpperCase() || "?"}</span>
              )}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white/90 truncate">{userName}</p>
                <p className="text-[10px] text-white/30 font-medium truncate">{userJob}</p>
              </div>
            )}
            {!collapsed && (
              <button onClick={() => auth.signOut().then(() => router.push("/"))}
                className="text-white/20 hover:text-red-400 transition-colors" title="Sign out">
                <span className="material-icons text-lg">logout</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  );
}
