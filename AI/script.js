(() => {
  const conversation = document.getElementById("conversation");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("message-input");
  const typing = document.getElementById("typing-indicator");
  const suggestions = document.getElementById("suggestions");
  const sendButton = form.querySelector(".send-button");
  const historyPanel = document.getElementById("chat-history");
  const historyList = document.getElementById("chat-history-list");
  const robotStage = document.getElementById("robot-stage");
  const robotStateLabel = document.getElementById("robot-state-label");
  let identity = "demo-account";
  try { identity = sessionStorage.getItem("careplusDemoIdentity") || identity; } catch { /* Use the browser demo account when session storage is unavailable. */ }
  const usageKey = `careplusAiAttempts:${identity.toLowerCase()}`;
  const usageEventKey = "careplusAiUsageEventsV1";
  const accessKey = `careplusAiAccessUntil:${identity.toLowerCase()}`;
  const historyKey = `careplusAiChatHistory:${identity.toLowerCase()}`;
  let conversations = [];
  let currentConversationId = `${Date.now()}`;
  try { conversations = JSON.parse(localStorage.getItem(historyKey) || "[]"); if (!Array.isArray(conversations)) conversations = []; } catch { conversations = []; }
  let accessUntil = 0;
  try { accessUntil = Number(localStorage.getItem(accessKey)) || 0; } catch { /* The current tab still enforces the free attempt limit. */ }
  let attemptsUsed = 0;
  try { attemptsUsed = Math.min(3, Math.max(0, Number(localStorage.getItem(usageKey)) || 0)); } catch { /* The current tab still enforces the limit. */ }
  const attemptsLabel = document.getElementById("attempts-remaining");
  const paymentPrompt = document.getElementById("payment-prompt");
  let isGenerating = false;
  let responseTimer;
  let robotTimer;
  let accessTimer;

  function renderUsage() {
    const remaining = Math.max(0, 3 - attemptsUsed);
    try { accessUntil = Number(localStorage.getItem(accessKey)) || 0; } catch { /* Keep the current access state. */ }
    const hasPaidAccess = accessUntil > Date.now();
    window.clearTimeout(accessTimer);
    if (hasPaidAccess) accessTimer = window.setTimeout(renderUsage, accessUntil - Date.now());
    attemptsLabel.textContent = hasPaidAccess
      ? `Premium access active until ${new Date(accessUntil).toLocaleString()}.`
      : `${remaining} free ${remaining === 1 ? "attempt" : "attempts"} remaining.`;
    paymentPrompt.hidden = remaining !== 0 || hasPaidAccess;
    input.disabled = (!hasPaidAccess && remaining === 0) || isGenerating;
    sendButton.disabled = (!hasPaidAccess && remaining === 0) || isGenerating;
    document.querySelectorAll(".suggestion-card").forEach(button => { button.disabled = !hasPaidAccess && remaining === 0; });
  }

  function setRobotState(state, label, returnToIdleAfter = 0) {
    window.clearTimeout(robotTimer);
    robotStage.classList.remove("is-greeting", "is-thinking", "is-ready");
    robotStage.dataset.state = state;
    if (state !== "idle") robotStage.classList.add(`is-${state}`);
    robotStateLabel.textContent = label;
    if (returnToIdleAfter) {
      robotTimer = window.setTimeout(() => setRobotState("idle", "Ready when you are"), returnToIdleAfter);
    }
  }

  function addMessage(role, text, action) {
    const isUser = role === "user";
    const article = document.createElement("article");
    article.className = `message ${isUser ? "user-message" : "assistant-message"}`;
    article.dataset.role = role;
    article.dataset.text = text;

    if (!isUser) {
      const avatar = document.createElement("div");
      avatar.className = "message-avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = "CP";
      article.append(avatar);
    }

    const content = document.createElement("div");
    content.className = "message-content";
    const name = document.createElement("span");
    name.className = "message-name";
    name.textContent = isUser ? "You" : "CarePlus Assistant - Demo";
    const body = document.createElement("p");
    body.textContent = text;
    const time = document.createElement("time");
    time.dateTime = new Date().toISOString();
    time.textContent = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date());
    content.append(name, body);

    if (action) {
      const link = document.createElement("a");
      link.className = "message-link";
      link.href = action.href;
      link.textContent = `${action.label} `;
      article.dataset.actionHref = action.href;
      article.dataset.actionLabel = action.label;
      content.append(link);
    }

    content.append(time);
    article.append(content);
    conversation.insertBefore(article, typing);
    conversation.scrollTop = conversation.scrollHeight;
    saveCurrentConversation();
  }

  function getCurrentMessages() {
    return [...conversation.querySelectorAll(".message")].map(article => ({
      role: article.dataset.role || (article.classList.contains("user-message") ? "user" : "assistant"),
      text: article.dataset.text || article.querySelector(".message-content p")?.textContent || "",
      action: article.dataset.actionHref ? { href: article.dataset.actionHref, label: article.dataset.actionLabel || "Open" } : null,
      time: article.querySelector("time")?.textContent || ""
    })).filter(message => message.text);
  }

  function saveCurrentConversation() {
    const messages = getCurrentMessages();
    const userMessage = messages.find(message => message.role === "user");
    if (!userMessage) return;
    const existing = conversations.findIndex(item => item.id === currentConversationId);
    const record = { id: currentConversationId, title: userMessage.text.slice(0, 58), updated: Date.now(), messages };
    if (existing >= 0) conversations[existing] = record; else conversations.unshift(record);
    conversations.sort((a, b) => b.updated - a.updated);
    conversations = conversations.slice(0, 30);
    try { localStorage.setItem(historyKey, JSON.stringify(conversations)); } catch { /* Conversation history is optional when browser storage is unavailable. */ }
    renderHistory();
  }

  function renderHistory() {
    historyList.replaceChildren();
    if (!conversations.length) {
      const empty = document.createElement("p");
      empty.className = "history-empty";
      empty.textContent = "Your saved conversations will appear here.";
      historyList.append(empty);
      return;
    }
    conversations.forEach(item => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "history-item";
      button.textContent = item.title || "Conversation";
      button.addEventListener("click", () => openConversation(item.id));
      historyList.append(button);
    });
  }

  function openConversation(id) {
    const item = conversations.find(record => record.id === id);
    if (!item) return;
    currentConversationId = item.id;
    conversation.querySelectorAll(".message").forEach(node => node.remove());
    item.messages.forEach(message => addMessage(message.role, message.text, message.action));
    suggestions.hidden = true;
    historyPanel.hidden = true;
    document.getElementById("show-history").setAttribute("aria-expanded", "false");
  }

  function restoreLatestConversation() {
    const latest = conversations[0];
    if (!latest?.messages?.length) return;
    openConversation(latest.id);
  }

  function makeReply(message) {
    const normalized = message.toLowerCase();

    if (/pharmacy|pharmacies|medicine|medication|drug|panadol/.test(normalized)) {
      return {
        text: "I can't check live pharmacy stock in this demo. You can search for a medicine and area in CarePlus Medicine Search, then review the results shown there.",
        action: { label: "Open Medicine Search", href: "../Pharmacy/index.html" }
      };
    }
    if (/doctor|appointment|specialist|book|clinic/.test(normalized)) {
      return {
        text: "I can point you to the CarePlus appointment flow. Doctor listings and available times may be prototype data, so please confirm details with the provider.",
        action: { label: "Open Appointments", href: "../Book/index.html" }
      };
    }
    if (/symptom|pain|fever|cough|headache|sick|nausea|dizz|breath|chest/.test(normalized)) {
      const urgent = /shortness of breath|can't breathe|cannot breathe|chest pain|sudden confusion|fainting/.test(normalized);
      return {
        text: urgent
          ? "The symptoms you mentioned may need urgent attention. Please contact local emergency services or seek urgent medical care now. This demo can't assess or diagnose symptoms."
          : "I'm sorry you're not feeling well. I can offer general information, but I can't diagnose or judge how serious this is. Consider noting when it started, how it has changed, and any other symptoms, then contact a healthcare professional for advice. If symptoms become severe or you have trouble breathing, chest pain, or sudden confusion, seek emergency care.",
        action: { label: "Find an appointment", href: "../Book/index.html" }
      };
    }
    if (/advice|healthy|health|sleep|water|exercise|diet|stress/.test(normalized)) {
      return {
        text: "I can share general educational information, but it may not fit your personal health needs. What topic would you like to learn about? For personal advice, check with a qualified healthcare professional."
      };
    }
    return {
      text: "Thanks for your message. This demo uses a small set of sample replies and isn't connected to a live AI or medical records. You can ask about pharmacy search, appointments, symptoms, or general health information."
    };
  }

  function sendMessage(rawText) {
    const text = rawText.trim();
    const hasPaidAccess = accessUntil > Date.now();
    if (!text || isGenerating || (!hasPaidAccess && attemptsUsed >= 3)) return;

    if (!hasPaidAccess) {
      attemptsUsed += 1;
      try { localStorage.setItem(usageKey, String(attemptsUsed)); } catch { /* The current tab still enforces the limit. */ }
    }
    try {
      const events = JSON.parse(localStorage.getItem(usageEventKey) || "[]");
      events.push({ identity: identity.toLowerCase(), at: new Date().toISOString(), paidAccess: hasPaidAccess });
      localStorage.setItem(usageEventKey, JSON.stringify(events.slice(-5000)));
    } catch { /* Usage metrics are optional; message access remains available. */ }
    renderUsage();

    addMessage("user", text);
    input.value = "";
    input.style.height = "auto";
    suggestions.hidden = true;
    typing.hidden = false;
    isGenerating = true;
    setRobotState("thinking", "Thinking about your message");
    sendButton.disabled = true;
    input.disabled = true;
    conversation.scrollTop = conversation.scrollHeight;

    responseTimer = window.setTimeout(() => {
      typing.hidden = true;
      const reply = makeReply(text);
      addMessage("assistant", reply.text, reply.action);
      setRobotState("ready", "Here to help", 2200);
      isGenerating = false;
      renderUsage();
      input.focus();
    }, Math.min(700 + text.length * 9, 1500));
  }

  function resetConversation(message) {
    window.clearTimeout(responseTimer);
    window.clearTimeout(robotTimer);
    isGenerating = false;
    typing.hidden = true;
    renderUsage();
    conversation.querySelectorAll(".message").forEach(node => node.remove());
    currentConversationId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    addMessage("assistant", message);
    setRobotState("greeting", "Starting a fresh conversation", 2000);
    suggestions.hidden = false;
    input.value = "";
    input.style.height = "auto";
    input.focus();
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    sendMessage(input.value);
  });

  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 132)}px`;
  });

  suggestions.querySelectorAll("[data-prompt]").forEach(button => {
    button.addEventListener("click", () => sendMessage(button.dataset.prompt));
  });

  document.getElementById("new-chat").addEventListener("click", () => {
    resetConversation("Hi! I'm your CarePlus AI Assistant. How can I help you today?");
  });

  document.getElementById("clear-chat").addEventListener("click", async () => {
    if (!await window.CarePlusDelete.confirm({ kind: "conversation", name: "Conversation history", description: "This will delete all saved conversations in this browser." })) return;
    resetConversation("Your conversation has been cleared. What would you like help with?");
    conversations = [];
    try { localStorage.removeItem(historyKey); } catch { /* Ignore unavailable browser storage. */ }
    renderHistory();
    window.CarePlusDelete.success({ kind: "conversation" });
  });

  document.getElementById("show-history").addEventListener("click", event => {
    historyPanel.hidden = !historyPanel.hidden;
    event.currentTarget.setAttribute("aria-expanded", String(!historyPanel.hidden));
    if (!historyPanel.hidden) renderHistory();
  });

  document.getElementById("payment-details-toggle").addEventListener("click", event => {
    const details = document.getElementById("payment-details");
    details.hidden = !details.hidden;
    event.currentTarget.setAttribute("aria-expanded", String(!details.hidden));
  });
  window.addEventListener("storage", event => { if (event.key === accessKey) renderUsage(); });
  renderUsage();
  renderHistory();
  restoreLatestConversation();
  setRobotState("greeting", "Waving hello", 2100);
})();
