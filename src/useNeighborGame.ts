import { useState, useCallback } from 'react';

interface NeighborGameState {
  targetCountry: string | null;
  foundNeighbors: string[];
  missedGuesses: string[];
  isHardMode: boolean;
  gameStatus: 'idle' | 'playing' | 'won';
  score: number;
}

export const useNeighborGame = (neighborMap: Map<string, string[]>) => {
  const [gameState, setGameState] = useState<NeighborGameState>({
    targetCountry: null,
    foundNeighbors: [],
    missedGuesses: [],
    isHardMode: false,
    gameStatus: 'idle',
    score: 0,
  });

  const startNewRound = useCallback(() => {
    // Filter to only countries with more than 1 neighbor
    const validTargets = Array.from(neighborMap.keys()).filter(country => {
      const neighbors = neighborMap.get(country) || [];
      return neighbors.length > 1;
    });
    
    const randomTarget = validTargets[Math.floor(Math.random() * validTargets.length)];

    setGameState(prev => ({
      ...prev,
      targetCountry: randomTarget,
      foundNeighbors: [],
      missedGuesses: [],
      gameStatus: 'playing'
    }));
  }, [neighborMap]);

  const checkGuess = useCallback((guess: string) => {
    if (gameState.gameStatus !== 'playing' || !gameState.targetCountry) return;

    const correctNeighbors = neighborMap.get(gameState.targetCountry) || [];
    
    if (gameState.foundNeighbors.includes(guess) || gameState.missedGuesses.includes(guess)) return;

    if (correctNeighbors.includes(guess)) {
      const newFound = [...gameState.foundNeighbors, guess];
      const isWin = newFound.length === correctNeighbors.length;
      
      setGameState(prev => ({
        ...prev,
        foundNeighbors: newFound,
        gameStatus: isWin ? 'won' : 'playing',
        score: isWin ? prev.score + 1 : prev.score
      }));
    } else {
      setGameState(prev => ({
        ...prev,
        missedGuesses: [...prev.missedGuesses, guess]
      }));
    }
  }, [gameState, neighborMap]);

  const toggleHardMode = () => {
    setGameState(prev => ({ ...prev, isHardMode: !prev.isHardMode }));
  };

  return {
    ...gameState,
    startNewRound,
    checkGuess,
    toggleHardMode
  };
};
