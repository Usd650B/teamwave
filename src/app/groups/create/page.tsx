"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase/firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { auth } from "@/lib/firebase/firebase";

export default function CreateGroupPage() {
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedMembers.length < 2) {
      setError("Group name and at least 2 members are required");
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated");

      // Create group document
      const groupRef = await addDoc(collection(db, "groups"), {
        name: groupName.trim(),
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        participants: [user.uid, ...selectedMembers],
        admin: [user.uid]
      });

      // Add group to each member's groups array
      for (const memberId of selectedMembers) {
        const memberRef = doc(db, "users", memberId);
        await updateDoc(memberRef, {
          groups: [groupRef.id]
        });
      }

      router.push(`/groups/${groupRef.id}`);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F5F5]">
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#E5E7EB]">
        <h1 className="text-xl font-bold text-[#2563EB]">Create Group</h1>
        <button
          onClick={() => router.push("/home")}
          className="text-[#2563EB] hover:underline"
        >
          Back
        </button>
      </header>
      <main className="flex-1 flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-md bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-[#2563EB] mb-6">Create New Group</h2>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Group Name
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name..."
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Members (minimum 2)
            </label>
            <div className="text-sm text-gray-500 mb-2">
              {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected
            </div>
          </div>

          <button
            onClick={handleCreateGroup}
            disabled={loading}
            className="w-full bg-[#2563EB] text-white py-2 px-4 rounded font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating Group..." : "Create Group"}
          </button>
        </div>
      </main>
    </div>
  );
}
