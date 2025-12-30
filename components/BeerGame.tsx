'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Trophy, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import confetti from 'canvas-confetti';
import { saveHighScore, getHighScore, HighScore } from '@/app/actions';

interface BeerGameProps {
    playerName: string;
    onClose: () => void;
}

interface Item {
    id: number;
    x: number;
    y: number;
    speed: number;
    emoji: string;
}

const backgroundStyle = "bg-gradient-to-b from-[#1a1c2c] via-[#4a2448] to-[#9d303b]";

export function BeerGame({ playerName, onClose }: BeerGameProps) {
    // UI State (for rendering only)
    const [gameState, setGameState] = useState<{
        items: Item[];
        score: number;
        gameOver: boolean;
        isPlaying: boolean;
    }>({
        items: [],
        score: 0,
        gameOver: false,
        isPlaying: false
    });

    // Logic Refs (Source of Truth)
    const itemsRef = useRef<Item[]>([]);
    const scoreRef = useRef(0);
    const isPlayingRef = useRef(false);
    const playerXRef = useRef(50);

    // Timers & Loop
    const requestRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);
    const spawnTimerRef = useRef<number>(0);

    const [highScore, setHighScore] = useState<HighScore | null>(null);
    const [isNewRecord, setIsNewRecord] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Initial Load
    useEffect(() => {
        getHighScore().then(setHighScore);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    const animate = (time: number) => {
        if (!lastTimeRef.current) lastTimeRef.current = time;
        const deltaTime = time - lastTimeRef.current;
        lastTimeRef.current = time;

        if (isPlayingRef.current) {
            updateGameLogic(deltaTime);
            requestRef.current = requestAnimationFrame(animate);
        }
    };

    const updateGameLogic = (delta: number) => {
        // 1. Difficulty: Aggressive Scaling
        // Difficulty increases 10% per point instead of 5%
        const currentScore = scoreRef.current;
        const currentDifficulty = 1 + (currentScore * 0.12); // Faster ramp-up

        // 2. Spawn System
        spawnTimerRef.current += delta;
        // Cap spawn rate at 400ms min to avoid impossible overlap, start at 1000ms
        const spawnRate = Math.max(450, 1000 - (currentDifficulty * 60));

        if (spawnTimerRef.current > spawnRate) {
            // Prevent spawning too close to edges due to zigzag
            itemsRef.current.push({
                id: Date.now() + Math.random(),
                x: Math.random() * 70 + 15, // 15% - 85% bounds
                y: -15,
                speed: 0.25 + (currentDifficulty * 0.05), // Higher base speed + faster growth
                emoji: Math.random() > 0.5 ? '🍺' : '🍻'
            });
            spawnTimerRef.current = 0;
        }

        // 3. Move & Collision
        const curPlayerX = playerXRef.current;
        const playerLeft = curPlayerX - 10;
        const playerRight = curPlayerX + 10;

        let missed = false;
        let caughtPoints = 0;
        const nextItems: Item[] = [];

        // Add zigzag phase ref or property if complex, but simple version:
        // Use item ID or Y to determine phase
        const timeFactor = Date.now() / 200; // time base for wave

        for (const item of itemsRef.current) {
            // Vertical Move
            const newY = item.y + (item.speed * delta * 0.15);

            // Horizontal ZigZag "Drunk" Movement
            // Sine wave based on Item ID (random phase) and Y position
            const wave = Math.sin((newY * 0.1) + (item.id % 100));
            const horizontalShift = wave * 0.4 * delta * 0.1; // Amplitude adjusted
            let newX = item.x + horizontalShift;

            // Wall Clamp
            if (newX < 5) newX = 5;
            if (newX > 95) newX = 95;

            // Check Catch
            if (newY > 80 && newY < 95) {
                if (newX > playerLeft && newX < playerRight) {
                    caughtPoints++;
                    continue; // Caught
                }
            }

            // Check Miss
            if (newY >= 100) {
                missed = true;
                break;
            } else {
                item.y = newY;
                item.x = newX; // Update X too
                nextItems.push({ ...item, y: newY, x: newX });
            }
        }

        // 4. Update State
        if (missed) {
            handleGameOver();
        } else {
            itemsRef.current = nextItems;

            if (caughtPoints > 0) {
                scoreRef.current += caughtPoints;
            }

            setGameState({
                items: [...itemsRef.current],
                score: scoreRef.current,
                gameOver: false,
                isPlaying: true
            });
        }
    };

    const startGame = () => {
        // Reset Refs
        itemsRef.current = [];
        scoreRef.current = 0;
        isPlayingRef.current = true;
        spawnTimerRef.current = 0;
        lastTimeRef.current = 0;

        setIsNewRecord(false);
        setGameState({
            items: [],
            score: 0,
            gameOver: false,
            isPlaying: true
        });

        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        requestRef.current = requestAnimationFrame(animate);
    };

    const handleGameOver = () => {
        isPlayingRef.current = false;
        if (requestRef.current) cancelAnimationFrame(requestRef.current);

        saveHighScore(playerName, scoreRef.current).then((res) => {
            if (res.newRecord) {
                setIsNewRecord(true);
                confetti({
                    particleCount: 150,
                    spread: 80,
                    origin: { y: 0.6 },
                    colors: ['#FFD700', '#FFA500', '#FFFFFF']
                });
                getHighScore().then(setHighScore);
            }
        });

        setGameState(prev => ({
            ...prev,
            gameOver: true,
            isPlaying: false
        }));
    };

    const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (!containerRef.current || !isPlayingRef.current) return;

        let clientX;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
        } else {
            clientX = (e as React.MouseEvent).clientX;
        }

        const rect = containerRef.current.getBoundingClientRect();
        const relativeX = clientX - rect.left;
        const percentage = (relativeX / rect.width) * 100;

        const clamped = Math.max(8, Math.min(92, percentage));
        playerXRef.current = clamped;

        // No need to setPlayerX state if we don't render it separately? 
        // We DO render it. So we can update specific state or Ref.
        // For smoothness, player basket should react instantly.
        // We can force a re-render or include playerX in gameState.
        // Let's create a separate state for playerX to avoid full game logic rerender on mouse move?
        // Actually, game loop rerenders every frame anyway (60fps). 
        // So we can just use a ref for render, but we need React to know.
        // Let's us `setPlayerX` separate from `gameState`? 
        // Or if loop runs 60fps, it handles position update too.
        // But mouse move might be faster/diff frequency.
        // Let's keep `playerX` state separate for immediate feedback if game loop lags?
        // No, simplest is `playerX` state synced.
        setPlayerX(clamped);
    };

    const [playerX, setPlayerX] = useState(50);

    return (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
            <div
                ref={containerRef}
                className={`relative w-full h-full max-w-md ${backgroundStyle} overflow-hidden shadow-2xl flex flex-col touch-none select-none`}
                onTouchMove={handleTouchMove}
                onMouseMove={(e) => isPlayingRef.current && handleTouchMove(e)}
            >
                {/* Background Stars */}
                <div className="absolute inset-0 opacity-30 pointer-events-none">
                    <div className="absolute top-[10%] left-[20%] text-[8px] text-white animate-pulse">✨</div>
                    <div className="absolute top-[30%] right-[15%] text-[10px] text-white animate-pulse delay-700">⭐</div>
                    <div className="absolute top-[15%] right-[40%] text-[6px] text-white animate-pulse delay-300">✨</div>
                    <div className="absolute top-[50%] left-[10%] text-[9px] text-yellow-100 animate-pulse delay-500">✨</div>
                </div>

                {/* HUD */}
                <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-20">
                    <div className="flex flex-col">
                        <span className="text-4xl font-black text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)] font-mono tracking-wider">
                            {gameState.score}
                        </span>
                        {highScore && (
                            <div className="bg-black/30 px-2 py-1 rounded text-[10px] text-white/80 backdrop-blur-sm mt-1 border border-white/10">
                                👑 TOP: {highScore.name} ({highScore.score})
                            </div>
                        )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20 rounded-full h-10 w-10">
                        <X size={24} />
                    </Button>
                </div>

                {/* Items */}
                {gameState.items.map(item => (
                    <div
                        key={item.id}
                        className="absolute -translate-x-1/2 text-4xl pointer-events-none drop-shadow-lg"
                        style={{ left: `${item.x}%`, top: `${item.y}%`, transition: 'top 0s' }}
                    >
                        {item.emoji}
                    </div>
                ))}

                {/* Player Basket */}
                <div
                    className="absolute bottom-[5%] -translate-x-1/2 text-6xl pointer-events-none drop-shadow-xl transition-transform duration-75"
                    style={{ left: `${playerX}%` }}
                >
                    🧺
                </div>

                {/* Screens */}
                {!gameState.isPlaying && !gameState.gameOver && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-30 p-6 text-center animate-in fade-in">
                        <div className="mb-6 p-6 bg-white/10 rounded-full backdrop-blur-lg border border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                            <span className="text-6xl">🏃🧺</span>
                        </div>
                        <h2 className="text-4xl font-bold bg-gradient-to-r from-yellow-300 to-orange-500 bg-clip-text text-transparent mb-2">
                            BEER CATCHER
                        </h2>
                        <p className="text-slate-200 mb-8 max-w-[250px] leading-relaxed">
                            Mueve la cesta. ¡No dejes caer ninguna cerveza al suelo!
                        </p>
                        <Button
                            onClick={startGame}
                            className="bg-gradient-to-tr from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold text-xl px-10 py-8 rounded-full shadow-[0_10px_20px_rgba(16,185,129,0.4)] animate-pulse border-t border-white/30"
                        >
                            <Play className="mr-2 fill-current w-6 h-6" /> JUGAR
                        </Button>
                    </div>
                )}

                {gameState.gameOver && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/90 backdrop-blur-md z-40 p-6 text-center animate-in zoom-in duration-300">
                        <div className="text-7xl mb-4 animate-bounce">😭</div>
                        <h2 className="text-5xl font-black text-white mb-2 drop-shadow-md">GAME OVER</h2>
                        <div className="flex flex-col items-center my-6">
                            <span className="text-white/60 text-sm uppercase tracking-widest mb-1">Puntuación Final</span>
                            <span className="text-6xl font-mono font-bold text-yellow-300 drop-shadow-lg">{gameState.score}</span>
                        </div>

                        {isNewRecord && (
                            <div className="mb-8 bg-gradient-to-r from-yellow-400/80 to-orange-500/80 p-3 rounded-xl border border-yellow-200 shadow-lg animate-bounce text-white font-bold flex items-center gap-2">
                                🏆 ¡NUEVO RÉCORD! 🏆
                            </div>
                        )}

                        <Button
                            onClick={startGame}
                            className="bg-white text-red-900 hover:bg-indigo-50 font-bold text-lg px-8 py-6 rounded-full shadow-xl transition-transform active:scale-95"
                        >
                            <RotateCcw className="mr-2 w-5 h-5" /> INTENTAR DE NUEVO
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
