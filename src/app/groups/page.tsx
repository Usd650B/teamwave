"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase/firebase";
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, getDoc } from "firebase/firestore";
import { auth } from "@/lib/firebase/firebase";

export default function GroupsPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "groups"),
      where("participants", "array-contains", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const groupsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setGroups(groupsData);
      setLoading(false);
    }, (err) => {
      setError("Failed to load groups: " + err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleJoinGroup = async (groupId: string) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const groupRef = doc(db, "groups", groupId);
      const groupDoc = await getDoc(groupRef);
      
      if (groupDoc.exists()) {
        const groupData = groupDoc.data();
        const updatedParticipants = [...(groupData.participants || []), user.uid].filter((id, index, arr) => arr.indexOf(id) === index);
        
        await updateDoc(groupRef, {
          participants: updatedParticipants
        });

        // Add group to user's groups array
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          groups: [...(groupData.groups || []), groupId]
        });
      }
    } catch (err: any) {
      setError("Failed to join group: " + (err as Error).message);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F5F5]">
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#E5E7EB]">
        <h1 className="text-xl font-bold text-[#2563EB]">Groups</h1>
        <div className="flex gap-2">
          <button
            onClick={() => router.push("/groups/create")}
            className="bg-[#2563EB] text-white px-3 py-1 rounded text-sm font-medium hover:bg-blue-600"
          >
            Create Group
          </button>
          <button
            onClick={() => router.push("/home")}
            className="text-[#2563EB] hover:underline"
          >
            Back to Chat
          </button>
        </div>
      </header>
      <main className="flex-1 flex flex-col px-4 py-8">
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2563EB]"></div>
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center text-gray-500">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-lg font-medium">No Groups Yet</h3>
            <p className="text-sm text-gray-600 mb-4">Create your first group to start collaborating with your team!</p>
            <button
              onClick={() => router.push("/groups/create")}
              className="bg-[#2563EB] text-white px-6 py-2 rounded font-medium hover:bg-blue-600"
            >
              Create Group
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map(group => (
              <div key={group.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-semibold text-[#2563EB]">{group.name}</h3>
                    <p className="text-sm text-gray-600">
                      {group.participants?.length || 0} member{group.participants?.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {group.participants?.includes(auth.currentUser?.uid) ? (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Joined</span>
                    ) : (
                      <button
                        onClick={() => handleJoinGroup(group.id)}
                        className="bg-[#2563EB] text-white px-3 py-1 rounded text-sm font-medium hover:bg-blue-600"
                      >
                        Join Group
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  Created {group.createdAt?.toDate?.().toLocaleDateString?.() || "Unknown"}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
