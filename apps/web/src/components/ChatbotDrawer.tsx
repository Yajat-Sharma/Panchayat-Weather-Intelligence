"use client";

import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, MapPin, MessagesSquare, RotateCw, Sprout, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { api } from '../lib/api';
import { IconButton, cx } from './ui';

interface Props {
  open: boolean;
  onClose: () => void;
  selectedGpcode: string | null;
  panchayatName: string | null;
  selectedCrop: string | null;
  isDesktop: boolean;
}

type Message = { id: number; role: 'bot' | 'user'; text: string; failed?: boolean };

let nextId = 1;

export default function ChatbotDrawer({ open, onClose, selectedGpcode, panchayatName, selectedCrop, isDesktop }: Props) {
  const { t, language } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!open) return;
    if (isDesktop) {
      const id = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 250);
      return () => clearTimeout(id);
    }
  }, [open, isDesktop]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const suggestions = ['ai.q1', 'ai.q2', 'ai.q3', 'ai.q4', 'ai.q5'].map(k => t(k));

  const ask = async (msgId: number, text: string, prior: Message[]) => {
    setIsLoading(true);
    try {
      const history = prior
        .filter(m => !m.failed)
        .map(m => ({ role: m.role, content: m.text }));
      const data = await api.chat({
        gpcode: selectedGpcode || '',
        crop: selectedCrop || '',
        language,
        message: text,
        history,
      });
      setMessages(prev => [...prev, { id: nextId++, role: 'bot', text: data.answer }]);
    } catch (error) {
      console.error('Chatbot error:', error);
      setMessages(prev => prev.map(m => (m.id === msgId ? { ...m, failed: true } : m)));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = (raw: string) => {
    const text = raw.trim();
    if (!text || isLoading) return;
    const prior = messages;
    const id = nextId++;
    setMessages([...prior, { id, role: 'user', text }]);
    setInput('');
    ask(id, text, prior);
  };

  const retry = (msg: Message) => {
    if (isLoading) return;
    const idx = messages.findIndex(m => m.id === msg.id);
    const prior = messages.slice(0, idx);
    setMessages([...prior, { ...msg, failed: false }]);
    ask(msg.id, msg.text, prior);
  };

  const hasConversation = messages.length > 0;

  return (
    <>
      {/* Scrim (mobile sheet only) */}
      {!isDesktop && (
        <div
          aria-hidden
          onClick={onClose}
          className={cx(
            'fixed inset-0 z-[900] bg-black/35 transition-opacity duration-500',
            open ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        />
      )}

      <div
        role="dialog"
        aria-modal={!isDesktop}
        aria-label={t('nav.aiCopilot')}
        inert={!open}
        className={cx(
          'fixed z-[1000] flex flex-col overflow-hidden glass-strong shadow-pop',
          isDesktop
            ? 'right-5 bottom-5 w-[400px] h-[min(680px,calc(100dvh-40px))] rounded-[26px] origin-bottom-right transition-[opacity,transform] duration-500 ease-[var(--ease-spring)]'
            : 'inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top)+10px)] rounded-t-[28px] transition-transform duration-500 ease-[var(--ease-sheet)]',
          isDesktop
            ? open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.9] translate-y-3 pointer-events-none'
            : open ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        {/* Header */}
        <div className="shrink-0 px-4 pt-3 pb-3 border-b border-separator">
          {!isDesktop && <div className="mx-auto mb-2 w-9 h-[5px] rounded-full bg-label-3/60" />}
          <div className="flex items-center gap-3">
            <span className="grid place-items-center w-9 h-9 rounded-full text-white bg-accent shrink-0">
              <MessagesSquare size={17} />
            </span>
            <div className="flex-1 min-w-0">
              <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-label">{t('nav.aiCopilot')}</h2>
              <p className="text-[12.5px] text-label-2 truncate">{t('ai.subtitle')}</p>
            </div>
            <IconButton label={t('ai.close')} onClick={onClose} variant="fill" className="w-8 h-8">
              <X size={16} strokeWidth={2.5} />
            </IconButton>
          </div>
          <div className="flex gap-1.5 mt-3 text-[12px] font-medium">
            <span className={cx('flex items-center gap-1 rounded-full px-2.5 py-1 min-w-0', panchayatName ? 'bg-accent/10 text-accent-ink' : 'bg-fill-2 text-label-2')}>
              <MapPin size={12} className="shrink-0" /><span className="truncate max-w-[160px]">{panchayatName || t('ai.noPanchayat')}</span>
            </span>
            <span className={cx('flex items-center gap-1 rounded-full px-2.5 py-1', selectedCrop ? 'bg-green/14 text-green-ink' : 'bg-fill-2 text-label-2')}>
              <Sprout size={12} />{selectedCrop ? t(`ag.${selectedCrop.toLowerCase()}`) : t('ai.noCrop')}
            </span>
          </div>
        </div>

        {/* Conversation */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain thin-scrollbar px-4 py-4 flex flex-col gap-2">
          <Bubble role="bot">{t('ai.greeting')}</Bubble>

          {!hasConversation && (
            <div className="mt-3 flex flex-col items-start gap-2 animate-fade">
              <div className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-label-2 px-1">{t('ai.suggested')}</div>
              {suggestions.map((q, i) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="pressable animate-rise text-left text-[14px] text-accent-ink bg-accent/10 hover:bg-accent/15 rounded-[16px] px-3.5 py-2"
                  style={{ '--i': i + 1 } as React.CSSProperties}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {messages.map(m => (
            <div key={m.id} className={cx('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}>
              <Bubble role={m.role} failed={m.failed}>{m.text}</Bubble>
              {m.failed && (
                <div className="flex items-center gap-2 mt-1 mr-1 text-[12px] text-red animate-fade">
                  {t('ai.error')}
                  <button onClick={() => retry(m)} className="flex items-center gap-1 font-semibold text-accent">
                    <RotateCw size={12} /> {t('ai.retry')}
                  </button>
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="self-start flex items-center gap-1 rounded-[20px] rounded-bl-[6px] bg-fill-2 px-4 py-3.5 animate-pop origin-bottom-left" aria-label={t('ai.thinking')}>
              {[0, 1, 2].map(i => (
                <span key={i} className="typing-dot w-[7px] h-[7px] rounded-full bg-label-2" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          )}
        </div>

        {/* Quick suggestions once a conversation is underway */}
        {hasConversation && (
          <div className="shrink-0 -mb-1">
            <div className="flex gap-1.5 overflow-x-auto hide-scrollbar px-4 pb-2 fade-x">
              {suggestions.map(q => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  disabled={isLoading}
                  className="pressable shrink-0 text-[12.5px] text-label bg-fill-2 hover:bg-fill rounded-full px-3 py-1.5 whitespace-nowrap disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={e => { e.preventDefault(); handleSend(input); }}
          className="shrink-0 px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
        >
          <div className="flex items-center gap-2 rounded-full bg-fill-2 focus-within:bg-fill focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_25%,transparent)] transition-all pl-4 pr-1.5 h-11">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={t('ai.placeholder')}
              aria-label={t('ai.placeholder')}
              enterKeyHint="send"
              className="flex-1 min-w-0 bg-transparent outline-none text-[16px] md:text-[15px] text-label placeholder:text-label-3"
            />
            <button
              type="submit"
              aria-label={t('ai.send')}
              disabled={!input.trim() || isLoading}
              className={cx(
                'grid place-items-center w-8 h-8 rounded-full bg-accent text-white shrink-0 transition-all duration-300 ease-[var(--ease-spring)]',
                input.trim() && !isLoading ? 'scale-100 opacity-100' : 'scale-75 opacity-0 pointer-events-none'
              )}
            >
              <ArrowUp size={17} strokeWidth={2.6} />
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function Bubble({ role, children, failed }: { role: 'bot' | 'user'; children: React.ReactNode; failed?: boolean }) {
  return (
    <div
      className={cx(
        'max-w-[85%] px-3.5 py-2 text-[15px] leading-[1.4] whitespace-pre-wrap animate-pop break-words',
        role === 'user'
          ? cx('self-end rounded-[20px] rounded-br-[6px] text-white origin-bottom-right', failed ? 'bg-accent/50' : 'bg-accent')
          : 'self-start rounded-[20px] rounded-bl-[6px] bg-fill-2 text-label origin-bottom-left'
      )}
    >
      {children}
    </div>
  );
}
