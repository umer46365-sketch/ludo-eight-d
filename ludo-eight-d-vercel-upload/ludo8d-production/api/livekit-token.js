const crypto = require('crypto');

function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

function makeToken({ apiKey, apiSecret, room, identity, name }) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: apiKey,
    sub: identity,
    name,
    nbf: now,
    exp: now + (60 * 60),
    video: {
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    }
  }));
  const signature = crypto.createHmac('sha256', apiSecret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

module.exports = (req, res) => {
  const origin = 'https://ludo-eight-d-umer-arena-pk.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', origin);
  const room = String(req.query.room || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64);
  const identity = String(req.query.identity || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const name = String(req.query.name || 'Ludo Player').slice(0, 40);
  if (!room || !identity) return res.status(400).json({ error: 'room and identity are required' });
  const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL } = process.env;
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) return res.status(503).json({ error: 'LiveKit server is not configured yet' });
  const token = makeToken({ apiKey: LIVEKIT_API_KEY, apiSecret: LIVEKIT_API_SECRET, room, identity, name });
  return res.status(200).json({ serverUrl: LIVEKIT_URL, participantToken: token });
};
