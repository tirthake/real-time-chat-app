import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithCustomToken,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  query,
  onSnapshot,
  orderBy,
  addDoc,
  Timestamp,
  doc,
  deleteDoc,
  setLogLevel,
} from 'firebase/firestore';
import { Send, Trash2, LogOut } from 'lucide-react';

// Environment variables provided by the canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(
  typeof __firebase_config !== 'undefined'
    ? __firebase_config
    : '{}'
);
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : '';


// --- CONFIGURATION START ---
// PASTE YOUR REAL FIREBASE CONFIGURATION HERE
// NOTE: I've included the project-specific values, but you MUST replace the three placeholders (API Key, Sender ID, App ID)
const config = {
  apiKey: "AIzaSyAJ7og8KerHxJ3RLW2NIL9Tt5cCY9VSGIg", // <-- REPLACE THIS WITH YOUR ACTUAL API KEY STRING
  authDomain: "real-time-chat-r174vhc55.firebaseapp.com",
  projectId: "real-time-chat-r174vhc55",
  storageBucket: "real-time-chat-r174vhc55.appspot.com",
  messagingSenderId: "516075270422", // <-- REPLACE THIS
  appId: "1:516075270422:web:d7a89c722e6e227f1c6037" // <-- REPLACE THIS
};

// Use environment variables if they exist, otherwise use the provided configuration
const finalConfig = Object.keys(firebaseConfig).length > 0 ? firebaseConfig : config;

// --- CONFIGURATION END ---


const generateUserColor = (userId) => {
  // Simple deterministic color generation based on user ID hash
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    color += ('00' + value.toString(16)).substr(-2);
  }
  return color;
};

