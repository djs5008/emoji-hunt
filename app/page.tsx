/**
 * Home Page Component
 * 
 * @description Landing page for the emoji hunt game. Provides options to:
 * - Create a new lobby (become host)
 * - Join an existing lobby with a code
 * - Handle URL parameters for direct joins
 * - Display support links (bug reports, donations)
 */

'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import EmojiBackground from './components/EmojiBackground';
// Session management is now handled server-side

/**
 * Main home page content component
 * 
 * @description Handles the game's entry point with lobby creation and joining.
 * Wrapped in Suspense boundary by the parent component.
 */
function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // UI state management
  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home');
  const [nickname, setNickname] = useState('');
  const [lobbyCode, setLobbyCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  
  // Animated drink emoji state for support button
  const [drinkIndex, setDrinkIndex] = useState(0);
  const drinks = ['☕️', '🍺', '🍵', '🥤', '🧋', '🍷', '🥛', '🧃'];
  
  /**
   * Creates a new game lobby
   * 
   * @description Handles lobby creation process:
   * 1. Validates nickname
   * 2. Sends creation request with existing player ID if available
   * 3. Stores player ID and host token
   * 4. Navigates to the new lobby
   */
  const handleCreateLobby = async () => {
    if (!nickname.trim()) {
      setError('Please enter a nickname');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Session management is now handled server-side
      // No need to send player ID - server will create/use session
      
      const res = await fetch('/api/lobby/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nickname: nickname.trim()
        }),
        credentials: 'include',
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        try {
          const errorData = JSON.parse(errorText);
          setError(errorData.error || `Server error: ${res.status}`);
        } catch {
          setError(`Server error: ${res.status} ${res.statusText}`);
        }
        return;
      }
      
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      
      // Store host token for future use
      // Session is managed server-side via cookies
      try {
        sessionStorage.setItem(`host-${data.lobby.id}`, data.hostToken);
      } catch (err) {
        console.warn('Could not store host token:', err);
        // Continue - the lobby was created successfully
      }
      
      // Navigate to lobby
      router.push(`/lobby/${data.lobby.id}`);
    } catch (err) {
      console.error('Error creating lobby:', err);
      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        setError('Network error - please check your connection');
      } else {
        setError('Failed to create lobby. Please try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  };
  
  /**
   * Joins an existing game lobby
   * 
   * @description Handles lobby joining process:
   * 1. Validates nickname and lobby code
   * 2. Sends join request with existing player ID if available
   * 3. Stores/updates player ID
   * 4. Navigates to the joined lobby
   * 
   * Note: Lobby codes are case-insensitive (converted to uppercase)
   */
  const handleJoinLobby = async () => {
    if (!nickname.trim()) {
      setError('Please enter a nickname');
      return;
    }
    
    if (!lobbyCode.trim()) {
      setError('Please enter a lobby code');
      return;
    }
    
    if (lobbyCode.trim().length !== 4) {
      setError('Lobby code must be 4 characters');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Session management is now handled server-side
      // No need to send player ID - server will use session
      
      const res = await fetch('/api/lobby/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nickname: nickname.trim(),
          lobbyId: lobbyCode.trim().toUpperCase()
        }),
        credentials: 'include',
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        try {
          const errorData = JSON.parse(errorText);
          if (res.status === 404) {
            setError('Lobby not found. Please check the code.');
          } else if (res.status === 400 && errorData.error?.includes('already started')) {
            setError('This game has already started.');
          } else {
            setError(errorData.error || `Server error: ${res.status}`);
          }
        } catch {
          setError(`Server error: ${res.status} ${res.statusText}`);
        }
        return;
      }
      
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      
      // Session is managed server-side via cookies
      // No need to store player ID client-side
      
      // Navigate to lobby
      router.push(`/lobby/${data.lobby.id}`);
    } catch (err) {
      console.error('Error joining lobby:', err);
      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        setError('Network error - please check your connection');
      } else {
        setError('Failed to join lobby. Please try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Resets form to initial state
   * 
   * @description Clears all form fields and returns to home view
   */
  const resetForm = () => {
    setMode('home');
    setNickname('');
    setLobbyCode('');
    setError(null);
  };
  
  /**
   * Handles URL parameters for deep linking
   * 
   * @description Processes URL parameters:
   * - ?join=CODE - Pre-fills join form with lobby code
   * - ?error=lobby-not-found - Shows error message
   * 
   * Cleans up URL after processing to prevent stale parameters
   */
  useEffect(() => {
    const joinCode = searchParams.get('join');
    const errorParam = searchParams.get('error');
    
    if (errorParam === 'lobby-not-found') {
      setError('This lobby doesn\'t exist');
    }
    
    if (joinCode) {
      setLobbyCode(joinCode.toUpperCase());
      setMode('join');
    }
    
    // Clean up URL parameters after processing
    if (joinCode || errorParam) {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [searchParams]);
  
  /**
   * Auto-scrolls to form when entering create/join mode
   * 
   * @description Ensures form is visible on mobile devices by scrolling
   * to center it in the viewport. Small delay ensures DOM is ready.
   */
  useEffect(() => {
    if (mode !== 'home' && formRef.current) {
      // Small delay to ensure the form is rendered
      setTimeout(() => {
        formRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'center'
        });
      }, 100);
    }
  }, [mode]);
  
  /**
   * Animates drink emoji in support button
   * 
   * @description Cycles through different drink emojis every 2 seconds
   * for visual interest in the "Buy me a drink" button
   */
  useEffect(() => {
    const interval = setInterval(() => {
      setDrinkIndex((prev) => (prev + 1) % drinks.length);
    }, 2000);
    
    return () => clearInterval(interval);
  }, [drinks.length]);
  
  /**
   * Handles Enter key press in forms
   * 
   * @param {React.KeyboardEvent} e - Keyboard event
   * @param {'create' | 'join'} action - Which form action to trigger
   */
  const handleKeyPress = (e: React.KeyboardEvent, action: 'create' | 'join') => {
    if (e.key === 'Enter') {
      if (action === 'create') {
        handleCreateLobby();
      } else {
        handleJoinLobby();
      }
    }
  };

  return (
    <div className="h-full bg-gray-900 flex items-center justify-center p-4 relative">
      <EmojiBackground />
      
      <div className="bg-gray-800/95 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full shadow-2xl relative z-10 border border-gray-700">
        <h1 className="text-5xl font-bold text-white text-center mb-2">
          🎯 Emoji Hunt
        </h1>
        <p className="text-gray-400 text-center mb-8 text-sm">
          Find the hidden emoji faster than your friends!
        </p>
        
        {error && (
          <div className="bg-red-600/90 text-white p-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}
        
        {mode === 'home' && (
          <div className="space-y-4">
            <button
              onClick={() => setMode('create')}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] shadow-lg"
            >
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl">🏠</span>
                <span className="text-lg">Create New Lobby</span>
              </div>
            </button>
            
            <button
              onClick={() => setMode('join')}
              className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] shadow-lg"
            >
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl">🎮</span>
                <span className="text-lg">Join Existing Lobby</span>
              </div>
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="space-y-6 animate-fadeIn" ref={formRef}>
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-2"
            >
              ← Back
            </button>
            
            <div>
              <label htmlFor="nickname" className="block text-gray-300 mb-2 font-medium">
                Your Nickname
              </label>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, 'create')}
                placeholder="Enter your nickname"
                className="w-full px-4 py-3 rounded-lg bg-gray-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-gray-700 transition-colors"
                maxLength={20}
                autoFocus
              />
            </div>
            
            <button
              onClick={handleCreateLobby}
              disabled={isProcessing || !nickname.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all"
            >
              {isProcessing ? 'Creating...' : 'Create Lobby'}
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="space-y-6 animate-fadeIn" ref={formRef}>
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-2"
            >
              ← Back
            </button>
            
            <div>
              <label htmlFor="join-nickname" className="block text-gray-300 mb-2 font-medium">
                Your Nickname
              </label>
              <input
                id="join-nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, 'join')}
                placeholder="Enter your nickname"
                className="w-full px-4 py-3 rounded-lg bg-gray-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-gray-700 transition-colors"
                maxLength={20}
                autoFocus
              />
            </div>
            
            <div>
              <label htmlFor="lobby-code" className="block text-gray-300 mb-2 font-medium">
                Lobby Code
              </label>
              <input
                id="lobby-code"
                type="text"
                value={lobbyCode}
                onChange={(e) => setLobbyCode(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, 'join')}
                placeholder="Enter 4-character code"
                className="w-full px-4 py-3 rounded-lg bg-gray-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-gray-700 transition-colors uppercase font-mono text-center text-lg tracking-wider"
                maxLength={4}
              />
            </div>
            
            <button
              onClick={handleJoinLobby}
              disabled={isProcessing || !nickname.trim() || !lobbyCode.trim()}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all"
            >
              {isProcessing ? 'Joining...' : 'Join Lobby'}
            </button>
          </div>
        )}
      </div>
      
      {/* Support buttons */}
      <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 flex flex-row gap-3 z-20">
        <a
          href="https://github.com/djs5008/emoji-hunt/issues/new?assignees=&labels=bug%2C+triage&projects=&template=bug_report.md&title=%5BBUG%5D+"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gray-800/90 backdrop-blur-sm hover:bg-gray-700/90 text-white px-3 py-2 md:px-4 md:py-2.5 rounded-lg transition-all transform hover:scale-105 shadow-lg border border-gray-700/50 text-xs md:text-sm font-medium flex items-center gap-1.5 md:gap-2 whitespace-nowrap"
          title="Report a bug on GitHub"
        >
          <span>Report a</span>
          <span className="text-base">🐛</span>
        </a>
        
        <a
          href="https://coff.ee/ttimhcsnad"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gray-800/90 backdrop-blur-sm hover:bg-gray-700/90 text-white px-3 py-2 md:px-4 md:py-2.5 rounded-lg transition-all transform hover:scale-105 shadow-lg border border-gray-700/50 text-xs md:text-sm font-medium flex items-center gap-1.5 md:gap-2 whitespace-nowrap overflow-hidden"
        >
          <span>Buy me a</span>
          <div className="relative w-6 h-6">
            {drinks.map((drink, index) => (
              <span
                key={index}
                className={`absolute inset-0 text-base flex items-center justify-center transition-all duration-500 ${
                  index === drinkIndex 
                    ? 'opacity-100 transform translate-y-0' 
                    : index === (drinkIndex - 1 + drinks.length) % drinks.length
                      ? 'opacity-0 transform -translate-y-6'
                      : 'opacity-0 transform translate-y-6'
                }`}
              >
                {drink}
              </span>
            ))}
          </div>
        </a>
      </div>
      
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

/**
 * Home page wrapper with Suspense boundary
 * 
 * @description Wraps the main content in Suspense to handle async operations
 * like useSearchParams which requires Suspense in Next.js app router.
 */
export default function HomePage() {
  return (
    <Suspense fallback={<div className="h-full bg-gray-900 flex items-center justify-center"><p className="text-2xl text-gray-400">Loading...</p></div>}>
      <HomePageContent />
    </Suspense>
  );
}