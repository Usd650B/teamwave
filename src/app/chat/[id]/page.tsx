"use client";

import React, { useEffect, useState, useRef } from "react";
import { db, storage } from "@/lib/firebase/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc, updateDoc, getDoc } from "firebase/firestore";
import { auth } from "@/lib/firebase/firebase";
import { useParams, useRouter } from "next/navigation";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useTheme } from "@/contexts/ThemeContext";
import { onAuthStateChanged } from "firebase/auth";

export default function ChatPage() {
  const { theme, toggleTheme } = useTheme();
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInfo, setChatInfo] = useState<any>(null);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [typingNames, setTypingNames] = useState<Record<string, string>>({});
  const [isTyping, setIsTyping] = useState(false);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const params = useParams();
  const chatId = params.id as string;
  const router = useRouter();

  // Monitor auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) router.replace("/login");
    });
    return unsubscribe;
  }, [router]);

  // Load chat info (name, etc)
  useEffect(() => {
    if (!chatId || !currentUser) return;
    const fetchChatInfo = async () => {
      try {
        const chatDoc = await getDoc(doc(db, "conversations", chatId));
        if (chatDoc.exists()) {
          const data = chatDoc.data();
          // Check if current user is a participant
          if (data.participants?.includes(currentUser.uid)) {
            setChatInfo(data);
          } else {
            console.warn("Access denied to this conversation");
            router.replace("/home");
          }
        } else {
          router.replace("/home");
        }
      } catch (err) {
        console.error("Error fetching chat info:", err);
      }
    };
    fetchChatInfo();
  }, [chatId, currentUser, router]);

  // Load messages & typing
  useEffect(() => {
    // ONLY subscribe if we verified chatInfo exists and the user is a participant
    if (!chatId || !currentUser || !chatInfo) return;

    const messagesQuery = query(
      collection(db, "conversations", chatId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribeMessages = onSnapshot(messagesQuery, 
      (snapshot) => {
        setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => {
        if (error.code === 'permission-denied') {
          console.warn("Permission denied for messages listener");
        } else {
          console.error("Messages listener error:", error);
        }
      }
    );

    const typingRef = doc(db, "typing", chatId);
    const unsubscribeTyping = onSnapshot(typingRef, 
      async (docSnap) => {
        if (docSnap.exists()) {
          const typingData = docSnap.data();
          const uids = Object.keys(typingData).filter(uid => 
            typingData[uid] === true && uid !== currentUser.uid
          );
          setTypingUsers(uids);
          
          for (const uid of uids) {
            setTypingNames(prev => {
              if (!prev[uid]) {
                getDoc(doc(db, "users", uid)).then(uDoc => {
                  if (uDoc.exists()) {
                    setTypingNames(latest => ({ ...latest, [uid]: uDoc.data().name || "Someone" }));
                  }
                }).catch(() => {});
              }
              return prev;
            });
          }
        } else {
          setTypingUsers([]);
        }
      },
      (error) => {
        if (error.code !== 'permission-denied') {
          console.error("Typing listener error:", error);
        }
      }
    );

    return () => {
      unsubscribeMessages();
      unsubscribeTyping();
    };
  }, [chatId, currentUser, chatInfo]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !file) return;

    const user = currentUser;
    if (!user || !chatId) return;

    try {
      let fileUrl = "";
      let fileName = "";
      let fileType = "";
      let fileSize = 0;

      if (file) {
        const storageRef = ref(storage, `uploads/${chatId}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        fileUrl = await getDownloadURL(storageRef);
        fileName = file.name;
        fileType = file.type;
        fileSize = file.size;
      }

      const messageContent = input.trim();
      const messageData = {
        senderId: user.uid,
        senderName: user.displayName || "Unknown",
        message: messageContent,
        fileUrl,
        fileName,
        fileType,
        fileSize,
        createdAt: serverTimestamp(),
        seen: false
      };

      await addDoc(collection(db, "conversations", chatId, "messages"), messageData);
      
      const convRef = doc(db, "conversations", chatId);
      await updateDoc(convRef, {
        lastMessage: messageContent || (fileName ? `📎 ${fileName}` : ""),
        updatedAt: serverTimestamp()
      });

      setInput("");
      setFile(null);
      setShowEmoji(false);
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message.");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
    
    if (!currentUser || !chatId) return;

    if (!isTyping) {
      setIsTyping(true);
      setDoc(doc(db, "typing", chatId), {
        [currentUser.uid]: true
      }, { merge: true });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      setDoc(doc(db, "typing", chatId), {
        [currentUser.uid]: false
      }, { merge: true });
    }, 2000);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'videocam';
    if (type.startsWith('audio/')) return 'audiotrack';
    return 'insert_drive_file';
  };

  return (
    <div className="flex flex-col h-screen bg-[#F0F2F5]">
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#E5E7EB] shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-blue-600 transition-colors">
            <span className="material-icons">arrow_back</span>
          </button>
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
            {chatInfo?.name?.charAt(0).toUpperCase() || "C"}
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 leading-tight truncate max-w-[150px]">
              {chatInfo?.name || "Loading chat..."}
            </h1>
            <div className="text-[10px] text-green-500 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              ACTIVE NOW
            </div>
          </div>
        </div>
        <button onClick={toggleTheme} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
          <span className="material-icons text-gray-500">{theme === "light" ? "dark_mode" : "light_mode"}</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-3">
        {messages.map((msg, idx) => {
          const isOwn = msg.senderId === currentUser?.uid;
          const showSender = !isOwn && (!messages[idx-1] || messages[idx-1].senderId !== msg.senderId);
          
          return (
            <div key={msg.id || idx} className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
              {showSender && <span className="text-[10px] font-bold text-gray-400 ml-2 mb-1 uppercase tracking-wider">{msg.senderName}</span>}
              
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                isOwn ? "bg-[#2563EB] text-white rounded-tr-none" : "bg-white text-gray-800 rounded-tl-none border border-gray-100"
              }`}>
                {msg.fileUrl && (
                  <div className="mb-2">
                    {msg.fileType.startsWith("image") ? (
                      <img src={msg.fileUrl} alt="attachment" className="rounded-lg max-h-60 object-cover border border-black/5 cursor-pointer hover:opacity-95 transition-opacity" onClick={() => window.open(msg.fileUrl, '_blank')} />
                    ) : (
                      <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-2 bg-black/5 rounded-lg hover:bg-black/10 transition-colors">
                        <span className="material-icons text-blue-500">{getFileIcon(msg.fileType)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold truncate">{msg.fileName}</div>
                          <div className="text-[10px] opacity-60 uppercase">{formatFileSize(msg.fileSize)}</div>
                        </div>
                        <span className="material-icons text-gray-400 text-sm">download</span>
                      </a>
                    )}
                  </div>
                )}
                <div className="leading-relaxed whitespace-pre-wrap break-words">{msg.message}</div>
                <div className={`text-[9px] mt-1 text-right ${isOwn ? "text-blue-100" : "text-gray-400"} font-bold`}>
                  {msg.createdAt?.toDate?.() ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "..."}
                </div>
              </div>
            </div>
          );
        })}
        
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="flex space-x-1">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight italic">
              {typingUsers.length === 1 ? `${typingNames[typingUsers[0]] || "Someone"} is typing...` : "People are typing..."}
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="bg-white border-t border-[#E5E7EB] px-4 py-3 pb-safe-bottom">
        <form className="flex items-end gap-2" onSubmit={handleSend}>
          <div className="flex items-center gap-1 mb-1">
            <label className="cursor-pointer p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-500">
              <span className="material-icons shadow-sm">attach_file</span>
              <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
            <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-500">
              <span className="material-icons text-xl">sentiment_satisfied_alt</span>
            </button>
          </div>
          
          <div className="flex-1 relative">
            {file && (
              <div className="absolute -top-12 left-0 right-0 bg-blue-50 border border-blue-100 rounded-lg p-2 text-xs flex justify-between items-center animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2 truncate">
                  <span className="material-icons text-blue-500 text-sm">description</span>
                  <span className="truncate font-medium">{file.name}</span>
                </div>
                <button type="button" onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500">
                  <span className="material-icons text-sm">close</span>
                </button>
              </div>
            )}
            <input
              type="text"
              placeholder="Write a message..."
              className="w-full bg-gray-100 border-none rounded-2xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 transition-all"
              value={input}
              onChange={handleInputChange}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={!input.trim() && !file}
            className="mb-0.5 w-10 h-10 rounded-full bg-[#2563EB] text-white flex items-center justify-center hover:bg-blue-600 shadow-md shadow-blue-500/30 transition-all disabled:bg-gray-200 disabled:shadow-none disabled:text-gray-400"
          >
            <span className="material-icons">send</span>
          </button>
        </form>
        
        {showEmoji && (
          <div className="mt-3 p-2 bg-gray-50 rounded-xl grid grid-cols-8 gap-1 border border-gray-100 animate-in zoom-in-95 duration-200">
            {['😀', '😂', '😍', '👍', '🔥', '✨', '🙏', '❤️', '🚀', '✅', '👋', '🎉', '💡', '🤔', '👀', '💯'].map(emoji => (
              <button key={emoji} type="button" onClick={() => setInput(p => p + emoji)} className="p-2 hover:bg-white rounded-lg transition-colors text-lg">{emoji}</button>
            ))}
          </div>
        )}
      </footer>
    </div>
  );
}