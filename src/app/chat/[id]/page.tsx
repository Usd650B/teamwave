"use client";

import React, { useEffect, useState, useRef } from "react";
import { db, storage } from "@/lib/firebase/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc } from "firebase/firestore";
import { auth } from "@/lib/firebase/firebase";
import { useParams } from "next/navigation";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useTheme } from "@/contexts/ThemeContext";

export default function ChatPage() {
  const { theme, toggleTheme } = useTheme();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { chatId } = useParams();

  // Monitor authentication state
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      console.log("Auth state changed:", user);
      setCurrentUser(user);
    });
    
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!chatId) return;

    const messagesQuery = query(
      collection(db, "conversations", chatId as string, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(messagesData);
    });

    const typingRef = doc(db, "conversations", chatId as string, "typing");
    const unsubscribeTyping = onSnapshot(typingRef, (doc) => {
      if (doc.exists()) {
        const typingData = doc.data();
        const currentUserId = auth.currentUser?.uid;
        const users = Object.keys(typingData).filter(userId => 
          typingData[userId] === true && userId !== currentUserId
        );
        setTypingUsers(users);
      }
    });

    return () => {
      unsubscribeMessages();
      unsubscribeTyping();
    };
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showEmoji) {
        const emojiPicker = document.querySelector('.emoji-picker-container');
        const emojiButton = document.querySelector('.emoji-button');
        
        if (emojiPicker && !emojiPicker.contains(event.target as Node) && 
            emojiButton && !emojiButton.contains(event.target as Node)) {
          setShowEmoji(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmoji]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !file) return;

    const user = currentUser;
    if (!user || !chatId) {
      console.error("No user or chatId", { user, chatId });
      alert("Please log in and try again.");
      return;
    }

    console.log("=== SENDING MESSAGE ===");
    console.log("User:", user.uid);
    console.log("Chat ID:", chatId);
    console.log("Message:", input);
    console.log("File:", file?.name);

    try {
      let fileUrl = "";
      let fileName = "";
      let fileType = "";
      let fileSize = 0;

      if (file) {
        console.log("Uploading file:", file.name, file.size, file.type);
        const storageRef = ref(storage, `uploads/${chatId}/${Date.now()}_${file.name}`);
        
        try {
          await uploadBytes(storageRef, file);
          console.log("File uploaded successfully");
          fileUrl = await getDownloadURL(storageRef);
          console.log("File URL obtained:", fileUrl);
          fileName = file.name;
          fileType = file.type;
          fileSize = file.size;
        } catch (uploadError) {
          console.error("File upload error:", uploadError);
          alert("Failed to upload file. Please try again.");
          return;
        }
      }

      const messageData = {
        senderId: user.uid,
        message: input,
        fileUrl,
        fileName,
        fileType,
        fileSize,
        createdAt: serverTimestamp(),
        seen: false
      };

      console.log("Message data:", messageData);
      console.log("Collection path:", `conversations/${chatId}/messages`);
      
      const docRef = await addDoc(collection(db, "conversations", chatId as string, "messages"), messageData);
      console.log("Message sent successfully with ID:", docRef.id);

      setInput("");
      setFile(null);
      setShowEmoji(false);
      
      console.log("=== MESSAGE SENT SUCCESSFULLY ===");
    } catch (error) {
      console.error("=== ERROR SENDING MESSAGE ===");
      console.error("Error details:", error);
      
      const firebaseError = error as any;
      console.error("Error code:", firebaseError.code);
      console.error("Error message:", firebaseError.message);
      
      if (firebaseError.code === 'permission-denied') {
        alert("Permission denied. Please check Firebase security rules.");
      } else if (firebaseError.code === 'not-found') {
        alert("Chat not found. Please try starting a new conversation.");
      } else {
        alert("Failed to send message: " + (firebaseError.message || "Unknown error"));
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
    
    const user = auth.currentUser;
    if (!user || !chatId) return;

    // Set typing status
    setIsTyping(true);
    const typingRef = doc(db, "conversations", chatId as string, "typing");
    setDoc(typingRef, {
      [user.uid]: true
    }, { merge: true });

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to clear typing status
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      setDoc(doc(db, `conversations/${chatId}/typing`), {
        [user.uid]: false
      }, { merge: true });
    }, 1000);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType.startsWith('video/')) return '🎥';
    if (fileType.startsWith('audio/')) return '🎵';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊';
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📽️';
    if (fileType.includes('zip') || fileType.includes('rar')) return '📦';
    return '📎';
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F5F5]">
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#E5E7EB]">
        <div className="flex items-center flex-1 gap-2">
          <button 
            onClick={() => window.history.back()} 
            className="mr-3 text-[#2563EB] hover:underline"
          >
            ← Back
          </button>
          <img src="/logo.svg" alt="TeamWave" className="w-6 h-6" />
          <h1 className="text-xl font-bold text-[#2563EB]">Chat</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={toggleTheme} className="text-2xl">
            {theme === "light" ? "🌙" : "☀️"}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col px-4 py-4 overflow-auto">
        {messages.map((msg, idx) => {
          const isOwnMessage = msg.senderId === auth.currentUser?.uid;
          
          return (
            <div
              key={idx}
              className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} mb-2`}
            >
              <div
                className={`rounded-lg px-4 py-2 text-sm max-w-xs ${isOwnMessage ? "bg-[#2563EB] text-white" : "bg-[#F5F5F5] text-black border border-[#E5E7EB]"}`}
              >
                {msg.fileUrl && msg.fileType.startsWith("image") ? (
                  <div className="mb-2">
                    <img 
                      src={msg.fileUrl} 
                      alt="sent" 
                      className="max-w-xs mb-2 rounded"
                    />
                    <div className="text-xs text-gray-600">
                      🖼️ {msg.fileName || "image"} • {msg.fileSize ? formatFileSize(msg.fileSize) : "Unknown size"}
                    </div>
                  </div>
                ) : msg.fileUrl ? (
                  <div className="mb-2 p-3 bg-gray-100 rounded">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getFileIcon(msg.fileType)}</span>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{msg.fileName || "file"}</div>
                        <div className="text-xs text-gray-600">
                          {msg.fileSize ? formatFileSize(msg.fileSize) : "Unknown size"}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
                
                <div className="mb-1">{msg.message}</div>
                <div className="text-xs opacity-70">
                  {msg.createdAt?.toDate?.() ? new Date(msg.createdAt.toDate()).toLocaleTimeString() : ""}
                </div>
              </div>
            </div>
          );
        })}
        
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 mb-2">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <span className="text-xs text-gray-500 ml-2">
              {typingUsers.length === 1 ? "Someone is typing..." : "People are typing..."}
            </span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </main>

      <form className="flex items-center px-4 py-3 bg-white border-t border-[#E5E7EB]" onSubmit={handleSend}>
        <div className="relative">
          <button 
            type="button" 
            className="mr-2 text-2xl hover:opacity-70 transition-opacity emoji-button" 
            onClick={() => setShowEmoji(!showEmoji)}
            title="Add emoji"
          >
            😊
          </button>
          
          {/* Emoji Picker */}
          {showEmoji && (
            <div className="absolute bottom-12 left-0 bg-white border border-gray-300 rounded-lg shadow-lg p-2 z-10 emoji-picker-container">
              <div className="grid grid-cols-8 gap-1">
                {['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', 
                 '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑',
                 '😶', '😏', '😒', '🙄', '😬', '🤥', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧',
                 '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯',
                 '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫',
                 '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾',
                 '🤖', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘',
                 '💝', '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚',
                 '🖐️', '🖖', '👋', '🤙', '💪', '🙏', '✍️', '🌟', '⭐', '💫', '✨', '⚡', '🔥', '💥', '💢', '💨',
                 '🦋', '🌈', '☀️', '🌙', '⭐', '🌟'].map((emoji, index) => (
                  <button
                    key={index}
                    type="button"
                    className="text-lg hover:bg-gray-100 rounded p-1 transition-colors"
                    onClick={() => {
                      const newInput = input + emoji;
                      setInput(newInput);
                      setShowEmoji(false);
                      console.log("Added emoji:", emoji, "New input:", newInput);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <input
          type="text"
          className="flex-1 p-2 rounded border border-[#E5E7EB]"
          placeholder="Type a message..."
          value={input}
          onChange={handleInputChange}
        />
        <input
          type="file"
          className="ml-2"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar"
        />
        <button 
          type="submit" 
          className="ml-2 px-4 py-2 rounded bg-[#2563EB] text-white font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!input.trim() && !file}
        >
          Send
        </button>
      </form>
    </div>
  );
}