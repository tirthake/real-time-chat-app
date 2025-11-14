import React, { useState, useEffect, useRef } from 'react';
// FIX: Using full CDN imports to resolve "Failed to resolve module specifier" errors on Vercel/browser.
// NOTE: lucide-react imports are removed here to fix "Cannot import a non-module file from a module file"
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, serverTimestamp, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Global Context Variables (Provided by Canvas) ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Directly reference the components globally (they will be available in this environment)
// NOTE: This assumes the lucide-react components are loaded globally by the runtime.
const { Send, LogOut, Loader, User, Zap, MessageCircle } = lucide;

// --- Helper function for Firebase Initialization ---
let app, db, auth;

function initializeFirebase() {
  if (!firebaseConfig) {
    console.error("Firebase configuration is missing.");
    return;
  }
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    setLogLevel('debug');
  } catch (error) {
    console.error("Error initializing Firebase:", error);
  }
}

// --- Main Chat Component ---
const App = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // 1. Firebase Initialization and Authentication
  useEffect(() => {
    // Check for essential config
    if (!firebaseConfig) {
      console.error("Firebase configuration is missing.");
      setIsLoading(false);
      return;
    }
    
    // Initialize Firebase if not already done
    if (!app) {
      initializeFirebase();
    }

    if (!auth) {
        console.error("Firebase Auth not initialized.");
        setIsLoading(false);
        return;
    }
    
    // Authentication State Listener
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // User signed in (via initial token or anonymously)
        setUser(currentUser);
        setIsLoading(false);
      } else {
        // No user, attempt initial sign-in
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
          } else {
            // Fallback to anonymous sign-in if token is unavailable
            await signInAnonymously(auth);
          }
        } catch (error) {
          console.error("Authentication failed:", error);
          setUser(null);
          setIsLoading(false);
        }
      }
    });

    return () => unsubscribeAuth();
  }, []); // Run only once on mount

  // 2. Real-time Data Fetching (Firestore Snapshot)
  useEffect(() => {
    // Wait until Firestore and user are ready
    if (!db || !user) {
      return;
    }

    // Path: /artifacts/{appId}/public/data/messages (5 segments: C/D/C/D/C)
    const messagesCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'messages');
    
    // Create a query without orderBy to avoid index creation issues in the environment
    const q = query(messagesCollectionRef);

    const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
      const fetchedMessages = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetchedMessages.push({
          id: doc.id,
          ...data,
          // Convert Firestore Timestamp to Date object if it exists
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        });
      });

      // Sort in memory to order by timestamp since orderBy() is avoided in the query
      fetchedMessages.sort((a, b) => a.createdAt - b.createdAt);
      setMessages(fetchedMessages);
    }, (error) => {
      console.error("Error fetching messages:", error);
    });

    return () => unsubscribeSnapshot();
  }, [user]); // Re-run when user object changes

  // 3. Scroll to Bottom of Messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 4. Send Message Handler
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !db) return;

    // Correct 5-segment public collection path
    const messagesCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'messages');

    try {
      await addDoc(messagesCollectionRef, {
        text: newMessage.trim(),
        createdAt: serverTimestamp(), 
        userId: user.uid,
        userName: `User-${user.uid.substring(0, 5)}`, 
        appId: appId,
      });
      setNewMessage('');
      inputRef.current?.focus();
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };
  
  // 5. User Sign-Out
  const handleSignOut = () => {
    if (auth) {
      auth.signOut();
      setUser(null);
    }
  };

  // 6. UI Rendering Logic
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader className="animate-spin text-indigo-500 h-8 w-8" />
        <p className="ml-3 text-lg font-medium text-gray-700">Connecting to Firebase...</p>
      </div>
    );
  }

  // --- Main Chat UI ---
  return (
    <div className="flex flex-col h-screen antialiased text-gray-800 bg-gray-100 p-4">
      <div className="flex flex-col flex-grow w-full max-w-4xl mx-auto bg-white rounded-xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-indigo-600 text-white shadow-lg">
          <div className="flex items-center">
            <MessageCircle className="w-6 h-6 mr-2" />
            <h1 className="text-xl font-extrabold tracking-tight">Public Real-Time Chat</h1>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-sm font-medium flex items-center bg-indigo-700 px-3 py-1 rounded-full">
              <User className="w-4 h-4 mr-1"/>
              {user ? `UID: ${user.uid.substring(0, 8)}...` : 'Not Signed In'}
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 rounded-full hover:bg-indigo-700 transition duration-150"
              aria-label="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Area */}
        <div className="flex flex-col flex-grow h-0 p-4 overflow-y-auto space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
              <Zap className="w-10 h-10 mb-3 text-indigo-400" />
              <p className="text-lg font-semibold">Start the conversation!</p>
              <p className="text-sm text-center mt-1">
                Your messages will appear here instantly.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.userId === user?.uid;
              const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex flex-col max-w-xs md:max-w-md ${isUser ? 'items-end' : 'items-start'}`}>
                    <div className={`text-xs mb-1 ${isUser ? 'text-gray-500' : 'text-gray-600'}`}>
                      {isUser ? 'You' : msg.userName}
                    </div>
                    <div className={`relative px-4 py-2 rounded-2xl shadow-md ${
                      isUser 
                        ? 'bg-indigo-500 text-white rounded-br-none' 
                        : 'bg-gray-200 text-gray-800 rounded-tl-none'
                    }`}>
                      <p className="text-sm break-words whitespace-pre-wrap">{msg.text}</p>
                      <span className={`block text-right text-[10px] opacity-70 mt-1 ${isUser ? 'text-indigo-100' : 'text-gray-500'}`}>
                        {time}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <form onSubmit={handleSendMessage} className="flex space-x-3">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 shadow-inner transition duration-150"
              disabled={!user}
            />
            <button
              type="submit"
              className="flex items-center justify-center px-4 py-3 bg-indigo-600 text-white rounded-lg shadow-lg hover:bg-indigo-700 transition duration-150 disabled:opacity-50"
              disabled={!newMessage.trim() || !user}
            >
              <Send className="w-5 h-5 mr-1" />
              Send
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default App;