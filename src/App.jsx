import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Users, Circle, Smile, MessageSquare, Globe, X, Trash2, Zap, Settings, StickyNote, Clock } from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app/compat'; // Note the /compat added here
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth/compat'; // Note the /compat added here
import { getFirestore, collection, addDoc, onSnapshot, query, serverTimestamp } from 'firebase/firestore';

export default function App() {
  // --- FIREBASE STATE ---
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  // --- CHAT STATE ---
  const [messages, setMessages] = useState({}); // { 'global': [...], 'User-XXXXX': [...] }
  const [inputMessage, setInputMessage] = useState('');
  const [userId, setUserId] = useState('Signing in...');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isConnected, setIsConnected] = useState(true); // Now reflects Firebase connection status
  const [activeChat, setActiveChat] = useState('global');
  const [showUserList, setShowUserList] = useState(true);
  
  // --- UI/MODAL STATE ---
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false); // Still client-side simulation for private chat
  const [isEphemeralMode, setIsEphemeralMode] = useState(false); 
  const [userStatus, setUserStatus] = useState('Ready to chat...'); 
  const [showStatusInput, setShowStatusInput] = useState(false);
  const [statusInput, setStatusInput] = useState('Ready to chat...');
  
  // --- PUBLIC NOTE STATE (Firestore Backed) ---
  // Use the existing Firestore `db` instance instead of re-initializing the app here.
  const PUBLIC_NOTE_DOC_PATH = (appId, db) => doc(db, `artifacts/${appId}/public/data/note`, 'current');
  const [publicNote, setPublicNote] = useState(null); 
  const [publicNoteInput, setPublicNoteInput] = useState('');
  const [showPublicNoteInput, setShowPublicNoteInput] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState('');

  const messagesEndRef = useRef(null);
  const DECAY_TIME_MS = 10000; 
  const SIMULATED_LIFETIME_MS = 5 * 60 * 1000; // Simulated 5 minutes for demo
  //----------------------------------------------------------------------------
  // Replace global variable usage with hardcoded local testing config
  const appId = 'my-chat-app-1'; // Use any unique string for local testing
  const firebaseConfig = {
    apiKey: "AIzaSyAJ7og8KerHxJ3RLW2NIL9Tt5cCY9VSGIg",
    authDomain: "fisfis-7a444.firebaseapp.com",
    projectId: "fisfis-7a444",
    storageBucket: "fisfis-7a444.firebasestorage.app",
    messagingSenderId: "516075270422",
    appId: ":516075270422:web:d7a89c722e6e227f1c6037"
  };
