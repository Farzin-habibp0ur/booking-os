'use client';

import { useState, useEffect, useRef } from 'react';

const API_URL = 'http://localhost:3001/api/v1';

const CONTACTS = [
  { name: 'Emma Wilson', phone: '+14155550201' },
  { name: 'James Thompson', phone: '+14155550202' },
  { name: 'Sofia Rodriguez', phone: '+14155550203' },
  { name: 'New Customer', phone: '+14155550299' },
];

interface Message {
  id: string;
  direction: 'sent' | 'received';
  content: string;
  timestamp: Date;
}

export default function SimulatorPage() {
  const [selectedContact, setSelectedContact] = useState(CONTACTS[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<NodeJS.Timeout>();
  const lastPollRef = useRef<string>(new Date(0).toISOString());

  useEffect(() => {
    // Reset messages when switching contacts
    setMessages([]);
    lastPollRef.current = new Date(0).toISOString();

    // Start polling for outbound messages (responses from the business)
    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/webhook/simulator/outbox?since=${lastPollRef.current}`);
        const outbox = await res.json();
        const relevant = outbox.filter((m: any) => m.to === selectedContact.phone);
        if (relevant.length > 0) {
          lastPollRef.current = new Date().toISOString();
          setMessages((prev) => [
            ...prev,
            ...relevant.map((m: any) => ({
              id: m.externalId,
              direction: 'received' as const,
              content: m.body,
              timestamp: new Date(m.sentAt),
            })),
          ]);
        }
      } catch (e) {
        // API might not be running yet
      }
    };

    poll();
    pollTimerRef.current = setInterval(poll, 2000);
    return () => clearInterval(pollTimerRef.current);
  }, [selectedContact.phone]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    setSending(true);

    const msg: Message = {
      id: `sim_${Date.now()}`,
      direction: 'sent',
      content: newMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, msg]);
    setNewMessage('');

    try {
      await fetch(`${API_URL}/webhook/inbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: selectedContact.phone,
          body: newMessage,
          externalId: msg.id,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (e) {
      console.error('Failed to send to webhook:', e);
    }
    setSending(false);
  };

  return (
    <div className="flex gap-6 p-6">
      {/* Phone frame */}
      <div className="w-[375px] h-[700px] bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border-[8px] border-gray-800">
        {/* WhatsApp header */}
        <div className="bg-[#075e54] text-white px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">
            {selectedContact.name[0]}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Glow Aesthetic Clinic</p>
            <p className="text-[10px] opacity-70">online</p>
          </div>
        </div>

        {/* Chat area */}
        <div
          className="flex-1 overflow-auto p-3 space-y-2"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e5ddd5' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        >
          {messages.length === 0 && (
            <div className="text-center text-gray-400 text-xs mt-8">
              Send a message to start a conversation
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.direction === 'sent' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] px-3 py-2 rounded-lg text-sm shadow-sm ${
                  m.direction === 'sent'
                    ? 'bg-[#dcf8c6] rounded-br-none'
                    : 'bg-white rounded-bl-none'
                }`}
              >
                <p>{m.content}</p>
                <p className="text-[10px] text-gray-500 text-right mt-1">
                  {m.timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="bg-[#f0f0f0] px-3 py-2 flex items-center gap-2">
          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message"
            className="flex-1 bg-white rounded-full px-4 py-2 text-sm outline-none"
          />
          <button
            onClick={sendMessage}
            disabled={sending || !newMessage.trim()}
            className="w-10 h-10 bg-[#075e54] rounded-full flex items-center justify-center text-white disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Contact picker sidebar */}
      <div className="w-64">
        <div className="bg-white rounded-lg shadow-lg p-4">
          <h2 className="font-bold text-lg mb-3">Simulate As</h2>
          <p className="text-xs text-gray-500 mb-4">Pick a contact to send messages from</p>
          <div className="space-y-2">
            {CONTACTS.map((c) => (
              <button
                key={c.phone}
                onClick={() => setSelectedContact(c)}
                className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${
                  selectedContact.phone === c.phone
                    ? 'bg-[#075e54] text-white'
                    : 'hover:bg-gray-100'
                }`}
              >
                <p className="font-medium">{c.name}</p>
                <p
                  className={`text-xs ${selectedContact.phone === c.phone ? 'text-white/70' : 'text-gray-400'}`}
                >
                  {c.phone}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-6 p-3 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-sm mb-2">How it works</h3>
            <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
              <li>Pick a contact above</li>
              <li>Type a message in the phone</li>
              <li>Message hits the API webhook</li>
              <li>See it appear in the Inbox</li>
              <li>Reply from Inbox — see it here</li>
            </ol>
          </div>

          <div className="mt-4 text-xs text-gray-400 text-center">
            <a href="http://localhost:3000" target="_blank" className="underline">
              Open Dashboard
            </a>
            {' · '}
            Port 3002
          </div>
        </div>
      </div>
    </div>
  );
}
