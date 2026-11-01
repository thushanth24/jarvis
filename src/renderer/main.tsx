import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Message = { role: 'user' | 'assistant'; text: string; time: string };
const initial: Message[] = [{ role: 'assistant', text: 'Good to see you. I’m ready for local commands.', time: 'NOW' }];

function App() {
  const [messages, setMessages] = useState<Message[]>(initial);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  async function submit(event?: React.FormEvent) {
    event?.preventDefault(); const command = input.trim(); if (!command || busy) return;
    setInput(''); setBusy(true); const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((current) => [...current, { role: 'user', text: command, time }]);
    const result = await window.jarvis.executeCommand(command);
    setMessages((current) => [...current, { role: 'assistant', text: result.message, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]); setBusy(false); inputRef.current?.focus();
  }
  return <main className="shell"><aside className="rail"><div className="brand"><span className="brand-mark">J</span><span>JARVIS</span></div><nav><button className="active">◉ <span>Assistant</span></button><button>☷ <span>Tasks</span></button><button>◇ <span>Memory</span></button><button>⚙ <span>Settings</span></button></nav><div className="rail-footer"><span className="status-dot" /> Local mode active<br /><small>No cloud provider connected</small></div></aside><section className="content"><header><div><p className="eyebrow">PERSONAL COMMAND CENTER</p><h1>How can I help?</h1></div><div className="header-status"><span className="pulse" /> READY <button className="icon-button" title="Minimize to tray" onClick={() => window.jarvis.toggleWindow()}>—</button></div></header><div className="conversation">{messages.map((message, index) => <div className={`message ${message.role}`} key={`${message.time}-${index}`}><div className="avatar">{message.role === 'assistant' ? 'J' : 'YOU'}</div><div><div className="message-meta">{message.role === 'assistant' ? 'JARVIS' : 'YOU'} <span>{message.time}</span></div><p>{message.text}</p></div></div>)}{busy && <div className="message assistant"><div className="avatar">J</div><div><div className="message-meta">JARVIS</div><p className="typing">Working<span>.</span><span>.</span><span>.</span></p></div></div>}</div><form className="composer" onSubmit={submit}><button type="button" className="mic" title="Voice input is planned for Phase 2">⌁</button><input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask JARVIS anything…" disabled={busy} /><button className="send" type="submit">SEND <span>↵</span></button></form><p className="hint">Try <button onClick={() => setInput('Open VS Code')}>“Open VS Code”</button> or <button onClick={() => setInput('What is the time?')}>“What is the time?”</button> · Ctrl + Shift + J toggles the window</p></section></main>;
}
createRoot(document.getElementById('root')!).render(<App />);
