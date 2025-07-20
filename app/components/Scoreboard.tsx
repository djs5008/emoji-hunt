'use client';

import { Player } from '@/app/types/game';
import { Button } from '@/app/components/Button';

/**
 * Scoreboard Component - Displays player rankings and scores
 * 
 * @description Shows player scores after each round or at game end. Features
 * animated rankings, round-specific scores, and special highlighting for winners.
 * Responsive design adapts to mobile and desktop screens.
 * 
 * Visual features:
 * - Medal emojis for top 3 players
 * - Gradient backgrounds for winners
 * - Round performance details (time, points)
 * - DNF (Did Not Find) indicators
 * - Play again / Main menu buttons for final scores
 */
interface ScoreboardProps {
  players: Player[];           // All players with scores
  currentRound?: number;       // Current round number (omit for final)
  isFinal?: boolean;          // True for game end scoreboard
  onPlayAgain?: () => void;   // Callback for play again (host only)
  onMainMenu?: () => void;    // Callback for main menu navigation
}

export default function Scoreboard({ players, currentRound, isFinal, onPlayAgain, onMainMenu }: ScoreboardProps) {
  // Sort players by score (highest first)
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  
  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50 p-3 md:p-4">
      <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-4 md:p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl border border-gray-700/50">
        <div className="text-center mb-4 md:mb-6">
          <div className="inline-flex items-center gap-2 md:gap-3 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-xl px-4 py-2 md:px-6 md:py-3 border border-purple-500/30">
            <span className="text-2xl md:text-4xl">{isFinal ? '🏆' : '📊'}</span>
            <h2 className="text-xl md:text-3xl font-bold text-white">
              {isFinal ? 'Final Scores' : `Round ${currentRound} Results`}
            </h2>
          </div>
        </div>
        
        <div className="space-y-2 md:space-y-3">
          {sortedPlayers.map((player, index) => {
            // Determine player status and styling
            const isWinner = index === 0 && isFinal;
            const isTop3 = index < 3;
            const roundScore = currentRound ? 
              player.roundScores.find(rs => rs.round === currentRound) : null;
            
            // Visual indicators based on ranking
            const positionEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
            const bgGradient = isWinner 
              ? 'from-yellow-600/30 to-amber-600/30 border-yellow-500/50'  // Gold for winner
              : isTop3
                ? 'from-indigo-600/20 to-purple-600/20 border-indigo-500/30' // Special color for top 3
                : 'from-gray-700/30 to-gray-800/30 border-gray-600/30';      // Default for others
            
            return (
              <div
                key={player.id}
                className={`relative bg-gradient-to-r ${bgGradient} rounded-xl p-3 md:p-4 border transition-all duration-300 hover:scale-[1.02]`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                    <span className="text-xl md:text-3xl font-bold text-gray-400 flex-shrink-0">
                      {positionEmoji || `#${index + 1}`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg md:text-2xl flex-shrink-0">{player.avatar || '😊'}</span>
                        <p className="text-white font-semibold text-sm md:text-lg truncate">{player.nickname}</p>
                      </div>
                      {!isFinal && (
                        <div className="mt-1">
                          {roundScore ? (
                            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                              {roundScore.timeToFind ? (
                                <>
                                  <span className="inline-flex items-center gap-1 text-[10px] md:text-sm text-green-400 bg-green-500/20 rounded-full px-2 py-0.5">
                                    <span className="hidden md:inline">✅</span>
                                    <span>Found in {roundScore.timeToFind.toFixed(1)}s</span>
                                  </span>
                                  <span className="text-yellow-400 text-xs md:text-base font-bold">
                                    +{roundScore.points}pts
                                  </span>
                                </>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] md:text-sm text-red-400 bg-red-500/20 rounded-full px-2 py-0.5">
                                  <span className="hidden md:inline">❌</span>
                                  <span>DNF</span>
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] md:text-sm text-red-400 bg-red-500/20 rounded-full px-2 py-0.5">
                              <span className="hidden md:inline">❌</span>
                              <span>DNF</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0">
                    <div className="bg-gradient-to-r from-amber-600/20 to-yellow-600/20 rounded-lg px-2 py-1 md:px-4 md:py-2 border border-amber-500/30">
                      <div className="flex items-center gap-1 md:gap-2">
                        <span className="text-sm md:text-xl">🏆</span>
                        <span className="text-base md:text-2xl font-bold text-yellow-400">
                          {player.score}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {isFinal && (
          <div className="mt-8 text-center">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {onPlayAgain && (
                <Button
                  onClick={onPlayAgain}
                  className="min-w-[160px] bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 transform hover:scale-105 shadow-lg border border-green-500/30"
                  size="lg"
                >
                  <span className="flex items-center justify-center gap-2">
                    <span>🎮</span>
                    <span>Play Again</span>
                  </span>
                </Button>
              )}
              {onMainMenu && (
                <Button
                  onClick={onMainMenu}
                  className="min-w-[160px] bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 transform hover:scale-105 shadow-lg border border-blue-500/30"
                  size="lg"
                >
                  <span className="flex items-center justify-center gap-2">
                    <span>🏠</span>
                    <span>Main Menu</span>
                  </span>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}