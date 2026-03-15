"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth, storage } from "@/lib/firebase/firebase";
import { collection, query, where, onSnapshot, orderBy, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { getStorage, ref, listAll, getDownloadURL } from "firebase/storage";
import { getMetadata } from "firebase/storage";

interface User {
  id: string;
  email: string;
  displayName: string;
  role: string;
  lastLogin: any;
  createdAt: any;
  isActive: boolean;
}

interface Conversation {
  id: string;
  name: string;
  participants: string[];
  createdAt: any;
  lastActivity: any;
  messageCount: number;
}

interface FileData {
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: any;
  uploadedBy: string;
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("users");
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    const user = auth.currentUser;
    if (!user) {
      router.push("/login");
      return;
    }

    // Check if user is admin (you can implement your own logic)
    const adminEmails = ["admin@teamwave.com", "mabessa@example.com"]; // Add your admin emails
    if (!adminEmails.includes(user.email || "")) {
      setError("Access denied. Admin privileges required.");
      return;
    }

    setIsAdmin(true);
    loadAdminData();
  };

  const loadAdminData = async () => {
    try {
      setLoading(true);
      
      // Load users
      const usersQuery = query(collection(db, "users"));
      const usersSnapshot = await getDocs(usersQuery);
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
      setUsers(usersData);

      // Load conversations
      const conversationsQuery = query(collection(db, "conversations"), orderBy("lastActivity", "desc"));
      const conversationsSnapshot = await getDocs(conversationsQuery);
      const conversationsData = conversationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Conversation[];
      setConversations(conversationsData);

      // Load files
      const storage = getStorage();
      const filesRef = ref(storage, "uploads");
      const filesList = await listAll(filesRef);
      
      const filesData: FileData[] = [];
      for (const item of filesList.items) {
        const url = await getDownloadURL(item);
        // Extract basic info from the file name
        const nameParts = item.name.split('_');
        const timestamp = nameParts[0] || '';
        const fileName = nameParts.slice(1).join('_') || item.name;
        
        filesData.push({
          name: fileName,
          size: 0, // Size not available without getMetadata
          type: "unknown",
          url,
          uploadedAt: timestamp ? new Date(parseInt(timestamp)) : new Date(),
          uploadedBy: "unknown"
        });
      }
      setFiles(filesData);

    } catch (error) {
      console.error("Error loading admin data:", error);
      setError("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "users", userId), {
        isActive: !currentStatus
      });
      loadAdminData();
    } catch (error) {
      console.error("Error updating user status:", error);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!confirm("Are you sure you want to delete this conversation?")) return;
    
    try {
      await deleteDoc(doc(db, "conversations", conversationId));
      loadAdminData();
    } catch (error) {
      console.error("Error deleting conversation:", error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col min-h-screen bg-[#F5F5F5]">
        <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#E5E7EB]">
          <h1 className="text-xl font-bold text-[#2563EB]">Admin Dashboard</h1>
        </header>
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-red-600 mb-2">Access Denied</h2>
            <p className="text-gray-700">{error}</p>
            <button 
              onClick={() => router.push("/home")}
              className="mt-4 px-6 py-2 rounded bg-[#2563EB] text-white font-medium"
            >
              Back to Home
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F5F5]">
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#E5E7EB]">
        <h1 className="text-xl font-bold text-[#2563EB]">Admin Dashboard</h1>
        <button 
          onClick={() => router.push("/home")}
          className="px-4 py-2 rounded bg-gray-200 text-gray-700 font-medium"
        >
          Back to Home
        </button>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-[#E5E7EB] p-4">
          <nav className="space-y-2">
            <button
              onClick={() => setActiveTab("users")}
              className={`w-full text-left px-3 py-2 rounded ${activeTab === "users" ? "bg-[#2563EB] text-white" : "hover:bg-gray-100"}`}
            >
              👥 Users ({users.length})
            </button>
            <button
              onClick={() => setActiveTab("conversations")}
              className={`w-full text-left px-3 py-2 rounded ${activeTab === "conversations" ? "bg-[#2563EB] text-white" : "hover:bg-gray-100"}`}
            >
              💬 Conversations ({conversations.length})
            </button>
            <button
              onClick={() => setActiveTab("files")}
              className={`w-full text-left px-3 py-2 rounded ${activeTab === "files" ? "bg-[#2563EB] text-white" : "hover:bg-gray-100"}`}
            >
              📁 Files ({files.length})
            </button>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2563EB]"></div>
            </div>
          ) : (
            <>
              {/* Users Tab */}
              {activeTab === "users" && (
                <div>
                  <h2 className="text-2xl font-bold text-[#2563EB] mb-4">User Management</h2>
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {users.map(user => (
                          <tr key={user.id}>
                            <td className="px-4 py-3">
                              <div>
                                <div className="font-medium">{user.displayName || user.email}</div>
                                <div className="text-sm text-gray-500">{user.email}</div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
                                {user.role || "user"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs font-medium rounded ${
                                user.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                              }`}>
                                {user.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {user.lastLogin?.toDate?.() ? new Date(user.lastLogin.toDate()).toLocaleDateString() : "Never"}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleToggleUserStatus(user.id, user.isActive)}
                                className={`px-3 py-1 text-xs font-medium rounded ${
                                  user.isActive ? "bg-red-500 text-white" : "bg-green-500 text-white"
                                }`}
                              >
                                {user.isActive ? "Deactivate" : "Activate"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Conversations Tab */}
              {activeTab === "conversations" && (
                <div>
                  <h2 className="text-2xl font-bold text-[#2563EB] mb-4">Conversation Management</h2>
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Participants</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Messages</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Last Activity</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {conversations.map(conv => (
                          <tr key={conv.id}>
                            <td className="px-4 py-3 font-medium">{conv.name || "Unnamed"}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{conv.participants?.length || 0}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{conv.messageCount || 0}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {conv.lastActivity?.toDate?.() ? new Date(conv.lastActivity.toDate()).toLocaleDateString() : "Never"}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleDeleteConversation(conv.id)}
                                className="px-3 py-1 text-xs font-medium rounded bg-red-500 text-white"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Files Tab */}
              {activeTab === "files" && (
                <div>
                  <h2 className="text-2xl font-bold text-[#2563EB] mb-4">File Management</h2>
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Uploaded By</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {files.map((file, index) => (
                          <tr key={index}>
                            <td className="px-4 py-3 font-medium">{file.name}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{file.type}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{formatFileSize(file.size)}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{file.uploadedBy}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString() : "Unknown"}
                            </td>
                            <td className="px-4 py-3">
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1 text-xs font-medium rounded bg-blue-500 text-white mr-2"
                              >
                                View
                              </a>
                              <button
                                onClick={() => window.open(file.url, '_blank')}
                                className="px-3 py-1 text-xs font-medium rounded bg-green-500 text-white"
                              >
                                Download
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