const ChatBubble = ({ message, currentUserId, onDelete }) => {
  const isMine = message.userId === currentUserId;
  const color = generateUserColor(message.userId);

  return (
    <div
      className={`flex mb-4 ${isMine ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-xs lg:max-w-md p-3 rounded-xl shadow-lg relative ${
          isMine
            ? 'bg-blue-600 text-white rounded-br-none'
            : 'bg-white text-gray-800 rounded-tl-none'
        }`}
        style={{
          border: isMine ? 'none' : `2px solid ${color}`,
        }}
      >
        <div className="font-semibold text-xs mb-1 opacity-70">
          {isMine ? 'You' : `User: ${message.userId.substring(0, 8)}...`}
        </div>
        <p className="text-sm break-words whitespace-pre-wrap">{message.text}</p>
        <div className="text-xs mt-1 text-right opacity-50">
          {message.timestamp?.toDate().toLocaleTimeString()}
        </div>
        {isMine && (
          <button
            onClick={() => onDelete(message.id)}
            className="absolute top-0 right-0 p-1 text-white opacity-70 hover:opacity-100 transition duration-150"
            title="Delete Message"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

const App = () => {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef(null);

  // Scroll to the latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Scroll whenever messages are loaded or updated
    scrollToBottom();
  }, [messages]);


  // 1. Initialize Firebase and Handle Authentication
  useEffect(() => {
    if (Object.keys(finalConfig).length === 0) {
      console.error("Firebase config is missing. Please provide the configuration.");
      setIsLoading(false);
      return;
    }

    setLogLevel('debug');
    try {
      const app = initializeApp(finalConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setDb(firestore);
      setAuth(firebaseAuth);

      const handleAuth = async () => {
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(firebaseAuth, initialAuthToken);
          } else {
            await signInAnonymously(firebaseAuth);
          }
        } catch (error) {
          console.error('Firebase Auth Error:', error);
          // If custom token fails, try anonymous sign-in as a fallback
          try {
            await signInAnonymously(firebaseAuth);
          } catch (anonError) {
            console.error('Anonymous sign-in failed:', anonError);
          }
        }
      };
      
      handleAuth();

      // Listen for auth state changes
      const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (user) => {
        if (user) {
          setUserId(user.uid);
          console.log('User signed in with UID:', user.uid);
        } else {
          setUserId(null);
          console.log('User signed out.');
        }
        setIsLoading(false);
      });

      return () => unsubscribeAuth();
    } catch (error) {
      console.error("Failed to initialize Firebase:", error);
      setIsLoading(false);
    }
  }, [initialAuthToken]); // Only run once on mount

  // 2. Fetch and Listen to Messages
  useEffect(() => {
    if (!db || !userId) return; // Wait for Firebase to be initialized and user authenticated

    // Collection path: /artifacts/{appId}/public/data/messages
    const messagesCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'messages');
    
    // Create a query to order messages by timestamp
    const q = query(messagesCollectionRef, orderBy('timestamp', 'asc'));

    // Set up real-time listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // In-memory sort just in case
      messagesData.sort((a, b) => (a.timestamp?.toMillis() || 0) - (b.timestamp?.toMillis() || 0));

      setMessages(messagesData);
      console.log('Messages updated.');
    }, (error) => {
      console.error('Firestore Snapshot Error:', error);
    });

    // Clean up the listener on component unmount
    return () => unsubscribe();
  }, [db, userId, appId]);

  // 3. Send Message Function
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !db || !userId) return;

    try {
      const messagesCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'messages');
      await addDoc(messagesCollectionRef, {
        text: newMessage.trim(),
        timestamp: Timestamp.now(),
        userId: userId,
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // 4. Delete Message Function
  const handleDeleteMessage = async (messageId) => {
    if (!db || !userId) return;

    const messageRef = doc(db, 'artifacts', appId, 'public', 'data', 'messages', messageId);
    
    try {
      await deleteDoc(messageRef);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  // 5. Placeholder Sign Out Function (For demonstration)
  const handleSignOut = () => {
    if (auth) {
      auth.signOut();
      setUserId(null);
      // Note: In a production app, you might want a full redirect or logout flow here
    }
  };


  return (
    <div className="flex flex-col h-screen antialiased bg-gray-100 font-sans p-4 sm:p-6 lg:p-8">
      {/* Header/User Info */}
      <header className="flex justify-between items-center p-3 mb-4 bg-white rounded-xl shadow-md sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-gray-800">Real-Time Chat</h1>
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-gray-600 truncate">
            {isLoading ? 'Connecting...' : (userId ? `User: ${userId}` : 'Signed Out')}
          </span>
          {userId && (
            <button
              onClick={handleSignOut}
              className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition duration-200 shadow-lg"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </header>

      {/* Main Chat Area */}
      <div className="flex-1 overflow-y-auto bg-white p-4 rounded-xl shadow-lg mb-4">
        {isLoading ? (
          <div className="flex justify-center items-center h-full text-gray-500">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading Messages...
          </div>
        ) : !userId ? (
            <div className="flex justify-center items-center h-full text-center text-red-500 font-medium">
                Authentication Failed. Please check your Firebase configuration!
            </div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center items-center h-full text-gray-400">
            Start the conversation! No messages yet.
          </div>
        ) : (
          messages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message}
              currentUserId={userId}
              onDelete={handleDeleteMessage}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSendMessage} className="flex space-x-3 p-3 bg-white rounded-xl shadow-lg">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={userId ? "Type your message here..." : "Connecting to chat service..."}
          className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 shadow-inner disabled:bg-gray-50 disabled:text-gray-400"
          disabled={!userId || isLoading}
        />
        <button
          type="submit"
          className={`p-3 rounded-lg text-white font-semibold flex items-center justify-center transition duration-200 shadow-md ${
            !newMessage.trim() || !userId || isLoading
              ? 'bg-blue-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
          }`}
          disabled={!newMessage.trim() || !userId || isLoading}
        >
          <Send size={20} className="mr-2" />
          Send
        </button>
      </form>
    </div>
  );
};

export default App;