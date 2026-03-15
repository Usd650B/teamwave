"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase/firebase";
import { collection, query, where, onSnapshot, orderBy, getDocs } from "firebase/firestore";
import { auth } from "@/lib/firebase/firebase";

export default function ChatList() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", user.uid),
      orderBy("updatedAt", "desc")
    );
    const unsubscribe = onSnapshot(q, snapshot => {
      setConversations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleGlobalSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      // Search across all conversations
      const allResults: any[] = [];
      
      for (const conv of conversations) {
        // Get all messages in this conversation
        const messagesRef = collection(db, "conversations", conv.id, "messages");
        const messagesSnapshot = await getDocs(messagesRef);
        
        // Search in message content
        const matchingMessages = messagesSnapshot.docs
          .map(doc => doc.data())
          .filter(msg => msg.message?.toLowerCase().includes(searchQuery.toLowerCase()));
        
        if (matchingMessages.length > 0) {
          allResults.push({
            conversationId: conv.id,
            conversationName: conv.name || "Unknown",
            message: matchingMessages[0]?.message,
            timestamp: matchingMessages[0]?.createdAt,
            conversation: conv
          });
        }
      }
      
      setSearchResults(allResults);
      setLoading(false);
    } catch (error) {
      console.error("Search error:", error);
    }
  };

  const handleSearchResultClick = (result: any) => {
    // Navigate to the specific conversation and highlight the message
    window.location.href = `/chat/${result.conversationId}`;
  };

  // Filter conversations based on search
  const filteredConversations = showGlobalSearch && searchQuery.trim() 
    ? conversations.filter(conv => 
        searchResults.some(result => result.conversationId === conv.id)
      ) 
    : conversations;

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F5F5]">
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#E5E7EB]">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="TeamWave" className="w-8 h-8" />
          <h1 className="text-xl font-bold text-[#2563EB]">TeamWave</h1>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowGlobalSearch(!showGlobalSearch)}
            className="w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-lg"
            title="Global Search"
          >
            🔍
          </button>
          <button 
            onClick={() => window.location.href = '/groups'}
            className="w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-lg"
            title="Groups"
          >
            👥
          </button>
          <button 
            onClick={() => window.location.href = '/admin'}
            className="w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-lg"
            title="Admin"
          >
            ⚙️
          </button>
          <button 
            onClick={() => window.location.href = '/discover'}
            className="w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-lg"
            title="Discover"
          >
            +
          </button>
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center px-4 py-8">
        {/* Global Search Bar */}
        {showGlobalSearch && (
          <div className="w-full max-w-md bg-white rounded-lg shadow p-4 mb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search all conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-2 pr-10 border border-[#E5E7EB] rounded"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            
            {/* Search Results */}
            {loading && (
              <div className="text-center mt-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2563EB]"></div>
              </div>
            )}
            
            {searchResults.length > 0 && (
              <div className="text-sm text-gray-600 mt-2">
                Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} across {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}
        {/* Regular Conversation List */}
        {!showGlobalSearch && (
          <div>
            <h2 className="text-lg font-semibold text-[#2563EB] mb-2">Chat List</h2>
            <div className="w-full max-w-md bg-white rounded shadow p-4">
              {filteredConversations.length === 0 ? (
                <div className="text-gray-400 text-center">No conversations yet.</div>
              ) : (
                filteredConversations.map(conv => (
                  <a
                    key={conv.id}
                    href={`/chat/${conv.id}`}
                    className="flex items-center gap-4 py-2 border-b border-[#E5E7EB] last:border-b-0 hover:bg-gray-50"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#E5E7EB] mr-2" />
                    <div className="flex-1">
                      <div className="font-semibold text-black">{conv.name}</div>
                      <div className="text-xs text-gray-500">{conv.lastMessage}</div>
                    </div>
                    <div className="text-xs opacity-70">
                      {conv.participants?.length || 0} member{conv.participants?.length !== 1 ? 's' : ''} • {conv.updatedAt?.toDate?.().toLocaleString?.() || ""}
                    </div>
                  </a>
                ))
              )}
            </div>
          </div>
        )}
      </main>
      <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-[#E5E7EB] flex justify-around py-2">
        <a href="/home" className="flex flex-col items-center text-[#2563EB]">
          <span className="material-icons">chat</span>
          <span className="text-xs">Home</span>
        </a>
        <a href="/discover" className="flex flex-col items-center text-black">
          <span className="material-icons">search</span>
          <span className="text-xs">Discover</span>
        </a>
        <a href="/profile" className="flex flex-col items-center text-black">
          <span className="material-icons">person</span>
          <span className="text-xs">Profile</span>
        </a>
      </nav>
    </div>
  );
}
