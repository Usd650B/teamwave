"use client";

import React, { useEffect, useState, useRef } from "react";
import { db, storage } from "@/lib/firebase/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc, updateDoc, getDoc, deleteDoc } from "firebase/firestore";
import { auth } from "@/lib/firebase/firebase";
import { useParams, useRouter } from "next/navigation";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useTheme } from "@/contexts/ThemeContext";
import { onAuthStateChanged } from "firebase/auth";
import { MessageSkeleton } from "@/components/Skeleton";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";

export default function ChatPage() {
  const { theme, toggleTheme } = useTheme();
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInfo, setChatInfo] = useState<any>(null);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [typingNames, setTypingNames] = useState<Record<string, string>>({});
  const [participantProfiles, setParticipantProfiles] = useState<Record<string, any>>({});
  const [isTyping, setIsTyping] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [swipeOffset, setSwipeOffset] = useState<Record<string, number>>({});
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const touchStartRef = useRef<number | null>(null);
  const [activeReactionPicker, setActiveReactionPicker] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
            
            // Fetch profiles for all participants
            const profiles: Record<string, any> = {};
            for (const uid of data.participants) {
              try {
                const uDoc = await getDoc(doc(db, "users", uid));
                if (uDoc.exists()) profiles[uid] = uDoc.data();
              } catch (e) {}
            }
            setParticipantProfiles(profiles);
            
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
        setIsLoading(false);
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
    if (!chatId || !currentUser || messages.length === 0) return;
    
    const unseenMessages = messages.filter(
      (m) => m.senderId !== currentUser.uid && !m.seen
    );

    if (unseenMessages.length > 0) {
      const markAsSeen = async () => {
        try {
          for (const msg of unseenMessages) {
            await updateDoc(doc(db, "conversations", chatId, "messages", msg.id), {
              seen: true
            });
          }
        } catch (err) {
          console.error("Error marking messages as seen:", err);
        }
      };
      markAsSeen();
    }
  }, [messages, chatId, currentUser]);

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
      const messageData: any = {
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

      if (replyingTo) {
        messageData.replyTo = {
          id: replyingTo.id,
          message: replyingTo.message,
          senderName: replyingTo.senderName
        };
      }

      await addDoc(collection(db, "conversations", chatId, "messages"), messageData);
      
      const convRef = doc(db, "conversations", chatId);
      await updateDoc(convRef, {
        lastMessage: messageContent || (fileName ? `📎 ${fileName}` : ""),
        updatedAt: serverTimestamp()
      });

      setInput("");
      setFile(null);
      setReplyingTo(null);
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

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!currentUser || !chatId) return;
    try {
      const msgRef = doc(db, "conversations", chatId, "messages", messageId);
      const msgSnap = await getDoc(msgRef);
      if (!msgSnap.exists()) return;

      const data = msgSnap.data();
      const reactions = { ...(data.reactions || {}) };
      const users = [...(reactions[emoji] || [])];

      if (users.includes(currentUser.uid)) {
        reactions[emoji] = users.filter((uid: string) => uid !== currentUser.uid);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        reactions[emoji] = [...users, currentUser.uid];
      }

      await updateDoc(msgRef, { reactions });
      setActiveReactionPicker(null);
    } catch (err) {
      console.error("Reaction update failed:", err);
    }
  };

  const deleteMessage = async (msgId: string) => {
    if (!confirm("Remove this message for everyone?")) return;
    try {
      await deleteDoc(doc(db, "conversations", chatId, "messages", msgId));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const deleteChat = async () => {
    if (!confirm("Permanently delete this entire conversation and all messages?")) return;
    try {
      await deleteDoc(doc(db, "conversations", chatId));
      router.replace("/home");
    } catch (err) {
      console.error("Chat deletion failed:", err);
    }
  };

  const handleSwipe = (msg: any, offset: number) => {
    if (offset > 60) {
      setReplyingTo(msg);
      // Haptic feedback if possible
      try { window.navigator.vibrate(10); } catch {}
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (msgId: string, e: React.TouchEvent) => {
    if (touchStartRef.current !== null) {
      const currentX = e.targetTouches[0].clientX;
      const diff = currentX - touchStartRef.current;
      if (diff > 0 && diff < 100) {
        setSwipeOffset(prev => ({ ...prev, [msgId]: diff }));
      }
    }
  };

  const onTouchEnd = (msg: any, e: React.TouchEvent) => {
    const finalOffset = swipeOffset[msg.id] || 0;
    handleSwipe(msg, finalOffset);
    setSwipeOffset(prev => ({ ...prev, [msg.id]: 0 }));
    touchStartRef.current = null;
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
              {activeThreadId ? "THREAD VIEW" : "ACTIVE NOW"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {activeThreadId && (
            <button 
              onClick={() => setActiveThreadId(null)} 
              className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-lg mr-2 uppercase tracking-widest"
            >
              Back to Chat
            </button>
          )}
          <button onClick={toggleTheme} className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-all">
            <span className="material-icons text-gray-500 text-xl">{theme === "light" ? "dark_mode" : "light_mode"}</span>
          </button>
          <button onClick={deleteChat} className="w-9 h-9 rounded-xl hover:bg-red-50 flex items-center justify-center transition-all text-gray-400 hover:text-red-500">
            <span className="material-icons text-xl">delete_sweep</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-3">
        {isLoading ? (
          <MessageSkeleton />
        ) : (
          <AnimatePresence initial={false}>
            {(activeThreadId 
                ? messages.filter(m => m.id === activeThreadId || m.replyTo?.id === activeThreadId)
                : messages
              ).map((msg, idx, filteredArr) => {
              const isOwn = msg.senderId === currentUser?.uid;
              const showSender = !isOwn && (!filteredArr[idx-1] || filteredArr[idx-1].senderId !== msg.senderId);
              const replies = messages.filter(m => m.replyTo?.id === msg.id);
              
              return (
                <motion.div 
                  key={msg.id || idx}
                  initial={{ opacity: 0, scale: 0.95, y: 10, x: isOwn ? 10 : -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex flex-col ${isOwn ? "items-end" : "items-start"} group relative mb-3`}
                  onTouchStart={onTouchStart}
                  onTouchMove={(e) => onTouchMove(msg.id, e)}
                  onTouchEnd={(e) => onTouchEnd(msg, e)}
                >
                  <div className={`flex gap-2 w-full max-w-[85%] ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
                    
                    {/* Profile Photo */}
                    {!isOwn && showSender && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex-shrink-0 flex items-center justify-center overflow-hidden border border-white shadow-sm mt-auto mb-1">
                        {participantProfiles[msg.senderId]?.profilePhoto ? (
                          <img src={participantProfiles[msg.senderId].profilePhoto} alt={msg.senderName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-black text-blue-600">{msg.senderName?.charAt(0)?.toUpperCase()}</span>
                        )}
                      </div>
                    )}
                    {/* Placeholder to keep alignment if not showing photo for subsequent messages */}
                    {!isOwn && !showSender && <div className="w-8 flex-shrink-0"></div>}

                    <div className="flex flex-col min-w-0" style={{ transform: `translateX(${swipeOffset[msg.id] || 0}px)` }}>
                      {showSender && <span className={`text-[10px] font-black text-gray-400 mb-1 uppercase tracking-widest ${isOwn ? "text-right mr-1" : "ml-1"}`}>{msg.senderName}</span>}
                      
                      <div className={`flex items-center gap-2 transition-transform duration-100 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
                    {/* Swipe Indicator */}
                    <div 
                      className="absolute -left-10 opacity-0 transition-opacity"
                      style={{ opacity: (swipeOffset[msg.id] || 0) / 60 }}
                    >
                       <span className="material-icons text-blue-500">reply</span>
                    </div>
                    {isOwn && (
                      <button 
                        onClick={() => deleteMessage(msg.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-gray-300 hover:text-red-500 transition-all active:scale-90"
                        title="Delete Message"
                      >
                        <span className="material-icons text-sm">delete</span>
                      </button>
                    )}
                    
                    <div 
                      className={`relative rounded-2xl px-4 py-2.5 shadow-sm text-sm transition-all cursor-pointer select-none ${
                        isOwn ? "bg-[#2563EB] text-white rounded-tr-none" : "bg-white text-gray-800 rounded-tl-none border border-gray-100"
                      }`}
                      onDoubleClick={() => setReplyingTo(msg)}
                    >
                      {/* Reply Reference */}
                      {msg.replyTo && (
                        <div className={`mb-2 p-2 rounded-lg text-[10px] border-l-4 ${isOwn ? "bg-blue-600/50 border-blue-300 text-blue-100" : "bg-gray-50 border-blue-500 text-gray-500"}`}>
                            <div className="font-black uppercase mb-0.5">{msg.replyTo.senderName}</div>
                            <div className="truncate">{msg.replyTo.message}</div>
                        </div>
                      )}

                      {msg.fileUrl && (
                        <div className="mb-2">
                          {msg.fileType.startsWith("image") ? (
                            <div className="relative rounded-lg overflow-hidden border border-black/5 shadow-inner bg-gray-50">
                               <Image 
                                 src={msg.fileUrl} 
                                 alt="attachment" 
                                 width={300} 
                                 height={240} 
                                 className="max-h-60 object-cover cursor-pointer hover:scale-105 transition-transform" 
                                 onClick={() => window.open(msg.fileUrl, '_blank')} 
                               />
                            </div>
                          ) : (
                            <Link href={msg.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-2 bg-black/5 rounded-lg hover:bg-black/10 transition-colors block">
                              <span className="material-icons text-blue-500">{getFileIcon(msg.fileType)}</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold truncate">{msg.fileName}</div>
                                <div className="text-[10px] opacity-60 uppercase font-black">{formatFileSize(msg.fileSize)}</div>
                              </div>
                            </Link>
                          )}
                        </div>
                      )}
                      <div className="leading-relaxed whitespace-pre-wrap break-words">{msg.message}</div>
                      
                      {/* Reactions Display */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2 -mb-1">
                          {Object.entries(msg.reactions).map(([emoji, users]: [string, any]) => (
                            <button
                              key={emoji}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleReaction(msg.id, emoji);
                              }}
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-all hover:scale-110 ${
                                users.includes(currentUser?.uid)
                                  ? isOwn ? "bg-blue-400/30 border-blue-300 text-white" : "bg-blue-50 border-blue-200 text-blue-600"
                                  : isOwn ? "bg-white/10 border-white/20 text-blue-100" : "bg-gray-50 border-gray-100 text-gray-400"
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="font-black">{users.length}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      <div className={`flex items-center justify-end gap-1 mt-1 ${isOwn ? "text-blue-100/70" : "text-gray-400"} font-black`}>
                        <span className="text-[9px]">
                          {msg.createdAt?.toDate?.() ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "..."}
                        </span>
                        {isOwn && (
                           <span className={`material-icons text-[12px] ${msg.seen ? "text-blue-200" : "text-blue-300/50"}`}>
                            {msg.seen ? "done_all" : "done"}
                          </span>
                        )}
                      </div>

                      {/* Thread Indicator */}
                      {!activeThreadId && replies.length > 0 && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveThreadId(msg.id);
                          }}
                          className={`text-[10px] font-black uppercase tracking-widest mt-2 block hover:underline ${isOwn ? "text-blue-100" : "text-blue-500"}`}
                        >
                          {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      {!isOwn && (
                        <button 
                          onClick={() => setReplyingTo(msg)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-gray-300 hover:text-blue-500 transition-all active:scale-90"
                          title="Reply"
                        >
                          <span className="material-icons text-sm">reply</span>
                        </button>
                      )}
                      
                      {/* Reaction Trigger */}
                      <div className="relative">
                        <button 
                          onClick={() => setActiveReactionPicker(activeReactionPicker === msg.id ? null : msg.id)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-gray-300 hover:text-yellow-500 transition-all active:scale-90"
                          title="React"
                        >
                          <span className="material-icons text-sm">add_reaction</span>
                        </button>

                        {activeReactionPicker === msg.id && (
                          <motion.div 
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className={`absolute bottom-full mb-2 bg-white rounded-full shadow-2xl border border-gray-100 p-1.5 flex gap-1 z-50 ${isOwn ? "right-0" : "left-0"}`}
                          >
                            {['👍', '❤️', '😂', '😮', '😢', '🔥'].map(emoji => (
                              <button
                                key={emoji}
                                onClick={() => toggleReaction(msg.id, emoji)}
                                className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 rounded-full transition-colors text-lg"
                              >
                                {emoji}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </div>
                      </div>
                    </div>
                  </div>
                 </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        
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
        <form className="flex flex-col gap-2 relative" onSubmit={handleSend}>
          {/* Reply Preview */}
          {replyingTo && (
            <div className="flex items-center justify-between p-3 bg-blue-50 border-l-4 border-blue-500 rounded-xl mb-1 animate-in slide-in-from-bottom-2">
              <div className="flex-1 min-w-0 pr-4">
                 <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{replyingTo.senderName}</div>
                 <div className="text-xs text-gray-600 truncate">{replyingTo.message}</div>
              </div>
              <button 
                type="button" 
                onClick={() => setReplyingTo(null)}
                className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-gray-400 hover:text-red-500 shadow-sm transition-all"
              >
                <span className="material-icons text-sm">close</span>
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            <div className="flex items-center gap-1 mb-1">
              <label className="cursor-pointer w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors text-gray-400">
                <span className="material-icons text-xl">attach_file</span>
                <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
              <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors text-gray-400">
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
          </div>
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