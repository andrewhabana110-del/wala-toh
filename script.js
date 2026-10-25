// Copy these values from your Supabase project (Connect button).
const SUPABASE_URL = "https://ynfqevwstwrimvzwuxer.supabase.co";
const SUPABASE_KEY = "sb_publishable_LYLpw8gdqiOdEu39pUDaZw_598BuHWR";

const authScreen = document.getElementById("auth-screen");
const chatScreen = document.getElementById("chat-screen");
const authForm = document.getElementById("auth-form");
const authMessage = document.getElementById("auth-message");
const displayName = document.getElementById("display-name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("login-btn");
const signupButton = document.getElementById("signup-btn");
const logoutButton = document.getElementById("logout-btn");
const who = document.getElementById("who");
const messageList = document.getElementById("messages");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const sendButton = messageForm.querySelector('button[type="submit"]');
const chatStatus = document.getElementById("chat-status");

let currentUser = null;
let channel = null;
let authBusy = false;
let sending = false;
let chatInitializedFor = null;
const names = Object.create(null);

const configIsPresent =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("PASTE-") &&
  Boolean(SUPABASE_KEY) &&
  !SUPABASE_KEY.includes("PASTE-");

let sb = null;
let authSetupError = "";
if (!configIsPresent) {
  authSetupError =
    "Configure SUPABASE_URL and SUPABASE_KEY in script.js to connect this app.";
} else if (typeof supabase === "undefined") {
  authSetupError =
    "The Supabase library did not load. Check your internet connection and reload.";
} else {
  try {
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (error) {
    authSetupError = `Could not initialize Supabase: ${errorMessage(
      error,
      "Check the project URL and publishable key."
    )}`;
  }
}

if (!sb) {
  authMessage.textContent = authSetupError;
  loginButton.disabled = true;
  signupButton.disabled = true;
}

function setAuthBusy(busy) {
  authBusy = busy;
  loginButton.disabled = busy || !sb;
  signupButton.disabled = busy || !sb;
}

function errorMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function authErrorMessage(error) {
  const message = errorMessage(error, "Authentication failed.");
  return /email.*(disabled|not enabled)|(disabled|not enabled).*email/i.test(message)
    ? `${message} Enable the Email provider in Supabase Dashboard > Authentication > Sign In / Providers.`
    : message;
}

async function signUp() {
  const name = displayName.value.trim();
  if (name.length < 2 || name.length > 24) {
    authMessage.textContent = "Enter a display name (2 to 24 characters).";
    displayName.focus();
    return;
  }
  if (!sb || authBusy) return;

  setAuthBusy(true);
  authMessage.textContent = "Creating your account...";
  try {
    const { data, error } = await sb.auth.signUp({
      email: emailInput.value.trim(),
      password: passwordInput.value,
      options: { data: { display_name: name } },
    });

    if (error) {
      authMessage.textContent = authErrorMessage(error);
    } else if (!data.session) {
      authMessage.textContent =
        "Account created, but email confirmation is enabled. Disable Confirm email in Supabase Authentication settings to sign in immediately.";
    } else {
      authMessage.textContent = "";
    }
  } catch (error) {
    authMessage.textContent = errorMessage(error, "Could not create your account.");
  } finally {
    setAuthBusy(false);
  }
}

async function logIn() {
  if (!sb || authBusy) return;
  setAuthBusy(true);
  authMessage.textContent = "Logging in...";
  try {
    const { error } = await sb.auth.signInWithPassword({
      email: emailInput.value.trim(),
      password: passwordInput.value,
    });
    authMessage.textContent = error ? authErrorMessage(error) : "";
  } catch (error) {
    authMessage.textContent = errorMessage(error, "Could not log in.");
  } finally {
    setAuthBusy(false);
  }
}

async function logOut() {
  if (!sb) return;
  logoutButton.disabled = true;
  chatStatus.textContent = "";
  try {
    const { error } = await sb.auth.signOut();
    if (error) chatStatus.textContent = `Could not log out: ${error.message}`;
  } catch (error) {
    chatStatus.textContent = errorMessage(error, "Could not log out.");
  } finally {
    logoutButton.disabled = false;
  }
}

authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  logIn();
});

signupButton.addEventListener("click", () => {
  if (sb && !authBusy && authForm.reportValidity()) signUp();
});

logoutButton.addEventListener("click", logOut);

function showEmptyState() {
  if (messageList.querySelector(".empty")) return;
  const item = document.createElement("li");
  item.className = "empty";
  item.textContent = "No messages yet. Start the conversation!";
  messageList.appendChild(item);
}

function findMessage(id) {
  return Array.from(messageList.children).find(
    (item) => item.dataset.id === String(id)
  );
}

