const STORAGE_KEY = "chatbox_env_settings_v1";

const defaultEnv = {
  clientSecret: "",
  brainId: "",
  ntid: "",
};

// Biến toàn cục để lưu settings, có thể truy cập từ bất kỳ đâu
let globalSettings = { ...defaultEnv };

// Gán vào window để có thể truy cập từ console hoặc các script khác
if (typeof window !== 'undefined') {
  window.globalSettings = globalSettings;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderBotText(text) {
  // Parse toàn bộ message, chỉ phần nằm trong <abap>...</abap> mới vào khung sửa,
  // còn lại hiển thị text bình thường.
  const startTag = "<abap>";
  const endTag = "</abap>";

    // Nếu KHÔNG có <abap> → parse Markdown bằng marked
  if (!text.includes(startTag)) {
    return marked.parse(text);
  }
  
  let html = "";
  let cursor = 0;

  while (cursor < text.length) {
    const start = text.indexOf(startTag, cursor);
    if (start === -1) {
      const rest = text.slice(cursor);
      if (rest.trim()) {
        html += `<p>${escapeHtml(rest).replace(/\n/g, "<br>")}</p>`;
      }
      break;
    }

    const plainPart = text.slice(cursor, start);
    if (plainPart.trim()) {
      html += `<p>${escapeHtml(plainPart).replace(/\n/g, "<br>")}</p>`;
    }

    const end = text.indexOf(endTag, start + startTag.length);
    if (end === -1) {
      // Không tìm thấy thẻ đóng, coi phần còn lại là text thường
      const rest = text.slice(start);
      if (rest.trim()) {
        html += `<p>${escapeHtml(rest).replace(/\n/g, "<br>")}</p>`;
      }
      break;
    }

    const code = text.slice(start + startTag.length, end);
    if (code.trim()) {
      html += `
        <div class="code-block-editable">
          <div class="code-header">
            <span class="code-lang-label">abap</span>
            <button type="button" class="btn-ghost btn-copy-code">Copy code</button>
          </div>
          <textarea class="code-textarea" spellcheck="false">${code.trim()}</textarea>
          <div class="code-actions">
            <button type="button" class="btn-primary btn-apply-code">Apply</button>
          </div>
        </div>
      `;
    }

    cursor = end + endTag.length;
  }

  if (!html) {
    // Không có <abap> thì hiện thường
    return escapeHtml(text).replace(/\n/g, "<br>");
  }

  return html;
}

function loadEnv() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const env = { ...defaultEnv };
      globalSettings = env;
      if (typeof window !== 'undefined') {
        window.globalSettings = globalSettings;
      }
      return env;
    }
    const parsed = JSON.parse(raw);
    const env = { ...defaultEnv, ...parsed };
    globalSettings = env;
    if (typeof window !== 'undefined') {
      window.globalSettings = globalSettings;
    }
    return env;
  } catch {
    const env = { ...defaultEnv };
    globalSettings = env;
    if (typeof window !== 'undefined') {
      window.globalSettings = globalSettings;
    }
    return env;
  }
}

function saveEnv(env) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(env));
  // Cập nhật biến toàn cục
  globalSettings = { ...env };
  // Cập nhật window object nếu có
  if (typeof window !== 'undefined') {
    window.globalSettings = globalSettings;
  }
}

// Biến để cache Windows username
let cachedWindowsUsername = null;

