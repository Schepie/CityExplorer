import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const LoginModal = () => {
    const { requestMagicLink, verifyAccessCode, isLoading: authLoading } = useAuth();
    const [email, setEmail] = useState('');
    const [accessCode, setAccessCode] = useState('');
    const [loginMode, setLoginMode] = useState('request'); // request | code
    const [status, setStatus] = useState('idle'); // idle | loading | success | error
    const [errorMsg, setErrorMsg] = useState('');

    const handleRequestLink = async (e) => {
        e.preventDefault();
        if (!email) return;

        setStatus('loading');
        setErrorMsg('');

        try {
            const success = await requestMagicLink(email);
            if (success === 'blocked') return;
            if (success) {
                setStatus('success');
            } else {
                setStatus('error');
                setErrorMsg('Failed to send link. Please try again.');
            }
        } catch (err) {
            setStatus('error');
            setErrorMsg(err.message);
        }
    };

    const handleVerifyCode = async (e) => {
        e.preventDefault();
        if (!email || !accessCode) return;

        setStatus('loading');
        setErrorMsg('');

        try {
            const success = await verifyAccessCode(email, accessCode);
            if (success === 'blocked') return;
            // Success handles redirection in AuthContext
        } catch (err) {
            setStatus('error');
            setErrorMsg(err.message || 'Invalid or expired code.');
        }
    };

    if (authLoading) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-8 relative overflow-hidden">
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] rounded-full pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 blur-[50px] rounded-full pointer-events-none" />

                <div className="relative z-10">
                    <h2 className="text-2xl font-bold text-white mb-2">Welcome to CityExplorer</h2>
                    <p className="text-slate-400 mb-6 text-sm">
                        Sign in to access premium AI features.
                    </p>

                    {status === 'success' ? (
                        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center">
                            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-green-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h3 className="text-white font-bold mb-2">Request Received</h3>
                            <p className="text-slate-400 text-sm">
                                Your access credentials for <span className="text-white">{email}</span> will be manually approved and forwarded by our administrator.
                            </p>
                            <div className="mt-6 flex flex-col gap-3">
                                <button
                                    onClick={() => {
                                        setLoginMode('code');
                                        setStatus('idle');
                                    }}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg text-sm transition-colors"
                                >
                                    I received my Access Code
                                </button>
                                <button
                                    onClick={() => setStatus('idle')}
                                    className="text-xs text-slate-500 hover:text-white transition-colors"
                                >
                                    Try a different email
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Tabs */}
                            <div className="flex bg-slate-800/50 p-1 rounded-xl mb-6">
                                <button
                                    onClick={() => setLoginMode('request')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${loginMode === 'request' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    Request Access
                                </button>
                                <button
                                    onClick={() => setLoginMode('code')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${loginMode === 'code' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    Enter Access Code
                                </button>
                            </div>

                            <form onSubmit={loginMode === 'request' ? handleRequestLink : handleVerifyCode} className="space-y-4">
                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-white font-black mb-2">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                    />
                                </div>

                                {loginMode === 'code' && (
                                    <div>
                                        <label className="block text-xs uppercase tracking-wider text-white font-black mb-2">
                                            6-Digit Access Code
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            maxLength={6}
                                            value={accessCode}
                                            onChange={(e) => setAccessCode(e.target.value.replace(/[^0-9]/g, ''))}
                                            placeholder="000000"
                                            className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-center tracking-[1em] text-xl font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                        />
                                    </div>
                                )}

                                {status === 'error' && (
                                    <div className="text-red-400 text-xs bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                                        {errorMsg}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={status === 'loading'}
                                    className="w-full bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {status === 'loading' ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Processing...
                                        </>
                                    ) : (
                                        loginMode === 'request' ? "Request Magic Link" : "Sign In with Code"
                                    )}
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoginModal;
