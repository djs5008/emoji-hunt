'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import EmojiBackground from './components/EmojiBackground';
import { setPlayerId, getPlayerId } from './lib/player-storage';

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home');
  const [nickname, setNickname] = useState('');
  const [lobbyCode, setLobbyCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [drinkIndex, setDrinkIndex] = useState(0);
  const drinks = ['☕️', '🍺', '🍵', '🥤', '🧋', '🍷', '🥛', '🧃'];
  
  const handleCreateLobby = async () => {
    if (!nickname.trim()) {
      setError('Please enter a nickname');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Get existing player ID if available
      const existingPlayerId = getPlayerId();
      
      const res = await fetch('/api/lobby/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nickname: nickname.trim(),
          playerId: existingPlayerId 
        }),
      });
      
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      
      // Store player ID and host token
      setPlayerId(data.playerId);
      sessionStorage.setItem(`host-${data.lobby.id}`, data.hostToken);
      
      // Navigate to lobby
      router.push(`/lobby/${data.lobby.id}`);
    } catch (err) {
      setError('Failed to create lobby');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleJoinLobby = async () => {
    if (!nickname.trim()) {
      setError('Please enter a nickname');
      return;
    }
    
    if (!lobbyCode.trim()) {
      setError('Please enter a lobby code');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Get existing player ID if available
      const existingPlayerId = getPlayerId();
      
      const res = await fetch('/api/lobby/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nickname: nickname.trim(),
          lobbyId: lobbyCode.trim().toUpperCase(),
          playerId: existingPlayerId
        }),
      });
      
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      
      // Store player ID
      setPlayerId(data.playerId);
      
      // Navigate to lobby
      router.push(`/lobby/${data.lobby.id}`);
    } catch (err) {
      setError('Failed to join lobby');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setMode('home');
    setNickname('');
    setLobbyCode('');
    setError(null);
  };
  
  // Handle URL parameters
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
  
  // Auto-scroll to form when mode changes
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
  
  // Cycle through drinks
  useEffect(() => {
    const interval = setInterval(() => {
      setDrinkIndex((prev) => (prev + 1) % drinks.length);
    }, 2000);
    
    return () => clearInterval(interval);
  }, [drinks.length]);
  
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
          href="https://github.com/djs5008/emoji-hunt"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gray-800/90 backdrop-blur-sm hover:bg-gray-700/90 text-white px-3 py-2 md:px-4 md:py-2.5 rounded-lg transition-all transform hover:scale-105 shadow-lg border border-gray-700/50 text-xs md:text-sm font-medium flex items-center gap-1.5 md:gap-2 whitespace-nowrap"
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

export default function HomePage() {
  return (
    <Suspense fallback={<div className="h-full bg-gray-900 flex items-center justify-center"><p className="text-2xl text-gray-400">Loading...</p></div>}>
      <HomePageContent />
    </Suspense>
  );
}