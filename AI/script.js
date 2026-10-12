(() => {
  const conversation = document.getElementById("conversation");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("message-input");
  const typing = document.getElementById("typing-indicator");
  const suggestions = document.getElementById("suggestions");
  const sendButton = form.querySelector(".send-button");
  const robotStage = document.getElementById("robot-stage");
  const robotStateLabel = document.getElementById("robot-state-label");
  let isGenerating = false;
  let responseTimer;
  let robotTimer;

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

    if (!isUser) {
      const avatar = document.createElement("div");
      avatar.className = "message-avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = "✦";
      article.append(avatar);
    }

    const content = document.createElement("div");
    content.className = "message-content";
    const name = document.createElement("span");
    name.className = "message-name";
    name.textContent = isUser ? "You" : "CarePlus Assistant · Demo";
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
      link.textContent = `${action.label} →`;
      content.append(link);
    }

    content.append(time);
    article.append(content);
    conversation.insertBefore(article, typing);
    conversation.scrollTop = conversation.scrollHeight;
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
    if (!text || isGenerating) return;

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
      sendButton.disabled = false;
      input.disabled = false;
      input.focus();
    }, Math.min(700 + text.length * 9, 1500));
  }

  function resetConversation(message) {
    window.clearTimeout(responseTimer);
    window.clearTimeout(robotTimer);
    isGenerating = false;
    typing.hidden = true;
    sendButton.disabled = false;
    input.disabled = false;
    conversation.querySelectorAll(".message").forEach(node => node.remove());
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

  document.getElementById("clear-chat").addEventListener("click", () => {
    resetConversation("Your conversation has been cleared. What would you like help with?");
  });

  setRobotState("greeting", "Waving hello", 2100);
})();