function showMessage(message) {
  if (!currentUser || !message || message.id == null || findMessage(message.id)) return;

  messageList.querySelector(".empty")?.remove();
  const item = document.createElement("li");
  item.className =
    message.user_id === currentUser.id ? "message mine" : "message";
  item.dataset.id = String(message.id);
  item.dataset.userId = String(message.user_id);

  const author = document.createElement("span");
  author.className = "author";
  author.textContent =
    message.user_id === currentUser.id
      ? currentUser.user_metadata?.display_name || "Me"
      : names[message.user_id] || "Unknown";

  const text = document.createElement("p");
  text.textContent = String(message.content ?? "");

  const time = document.createElement("time");
  const createdAt = new Date(message.created_at);
  if (!Number.isNaN(createdAt.getTime())) {
    time.dateTime = createdAt.toISOString();
    time.textContent = createdAt.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  item.append(author, text);
  if (message.user_id === currentUser.id) {
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-message";
    deleteButton.dataset.deleteMessageId = String(message.id);
    deleteButton.setAttribute("aria-label", "Delete this message");
    deleteButton.textContent = "Delete";
    item.append(deleteButton);
  }
  item.append(time);
  const nextMessage = Array.from(messageList.children).find(
    (existing) =>
      existing.dataset.id &&
      new Date(existing.querySelector("time")?.dateTime || 0) > createdAt
  );
  messageList.insertBefore(item, nextMessage || null);
  messageList.scrollTop = messageList.scrollHeight;
}

async function loadNames(userId) {
  const { data, error } = await sb
    .from("profiles")
    .select("id, display_name");

  if (error) throw error;
  if (currentUser?.id !== userId) return;
  data.forEach((profile) => {
    if (profile.id && profile.display_name) {
      names[profile.id] = profile.display_name;
    }
  });
  Array.from(messageList.children).forEach((item) => {
    const author = item.querySelector(".author");
    const authorId = item.dataset.userId;
    if (author && authorId && authorId !== userId) {
      author.textContent = names[authorId] || "Unknown";
    }
  });
}

async function loadMessages(userId) {
  const { data, error } = await sb
    .from("messages")
    .select("id, user_id, content, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  if (currentUser?.id !== userId) return;

  data.reverse().forEach(showMessage);
  if (data.length === 0 && messageList.children.length === 0) showEmptyState();
}

function removeMessage(id) {
  findMessage(id)?.remove();
  if (messageList.children.length === 0) showEmptyState();
}

async function deleteMessage(id, userId, button) {
  if (!sb || currentUser?.id !== userId || button.disabled) return;

  button.disabled = true;
  chatStatus.textContent = "";
  try {
    const { data, error } = await sb
      .from("messages")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();

    if (currentUser?.id !== userId) return;
    if (error) throw error;
    if (!data) {
      chatStatus.textContent =
        "Message was not deleted. It may already be gone, or your account may not have permission to delete it.";
      return;
    }
    removeMessage(id);
  } catch (error) {
    if (currentUser?.id === userId) {
      chatStatus.textContent =
        `Could not delete message: ${errorMessage(error, "Unknown error.")}`;
    }
  } finally {
    button.disabled = false;
  }
}

messageList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest("[data-delete-message-id]");
  const userId = currentUser?.id;
  if (button && userId) {
    void deleteMessage(button.dataset.deleteMessageId, userId, button);
  }
});

function showBotMessage(content, userId) {
  if (currentUser?.id !== userId) return;

  messageList.querySelector(".empty")?.remove();
  const item = document.createElement("li");
  item.className = "message bot";

  const author = document.createElement("span");
  author.className = "author";
  author.textContent = "Weather bot";

  const text = document.createElement("p");
  text.textContent = content;

  const time = document.createElement("time");
  const createdAt = new Date();
  time.dateTime = createdAt.toISOString();
  time.textContent = createdAt.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  item.append(author, text, time);
  messageList.appendChild(item);
  messageList.scrollTop = messageList.scrollHeight;
}

function weatherDescription(code) {
  if (code === 0) return "clear sky";
  if (code === 1) return "mostly clear";
  if (code === 2) return "partly cloudy";
  if (code === 3) return "overcast";
  if ([45, 48].includes(code)) return "fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "drizzle";
  if ([61, 63, 65, 66, 67].includes(code)) return "rain";
  if ([71, 73, 75, 77].includes(code)) return "snow";
  if ([80, 81, 82].includes(code)) return "rain showers";
  if ([85, 86].includes(code)) return "snow showers";
  if ([95, 96, 99].includes(code)) return "thunderstorm";
  return "unknown conditions";
}

