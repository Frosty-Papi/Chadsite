const WebSocket = require("ws");
const db = require("./db");

function initRealtime(server, sessionParser) {
  const wss = new WebSocket.Server({ noServer: true });

  const clients = new Map(); // userId -> Set(ws)

  function broadcastToUser(userId, data) {
    const set = clients.get(userId);
    if (!set) return;
    for (const ws of set) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    }
  }

  function broadcastToFriends(userId, data) {
    const friends = db.prepare(`SELECT friend_id FROM friends WHERE user_id = ?`).all(userId);
    friends.forEach(f => broadcastToUser(f.friend_id, data));
  }

  server.on("upgrade", (req, socket, head) => {
    sessionParser(req, {}, () => {
      if (!req.session || !req.session.user) {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, ws => {
        ws.user = req.session.user;
        wss.emit("connection", ws, req);
      });
    });
  });

  wss.on("connection", ws => {
    const userId = ws.user.id;

    if (!clients.has(userId)) clients.set(userId, new Set());
    clients.get(userId).add(ws);

    broadcastToFriends(userId, { type: "presence", userId, online: true });

    ws.on("close", () => {
      const set = clients.get(userId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          clients.delete(userId);
          broadcastToFriends(userId, { type: "presence", userId, online: false });
        }
      }
    });
  });

  return {
    notifyInvite(receiverId, payload) {
      broadcastToUser(receiverId, { type: "invite", ...payload });
    }
  };
}

module.exports = initRealtime;
