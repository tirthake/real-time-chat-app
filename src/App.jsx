import React, { useState, useEffect, useRef } from 'react';
// STANDARD IMPORTS (Correct for Vite)
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, serverTimestamp, setLogLevel } from 'firebase/firestore';
import { Send, LogOut, Loader, User, Zap, MessageCircle } from 'lucide-react';

// --- CONFIGURATION START ---
// THESE ARE YOUR REAL KEYS FROM THE SCREENSHOT
const firebaseConfig = {
  apiKey: "AIzaSyAJ7og8KerHxJ3RLW2NIL9Tt5cCY9VSGIg",
  authDomain: "real-time-chat-r174vhc55.firebaseapp.com",
  projectId: "real-time-chat-r174vhc55",
  storageBucket: "real-time-chat-r174vhc55.appspot.com",
  messagingSenderId: "516075270422",
  appId: "1:516075270422:web:d7a89c722e6e227f1c6037",
  measurementId: "G-N917LBK9R4"
};
// ---------------------------

const appId = "my-chat-app"; 

// Initialize Firebase
let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.error("Firebase init error:", e);
}

const App = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // 1. Authentication
  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setIsLoading(false);
      } else {
        signInAnonymously(auth).catch((error) => {
          console.error("Auth failed:", error);
          setIsLoading(false);
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Fetching
  useEffect(() => {
    if (!db || !user) return;

    // Correct Path: 5 segments
    const messagesCol = collection(db, 'artifacts', appId, 'public', 'data', 'messages');
    const q = query(messagesCol);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date()
      }));
      // Sort by time
      fetched.sort((a, b) => a.createdAt - b.createdAt);
      setMessages(fetched);
    }, (err) => {
      console.error("Fetch error:", err);
    });

    return () => unsubscribe();
  }, [user]);

  // 3. Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 4. Send Message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !db || !user) return;

    try {
      // FIX: Ensure this path matches the listener path EXACTLY (5 segments)
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), {
        text: newMessage.trim(),
        createdAt: serverTimestamp(),
        userId: user.uid,
        userName: `User-${user.uid.substring(0, 5)}`
      });
      setNewMessage('');
    } catch (error) {
      console.error("Send error:", error);
    }
  };

  // 5. Sign Out
  const handleSignOut = () => {
    if (auth) auth.signOut();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader className="animate-spin h-8 w-8 text-indigo-600" />
        <span className="ml-2">Connecting...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-indigo-600 text-white p-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-6 h-6" />
          <h1 className="font-bold text-lg">Public Real-Time Chat</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm bg-indigo-700 px-3 py-1 rounded-full flex items-center gap-2">
            <User className="w-4 h-4" />
            {user ? user.uid.substring(0, 6) : 'Guest'}
          </div>
          <button onClick={handleSignOut} className="p-2 hover:bg-indigo-500 rounded-full">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <Zap className="w-12 h-12 mb-2" />
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.userId === user?.uid;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs md:max-w-md p-3 rounded-lg shadow-sm ${
                  isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-tl-none'
                }`}>
                  <div className={`text-xs mb-1 ${isMe ? 'text-indigo-200' : 'text-gray-500'}`}>
                    {isMe ? 'You' : msg.userName}
                  </div>
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
          <button 
            type="submit" 
            disabled={!newMessage.trim()}
            className="bg-indigo-600 text-white p-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default App;