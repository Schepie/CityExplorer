import React, { useState, useEffect, useRef } from 'react';

const ChatInterface = ({ onCitySelect }) => {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const messagesEndRef = useRef(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        // Initial greeting
        setMessages([{ sender: 'guide', text: "Welcome! Which city would you like to explore today?" }]);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;

        const city = inputText.trim();
        setInputText('');

        // Add user message
        setMessages(prev => [...prev, { sender: 'user', text: city }]);
        setIsLoading(true);

        // Simulate a brief "processing" moment or just immediately call parent
        setMessages(prev => [...prev, { sender: 'guide', text: `Flying to ${city}...` }]);

        if (onCitySelect) {
            await onCitySelect(city);
        }

        setIsLoading(false);
    };

    return (
        <div className="flex flex-col h-full bg-slate-900/50 glass-panel overflow-hidden">
            <div className="p-4 border-b border-white/10">
                <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    City Explorer
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`max-w-[80%] p-3 rounded-2xl ${msg.sender === 'user'
                            ? 'bg-primary self-end rounded-br-none ml-auto'
                            : 'bg-slate-800 text-slate-100 self-start rounded-bl-none'
                            }`}
                    >
                        {msg.text}
                    </div>
                ))}
                {isLoading && (
                    <div className="self-start bg-slate-800 p-3 rounded-2xl rounded-bl-none text-slate-400 text-sm italic">
                        Locating...
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="p-4 border-t border-white/10 flex gap-2">
                <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Enter a city name..."
                    className="flex-1 bg-slate-800/50 border border-white/10 rounded-full px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    disabled={!inputText.trim() || isLoading}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Go
                </button>
            </form>
        </div>
    );
};

export default ChatInterface;
