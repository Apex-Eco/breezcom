'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';

interface AuthModalProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, name: string) => Promise<void>;
  onClose: () => void;
}

export default function AuthModal({ onLogin, onRegister }: AuthModalProps) {
  const t = useTranslations('auth');
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await onLogin(email, password);
        toast.success(t('loginSuccess'));
      } else {
        await onRegister(email, password, name);
        toast.success(t('registerSuccess'));
      }
    } catch (error: any) {
      toast.error(error.message || t('authFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-4">
      <div className="absolute inset-0 page-shell"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(0,255,136,0.15),transparent_60%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(0,212,255,0.1),transparent_60%)]"></div>
      
      <div className="glass-strong rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all relative z-10 fade-in">
        {/* Header with Breez style */}
        <div className="relative bg-gradient-to-br from-green-500/20 via-emerald-500/20 to-cyan-500/20 p-10 text-center border-b border-green-500/30">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,136,0.2),transparent_70%)]"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-center space-x-3 mb-6">
              <div className="relative">
                <div className="w-14 h-14 bg-[#9fe870] rounded-full flex items-center justify-center">
                  <span className="text-3xl font-black text-[#163300]">+</span>
                </div>
              </div>
              <span className="text-4xl font-black text-primary">Breez</span>
            </div>
            <h2 className="text-3xl font-black text-primary mb-2">
              {isLogin ? t('welcome') : t('createAccount')}
            </h2>
            <p className="text-secondary text-sm">
              {isLogin ? t('loginSubtitle') : t('registerSubtitle')}
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="p-8 bg-surface">
          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
              <div className="space-y-2">
                <label className="block text-sm font-bold text-secondary mb-2">
                  {t('fullName')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="wise-input w-full pl-12 pr-4 py-3.5"
                    placeholder={t('fullNamePlaceholder')}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-bold text-secondary mb-2">
                {t('email')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="wise-input w-full pl-12 pr-4 py-3.5"
                  placeholder="your.email@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-secondary mb-2">
                {t('password')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="wise-input w-full pl-12 pr-4 py-3.5"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="wise-btn w-full py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('processing')}
                </span>
              ) : (
                isLogin ? t('signIn') : t('createAccountButton')
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setEmail('');
                setPassword('');
                setName('');
              }}
              className="text-sm text-muted hover:text-green-400 font-medium transition-colors"
            >
              {isLogin ? (
                <>
                  {t('noAccount')}{' '}
                  <span className="text-green-400 font-bold">{t('register')}</span>
                </>
              ) : (
                <>
                  {t('haveAccount')}{' '}
                  <span className="text-green-400 font-bold">{t('signIn')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
