const WebSocket = require("ws");
const db = require("./db");
const { isRoleAtLeast } = require("./middleware/auth");

function safeSend(ws, data) {
  if (ws.readyState !== WebSocket.OPEN) return;

  try {
    ws.send(JSON.stringify(data));
  } catch {
    // Ignore dead sockets; close cleanup handles removal.
  }
}

function getSocketUser(userId) {
  return db.prepare(`
    SELECT id, username, display_name, role, avatar,
           is_disabled, disabled_until, must_reset_password
    FROM users
    WHERE id = ?
  `).get(userId);
}

function initRealtime(server, sessionParser) {
  const wss = new WebSocket.Server({ noServer: true });

  const clients = new Map(); // userId -> Set(ws)

  function addClient(userId, ws) {
    if (!clients.has(userId)) clients.set(userId, new Set());
    clients.get(userId).add(ws);
  }

  function removeClient(userId, ws) {
    const set = clients.get(userId);
    if (!set) return true;

    set.delete(ws);
    if (set.size === 0) {
      clients.delete(userId);
      return true;
    }

    return false;
  }

  function broadcastToUser(userId, data) {
    const set = clients.get(Number(userId));
    if (!set) return;
    for (const ws of set) safeSend(ws, data);
  }

  function broadcastToFriends(userId, data) {
    const friends = db.prepare(`SELECT friend_id FROM friends WHERE user_id = ?`).all(userId);
    friends.forEach(f => broadcastToUser(f.friend_id, data));
  }

  function broadcastToAdmins(data) {
    for (const set of clients.values()) {
      for (const ws of set) {
        if (ws.user && isRoleAtLeast(ws.user.role, "admin")) {
          safeSend(ws, data);
        }
      }
    }
  }

  function broadcastAdminState(snapshot) {
    broadcastToAdmins({ type: "admin:state", ...snapshot });
  }

  server.on("upgrade", (req, socket, head) => {
    sessionParser(req, {}, () => {
      const userId = req.session?.userId;
      if (!userId) {
        socket.destroy();
        return;
      }

      const user = getSocketUser(userId);
      if (!user || user.is_disabled) {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, ws => {
        ws.user = user;
        wss.emit("connection", ws, req);
      });
    });
  });

  wss.on("connection", ws => {
    const userId = Number(ws.user.id);
    addClient(userId, ws);

    safeSend(ws, { type: "connected", userId });
    broadcastToFriends(userId, { type: "presence", userId, online: true });

    ws.on("message", raw => {
      let data = null;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (data?.type === "ping") {
        safeSend(ws, { type: "pong", at: Date.now() });
      }
    });

    ws.on("close", () => {
      const wasLastConnection = removeClient(userId, ws);
      if (wasLastConnection) {
        broadcastToFriends(userId, { type: "presence", userId, online: false });
      }
    });
  });

  return {
    broadcastToUser,
    broadcastToAdmins,
    broadcastAdminState,
    notifyInvite(receiverId, payload) {
      broadcastToUser(receiverId, { type: "invite", ...payload });
    }
  };
}

module.exports = initRealtime;
