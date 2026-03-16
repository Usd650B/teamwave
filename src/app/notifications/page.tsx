"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { requestNotificationPermission, initializeMessaging } from "@/lib/notifications";

export default function NotificationsPage() {
  const [permission, setPermission] = useState<string>("prompt");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const handleRequestPermission = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const granted = await requestNotificationPermission();
      if (granted) {
        await initializeMessaging();
        setPermission("granted");
        setSuccess("Notifications enabled successfully!");
      } else {
        setPermission("denied");
        setError(
          "Notification permission was denied. Please enable notifications in your browser settings."
        );
      }
    } catch (err) {
      setError("Failed to request permission: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = () => {
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("TeamWave", {
          body: "This is a test notification from TeamWave! 🎉",
          icon: "/favicon.ico",
          tag: "test-notification",
        });
        setSuccess("Test notification sent!");
      } else {
        setError("Please enable notifications first.");
      }
    } catch (err) {
      setError("Failed to send test notification: " + (err as Error).message);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#E2E8F0] sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-[#2563EB] transition-colors">
            <span className="material-icons">arrow_back</span>
          </button>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">System Alerts</h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-12 pb-24 max-w-lg mx-auto w-full">
        <div className="w-full space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-block p-4 bg-blue-50 rounded-3xl mb-2">
              <span className="material-icons text-[#2563EB] text-4xl">notifications_active</span>
            </div>
            <h2 className="text-2xl font-black text-[#1E293B]">Stay Synced</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">Notification Preferences</p>
          </div>

          <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-sm p-8 space-y-8">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                  <span className="material-icons text-sm">error</span>
                  {error}
                </div>
              </div>
            )}

            {success && (
              <div className="p-4 bg-green-50 border border-green-100 rounded-2xl text-green-600 text-xs font-bold animate-in fade-in slide-in-from-top-2">
                 <div className="flex items-center gap-2">
                  <span className="material-icons text-sm">check_circle</span>
                  {success}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
               <div>
                 <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Live Status</div>
                 <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${permission === 'granted' ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`}></span>
                    <span className="text-sm font-bold text-gray-900">
                      {permission === 'granted' ? 'ENABLED' : permission === 'denied' ? 'BLOCKED' : 'READY TO SETUP'}
                    </span>
                 </div>
               </div>
               <span className="material-icons text-gray-300">verified_user</span>
            </div>

            <div className="space-y-4">
              {permission !== "granted" && (
                <button
                  onClick={handleRequestPermission}
                  disabled={loading || permission === "denied"}
                  className="w-full bg-[#1E293B] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-gray-200 disabled:opacity-50"
                >
                  {loading ? "INITIALIZING..." : "ENABLE BROWSER ALERTS"}
                </button>
              )}

              <button
                onClick={handleTestNotification}
                className="w-full bg-white text-[#2563EB] border-2 border-blue-50 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-50 transition-all"
              >
                TEST PUSH PROTOCOL
              </button>
            </div>

            <div className="pt-6 border-t border-gray-50">
               <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">You will be alerted for:</h3>
               <div className="space-y-4">
                  {[
                    { icon: 'chat', label: 'Incoming direct messages' },
                    { icon: 'groups', label: 'New community invitations' },
                    { icon: 'alternate_email', label: 'Mentions and reactions' }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-[#2563EB]">
                         <span className="material-icons text-sm">{item.icon}</span>
                       </div>
                       <span className="text-xs font-bold text-gray-700">{item.label}</span>
                    </div>
                  ))}
               </div>
            </div>
          </div>

          {permission === "denied" && (
            <div className="text-center px-6">
               <p className="text-[10px] text-gray-400 font-bold uppercase leading-relaxed font-mono">
                 [!] PERMISSION TERMINATED BY BROWSER ENVIRONMENT. <br />
                 UNBLOCK VIA ADDRESS BAR SETTINGS TO RESTORE.
               </p>
            </div>
          )}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-md border-t border-[#E2E8F0] flex justify-around py-2.5 z-20">
        <a href="/home" className="flex flex-col items-center text-gray-400 px-6 py-1 rounded-xl">
          <span className="material-icons">chat</span>
          <span className="text-[10px] font-bold mt-0.5">CHATS</span>
        </a>
        <a href="/groups" className="flex flex-col items-center text-gray-400 px-6 py-1 rounded-xl">
          <span className="material-icons">groups</span>
          <span className="text-[10px] font-bold mt-0.5 tracking-tighter">COMMUNITY</span>
        </a>
        <a href="/profile" className="flex flex-col items-center text-[#2563EB] px-6 py-1 rounded-xl">
          <span className="material-icons">person</span>
          <span className="text-[10px] font-bold mt-0.5">PROFILE</span>
        </a>
      </nav>
    </div>
  );
}
