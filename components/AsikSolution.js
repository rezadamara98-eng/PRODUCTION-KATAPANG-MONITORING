"use client";

import { useRef, useState } from "react";

export default function AsikSolution() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Halo, saya ASIK. Tanya saya soal data produksi lini STRONG PONT LINE dan PA — misalnya efisiensi, reject rate, atau perbandingan antar lini.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mendapat respon");
      setMessages((prev) => [...prev, { role: "assistant", content: json.reply }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }, 50);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--steel)",
        borderRadius: 4,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        height: 560,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 12,
          letterSpacing: "0.1em",
          color: "var(--text-faint)",
          textTransform: "uppercase",
          marginBottom: 14,
        }}
      >
        ASIK Solution &middot; Room Chat AI
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginBottom: 14,
          paddingRight: 4,
        }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              background: m.role === "user" ? "var(--teal)" : "var(--panel-raised)",
              color: m.role === "user" ? "#1b1e20" : "var(--text)",
              padding: "10px 14px",
              borderRadius: 6,
              maxWidth: "75%",
              fontSize: 14,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
            }}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div
            style={{
              alignSelf: "flex-start",
              color: "var(--text-faint)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
            }}
          >
            ASIK sedang mengetik...
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            color: "var(--red)",
            fontSize: 12,
            marginBottom: 8,
            fontFamily: "var(--font-mono)",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tanya soal data produksi..."
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            background: "var(--panel-raised)",
            border: "1px solid var(--steel)",
            borderRadius: 4,
            color: "var(--text)",
            padding: "10px 12px",
            fontSize: 14,
            fontFamily: "var(--font-body)",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{
            background: "var(--teal)",
            color: "#1b1e20",
            border: "none",
            borderRadius: 4,
            padding: "0 20px",
            fontWeight: 600,
            cursor: loading ? "default" : "pointer",
            opacity: loading || !input.trim() ? 0.6 : 1,
          }}
        >
          Kirim
        </button>
      </div>
    </div>
  );
}