async function getWindowsNtid() {
  // Nếu đã có cache, trả về ngay
  if (cachedWindowsUsername) {
    console.log('[getWindowsNtid] Using cached username:', cachedWindowsUsername);
    return cachedWindowsUsername;
  }
  
  try {
    console.log('[getWindowsNtid] Fetching username from API...');
    // Gọi API từ server để lấy Windows username
    const response = await fetch('/api/userinfo');
    if (response.ok) {
      const data = await response.json();
      console.log('[getWindowsNtid] API response:', data);
      if (data.username) {
        cachedWindowsUsername = data.username;
        console.log('[getWindowsNtid] Cached username:', cachedWindowsUsername);
        return data.username;
      }
    } else {
      console.error('[getWindowsNtid] API response not OK:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('[getWindowsNtid] Error fetching Windows username:', error);
  }
  
  // Fallback: thử lấy từ path
  try {
    const path = window.location.pathname || "";
    const match = path.match(/[/\\]Users[/\\]([^/\\]+)/i);
    if (match && match[1]) {
      const username = decodeURIComponent(match[1]);
      cachedWindowsUsername = username;
      console.log('[getWindowsNtid] Using username from path:', username);
      return username;
    }
  } catch (err) {
    console.error('[getWindowsNtid] Error parsing path:', err);
  }
  
  console.warn('[getWindowsNtid] No username found, returning empty string');
  return "";
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function createMessageElement({ role, text, env, time }) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;

  const meta = document.createElement("div");
  meta.className = "message-meta";
  const who = role === "user" ? "Bạn" : "Bot";
  meta.innerHTML = `<span>${who}</span><span>${time || formatTime()}</span>`;

  const content = document.createElement("div");
  if (role === "bot") {
    content.innerHTML = renderBotText(text);
  } else {
    content.textContent = text;
  }

  wrapper.appendChild(meta);
  wrapper.appendChild(content);

  if (role === "user" && env) {
    const pillRow = document.createElement("div");
    pillRow.className = "pill-row";

    const items = [
      ["Client Secret", env.clientSecret ? "***" : "chưa đặt"],
      ["Brain ID", env.brainId || "chưa đặt"],
      ["NTID", env.ntid || "chưa đặt"],
    ];

    items.forEach(([label, value]) => {
      const pill = document.createElement("span");
      pill.className = "env-pill";
      pill.innerHTML = `<span>${label}:</span> ${value}`;
      pillRow.appendChild(pill);
    });

    wrapper.appendChild(pillRow);
  }

  return wrapper;
}

document.addEventListener("DOMContentLoaded", () => {
  // Sidebar elements
  const leftSidebar = document.getElementById("leftSidebar");
  const rightSidebar = document.getElementById("rightSidebar");
  const leftSidebarToggle = document.getElementById("leftSidebarToggle");
  const rightSidebarToggle = document.getElementById("rightSidebarToggle");
  
  // Left sidebar elements
  const newChatBtn = document.getElementById("newChatBtn");
  const recentChatsToggle = document.getElementById("recentChatsToggle");
  const recentChatsList = document.getElementById("recentChatsList");
  
  // Right sidebar elements
  const settingsToggle = document.getElementById("settingsToggle");
  const settingsPanel = document.getElementById("settingsPanel");
  const saveSettingsBtn = document.getElementById("saveSettings");
  const resetSettingsBtn = document.getElementById("resetSettings");
  const envClientSecret = document.getElementById("envClientSecret");
  const envBrainId = document.getElementById("envBrainId");
  const envNtid = document.getElementById("envNtid");

  // Chat elements
  const chatForm = document.getElementById("chatForm");
  const userInput = document.getElementById("userInput");
  const messages = document.getElementById("messages");
  const submitBtn = chatForm.querySelector("button[type='submit']") || chatForm.querySelector(".btn-send");
  const commandMenu = document.getElementById("commandMenu");
  const waitOverlay = document.getElementById("waitOverlay");
  
  // Sidebar toggle functions
  leftSidebarToggle.addEventListener("click", () => {
    leftSidebar.classList.toggle("collapsed");
    const isCollapsed = leftSidebar.classList.contains("collapsed");
    leftSidebarToggle.textContent = isCollapsed ? "▶" : "◀";
    leftSidebarToggle.title = isCollapsed ? "Mở sidebar trái" : "Thu sidebar trái";
  });
  
  rightSidebarToggle.addEventListener("click", () => {
    rightSidebar.classList.toggle("collapsed");
    const isCollapsed = rightSidebar.classList.contains("collapsed");
    rightSidebarToggle.textContent = isCollapsed ? "◀" : "▶";
    rightSidebarToggle.title = isCollapsed ? "Mở sidebar phải" : "Thu sidebar phải";
  });
  
  // Set initial state - both sidebars collapsed by default
  // Đảm bảo cả 2 sidebar đều collapsed khi load
  if (!leftSidebar.classList.contains("collapsed")) {
    leftSidebar.classList.add("collapsed");
  }
  if (!rightSidebar.classList.contains("collapsed")) {
    rightSidebar.classList.add("collapsed");
  }
  leftSidebarToggle.textContent = "▶";
  rightSidebarToggle.textContent = "◀";
  leftSidebarToggle.title = "Mở sidebar trái";
  rightSidebarToggle.title = "Mở sidebar phải";
  
  // Recent Chats toggle
  recentChatsToggle.addEventListener("click", () => {
    recentChatsToggle.classList.toggle("collapsed");
    recentChatsList.classList.toggle("collapsed");
  });
  
  // Settings toggle
  settingsToggle.addEventListener("click", () => {
    settingsToggle.classList.toggle("collapsed");
    settingsPanel.classList.toggle("hidden");
  });
  
  // New Chat button
  newChatBtn.addEventListener("click", () => {
    // Clear messages
    messages.innerHTML = "";
    // Clear input
    userInput.value = "";
    // Update active chat item
    document.querySelectorAll(".chat-item").forEach(item => {
      item.classList.remove("active");
    });
    // You can add more logic here to create a new chat session
    console.log("New chat created");
  });
  
  // Chat items click handler
  document.querySelectorAll(".chat-item").forEach(item => {
    item.addEventListener("click", () => {
      // Remove active from all items
      document.querySelectorAll(".chat-item").forEach(i => i.classList.remove("active"));
      // Add active to clicked item
      item.classList.add("active");
      // You can add logic here to load chat history
      const chatTitle = item.querySelector(".chat-title").textContent;
      console.log("Switched to chat:", chatTitle);
    });
  });

  function showCommandMenu() {
    if (!commandMenu) return;
    commandMenu.classList.remove("hidden");
  }

  function hideCommandMenu() {
    if (!commandMenu) return;
    commandMenu.classList.add("hidden");
  }

  function maybeToggleCommandMenu() {
    const value = userInput.value;
    const pos = userInput.selectionStart || 0;
    const hasAt = pos > 0 && value[pos - 1] === "@";
    if (hasAt) {
      showCommandMenu();
    } else {
      hideCommandMenu();
    }
  }

  // Load env on start
  const currentEnv = loadEnv();
  envClientSecret.value = currentEnv.clientSecret || "";
  envBrainId.value = currentEnv.brainId || "";
  
  // Tự động lấy Windows username và điền vào NTID
  (async () => {
    console.log('[DOMContentLoaded] Loading NTID...');
    console.log('[DOMContentLoaded] Current env ntid:', currentEnv.ntid);
    
    const defaultNtid = await getWindowsNtid();
    console.log('[DOMContentLoaded] Got default NTID:', defaultNtid);
    
    if (defaultNtid) {
      // Nếu có NTID từ Windows và chưa có trong env, hoặc env trống
      if (!currentEnv.ntid || currentEnv.ntid === "") {
        console.log('[DOMContentLoaded] Setting NTID to:', defaultNtid);
        envNtid.value = defaultNtid;
        // Cập nhật env và lưu
        const updatedEnv = { ...currentEnv, ntid: defaultNtid };
        saveEnv(updatedEnv);
      } else {
        // Nếu đã có trong env, dùng giá trị đã lưu
        console.log('[DOMContentLoaded] Using saved NTID:', currentEnv.ntid);
        envNtid.value = currentEnv.ntid;
      }
    } else if (currentEnv.ntid) {
      // Nếu không lấy được từ Windows nhưng có trong env
      console.log('[DOMContentLoaded] Using saved NTID (no Windows username):', currentEnv.ntid);
      envNtid.value = currentEnv.ntid;
    } else {
      // Không có gì cả
      console.warn('[DOMContentLoaded] No NTID available');
      envNtid.value = "";
    }
  })();


  saveSettingsBtn.addEventListener("click", async () => {
    let ntidValue = envNtid.value.trim();
    // Nếu NTID trống, tự động lấy từ Windows
    if (!ntidValue) {
      ntidValue = await getWindowsNtid() || defaultEnv.ntid;
      envNtid.value = ntidValue;
    }
    const newEnv = {
      clientSecret: envClientSecret.value.trim(),
      brainId: envBrainId.value.trim(),
      ntid: ntidValue,
    };
    saveEnv(newEnv);
    // simple visual feedback
    saveSettingsBtn.textContent = "Đã lưu ✓";
    setTimeout(() => {
      saveSettingsBtn.textContent = "Lưu cấu hình";
    }, 1200);
  });

  resetSettingsBtn.addEventListener("click", async () => {
    envClientSecret.value = "";
    envBrainId.value = "";
    const defaultNtid = await getWindowsNtid();
    envNtid.value = defaultNtid;
    const resetEnv = { ...defaultEnv, ntid: defaultNtid };
    saveEnv(resetEnv);
  });

  function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  async function sendToApi(messageText, env) {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: messageText }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      return data.reply || messageText;
    } catch (error) {
      console.error('Error sending message to API:', error);
      throw error;
    }
  }

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = userInput.value.trim();
    if (!text) return;

    const env = loadEnv();

    const userMsgEl = createMessageElement({
      role: "user",
      text,
      env,
    });
    messages.appendChild(userMsgEl);
    scrollToBottom();
    userInput.value = "";

    submitBtn.disabled = true;
    submitBtn.style.opacity = "0.6";
    submitBtn.style.cursor = "not-allowed";
    if (waitOverlay) {
      waitOverlay.classList.remove("hidden");
    }

    try {
      const reply = await sendToApi(text, env);
      const botMsgEl = createMessageElement({
        role: "bot",
        text: reply,
      });
      messages.appendChild(botMsgEl);
      scrollToBottom();
    } catch (err) {
      const errMsgEl = createMessageElement({
        role: "bot",
        text: "Có lỗi khi gửi tin nhắn. Vui lòng kiểm tra lại cấu hình ENV hoặc console.",
      });
      messages.appendChild(errMsgEl);
      scrollToBottom();
      console.error(err);
    } finally {
      submitBtn.disabled = false;
      submitBtn.style.opacity = "1";
      submitBtn.style.cursor = "pointer";
      if (waitOverlay) {
        waitOverlay.classList.add("hidden");
      }
    }
  });

  // Gợi ý lệnh @phân tích, @sữa mã, @review
  userInput.addEventListener("input", () => {
    maybeToggleCommandMenu();
  });

  userInput.addEventListener("click", () => {
    maybeToggleCommandMenu();
  });

  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hideCommandMenu();
    }
    // sau một tick mới đọc được selectionStart mới
    setTimeout(() => maybeToggleCommandMenu(), 0);
  });

  if (commandMenu) {
    commandMenu.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const btn = target.closest(".command-item");
      if (!btn) return;
      const command = btn.getAttribute("data-command");
      if (!command) return;

      const value = userInput.value;
      const pos = userInput.selectionStart || 0;
      const atIndex = value.lastIndexOf("@", pos - 1);
      if (atIndex === -1) return;

      const before = value.slice(0, atIndex);
      const after = value.slice(pos);
      const insert = `@${command}`;
      const newVal = `${before}${insert} ${after}`;
      userInput.value = newVal;

      const newPos = before.length + insert.length + 1;
      userInput.selectionStart = newPos;
      userInput.selectionEnd = newPos;

      hideCommandMenu();
      userInput.focus();
    });
  }

  // Lắng nghe nút Apply trong block code bot trả về
  messages.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const applyBtn = target.closest(".btn-apply-code");
    const copyBtn = target.closest(".btn-copy-code");

    const wrapper = (applyBtn || copyBtn) && target.closest(".code-block-editable");
    if (!wrapper) return;
    const textarea = wrapper.querySelector(".code-textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) return;

    if (copyBtn) {
      const code = textarea.value;
      navigator.clipboard
        .writeText(code)
        .then(() => {
          copyBtn.textContent = "Copied";
          setTimeout(() => {
            copyBtn.textContent = "Copy";
          }, 1000);
        })
        .catch(() => {
          // fallback: select text
          textarea.focus();
          textarea.select();
        });
      return;
    }

    if (applyBtn) {
      const newCode = textarea.value;
      userInput.value = newCode;
      userInput.focus();

      // Bot trả thêm message hiển thị code sau khi sửa
      const botMsgEl = createMessageElement({
        role: "bot",
        text: `Đoạn code sau khi sửa:\n\n<abap>\n${newCode}\n</abap>`,
      });
      messages.appendChild(botMsgEl);
      messages.scrollTop = messages.scrollHeight;
    }
  });
});


