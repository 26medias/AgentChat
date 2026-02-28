function parse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function send(ws, obj) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(obj));
  }
}

function broadcast(wsSet, obj) {
  const data = JSON.stringify(obj);
  for (const ws of wsSet) {
    if (ws.readyState === 1) {
      ws.send(data);
    }
  }
}

module.exports = { parse, send, broadcast };