async function replyWithWeather(city, userId) {
  try {
    const geocodingUrl = new URL(
      "https://geocoding-api.open-meteo.com/v1/search"
    );
    geocodingUrl.search = new URLSearchParams({
      name: city,
      count: "1",
      language: "en",
      format: "json",
    });
    const geocodingResponse = await fetch(geocodingUrl);
    if (!geocodingResponse.ok) {
      throw new Error(
        `Location lookup failed (HTTP ${geocodingResponse.status}).`
      );
    }

    const geocodingData = await geocodingResponse.json();
    const location = geocodingData.results?.[0];
    if (!location) {
      showBotMessage(`I couldn't find "${city}". Try a nearby city name.`, userId);
      return;
    }

    const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
    forecastUrl.search = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current:
        "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
      timezone: "auto",
    });
    const forecastResponse = await fetch(forecastUrl);
    if (!forecastResponse.ok) {
      throw new Error(`Weather lookup failed (HTTP ${forecastResponse.status}).`);
    }

    const forecastData = await forecastResponse.json();
    const current = forecastData.current;
    if (!current || typeof current.temperature_2m !== "number") {
      throw new Error("The weather service returned incomplete data.");
    }

    const place = [location.name, location.admin1, location.country]
      .filter(Boolean)
      .filter((part, index, parts) => parts.indexOf(part) === index)
      .join(", ");
    const feelsLike =
      typeof current.apparent_temperature === "number"
        ? `, feels like ${Math.round(current.apparent_temperature)}°C`
        : "";
    const humidity =
      typeof current.relative_humidity_2m === "number"
        ? `, humidity ${current.relative_humidity_2m}%`
        : "";
    const wind =
      typeof current.wind_speed_10m === "number"
        ? `, wind ${Math.round(current.wind_speed_10m)} km/h`
        : "";

    showBotMessage(
      `Current weather in ${place}: ${weatherDescription(
        current.weather_code
      )}, ${Math.round(current.temperature_2m)}°C${feelsLike}${humidity}${wind}.`,
      userId
    );
  } catch (error) {
    showBotMessage(
      `I couldn't get the weather: ${errorMessage(error, "Unknown error.")}`,
      userId
    );
  }
}

function startChat(user) {
  if (!sb || !user || currentUser?.id === user.id) return;

  if (channel) {
    sb.removeChannel(channel).catch((error) => {
      console.error("Could not close the previous chat connection:", error);
    });
  }
  currentUser = user;
  channel = null;
  chatInitializedFor = null;
  messageList.replaceChildren();
  who.textContent =
    user.user_metadata?.display_name || user.email || "Signed in";
  chatStatus.textContent = "Connecting...";
  authMessage.textContent = "";
  authScreen.hidden = true;
  chatScreen.hidden = false;

  const userId = user.id;
  channel = sb
    .channel(`class-chat-${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => {
        if (currentUser?.id === userId) showMessage(payload.new);
      }
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "messages" },
      (payload) => {
        if (currentUser?.id === userId) removeMessage(payload.old.id);
      }
    )
    .subscribe((status, error) => {
      if (currentUser?.id !== userId) return;
      if (status === "SUBSCRIBED") {
        chatStatus.textContent = "";
        if (chatInitializedFor !== userId) {
          chatInitializedFor = userId;
          initializeChat(userId);
        }
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        chatStatus.textContent =
          error?.message || "Could not connect to live messages.";
      } else if (status === "CLOSED") {
        chatStatus.textContent = "The live chat connection was closed.";
      }
    });
}

async function initializeChat(userId) {
  try {
    try {
      await loadNames(userId);
    } catch (error) {
      if (currentUser?.id === userId) {
        chatStatus.textContent =
          `Could not load profile names: ${errorMessage(error, "Unknown error.")}`;
      }
    }
    await loadMessages(userId);
    if (currentUser?.id === userId) {
      who.textContent =
        names[userId] || currentUser.email || "Signed in";
      messageInput.focus();
    }
  } catch (error) {
    if (currentUser?.id === userId) {
      chatStatus.textContent =
        `Could not load chat data: ${errorMessage(error, "Unknown error.")}`;
    }
  }
}

function stopChat() {
  currentUser = null;
  chatInitializedFor = null;
  if (channel && sb) {
    sb.removeChannel(channel).catch((error) => {
      console.error("Could not close the chat connection:", error);
    });
  }
  channel = null;
  messageList.replaceChildren();
  passwordInput.value = "";
  chatStatus.textContent = "";
  chatScreen.hidden = true;
  authScreen.hidden = false;
}

if (sb) {
  sb.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    setTimeout(() => {
      if (user) startChat(user);
      else if (currentUser) stopChat();
    }, 0);
  });
}

messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!sb || !currentUser || sending) return;

  const content = messageInput.value.trim();
  if (!content) return;

  const submittedContent = content;
  const submittedUserId = currentUser.id;
  sending = true;
  sendButton.disabled = true;
  chatStatus.textContent = "";
  try {
    const { data, error } = await sb
      .from("messages")
      .insert({ content })
      .select("id, user_id, content, created_at")
      .single();

    if (error) {
      chatStatus.textContent = `Could not send: ${error.message}`;
      return;
    }
    if (currentUser?.id !== submittedUserId) return;
    if (messageInput.value.trim() === submittedContent) messageInput.value = "";
    showMessage(data);
    const weatherRequest = submittedContent.match(
      /^\/weather\s+(.+)$/i
    );
    if (weatherRequest) {
      void replyWithWeather(weatherRequest[1].trim(), submittedUserId);
    }
  } catch (error) {
    chatStatus.textContent =
      `Could not send: ${errorMessage(error, "Unknown error.")}`;
  } finally {
    sending = false;
    sendButton.disabled = false;
  }
});