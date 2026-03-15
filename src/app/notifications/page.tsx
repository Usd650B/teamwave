"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/firebase";
import { initializeMessaging, requestNotificationPermission } from "@/lib/notifications";

export default function NotificationsPage() {
  const [permission, setPermission] = useState<string>("prompt");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    checkPermissionStatus();
  }, []);

  const checkPermissionStatus = async () => {
    if ("Notification" in window) {
      const status = Notification.permission;
      setPermission(status);
    }
  };

  const handleRequestPermission = async () => {
    setLoading(true);
    setError("");
    
    try {
      const granted = await requestNotificationPermission();
      if (granted) {
        await initializeMessaging();
        setPermission("granted");
      } else {
        setPermission("denied");
        setError("Notification permission was denied. Please enable notifications in your browser settings.");
      }
    } catch (err) {
      setError("Failed to request permission: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Test Notification", {
          body: "This is a test notification from TeamWave!",
          icon: "/favicon.ico",
          tag: "test-notification"
        });
      }
    } catch (err) {
      setError("Failed to send test notification: " + (err as Error).message);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F5F5]">
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#E5E7EB]">
        <h1 className="text-xl font-bold text-[#2563EB]">Notifications</h1>
        <button
          onClick={() => router.push("/home")}
          className="text-[#2563EB] hover:underline"
        >
          Back
        </button>
      </header>
      <main className="flex-1 flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-md bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-[#2563EB] mb-6">Notification Settings</h2>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700">
              {error}
            </div>
          )}

          <div className="mb-6">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
              <div>
                <h3 className="text-sm font-medium text-gray-700">Status</h3>
                <p className="text-xs text-gray-600">
                  {permission === "granted" ? "✅ Enabled" : 
                   permission === "denied" ? "❌ Denied" : 
                   permission === "prompt" ? "⚠️ Not requested" : "🔔 Unknown"}
                </p>
              </div>
            </div>
              {permission !== "granted" && (
                <button
                  onClick={handleRequestPermission}
                  disabled={loading}
                  className="bg-[#2563EB] text-white px-4 py-2 rounded font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Requesting..." : "Enable Notifications"}
                </button>
              )}
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={handleTestNotification}
              className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded hover:bg-gray-200"
            >
              Test Notification
            </button>
          </div>

          <div className="mt-4 text-xs text-gray-500">
            <p className="mb-2">💡 Notifications will appear when:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>You receive a new message</li>
              <li>Someone reacts to your message</li>
              <li>You are mentioned in a message</li>
              <li>Tab is active in background</li>
            </ul>
          </div>
      </main>
    </div>
  );
}