//-----------------------------------------------------------------------------
  const emojis = [
    '😀', '😂', '😍', '🥰', '😎', '🤔', '😭', '😡',
    '👍', '👎', '👏', '🙌', '💪', '🤝', '❤️', '💔',
    '🔥', '⭐', '✨', '🎉', '🎊', '🎈', '💯', '✅',
    '❌', '🚀', '💡', '⚡', '🌟', '🎯', '💬', '📢'
  ];

  // Utility to format time
  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };
  
  // Utility to format remaining time for display
  const formatRemainingTime = (expiresAt) => {
    const totalSeconds = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    if (totalSeconds === 0) return 'Expired';
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    let parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    
    return parts.join(' ');
  };
  
  // Utility for user avatar color
  const getUserColor = (uid) => {
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
      'bg-pink-500', 'bg-indigo-500', 'bg-orange-500', 'bg-teal-500',
      'bg-cyan-500', 'bg-rose-500', 'bg-violet-500', 'bg-lime-500'
    ];
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
      hash = uid.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Utility for user avatar initial
  const getUserAvatarInitial = (uid) => {
    return uid.length > 5 ? uid[5] : uid[0];
  };

  // --- STEP 1: INITIALIZATION AND AUTHENTICATION ---
  useEffect(() => {
    try {
      if (Object.keys(firebaseConfig).length === 0) {
        throw new Error("Firebase configuration is missing.");
      }
      
      const app = initializeApp(firebaseConfig);
      const newAuth = getAuth(app);
      const newDb = getFirestore(app);
      setAuth(newAuth);
      setDb(newDb);
//----------------------------------------------------
      // Sign in or listen for changes
      const unsubscribeAuth = onAuthStateChanged(newAuth, async (user) => {
        if (!user) {
          try {
            // Replaced custom token sign-in with simple anonymous sign-in for local testing
            await signInAnonymously(newAuth);
          } catch (error) {
            console.error("Firebase Sign-In Error:", error);
            setUserId(`Anon-Fail-${crypto.randomUUID().substring(0, 4)}`);
          }
        }//------------------------------
        // User is now authenticated (or anonymous)
        setUserId(newAuth.currentUser?.uid || 'N/A');
        setIsAuthReady(true);
        setIsConnected(true);
        
        // Initial system message logic moved here after auth is ready
        setMessages(prev => ({
            ...prev,
            global: [{
                id: Date.now(),
                type: 'system',
                text: `Welcome! Your ID: ${newAuth.currentUser?.uid || 'N/A'}`,
                timestamp: new Date()
            }]
        }));
      });
      
      return () => unsubscribeAuth();
    } catch (error) {
      console.error("Firebase Initialization Error:", error.message);
      setIsConnected(false);
      setIsAuthReady(true);
      setUserId(`Error-${crypto.randomUUID().substring(0, 4)}`);
    }
  }, []);

  // --- STEP 2: GLOBAL MESSAGES LISTENER ---
  useEffect(() => {
    if (!isAuthReady || !db || !userId) return;

    // Public messages collection path
    const messagesCollectionRef = collection(db, `artifacts/${appId}/public/data/messages`);
    
    // Query: Order by timestamp, limit to latest 50 for performance
    const q = query(messagesCollectionRef, orderBy('timestamp', 'desc'), limit(50));

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          text: data.text,
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(),
          type: 'message',
          isOwn: data.userId === userId,
          decayAt: data.decayAt || null, // Will be null for global
        };
      }).reverse(); // Reverse to show latest at bottom

      setMessages(prev => ({
        ...prev,
        global: newMessages,
      }));
    }, (error) => {
      console.error("Error listening to global messages:", error);
      setIsConnected(false);
    });

    return () => unsubscribeMessages();
  }, [isAuthReady, db, userId, appId]);


  // --- STEP 3: PUBLIC NOTE LISTENER ---
  useEffect(() => {
    if (!isAuthReady || !db || !userId) return;
    
  const noteDocRef = PUBLIC_NOTE_DOC_PATH(appId, db);

    const unsubscribeNote = onSnapshot(noteDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const expiresAt = data.expiresAt || 0;
            
            if (expiresAt > Date.now()) {
                setPublicNote({
                    id: docSnap.id,
                    text: data.text,
                    userId: data.userId,
                    expiresAt: expiresAt,
                    duration: data.duration,
                });
            } else {
                // If expired, attempt to delete (optional cleanup)
                deleteDoc(noteDocRef).catch(e => console.log("Note already deleted or access denied."));
                setPublicNote(null);
            }
        } else {
            setPublicNote(null);
        }
    }, (error) => {
        console.error("Error listening to public note:", error);
    });

    return () => unsubscribeNote();
  }, [isAuthReady, db, userId, appId]);

  // Public Note Decay Timer UI
  useEffect(() => {
    if (!publicNote) {
        setTimeRemaining('');
        return;
    }
    
    const countdownInterval = setInterval(() => {
        const remainingTime = publicNote.expiresAt - Date.now();
        
        if (remainingTime <= 0) {
            clearInterval(countdownInterval);
            setPublicNote(null);
        } else {
            setTimeRemaining(formatRemainingTime(publicNote.expiresAt));
        }
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [publicNote]);
  
  // --- STEP 4: SEND MESSAGE FUNCTION ---
  const sendMessage = async () => {
    if (!inputMessage.trim() || !isAuthReady || !db) return;

    const messagePayload = {
      userId: userId,
      text: inputMessage,
      timestamp: serverTimestamp(),
    };

    try {
      if (activeChat === 'global') {
        // Post to the public global collection
        const messagesCollectionRef = collection(db, `artifacts/${appId}/public/data/messages`);
        await addDoc(messagesCollectionRef, messagePayload);
      } else {
        // Private chat (client-side simulation, no real database persistence for DMs here)
        // This simulates sending a message while we focus on the global chat database features.
        const newMessage = {
            id: Date.now(),
            userId: userId,
            text: inputMessage,
            timestamp: new Date(),
            type: 'message',
            isOwn: true,
            decayAt: (isEphemeralMode) ? Date.now() + DECAY_TIME_MS : null
        };
        setMessages(prev => ({
            ...prev,
            [activeChat]: [
              ...(prev[activeChat] || []),
              newMessage
            ]
        }));
        // Simulate bot response for DMs
        simulatePrivateResponse(inputMessage);
      }
      setInputMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const simulatePrivateResponse = (messageToSend) => {
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);

      const responses = [
        'That\'s a good point! Tell me more about it.',
        `Interesting thought on "${messageToSend.substring(0, 15)}..."`,
        'I totally agree with you on that one. 😊',
        'Got it! What are you working on right now?',
        'Thanks for sharing that!',
        'Hmm, I hadn\'t considered that perspective before. 🤔'
      ];
      
      const responseMessage = {
        id: Date.now() + 1,
        userId: activeChat,
        text: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date(),
        type: 'message',
        isOwn: false,
        decayAt: (isEphemeralMode) ? Date.now() + DECAY_TIME_MS : null
      };

      setMessages(prev => ({
        ...prev,
        [activeChat]: [
          ...(prev[activeChat] || []),
          responseMessage
        ]
      }));
    }, 2500);
  };
  
  // --- STEP 5: PUBLIC NOTE SUBMISSION ---
  const handleSubmitPublicNote = async () => {
      if (!publicNoteInput.trim() || !isAuthReady || !db) return;

      const expiresAt = Date.now() + SIMULATED_LIFETIME_MS;
      
      const newNote = {
          text: publicNoteInput.trim(),
          userId: userId,
          expiresAt: expiresAt,
          duration: SIMULATED_LIFETIME_MS,
          timestamp: serverTimestamp()
      };

      try {
  const noteDocRef = PUBLIC_NOTE_DOC_PATH(appId, db);
        // Use setDoc to create/overwrite the single 'current' document
        await setDoc(noteDocRef, newNote);
        
        // Add a system message to global chat, stored in Firestore
        await addDoc(collection(db, `artifacts/${appId}/public/data/messages`), {
            userId: 'System',
            text: `A new public note has been posted by ${userId}. (Expires in ~5 minutes for demo).`,
            timestamp: serverTimestamp(),
            type: 'system' // Not strictly needed in Firestore, but helps with clarity
        });

        setPublicNoteInput('');
        setShowPublicNoteInput(false);
      } catch (error) {
          console.error("Error posting public note:", error);
      }
  };


  // --- STEP 6: SIMULATED ONLINE USERS (Still simulated for now) ---
  useEffect(() => {
    // This part remains simulated, as tracking *truly* active users requires more complex logic 
    // (e.g., presence systems, which is beyond a single-file React component scope).
    const generateUsers = () => {
      const count = Math.floor(Math.random() * 10) + 3;
      const statuses = ['Looking for deep talk', 'Just chilling', 'Seeking advice', 'Gaming', 'Lurking', 'Away'];
      const users = [];
      for (let i = 0; i < count; i++) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let id = 'User-';
        for (let j = 0; j < 6; j++) { id += chars.charAt(Math.floor(Math.random() * chars.length)); }
        users.push({
          id: id,
          status: statuses[Math.floor(Math.random() * statuses.length)],
        });
      }
      setOnlineUsers(users.filter(u => u.id !== userId));
    };
    
    // Simulate user list updates every 30 seconds
    generateUsers();
    const userInterval = setInterval(generateUsers, 30000);

    return () => clearInterval(userInterval);
  }, [userId]);


  // --- REMAINING UTILITY/UI FUNCTIONS ---
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const addEmoji = (emoji) => {
    setInputMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const startPrivateChat = (user) => {
    setActiveChat(user.id);
    if (!messages[user.id]) {
      setMessages(prev => ({
        ...prev,
        [user.id]: [{
          id: Date.now(),
          type: 'system',
          text: `Private chat established with ${user.id}`,
          timestamp: new Date()
        }]
      }));
    }
    if (window.innerWidth < 1024) {
      setShowUserList(false);
    }
  };

  const getUnreadCount = (chatId) => {
    if (chatId === activeChat) return 0;
    const chatMessages = messages[chatId] || [];
    return chatMessages.filter(m => !m.isOwn && m.type === 'message').length;
  };

  const handleClearChat = () => {
    if (activeChat === 'global') return;
    
    const systemMessage = {
      id: Date.now(),
      type: 'system',
      text: `Chat history with ${activeChat} has been cleared.`,
      timestamp: new Date()
    };

    setMessages(prev => ({
      ...prev,
      [activeChat]: [systemMessage]
    }));
  };
  
  useEffect(() => {
      setStatusInput(userStatus);
  }, [userStatus, showStatusInput]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChat]);
  
  // Ephemeral mode logic remains client-side for DMs
  useEffect(() => {
    if (activeChat === 'global' || !isEphemeralMode) return;

    const timer = setInterval(() => {
      const now = Date.now();
      
      setMessages(prev => {
        const currentChat = prev[activeChat] || [];
        const filteredMessages = currentChat.filter(msg => 
          msg.type === 'system' || !msg.decayAt || msg.decayAt > now
        );

        if (filteredMessages.length === currentChat.length) {
          return prev;
        }

        return {
          ...prev,
          [activeChat]: filteredMessages
        };
      });
    }, 1000); 

    return () => clearInterval(timer);
  }, [activeChat, isEphemeralMode]);
  
  
  const currentMessages = messages[activeChat] || [];
  const activeChatName = activeChat === 'global' ? 'Global Chat' : activeChat;
  const activeChatUser = onlineUsers.find(u => u.id === activeChat);

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 font-sans">
        
      {/* Public Note Input Modal */}
      {showPublicNoteInput && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
              <div className="bg-slate-800 p-6 rounded-xl w-full max-w-lg border border-yellow-500/50 shadow-2xl">
                  <h3 className="text-xl font-bold text-yellow-300 mb-4 flex items-center gap-2">
                    <StickyNote className="w-6 h-6" /> Post Public Note
                  </h3>
                  <p className="text-sm text-purple-200 mb-3">This note will be visible to all online users and saved to Firestore. (Simulated 5 minute expiry for demo).</p>
                  
                  {publicNote && (
                      <div className="bg-yellow-500/10 text-yellow-300 p-2 rounded-lg text-sm mb-3 border border-yellow-500/30">
                          Note: A note is already active, posted by {publicNote.userId}. Posting a new one will replace it.
                      </div>
                  )}

                  <textarea
                      rows={4}
                      maxLength={200}
                      value={publicNoteInput}
                      onChange={(e) => setPublicNoteInput(e.target.value)}
                      placeholder="Enter your public announcement (Max 200 characters)"
                      className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-purple-500/30 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                  />
                  <div className="text-xs text-purple-400 text-right mt-1">{publicNoteInput.length}/200</div>
                  
                  <div className="flex justify-end gap-3 mt-4">
                      <button
                          onClick={() => {
                              setPublicNoteInput('');
                              setShowPublicNoteInput(false);
                          }}
                          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                      >
                          Cancel
                      </button>
                      <button
                          onClick={handleSubmitPublicNote}
                          disabled={!publicNoteInput.trim()}
                          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                      >
                          Post Note
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Sidebar - User List */}
      <div className={`
          ${showUserList ? 'w-full' : 'w-0'}
          fixed h-full
          lg:w-80 lg:relative
          z-10 bg-black/50 backdrop-blur-md border-r border-purple-500/20 
          transition-all duration-300 overflow-hidden
      `}>
        <div className="p-4 border-b border-purple-500/20 flex flex-col h-full">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-purple-600 p-2 rounded-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-white font-bold">WhisperNet</h2>
              <p className="text-xs text-purple-300">{onlineUsers.length + 1} online</p>
            </div>
            {/* Mobile close button */}
            <button
                onClick={() => setShowUserList(false)}
                className="lg:hidden text-purple-300 hover:text-white"
              >
                <X className="w-6 h-6" />
            </button>
          </div>
          
          {/* Your ID and Status */}
          <div className="mb-4 bg-black/30 p-2 rounded-lg border border-purple-500/10">
             <div className="text-xs text-purple-300 flex items-center justify-between">
               <span className="font-semibold text-white">Your ID:</span> 
               <span className="truncate max-w-[70%]">{userId}</span>
             </div>
             <div className="flex items-center justify-between mt-1">
                <p className="text-sm text-purple-200 truncate">{userStatus}</p>
                <button 
                    onClick={() => setShowStatusInput(true)} 
                    title="Set Status"
                    className="p-1 rounded-full hover:bg-purple-700/50 text-purple-300 transition-colors"
                >
                    <Settings className="w-4 h-4" />
                </button>
             </div>
          </div>
          
          {/* Status Input Modal (Responsive to max-w-sm) */}
          {showStatusInput && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-40">
                  <div className="bg-slate-800 p-6 rounded-xl w-full max-w-sm border border-purple-500/50 shadow-2xl">
                      <h3 className="text-lg font-bold text-white mb-4">Set Anonymous Status</h3>
                      <input
                          type="text"
                          maxLength={30}
                          value={statusInput} // Controlled input
                          onChange={(e) => setStatusInput(e.target.value)}
                          placeholder="Max 30 characters"
                          className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-purple-500/30 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                      <button
                          onClick={() => {
                              setUserStatus(statusInput || 'Ready to chat...');
                              setShowStatusInput(false);
                          }}
                          className="mt-4 w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg transition-colors"
                      >
                          Save
                      </button>
                  </div>
              </div>
          )}

          <div className="overflow-y-auto flex-1">
            {/* Global Chat */}
            <button
              onClick={() => setActiveChat('global')}
              className={`w-full p-4 flex items-center gap-3 hover:bg-purple-500/10 transition-colors border-b border-purple-500/10 ${
                activeChat === 'global' ? 'bg-purple-500/20' : ''
              }`}
            >
              <div className="bg-purple-600 p-2 rounded-full">
                <Globe className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-white font-medium">Global Chat</div>
                <div className="text-xs text-purple-300">Public room (Real-time via Firestore)</div>
              </div>
              {getUnreadCount('global') > 0 && (
                <div className="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {getUnreadCount('global')}
                </div>
              )}
            </button>

            {/* Online Users */}
            <div className="p-3 text-xs text-purple-400 font-semibold uppercase tracking-wider">Online Users (Simulated)</div>
            {onlineUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => startPrivateChat(user)}
                className={`w-full p-4 flex flex-col items-start gap-1 hover:bg-purple-500/10 transition-colors border-b border-purple-500/10 ${
                  activeChat === user.id ? 'bg-purple-500/20' : ''
                }`}
              >
                <div className="flex items-center gap-3 w-full">
                    {/* Unique Avatar */}
                    <div className={`w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full text-white font-bold text-sm relative ${getUserColor(user.id)}`}>
                        {getUserAvatarInitial(user.id)}
                        <Circle className="w-3 h-3 fill-green-500 text-green-500 absolute -bottom-0.5 -right-0.5 bg-slate-900 rounded-full" />
                    </div>

                    <div className="flex-1 text-left overflow-hidden">
                      <div className="text-white font-medium text-sm">{user.id}</div>
                      <div className="text-xs text-green-400">Online</div>
                    </div>
                    {getUnreadCount(user.id) > 0 && (
                      <div className="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex-shrink-0 flex items-center justify-center">
                        {getUnreadCount(user.id)}
                      </div>
                    )}
                </div>
                <div className="text-xs text-purple-400 italic mt-1 pl-12 truncate max-w-full">
                    {user.status || 'Ready to chat...'}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-black/30 backdrop-blur-sm border-b border-purple-500/20 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile button to open user list */}
              <button
                onClick={() => setShowUserList(!showUserList)}
                className="lg:hidden bg-purple-600 p-2 rounded-lg"
              >
                {showUserList ? <X className="w-5 h-5 text-white" /> : <Users className="w-5 h-5 text-white" />}
              </button>
              
              {/* Active Chat Avatar/Icon */}
              {activeChat === 'global' ? (
                <div className="bg-purple-600 p-2 rounded-lg">
                  <Globe className="w-6 h-6 text-white" />
                </div>
              ) : (
                <div className={`w-10 h-10 flex items-center justify-center rounded-lg text-white font-bold text-lg ${getUserColor(activeChat)}`}>
                  {getUserAvatarInitial(activeChat)}
                </div>
              )}
              
              <div>
                <h1 className="text-xl font-bold text-white">{activeChatName}</h1>
                <p className="text-sm text-purple-300">
                  {activeChat === 'global' ? `${onlineUsers.length + 1} members` : activeChatUser?.status || 'Private chat (Client-side only)'}
                </p>
              </div>
            </div>
            
            {/* Controls and Status */}
            <div className="flex items-center gap-3">
                
                {/* Public Note Button */}
                {activeChat === 'global' && (
                    <button
                        onClick={() => setShowPublicNoteInput(true)}
                        title="Post Public Note (Visible for 12 hours)"
                        className="p-2 bg-yellow-600 hover:bg-yellow-700 rounded-full transition-colors border border-yellow-500/50"
                    >
                        <StickyNote className="w-5 h-5 text-white" />
                    </button>
                )}
                
                {activeChat !== 'global' && (
                    <div className="flex items-center gap-2">
                         {/* Ephemeral Toggle */}
                        <button
                            onClick={() => setIsEphemeralMode(!isEphemeralMode)}
                            title={isEphemeralMode ? "Ephemeral Mode ON (10s decay)" : "Ephemeral Mode OFF"}
                            className={`p-2 rounded-full transition-colors border ${isEphemeralMode ? 'bg-red-600 border-red-500/50 hover:bg-red-700' : 'bg-slate-700 border-purple-500/50 hover:bg-slate-600'}`}
                        >
                            <Zap className={`w-5 h-5 ${isEphemeralMode ? 'text-yellow-300' : 'text-purple-300'}`} />
                        </button>
                        
                        {/* Clear History Button */}
                        <button
                            onClick={handleClearChat}
                            title="Clear Chat History (Client-side)"
                            className="p-2 bg-slate-700 hover:bg-red-600 rounded-full transition-colors border border-red-500/50"
                        >
                            <Trash2 className="w-5 h-5 text-white" />
                        </button>
                    </div>
                )}
                {/* Connection Status */}
                <div className="flex items-center gap-2 bg-black/30 px-4 py-2 rounded-full border border-purple-500/30">
                  <Circle className={`w-3 h-3 ${isConnected ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'}`} />
                  <span className="text-white font-medium text-sm">{isConnected ? 'Online' : 'Offline'}</span>
                </div>
            </div>
          </div>
        </div>
        
        {/* Public Note Banner */}
        {publicNote && (
            <div className="bg-yellow-900/40 text-yellow-300 p-3 text-sm border-b border-yellow-500/50 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 font-bold flex-1 min-w-0">
                    <StickyNote className="w-5 h-5 flex-shrink-0" />
                    <span className="truncate">
                        {publicNote.text}
                    </span>
                    <span className="text-yellow-500 font-normal italic text-xs ml-2 flex-shrink-0">
                        — posted by {publicNote.userId}
                    </span>
                </div>
                <div className="flex items-center gap-1 text-yellow-400 flex-shrink-0">
                    <Clock className="w-4 h-4" />
                    <span className="font-semibold">{timeRemaining}</span> remaining
                </div>
            </div>
        )}


        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-900/30">
          <div className="max-w-4xl mx-auto space-y-3">
            {currentMessages.map((msg) => (
              <div key={msg.id}>
                {msg.type === 'system' || msg.userId === 'System' ? (
                  <div className="flex justify-center">
                    <div className="bg-purple-500/20 text-purple-200 px-4 py-2 rounded-full text-sm border border-purple-500/30">
                      {msg.text}
                    </div>
                  </div>
                ) : (
                  <div className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div 
                        className={`max-w-[85%] sm:max-w-md rounded-2xl px-4 py-2 shadow-lg transition-opacity duration-1000 ${
                            msg.isOwn ? 'bg-purple-600' : 'bg-slate-700'
                        } ${msg.decayAt ? 'opacity-90 hover:opacity-100' : 'opacity-100'}`}
                    >
                      <div className="text-xs opacity-70 text-white mb-1">
                        {msg.isOwn ? 'You' : msg.userId}
                        {msg.decayAt && (
                            <Zap className="w-3 h-3 text-yellow-300 inline-block ml-2 mb-0.5" title="Ephemeral Message" />
                        )}
                      </div>
                      <div className="text-white break-words">{msg.text}</div>
                      <div className="text-xs opacity-60 text-white mt-1 text-right">
                        {formatTime(msg.timestamp)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="bg-black/30 backdrop-blur-sm border-t border-purple-500/20 p-4">
          <div className="max-w-4xl mx-auto">
            
            {/* Typing Indicator */}
            {isTyping && activeChat !== 'global' && (
              <div className="text-sm text-purple-300 mb-2 italic flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-400 animate-pulse"></span>
                {activeChat} is typing...
              </div>
            )}

            {/* Emoji Picker */}
            {showEmojiPicker && (
              <div className="mb-3 bg-slate-800 rounded-2xl p-4 border border-purple-500/30 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white font-medium">Emojis</span>
                  <button
                    onClick={() => setShowEmojiPicker(false)}
                    className="text-purple-300 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="grid grid-cols-8 gap-2">
                  {emojis.map((emoji, index) => (
                    <button
                      key={index}
                      onClick={() => addEmoji(emoji)}
                      className="text-2xl hover:bg-purple-600/30 rounded-lg p-2 transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="bg-slate-800 hover:bg-slate-700 text-white p-3 rounded-full transition-colors border border-purple-500/30"
              >
                <Smile className="w-5 h-5" />
              </button>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`Message ${activeChatName}...`}
                className="flex-1 bg-slate-800 text-white px-4 py-3 rounded-full border border-purple-500/30 focus:outline-none focus:border-purple-500 placeholder-slate-400"
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || !isConnected}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white p-3 rounded-full transition-colors shadow-lg"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}