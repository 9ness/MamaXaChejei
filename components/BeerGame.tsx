'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Trophy, Play, RotateCcw, Check, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import confetti from 'canvas-confetti';
import { saveHighScore, getHighScore, HighScore, incrementTotalGames, getTotalGames } from '@/app/actions';

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
    // UI State (rendering minimal updates)
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

    // Validated Refs (Game Loop Source of Truth)
    const itemsRef = useRef<Item[]>([]);
    const scoreRef = useRef(0);
    const isPlayingRef = useRef(false);
    const playerXRef = useRef(50);

    // Visual Refs for Direct DOM Manipulation (60fps perf)
    const containerRef = useRef<HTMLDivElement>(null);
    const flickerOverlayRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const playerRef = useRef<HTMLDivElement>(null);

    // Timers & Loop
    const requestRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);
    const spawnTimerRef = useRef<number>(0);
    const nextBlinkTimeRef = useRef<number>(0);

    // Animation Refs
    const drinkingTimerRef = useRef<NodeJS.Timeout | null>(null);

    const [highScore, setHighScore] = useState<HighScore | null>(null);
    const [isNewRecord, setIsNewRecord] = useState(false);
    const [isDrinking, setIsDrinking] = useState(false);
    const [totalGames, setTotalGames] = useState(0);

    // Name Entry State
    const [showNameInput, setShowNameInput] = useState(false);
    const [nameInput, setNameInput] = useState('');
    const [pendingScore, setPendingScore] = useState(0);

    // Constants
    const BASE_SPEED = 0.25;
    const BASE_BASKET_WIDTH = 20;

    // Initial Load
    useEffect(() => {
        getHighScore().then(setHighScore);
        getTotalGames().then(setTotalGames);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            if (drinkingTimerRef.current) clearTimeout(drinkingTimerRef.current);
        };
    }, []);

    const animate = (time: number) => {
        if (!lastTimeRef.current) lastTimeRef.current = time;
        const deltaTime = time - lastTimeRef.current;
        lastTimeRef.current = time;

        if (isPlayingRef.current) {
            updateGameLogic(deltaTime, time);
            requestRef.current = requestAnimationFrame(animate);
        }
    };

    const updateGameLogic = (delta: number, totalTime: number) => {
        const currentScore = scoreRef.current;

        // --- 1. Math & Difficulty ---
        const currentSpeed = BASE_SPEED + (currentScore * 0.15);
        const spawnRate = Math.max(400, 1000 - (currentScore * 25));

        // Dynamic Width
        const shrinkFactor = Math.max(0.3, 1 - (currentScore * 0.015));
        const currentBasketWidth = BASE_BASKET_WIDTH * shrinkFactor;
        const hitBoxHalfWidth = currentBasketWidth / 2;

        // --- 2. Visual Effects (Direct DOM) ---
        if (sceneRef.current && flickerOverlayRef.current) {
            // A. Oscillating Blur (The "Drunk" Effect)
            // RESTORED BUT OPTIMIZED with will-change: filter
            const breathe = 0.6 + 0.4 * Math.sin(totalTime * 0.003);
            const baseBlur = currentScore * 0.25;
            // Cap blur to prevent unplayable mess and extreme GPU load
            const blurAmount = Math.min(8, baseBlur * breathe);

            // Rotation (Dizziness)
            const maxRotation = currentScore * 0.4;
            const sway = Math.sin(totalTime * 0.002) * maxRotation;

            let scale = 1;
            if (currentScore >= 15) {
                const pulse = Math.sin(totalTime * 0.01);
                const intensity = (currentScore - 14) * 0.02;
                scale = 1 + (pulse * intensity);
            }

            // Apply transformations
            // NOTE: Changing filter every frame IS expensive, but 'will-change: filter' helps.
            // If it's still slow, we might need to quantize it (update every 5 frames).
            // For now, attempting full fluidity as requested.
            sceneRef.current.style.filter = `blur(${blurAmount}px)`;
            sceneRef.current.style.transform = `rotate(${sway}deg) scale(${scale}) translateZ(0)`;

            // C. Natural Blink
            if (currentScore >= 5) {
                if (totalTime > nextBlinkTimeRef.current) {
                    flickerOverlayRef.current.style.opacity = '0.92';
                    const blinkDuration = Math.random() * 200 + 150;
                    setTimeout(() => {
                        if (flickerOverlayRef.current) flickerOverlayRef.current.style.opacity = '0.001'; // Keep layer active
                    }, blinkDuration);
                    const baseInterval = Math.max(1000, 5000 - (currentScore * 200));
                    nextBlinkTimeRef.current = totalTime + baseInterval + (Math.random() * 2000);
                }
            }
        }

        // --- 3. Spawn System ---
        spawnTimerRef.current += delta;
        if (spawnTimerRef.current > spawnRate) {
            itemsRef.current.push({
                id: Date.now() + Math.random(),
                x: Math.random() * 80 + 10,
                y: -15,
                speed: currentSpeed,
                emoji: Math.random() > 0.5 ? '🍺' : '🍻'
            });
            spawnTimerRef.current = 0;
        }

        // --- 4. Physics & Collisions ---
        const curPlayerX = playerXRef.current;
        const playerLeft = curPlayerX - hitBoxHalfWidth;
        const playerRight = curPlayerX + hitBoxHalfWidth;

        let missed = false;
        let caughtPoints = 0;
        const nextItems: Item[] = [];

        for (const item of itemsRef.current) {
            const newY = item.y + (item.speed * delta * 0.1);
            const wobbleMultiplier = 1 + (currentScore * 0.05);
            const wave = Math.sin((newY * 0.1) + (item.id % 10));
            const newX = item.x + (wave * 0.4 * delta * 0.05 * wobbleMultiplier);
            const clampedX = Math.max(2, Math.min(98, newX));

            if (newY > 75 && newY < 88) {
                if (clampedX > playerLeft && clampedX < playerRight) {
                    caughtPoints++;
                    continue; // Caught
                }
            }

            if (newY >= 88) {
                missed = true;
                break;
            } else {
                const updatedItem = { ...item, y: newY, x: clampedX };
                nextItems.push(updatedItem);
                const el = itemRefs.current.get(item.id);
                if (el) {
                    el.style.left = `${clampedX}%`;
                    el.style.top = `${newY}%`;
                }
            }
        }

        if (missed) {
            handleGameOver();
        } else {
            itemsRef.current = nextItems;
            if (caughtPoints > 0) {
                scoreRef.current += caughtPoints;
                if (!drinkingTimerRef.current) {
                    setIsDrinking(true);
                    drinkingTimerRef.current = setTimeout(() => {
                        setIsDrinking(false);
                        drinkingTimerRef.current = null;
                    }, 400);
                }
            }

            const shouldRender = caughtPoints > 0 || nextItems.length !== gameState.items.length;
            if (shouldRender) {
                setGameState({
                    items: nextItems,
                    score: scoreRef.current,
                    gameOver: false,
                    isPlaying: true
                });
            }
        }
    };

    const startGame = () => {
        incrementTotalGames().then(setTotalGames);
        itemsRef.current = [];
        scoreRef.current = 0;
        isPlayingRef.current = true;
        spawnTimerRef.current = 0;
        lastTimeRef.current = 0;
        playerXRef.current = 50;

        if (sceneRef.current) {
            sceneRef.current.style.transform = 'none';
            sceneRef.current.style.filter = 'none';
        }
        if (flickerOverlayRef.current) {
            flickerOverlayRef.current.style.opacity = '0.001';
        }
        if (playerRef.current) {
            playerRef.current.style.left = '50%';
        }

        setIsNewRecord(false);
        setIsDrinking(false);
        if (drinkingTimerRef.current) {
            clearTimeout(drinkingTimerRef.current);
            drinkingTimerRef.current = null;
        }

        setGameState({ items: [], score: 0, gameOver: false, isPlaying: true });
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        requestRef.current = requestAnimationFrame(animate);
    };

    const handleGameOver = async () => {
        isPlayingRef.current = false;
        if (requestRef.current) cancelAnimationFrame(requestRef.current);

        const score = scoreRef.current;
        const currentRecord = await getHighScore();
        const isRecord = !currentRecord || score > currentRecord.score;

        if (isRecord && (playerName === 'Anónimo' || !playerName)) {
            setIsNewRecord(true);
            setPendingScore(score);
            setShowNameInput(true);
            setNameInput('');
            confetti({
                particleCount: 200, spread: 100, origin: { y: 0.6 },
                colors: ['#FFD700', '#FFA500', '#FFFFFF', '#FF4500']
            });
        } else {
            saveHighScore(playerName, score).then((res) => {
                if (res.newRecord) {
                    setIsNewRecord(true);
                    confetti({
                        particleCount: 200, spread: 100, origin: { y: 0.6 },
                        colors: ['#FFD700', '#FFA500', '#FFFFFF', '#FF4500']
                    });
                    getHighScore().then(setHighScore);
                }
            });
        }
        setGameState(prev => ({ ...prev, gameOver: true, isPlaying: false }));
    };

    const saveNamedRecord = () => {
        const nameToSave = nameInput.trim() || 'Anónimo';
        saveHighScore(nameToSave, pendingScore).then(() => {
            setShowNameInput(false);
            getHighScore().then(setHighScore);
        });
    };

    const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (!containerRef.current || !isPlayingRef.current) return;
        let clientX;
        if ('touches' in e) clientX = e.touches[0].clientX;
        else clientX = (e as React.MouseEvent).clientX;

        const rect = containerRef.current.getBoundingClientRect();
        const relativeX = clientX - rect.left;
        const percentage = (relativeX / rect.width) * 100;
        const clamped = Math.max(5, Math.min(95, percentage));

        playerXRef.current = clamped;
        if (playerRef.current) {
            playerRef.current.style.left = `${clamped}%`;
        }
    };

    const currentScore = gameState.score;
    const shrinkFactor = Math.max(0.3, 1 - (currentScore * 0.015));
    const basketScale = shrinkFactor;

    // Sprite Logic: Determine which sprite ID is active
    const getActiveSpriteId = (score: number, drinking: boolean) => {
        let base = 'man1';
        if (score > 10) base = 'man3';
        else if (score > 5) base = 'man2';
        return drinking ? `${base}_drunk` : base;
    };

    const activeSpriteId = getActiveSpriteId(currentScore, isDrinking);

    // All possible sprites for pre-rendering
    const ALL_SPRITES = [
        { id: 'man1', src: '/man1.png' },
        { id: 'man1_drunk', src: '/man1_drunk.png' },
        { id: 'man2', src: '/man2.png' },
        { id: 'man2_drunk', src: '/man2_drunk.png' },
        { id: 'man3', src: '/man3.png' },
        { id: 'man3_drunk', src: '/man3_drunk.png' },
        { id: 'man_finish', src: '/man_finish.png' }, // Not used in player loop but good to preload
    ];

    return (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90">
            {/* Optimized Flicker Overlay: 'will-change' + initialized opacity for layer promotion */}
            <div
                ref={flickerOverlayRef}
                className="fixed inset-0 bg-black z-[70] pointer-events-none transition-opacity duration-200 ease-in-out will-change-[opacity]"
                style={{ opacity: 0.001 }} // Start nearly invisible but active
            />

            <div
                ref={containerRef}
                className="relative w-full h-full max-w-md overflow-hidden shadow-2xl flex flex-col touch-none select-none bg-black"
                onTouchMove={handleTouchMove}
                onMouseMove={(e) => isPlayingRef.current && handleTouchMove(e)}
            >
                <div className={`absolute inset-0 ${backgroundStyle}`} />
                <div className="absolute inset-0 opacity-30 pointer-events-none">
                    <div className="absolute top-[10%] left-[20%] text-[8px] text-white animate-pulse">✨</div>
                    <div className="absolute top-[30%] right-[15%] text-[10px] text-white animate-pulse delay-700">⭐</div>
                </div>

                <div
                    ref={sceneRef}
                    className="relative w-full h-full will-change-[transform,filter]" // Critical Optimization
                    style={{ transformOrigin: 'center bottom' }}
                >
                    {/* Items */}
                    {gameState.items.map(item => (
                        <div
                            key={item.id}
                            ref={(el) => {
                                if (el) itemRefs.current.set(item.id, el);
                                else itemRefs.current.delete(item.id);
                            }}
                            className="absolute -translate-x-1/2 text-4xl pointer-events-none drop-shadow-lg z-10 will-change-transform"
                            style={{ left: `${item.x}%`, top: `${item.y}%`, transition: 'none' }}
                        >
                            {item.emoji}
                        </div>
                    ))}

                    {/* LOW-LATENCY PLAYER SPRITE SYSTEM */}
                    {/* Instead of replacing the <img> src (causing decoding stutter), we pre-render ALL sprites */}
                    <div
                        ref={playerRef}
                        className="absolute bottom-[10%] -translate-x-1/2 flex justify-center items-end pointer-events-none transition-transform duration-75 z-20 will-change-transform"
                        style={{
                            left: `50%`,
                            transform: `translateX(-50%) scaleX(${basketScale}) scaleY(${basketScale})`,
                            width: '130px',
                            height: '130px'
                        }}
                    >
                        {ALL_SPRITES.filter(s => s.id !== 'man_finish').map((sprite) => (
                            <img
                                key={sprite.id}
                                src={sprite.src}
                                alt="Player"
                                className="absolute inset-0 w-full h-full object-contain filter drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] transition-opacity duration-75"
                                style={{
                                    opacity: sprite.id === activeSpriteId ? 1 : 0,
                                    zIndex: sprite.id === activeSpriteId ? 2 : 1
                                }}
                            />
                        ))}
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 h-[12%] bg-[#4a2c18] border-t-4 border-[#6d4c30] shadow-[0_-5px_20px_rgba(0,0,0,0.6)] z-30 flex items-start justify-center overflow-hidden">
                        <div className="w-full h-full opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #000 10px, #000 12px)' }}></div>
                        <div className="absolute top-1 left-0 right-0 h-[1px] bg-white/10"></div>
                    </div>
                </div>

                {/* HUD */}
                <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-50 pointer-events-none">
                    <div className="flex flex-col pointer-events-auto">
                        <span className="text-5xl font-black text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] font-mono tracking-wider">
                            {gameState.score}
                        </span>
                        {highScore && (
                            <div className="bg-black/40 px-3 py-1 rounded-full text-xs text-yellow-300/90 font-bold backdrop-blur-sm mt-2 border border-yellow-500/30">
                                👑 RÉCORD: {highScore.score} ({highScore.name})
                            </div>
                        )}
                    </div>
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="absolute top-4 right-4 z-[90] text-white hover:bg-white/20 rounded-full h-12 w-12 bg-black/20 backdrop-blur pointer-events-auto"
                >
                    <X size={28} />
                </Button>

                {!gameState.isPlaying && !gameState.gameOver && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-[60] p-6 text-center animate-in fade-in">
                        <div className="mb-6 w-36 h-36 bg-white/10 rounded-full backdrop-blur-lg border border-white/20 flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.1)] overflow-hidden">
                            <img src="/man1.png" className="w-full h-full object-contain scale-90 mt-2" />
                        </div>
                        <h2 className="text-5xl font-black bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent mb-4 drop-shadow-sm">
                            ATRAPA A CERVEZA
                        </h2>
                        <div className="space-y-4 mb-8 max-w-[280px]">
                            <p className="text-slate-300 text-lg leading-relaxed font-medium">
                                Eres o cliente. <br />
                                <span className="text-yellow-400">¡Que non caia nin unha gota na barra!</span>
                            </p>
                            <div className="flex gap-2 justify-center text-xs text-white/40 uppercase tracking-widest">
                                <span>Cada cerveza emborracha máis</span>
                            </div>
                        </div>
                        <Button
                            onClick={startGame}
                            className="bg-gradient-to-tr from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-black text-2xl px-12 py-8 rounded-full shadow-[0_0_30px_rgba(16,185,129,0.5)] animate-pulse border border-white/20 transition-all hover:scale-105 active:scale-95"
                        >
                            <Play className="mr-3 fill-current w-8 h-8" /> XOGAR
                        </Button>
                    </div>
                )}

                {gameState.gameOver && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/95 backdrop-blur-xl z-[60] p-4 text-center animate-in zoom-in duration-300">
                        <div className="mb-2 relative">
                            <div className="absolute inset-0 bg-yellow-500/20 blur-xl rounded-full animate-pulse"></div>
                            <img src="/man_finish.png" alt="Drunk Finish" className="w-32 h-32 object-contain relative z-10 drop-shadow-2xl transform hover:scale-105 transition-transform" />
                        </div>
                        <h2 className="text-5xl font-black text-white mb-1 drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)]">A CA BOU SE!</h2>
                        <p className="text-red-200 font-bold mb-2">¡Pasásteste de copas!</p>
                        <div className="flex flex-col items-center my-2 p-3 bg-white/5 rounded-3xl border border-white/10 w-full max-w-xs">
                            <span className="text-white/60 text-xs uppercase tracking-widest mb-1">Puntuación</span>
                            <span className="text-6xl font-mono font-black text-yellow-400 drop-shadow-lg">{gameState.score}</span>
                        </div>
                        {isNewRecord && (
                            <div className="mb-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white p-2 px-4 rounded-xl shadow-[0_0_30px_rgba(255,215,0,0.6)] animate-pulse font-black text-md flex items-center gap-2 transform rotate-1">
                                🏆 ¡NOVO RÉCORD! 🏆
                            </div>
                        )}
                        <div className="flex flex-col gap-2 w-full max-w-[220px] mt-1">
                            {showNameInput ? (
                                <div className="animate-in fade-in slide-in-from-bottom-2 w-full mb-2">
                                    <p className="text-yellow-200 text-xs mb-1 font-bold">¡Garda o teu récord!</p>
                                    <div className="flex gap-2">
                                        <Input
                                            value={nameInput}
                                            onChange={(e) => setNameInput(e.target.value)}
                                            placeholder="Nome..."
                                            className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-10"
                                            maxLength={15}
                                        />
                                        <Button size="icon" onClick={saveNamedRecord} className="bg-green-600 hover:bg-green-700 h-10 w-10 shrink-0">
                                            <Save className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <Button
                                    onClick={startGame}
                                    className="w-full bg-white text-red-900 hover:bg-slate-100 font-bold text-lg py-5 rounded-full shadow-2xl transition-transform active:scale-95"
                                >
                                    <RotateCcw className="mr-2 w-5 h-5" /> OUTRA RONDA
                                </Button>
                            )}
                            <Button
                                onClick={() => {
                                    if (showNameInput) saveHighScore('Anónimo', pendingScore);
                                    onClose();
                                }}
                                className="w-full bg-red-800 text-white hover:bg-red-700 font-bold text-md py-5 rounded-full shadow-lg border-2 border-white/20 transition-transform active:scale-95"
                            >
                                <X className="mr-2 w-4 h-4" /> SALIR
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
