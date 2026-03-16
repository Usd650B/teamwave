"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth, storage } from "@/lib/firebase/firebase";
import { collection, query, orderBy, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { ref, listAll, getDownloadURL, getMetadata } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";

interface User {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  isActive: boolean;
  createdAt: any;
}

interface Conversation {
  id: string;
  name: string;
  participants: string[];
  lastMessage: string;
  updatedAt: any;
}

interface FileData {
  name: string;
  size: number;
  type: string;
  url: string;
  uploader?: string;
  chatId: string;
  fullPath: string;
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [files, setFiles] = useState<FileData[]>([]);
  const [activeTab, setActiveTab] = useState("users");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = checkAdminAccess();
    return () => { if (unsubscribe) unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAdminAccess = () => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      const adminEmails = ["admin@teamwave.com", "mabessa@example.com", "admin@example.com"];
      if (!adminEmails.includes(user.email || "")) {
        setError("Access denied. Admin privileges required.");
        setLoading(false);
        return;
      }
      setIsAdmin(true);
      loadAdminData();
    });
    return unsubscribe;
  };

  const loadAdminData = async () => {
    setLoading(true);
    try {
      // Load users
      const usersSnapshot = await getDocs(collection(db, "users"));
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
      setUsers(usersData);

      // Load conversations
      const conversationsQuery = query(collection(db, "conversations"), orderBy("updatedAt", "desc"));
      const conversationsSnapshot = await getDocs(conversationsQuery);
      const conversationsData = conversationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Conversation[];
      setConversations(conversationsData);

      // Load files from storage (recursively through chatId folders)
      const uploadsRef = ref(storage, "uploads");
      const rootList = await listAll(uploadsRef);
      
      const allFiles: FileData[] = [];
      
      // Check files in root (if any)
      for (const item of rootList.items) {
        const metadata = await getMetadata(item);
        const url = await getDownloadURL(item);
        allFiles.push({
          name: item.name,
          size: metadata.size,
          type: metadata.contentType || "unknown",
          url,
          chatId: "root",
          fullPath: item.fullPath
        });
      }

      // Check subfolders (chatId folders)
      for (const folder of rootList.prefixes) {
        const folderList = await listAll(folder);
        for (const item of folderList.items) {
          try {
            const metadata = await getMetadata(item);
            const url = await getDownloadURL(item);
            allFiles.push({
              name: item.name,
              size: metadata.size,
              type: metadata.contentType || "unknown",
              url,
              chatId: folder.name,
              fullPath: item.fullPath
            });
          } catch (e) {
            console.warn("Could not fetch metadata for", item.fullPath);
          }
        }
      }
      
      setFiles(allFiles);
    } catch (err: any) {
      setError("Error loading admin data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "users", userId), {
        isActive: !currentStatus
      });
      loadAdminData();
    } catch (err: any) {
      alert("Error updating user: " + err.message);
    }
  };

  const deleteConversation = async (chatId: string) => {
    if (!confirm("Are you sure you want to delete this conversation? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "conversations", chatId));
      loadAdminData();
    } catch (err: any) {
      alert("Error deleting conversation: " + err.message);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F5F5]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2563EB]"></div>
      </div>
    );
  }

  if (error && !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F5F5] p-4 text-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-sm">
          <div className="text-red-500 text-5xl mb-4">🚫</div>
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button onClick={() => router.push("/home")} className="bg-[#2563EB] text-white px-6 py-2 rounded font-medium">
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      <header className="bg-[#1E293B] text-white px-6 py-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-[#2563EB] p-2 rounded-lg">
            <span className="material-icons">admin_panel_settings</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Admin Terminal</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">TeamWave System Control</p>
          </div>
        </div>
        <button onClick={() => router.push("/home")} className="text-sm border border-white/20 px-4 py-1.5 rounded-full hover:bg-white/10 transition-all">
          Exit Admin
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <nav className="w-64 bg-white border-r border-[#E2E8F0] py-6 hidden md:block">
          <div className="px-4 space-y-1">
            <button
              onClick={() => setActiveTab("users")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === "users" ? "bg-[#2563EB] text-white shadow-md shadow-blue-500/20" : "text-gray-500 hover:bg-gray-50"}`}
            >
              <span className="material-icons text-xl">people</span>
              <span>Users</span>
            </button>
            <button
              onClick={() => setActiveTab("conversations")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === "conversations" ? "bg-[#2563EB] text-white shadow-md shadow-blue-500/20" : "text-gray-500 hover:bg-gray-50"}`}
            >
              <span className="material-icons text-xl">chat</span>
              <span>Chats</span>
            </button>
            <button
              onClick={() => setActiveTab("files")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === "files" ? "bg-[#2563EB] text-white shadow-md shadow-blue-500/20" : "text-gray-500 hover:bg-gray-50"}`}
            >
              <span className="material-icons text-xl">folder_shared</span>
              <span>Files</span>
            </button>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === "users" && (
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <h2 className="text-2xl font-bold text-[#1E293B]">User Management</h2>
                <span className="text-xs font-bold text-gray-400 uppercase">{users.length} Users Total</span>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Role/Status</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {users.map(user => (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900">{user.name}</div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                          <div className="text-[10px] text-blue-500 font-medium uppercase mt-1">{user.jobTitle || 'No Title'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight ${user.isActive !== false ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {user.isActive !== false ? "Active" : "Disabled"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => toggleUserStatus(user.id, user.isActive !== false)}
                            className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border transition-all ${user.isActive !== false ? "border-red-200 text-red-600 hover:bg-red-50" : "border-green-200 text-green-600 hover:bg-green-50"}`}
                          >
                            {user.isActive !== false ? "Freeze" : "Restore"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "conversations" && (
            <div className="space-y-6">
               <div className="flex justify-between items-end">
                <h2 className="text-2xl font-bold text-[#1E293B]">System Chats</h2>
                <span className="text-xs font-bold text-gray-400 uppercase">{conversations.length} Active Rooms</span>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {conversations.map(conv => (
                  <div key={conv.id} className="bg-white p-5 rounded-2xl shadow-sm border border-[#E2E8F0] flex flex-col group hover:border-[#2563EB] transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-gray-900">{conv.name || "Unnamed Chat"}</h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">ID: {conv.id}</p>
                      </div>
                      <button
                        onClick={() => deleteConversation(conv.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <span className="material-icons text-xl">delete_sweep</span>
                      </button>
                    </div>
                    <div className="flex gap-2 mb-4">
                      {conv.participants?.length || 0} participants
                    </div>
                    <div className="mt-auto pt-3 border-t border-gray-50 flex items-center justify-between">
                       <div className="text-xs text-gray-500 italic max-w-[200px] truncate">
                        &quot;{conv.lastMessage || "No messages"}&quot;
                       </div>
                       <div className="text-[10px] font-bold text-gray-300">
                        {conv.updatedAt?.toDate?.() ? conv.updatedAt.toDate().toLocaleDateString() : ""}
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "files" && (
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <h2 className="text-2xl font-bold text-[#1E293B]">Storage Terminal</h2>
                <span className="text-xs font-bold text-gray-400 uppercase">{files.length} Shared Files</span>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Filename</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Size</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Context</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Download</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {files.map((file, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="material-icons text-gray-400">description</span>
                            <div className="min-w-0">
                               <div className="font-bold text-sm text-gray-900 truncate max-w-[200px]">{file.name}</div>
                               <div className="text-[10px] text-gray-400 uppercase truncate">{file.type}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-gray-600">{formatSize(file.size)}</td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-md">
                            CHAT: {file.chatId.substring(0, 8)}...
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <a href={file.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 font-bold text-xs uppercase">
                            View File
                          </a>
                        </td>
                      </tr>
                    ))}
                    {files.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">No files found in storage.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
