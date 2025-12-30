"use client";

import { useState, useEffect, useRef, useOptimistic, startTransition } from 'react';
import { MessageCircle, X, Send, Trash2, Pin, PinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePathname } from 'next/navigation';
import { BeerGame } from '@/components/BeerGame';
import { HighScore, getHighScore } from '@/app/actions';

interface ChatMessage {
    id: string;
    nombre: string;
    mensaje: string;
    fecha: number;
    reacciones?: Record<string, number>;
    isPinned?: boolean;
    isAdminMessage?: boolean;
}

const REACTION_EMOJIS = ['😂', '❤️', '🔥', '🍻', '🥳', '💩'];

export function GlobalChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [pinnedMessage, setPinnedMessage] = useState<ChatMessage | null>(null);
    const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
    const [showGame, setShowGame] = useState(false);
    const [headerHighScore, setHeaderHighScore] = useState<HighScore | null>(null);

    // Fetch HighScore on open
    useEffect(() => {
        if (isOpen) {
            getHighScore().then(setHeaderHighScore);
        }
    }, [isOpen]);

    const pathname = usePathname();
    const isAdmin = pathname === '/admin';

    const [optimisticMessages, addOptimisticAction] = useOptimistic<ChatMessage[], any>(
        messages,
        (state, action) => {
            if (action.type === 'add') return [...state, action.payload];
            if (action.type === 'delete') return state.filter(m => m.id !== action.payload.id);
            if (action.type === 'react') {
                return state.map(m => {
                    if (m.id === action.payload.id) {
                        const newReactions = { ...(m.reacciones || {}) };
                        newReactions[action.payload.emoji] = (newReactions[action.payload.emoji] || 0) + 1;
                        return { ...m, reacciones: newReactions };
                    }
                    return m;
                });
            }
            return state;
        }
    );

    const [newMessage, setNewMessage] = useState('');
    const [userName, setUserName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Initial load and polling
    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch('/api/chat', { cache: 'no-store', next: { revalidate: 0 } });
                const data = await res.json();
                if (data.messages) setMessages(data.messages.reverse());
                if (data.pinnedMessage) setPinnedMessage(data.pinnedMessage);
            } catch {
                // silent
            }
        };

        if (isOpen) {
            load();
            const interval = setInterval(load, 5000);
            return () => clearInterval(interval);
        }
    }, [isOpen]);

    // Local Storage Name
    useEffect(() => {
        const saved = localStorage.getItem('chat_username');
        if (saved) setUserName(saved);
    }, []);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newMessage.trim() || !userName.trim()) return;

        const tempId = Math.random().toString();
        const msg: ChatMessage = {
            id: tempId,
            nombre: isAdmin ? `${userName} (Admin)` : userName,
            mensaje: newMessage,
            fecha: Date.now(),
            reacciones: {},
            isAdminMessage: isAdmin
        };

        startTransition(() => addOptimisticAction({ type: 'add', payload: msg }));
        setNewMessage('');

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: userName, mensaje: newMessage, id: tempId, isAdmin }),
                cache: 'no-store'
            });
            const data = await res.json();
            if (data.messages) setMessages(data.messages.reverse());
        } catch { /* silent */ }
    };

    const handleDelete = async (id: string) => {
        startTransition(() => addOptimisticAction({ type: 'delete', payload: { id } }));
        await fetch('/api/chat', { method: 'DELETE', body: JSON.stringify({ id }) });
    };

    const handlePin = async (msg: ChatMessage) => {
        setPinnedMessage(msg); // Optimistic
        await fetch('/api/chat', {
            method: 'PATCH',
            body: JSON.stringify({ action: 'pin', payload: msg })
        });
    };

    const handleUnpin = async () => {
        setPinnedMessage(null);
        await fetch('/api/chat', { method: 'PATCH', body: JSON.stringify({ action: 'unpin' }) });
    };

    const handleReact = async (id: string, emoji: string) => {
        startTransition(() => addOptimisticAction({ type: 'react', payload: { id, emoji } }));
        await fetch('/api/chat', {
            method: 'PATCH',
            body: JSON.stringify({ action: 'react', id, emoji })
        });
    };

    const scrollToBottom = () => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    };

    useEffect(() => {
        scrollToBottom();
    }, [optimisticMessages, isOpen]);

    // Helper for relative time
    const getRelativeTime = (timestamp: number) => {
        const diff = Date.now() - timestamp;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Ahora mismo';
        if (mins < 60) return `Hace ${mins} min`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `Hace ${hours} h`;
        return new Date(timestamp).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    };

    const lastMessageTime = messages.length > 0 ? messages[messages.length - 1].fecha : 0;
    const headerStatus = messages.length === 0 ? 'Sin mensajes' : `Último mensaje: ${getRelativeTime(lastMessageTime)}`;

    return (
        <>
            {!isOpen && (
                <Button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-4 right-4 md:bottom-6 md:right-6 h-12 w-12 rounded-full shadow-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:scale-105 transition-all z-50 animate-in zoom-in opacity-80 hover:opacity-100"
                >
                    <MessageCircle className="h-6 w-6 text-white" />
                </Button>
            )}

            {isOpen && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[90vw] max-w-[380px] md:left-auto md:translate-x-0 md:bottom-6 md:right-6 md:w-[400px] h-[600px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50 animate-in slide-in-from-bottom-5 overflow-hidden font-sans">
                    {/* Header */}
                    <div className="p-3 bg-gradient-to-r from-indigo-600 to-purple-700 text-white flex justify-between items-center shadow-md z-10 shrink-0">
                        <div>
                            <h3 className="font-bold flex items-center gap-2 text-sm">
                                Chat Xa Chejei 🍻
                                {isAdmin && <span className="text-[9px] bg-white/20 px-1 rounded">ADMIN</span>}
                            </h3>
                            {headerHighScore ? (
                                <button
                                    onClick={() => setShowGame(true)}
                                    className="text-[10px] bg-yellow-400 text-purple-900 px-1.5 py-0.5 rounded-full font-bold animate-pulse hover:scale-105 transition-transform mt-0.5"
                                >
                                    🎮 Récord: {headerHighScore.name} - {headerHighScore.score}
                                </button>
                            ) : (
                                <button
                                    onClick={() => setShowGame(true)}
                                    className="text-[10px] text-indigo-100 opacity-90 hover:text-white hover:underline mt-0.5 flex items-center gap-1"
                                >
                                    🎮 ¡Xogar a Atrapa a Cerveza!
                                </button>
                            )}
                        </div>
                        <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setShowGame(true)} className="hover:bg-white/10 rounded-full h-8 w-8 text-white" title="Jugar">
                                <span className="text-lg">🎮</span>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="hover:bg-white/10 rounded-full h-8 w-8 text-white">
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>

                    {/* Game Overlay */}
                    {showGame && (
                        <BeerGame
                            playerName={userName || 'Anónimo'}
                            onClose={() => {
                                setShowGame(false);
                                getHighScore().then(setHeaderHighScore); // Refresh record when closing
                            }}
                        />
                    )}

                    {/* Pinned Message */}
                    {pinnedMessage && (
                        <div
                            onClick={() => {
                                // Find message in list and scroll to it if possible
                                const el = document.getElementById(`msg-${pinnedMessage.id}`);
                                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            className="bg-amber-50 border-b border-amber-100 p-2 flex items-start gap-2 cursor-pointer hover:bg-amber-100 transition-colors"
                        >
                            <div className="bg-amber-200 p-1 rounded">
                                <Pin className="h-3 w-3 text-amber-700" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-amber-800 line-clamp-1">{pinnedMessage.nombre}</p>
                                <p className="text-xs text-amber-700 line-clamp-1">{pinnedMessage.mensaje}</p>
                            </div>
                            {isAdmin && (
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleUnpin(); }}>
                                    <X className="h-3 w-3 text-amber-500" />
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Messages */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#e4ddd6] bg-opacity-30 scroll-smooth">
                        {optimisticMessages.length === 0 ? (
                            <div className="text-center text-slate-400 py-10 opacity-70">
                                <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                <p>El chat está vacío...</p>
                            </div>
                        ) : (
                            optimisticMessages.map((msg) => {
                                const isMe = msg.nombre === userName || msg.nombre === `${userName} (Admin)`;
                                const isAdminMsg = msg.isAdminMessage;

                                return (
                                    <div key={msg.id} id={`msg-${msg.id}`} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group mb-4`}>
                                        {/* Controls for Admin */}
                                        {isAdmin && (
                                            <div className="flex gap-1 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleDelete(msg.id)} className="p-1 bg-red-100 rounded-full hover:bg-red-200 text-red-600"><Trash2 className="h-3 w-3" /></button>
                                                <button onClick={() => handlePin(msg)} className="p-1 bg-amber-100 rounded-full hover:bg-amber-200 text-amber-600"><Pin className="h-3 w-3" /></button>
                                            </div>
                                        )}

                                        <div
                                            onClick={() => setActiveMessageId(activeMessageId === msg.id ? null : msg.id)}
                                            className={`relative p-2 rounded-xl text-sm max-w-[85%] shadow-sm flex flex-col gap-0.5 cursor-pointer transition-all active:scale-[0.98]
                                                ${isAdminMsg
                                                    ? 'bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-300 text-amber-900'
                                                    : isMe
                                                        ? 'bg-indigo-600 text-white rounded-tr-none'
                                                        : 'bg-white text-slate-800 rounded-tl-none border border-slate-200'
                                                }`}
                                        >
                                            {/* Name Header */}
                                            <span className={`text-[10px] font-bold leading-none mb-1 block ${isMe ? 'text-indigo-200' : 'text-indigo-600'} ${isAdminMsg ? '!text-amber-800' : ''}`}>
                                                {msg.nombre}
                                            </span>

                                            {/* Body & Time */}
                                            <div className="relative">
                                                <span className="leading-tight break-words pr-2">{msg.mensaje}</span>
                                                <span className={`text-[9px] float-right mt-1 ml-1 select-none opacity-70 ${isAdminMsg ? '!text-amber-800/70 font-semibold' : isMe ? 'text-indigo-100' : 'text-slate-500'}`}>
                                                    {new Date(msg.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>

                                            {/* Reactions Display (Count) */}
                                            {msg.reacciones && Object.entries(msg.reacciones).length > 0 && (
                                                <div className="flex flex-wrap justify-end gap-1 mt-1 mb-1 pt-1 border-t border-black/5">
                                                    {Object.entries(msg.reacciones).map(([emoji, count]) => (
                                                        <span key={emoji} className="text-[10px] bg-white/40 px-1 py-0.5 rounded-full shadow-sm border border-black/5 flex items-center gap-0.5 leading-none">
                                                            <span>{emoji}</span>
                                                            {count > 1 && <span className="font-bold opacity-80">{count}</span>}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Reaction Toolbar (Click Triggered) */}
                                            {activeMessageId === msg.id && (
                                                <div className={`absolute -bottom-10 z-20 flex animate-in zoom-in-50 duration-200 ${isMe ? 'right-0 origin-top-right' : 'left-0 origin-top-left'}`}>
                                                    <div className="bg-white rounded-full shadow-xl border border-indigo-100 p-1 flex gap-1 items-center min-w-max">
                                                        {REACTION_EMOJIS.map(emoji => (
                                                            <button
                                                                key={emoji}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleReact(msg.id, emoji);
                                                                    setActiveMessageId(null); // Close after react
                                                                }}
                                                                className="hover:scale-125 hover:bg-indigo-50 rounded-full w-8 h-8 flex items-center justify-center transition-all text-xl leading-none active:scale-95 flex-shrink-0"
                                                            >
                                                                {emoji}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Input */}
                    <div className="p-3 bg-white border-t space-y-2 shrink-0">
                        {!userName && <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded">¡Ponte nombre para hablar!</p>}
                        <div className="flex gap-2">
                            <Input
                                placeholder="Tu Nombre"
                                value={userName}
                                onChange={(e) => {
                                    setUserName(e.target.value);
                                    localStorage.setItem('chat_username', e.target.value);
                                }}
                                className="w-1/3 text-xs h-9 bg-slate-50 font-bold text-indigo-900"
                            />
                            <form
                                onSubmit={handleSend}
                                className="flex-1 flex gap-2"
                            >
                                <Input
                                    ref={inputRef}
                                    placeholder="Mensaje..."
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    className="flex-1 h-9"
                                    disabled={!userName}
                                />
                                <Button type="submit" size="icon" className="h-9 w-9 bg-indigo-600 hover:bg-indigo-700" disabled={!newMessage.trim() || !userName}>
                                    <Send className="h-4 w-4" />
                                </Button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
