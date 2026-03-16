"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase/firebase";
import { collection, query, where, onSnapshot, orderBy, getDocs, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

interface Conversation {
  id: string;
  name?: string;
  participants: string[];
  isGroup?: boolean;
  lastMessage?: string;
  updatedAt?: any;
  isActive?: boolean;
  unread?: boolean;
}

interface UserProfile {
  id: string;
  name?: string;
  profilePhoto?: string;
  jobTitle?: string;
}

export default function ChatList() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [userCache, setUserCache] = useState<Record<string, UserProfile>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const router = useRouter();

  // Wait for auth state
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        router.replace("/login");
      }
    });
    return unsubscribeAuth;
  }, [router]);

  // Subscribe to conversations
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", currentUser.uid),
      orderBy("updatedAt", "desc")
    );
    const unsubscribe = onSnapshot(q, 
      async (snapshot) => {
        const convs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Conversation));
        setConversations(convs);

        // Fetch user info for private chats to get correct names/photos
        for (const conv of convs) {
          if (!conv.isGroup && conv.participants) {
            const otherId = conv.participants.find((uid: string) => uid !== currentUser?.uid);
            if (otherId && !userCache[otherId]) {
               const userDoc = await getDoc(doc(db, "users", otherId));
               if (userDoc.exists()) {
                  const userData = userDoc.data();
                  setUserCache(prev => ({ ...prev, [otherId]: { id: userDoc.id, ...userData } as UserProfile }));
               }
            }
          }
        }
      },
      (error) => {
        if (error.code === 'failed-precondition') {
          console.warn("Missing index for conversations. Retrying with client-side sort.");
          // Fallback query without orderBy
          const fallbackQ = query(
            collection(db, "conversations"),
            where("participants", "array-contains", currentUser.uid)
          );
          onSnapshot(fallbackQ, (snapshot) => {
            const convs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Conversation));
            // Sort client-side
            const sorted = convs.sort((a, b) => {
              const dateA = a.updatedAt?.toDate?.() || 0;
              const dateB = b.updatedAt?.toDate?.() || 0;
              return dateB - dateA;
            });
            setConversations(sorted);
          });
        } else {
          console.error("Conversations listener error:", error);
        }
      }
    );
    return () => unsubscribe();
  }, [currentUser, userCache]);

  const handleGlobalSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const allResults: any[] = [];
      for (const conv of conversations) {
        const messagesRef = collection(db, "conversations", conv.id, "messages");
        const messagesSnapshot = await getDocs(messagesRef);
        const matchingMessages = messagesSnapshot.docs
          .map((doc) => doc.data())
          .filter((msg) => msg.message?.toLowerCase().includes(searchQuery.toLowerCase()));
        if (matchingMessages.length > 0) {
          allResults.push({
            conversationId: conv.id,
            conversationName: conv.name || "Unknown",
            message: matchingMessages[0]?.message,
            timestamp: matchingMessages[0]?.createdAt,
            conversation: conv,
          });
        }
      }
      setSearchResults(allResults);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredConversations =
    showGlobalSearch && searchQuery.trim()
      ? conversations.filter((conv) =>
          searchResults.some((result) => result.conversationId === conv.id)
        )
      : conversations;

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#E2E8F0] sticky top-0 z-20">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 bg-[#2563EB] rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 overflow-hidden">
             <img src="/logo.png" alt="Logo" className="w-full h-full object-cover scale-110" />
           </div>
           <h1 className="text-xl font-black text-gray-900 tracking-tight">TeamWave</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGlobalSearch(!showGlobalSearch)}
            className="w-10 h-10 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center hover:bg-blue-100 transition-all hover:scale-105"
            title="Search Messages"
          >
            <span className="material-icons text-xl">search</span>
          </button>
          <button
            onClick={() => router.push("/groups")}
            className="w-10 h-10 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center hover:bg-blue-100 transition-all hover:scale-105"
            title="Communities"
          >
            <span className="material-icons text-xl">groups</span>
          </button>
          <a 
            href="/profile" 
            className="w-10 h-10 rounded-2xl bg-[#E5E7EB] overflow-hidden flex items-center justify-center border-2 border-white shadow-sm ml-1 hover:scale-105 transition-all"
          >
            {currentUser?.photoURL ? (
              <img src={currentUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="material-icons text-gray-400">account_circle</span>
            )}
          </a>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-8 pb-28 max-w-2xl mx-auto w-full">
        {showGlobalSearch && (
          <div className="w-full bg-white rounded-3xl shadow-xl shadow-blue-500/5 p-6 mb-8 border border-blue-50 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="relative flex gap-3">
              <div className="relative flex-1">
                <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                <input
                  type="text"
                  placeholder="Find messages in any chat..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGlobalSearch()}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-500/10 transition-all text-sm outline-none"
                  autoFocus
                />
              </div>
              <button
                onClick={handleGlobalSearch}
                className="px-6 py-4 bg-[#2563EB] text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/30"
              >
                FIND
              </button>
            </div>

            {loading && (
              <div className="flex justify-center mt-6">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#2563EB] border-t-transparent"></div>
              </div>
            )}

            {!loading && searchQuery && searchResults.length === 0 && (
              <div className="text-xs font-bold text-gray-400 mt-6 text-center py-4 bg-gray-50 rounded-2xl uppercase tracking-widest">No matching results</div>
            )}

            {!loading && searchResults.length > 0 && (
              <div className="text-[10px] font-black text-blue-500 mt-6 px-1 uppercase tracking-widest">
                {searchResults.length} Match{searchResults.length !== 1 ? "es" : ""} found
              </div>
            )}
          </div>
        )}

        <div className="w-full space-y-4">
          <div className="flex justify-between items-center mb-6 px-2">
            <h2 className="text-2xl font-black text-[#1E293B] tracking-tight">
              {showGlobalSearch && searchQuery ? "Results" : "Messages"}
            </h2>
            {!showGlobalSearch && (
              <button onClick={() => router.push("/discover")} className="text-xs font-black text-[#2563EB] bg-blue-50 px-4 py-2 rounded-xl hover:bg-blue-100 transition-colors uppercase tracking-widest">
                Start +
              </button>
            )}
          </div>
          
          <div className="space-y-3">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-8 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                <div className="w-20 h-20 bg-blue-50 rounded-[2.5rem] flex items-center justify-center mb-6">
                  <span className="material-icons text-[#2563EB] text-4xl">chat_bubble_outline</span>
                </div>
                <h3 className="text-[#1E293B] font-black text-lg mb-2 uppercase tracking-tight">Silent Waves...</h3>
                <p className="text-sm text-gray-400 font-medium max-w-[240px] leading-relaxed mb-8">
                  {showGlobalSearch && searchQuery ? "Try searching for a different keyword or name." : "Start a conversation with your team members in the discovery tab."}
                </p>
                {!showGlobalSearch && (
                  <button 
                    onClick={() => router.push("/discover")}
                    className="px-8 py-3 bg-[#1E293B] text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-gray-200"
                  >
                    DISCOVER TEAM
                  </button>
                )}
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const otherUid = conv.isGroup ? null : conv.participants?.find((uid: string) => uid !== currentUser?.uid);
                const chatName = conv.isGroup ? conv.name : (otherUid && userCache[otherUid] ? userCache[otherUid].name : (conv.name || "Private Chat"));
                const chatPhoto = conv.isGroup ? null : (otherUid && userCache[otherUid] ? userCache[otherUid].profilePhoto : null);
                
                return (
                  <a
                    key={conv.id}
                    href={`/chat/${conv.id}`}
                    className="flex items-center gap-4 p-5 bg-white rounded-3xl border border-[#E2E8F0] hover:border-[#2563EB] transition-all group relative overflow-hidden shadow-sm hover:shadow-md active:scale-95"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center flex-shrink-0 relative">
                      {chatPhoto ? (
                        <img src={chatPhoto} alt={chatName} className="w-full h-full rounded-2xl object-cover shadow-inner" />
                      ) : (
                        <span className="material-icons text-blue-300 text-3xl">{conv.isGroup ? 'groups' : 'person'}</span>
                      )}
                      {conv.isActive && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-4 border-white rounded-full"></div>}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <div className="font-black text-[#1E293B] truncate pr-2 tracking-tight">{chatName}</div>
                        <div className="text-[10px] font-black text-gray-300 flex-shrink-0 uppercase tracking-widest">
                          {conv.updatedAt?.toDate?.()
                            ? conv.updatedAt.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : ""}
                        </div>
                      </div>
                      <div className="text-sm text-gray-400 truncate font-semibold">
                        {conv.lastMessage || <span className="text-gray-200 italic font-medium">New match! Send a wave 👋</span>}
                      </div>
                    </div>
                    
                    {conv.unread && <div className="w-2.5 h-2.5 bg-[#2563EB] rounded-full shadow-lg shadow-blue-500/50"></div>}
                  </a>
                );
              })
            )}
          </div>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-xl border-t border-gray-100 flex justify-around py-4 z-20">
        <a href="/home" className="flex flex-col items-center text-[#2563EB] px-6 py-1">
          <span className="material-icons">chat</span>
          <span className="text-[9px] font-black mt-1 tracking-widest">CHATS</span>
        </a>
        <a href="/discover" className="flex flex-col items-center text-gray-300 hover:text-gray-500 px-6 py-1 transition-colors">
          <span className="material-icons">search</span>
          <span className="text-[9px] font-black mt-1 tracking-widest">TEAM</span>
        </a>
        <a href="/profile" className="flex flex-col items-center text-gray-300 hover:text-gray-500 px-6 py-1 transition-colors">
          <span className="material-icons">person</span>
          <span className="text-[9px] font-black mt-1 tracking-widest">ME</span>
        </a>
      </nav>
    </div>
  );
}
