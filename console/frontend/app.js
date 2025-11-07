const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const chatWindow = document.getElementById("chat-window");
const messages = document.getElementById("messages");

// === Helpers ===
function addMessageTyping(text, from = "system", speed = 30) {
  chatWindow.classList.remove("hidden");
  const div = document.createElement("div");
  div.className = `message ${from}`;
  messages.appendChild(div);

  let i = 0;
  function typeChar() {
    if (i < text.length) {
      div.innerHTML += text[i];
      i++;
      setTimeout(typeChar, speed);
    } else {
      messages.scrollTop = messages.scrollHeight;
    }
  }
  typeChar();
}

const messageQueue = [];
let isTyping = false;

function queueMessage(text, from = "system", speed = 30) {
  messageQueue.push({ text, from, speed });
  if (!isTyping) {
    processQueue();
  }
}

function processQueue() {
  if (messageQueue.length === 0) {
    isTyping = false;
    return;
  }
  isTyping = true;

  const { text, from, speed } = messageQueue.shift();

  const div = document.createElement("div");
  if (text.startsWith("❌")) {
    div.className = "message error";
  } else if (text.startsWith("✅")) {
    div.className = "message success";
  } else if (text.startsWith("⚠️")) {
    div.className = "message warning";   // ⚠️ Warning
  } else {
    div.className = `message ${from}`;
  }
  messages.appendChild(div);

  if (text.includes("<a")) {
    div.innerHTML = text;
    processQueue();
    messages.scrollTop = messages.scrollHeight;
    return;
  }

  let i = 0;
  function typeChar() {
    if (i < text.length) {
      div.innerHTML += text[i];
      i++;
      setTimeout(typeChar, speed);
    } else {
      processQueue();
    }
    messages.scrollTop = messages.scrollHeight;
  }
  typeChar();
}

// === Core ===

function startRefactor(issueKey) {
  queueMessage(issueKey, "user");

  const evtSource = new EventSource(`/api/logs/${issueKey}`);

  evtSource.onmessage = (event) => {
    queueMessage(event.data, "system", 20);
  };

  evtSource.onerror = () => {
    //queueMessage("❌ SSE connection closed", "error");
    evtSource.close();
  };
}

// === Event bindings ===
sendBtn.addEventListener("click", () => {
  const issueKey = input.value.trim();
  if (!issueKey) return alert("Enter issue key ...");
  startRefactor(issueKey);
  input.value = "";
});

input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    sendBtn.click();
  }
});


