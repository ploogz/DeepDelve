/* ============================================================
   Peer-to-peer co-op over PeerJS (WebRTC), for hosting the game anywhere (GitHub Pages etc.).
   It implements the same small "room" interface the game's netcode already uses:
     room.presence(obj)   merge my player state, shared with everyone
     room.emit(topic, d)  send an event to everyone (echoed to me with sameTab: true)
     room.on(topic, fn)   receive events -> fn({ topic, data, peer, sameTab, isMe })
     room.onPeers(fn)     roster changes -> fn({ peers, joined, left, updated })
     room.leave()
   Topology is a star: the host's browser holds the connections and relays everything to the
   other players, so every player only needs one connection. Up to 4 players.
   ============================================================ */
'use strict';
G.p2p = {
  PREFIX: 'ddcrawl-v1-',
  MAX: 4,
  available() { return typeof window.Peer === 'function'; },
  // optional TURN relay for strict networks: set window.DD_ICE = [{ urls, username, credential }, ...] before the game loads
  // optional self-hosted signalling server: window.DD_PEER = { host, port, path, secure }
  peerOpts() { const o = Object.assign({ debug: 1 }, window.DD_PEER || {}); if (Array.isArray(window.DD_ICE) && window.DD_ICE.length) o.config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }].concat(window.DD_ICE) }; return o; },
  // the always-present "lobby" object; joining a party opens a real P2P room
  lobby() {
    return {
      p2p: true,
      presence: async () => { }, onPeers: () => () => { },
      join: (name, opts = {}) => this.openRoom(name.replace(/^dd-/, ''), !!opts.host)
    };
  },
  openRoom(code, asHost) {
    const self = this;
    return new Promise((resolve, reject) => {
      const peers = new Map();           // peerId -> { peer, sameTab, isMe, presence }
      const conns = new Map();           // host: peerId -> DataConnection
      const subs = {}, rosterSubs = [], errSubs = [];
      let hostConn = null, myId = null, closed = false, settled = false;
      const peer = new Peer(asHost ? self.PREFIX + code.toLowerCase() : undefined, self.peerOpts());
      const fail = (msg) => { if (!settled) { settled = true; try { peer.destroy(); } catch (e) { } reject(new Error(msg)); } };
      const roster = (joined = [], left = []) => { const list = [...peers.values()]; rosterSubs.forEach(f => { try { f({ peers: list, joined, left, updated: [] }); } catch (e) { console.warn(e); } }); };
      const deliver = (topic, data, from) => { (subs[topic] || []).forEach(f => { try { f({ topic, data, peer: from, sameTab: from === myId, isMe: from === myId }); } catch (e) { console.warn(e); } }); };
      const setPresence = (id, p, replace) => {
        let e = peers.get(id), isNew = false;
        if (!e) { e = { peer: id, sameTab: id === myId, isMe: id === myId, presence: {} }; peers.set(id, e); isNew = true; }
        if (replace) { for (const k in e.presence) delete e.presence[k]; }
        // merge in place so everyone holding this presence object sees live values
        for (const k in p) { if (p[k] === null) delete e.presence[k]; else e.presence[k] = p[k]; }
        if (isNew) roster([e], []);
      };
      const dropPeer = (id) => { const e = peers.get(id); if (!e) return; peers.delete(id); roster([], [e]); };
      const broadcast = (msg, except) => { conns.forEach((c, id) => { if (id !== except && c.open) { try { c.send(msg); } catch (e) { } } }); };
      const lost = (why) => { if (closed) return; closed = true; errSubs.forEach(f => { try { f(new Error(why)); } catch (e) { } }); try { peer.destroy(); } catch (e) { } };

      // a message arriving from the network (host: from a client; client: from the host)
      const onMsg = (m, from) => {
        if (!m || typeof m !== 'object') return;
        if (m.t === 'ev') {
          const src = asHost ? from : m.from;
          if (asHost) broadcast({ t: 'ev', topic: m.topic, data: m.data, from: src }, from);
          deliver(m.topic, m.data, src);
        } else if (m.t === 'pr') {
          const src = asHost ? from : m.from;
          setPresence(src, m.p || {}, !!m.full);
          if (asHost) broadcast({ t: 'pr', from: src, p: m.p, full: m.full }, from);
        } else if (m.t === 'roster' && !asHost) {            // full snapshot from the host on join
          (m.list || []).forEach(o => { if (o.peer !== myId) setPresence(o.peer, o.presence || {}, true); });
        } else if (m.t === 'left' && !asHost) dropPeer(m.peer);
        else if (m.t === 'full' && !asHost) { if (!settled) fail('That room is full (4 players).'); else lost('That room is full (4 players).'); }
      };

      const api = {
        p2p: true, get code() { return code; },
        on(topic, fn) { (subs[topic] = subs[topic] || []).push(fn); return () => { subs[topic] = (subs[topic] || []).filter(f => f !== fn); }; },
        onPeers(fn, err) { rosterSubs.push(fn); if (err) errSubs.push(err); setTimeout(() => fn({ peers: [...peers.values()], joined: [...peers.values()], left: [], updated: [] })); return () => { const i = rosterSubs.indexOf(fn); if (i >= 0) rosterSubs.splice(i, 1); }; },
        peers() { return [...peers.values()]; },
        connected() { return !closed && (asHost || (hostConn && hostConn.open)); },
        async presence(p) {
          if (closed) return; setPresence(myId, p);
          const msg = { t: 'pr', from: myId, p };
          if (asHost) broadcast(msg); else if (hostConn && hostConn.open) hostConn.send(msg);
        },
        async emit(topic, data) {
          if (closed) return; const msg = { t: 'ev', topic, data, from: myId };
          if (asHost) broadcast(msg); else if (hostConn && hostConn.open) hostConn.send(msg);
          deliver(topic, data, myId);
        },
        async leave() { closed = true; try { if (hostConn) hostConn.close(); conns.forEach(c => c.close()); peer.destroy(); } catch (e) { } }
      };

      peer.on('open', id => {
        myId = id; setPresence(myId, {});
        if (asHost) { settled = true; resolve(api); return; }
        hostConn = peer.connect(self.PREFIX + code.toLowerCase(), { reliable: true, serialization: 'json' });
        const t = setTimeout(() => fail('Could not reach that party. Check the Room ID and try again.'), 12000);
        hostConn.on('open', () => { clearTimeout(t); if (!settled) { settled = true; resolve(api); } });
        hostConn.on('data', m => onMsg(m, self.PREFIX + code.toLowerCase()));
        hostConn.on('close', () => { if (settled) lost('The host left the party.'); });
        hostConn.on('error', () => { if (settled) lost('Lost connection to the host.'); });
      });
      // host side: players connecting in
      peer.on('connection', c => {
        if (!asHost) { c.close(); return; }
        c.on('open', () => {
          if (conns.size >= self.MAX - 1) { try { c.send({ t: 'full' }); } catch (e) { } setTimeout(() => c.close(), 300); return; }
          conns.set(c.peer, c);
          c.send({ t: 'roster', list: [...peers.values()].map(e => ({ peer: e.peer, presence: e.presence })) });
        });
        c.on('data', m => onMsg(m, c.peer));
        const gone = () => { if (!conns.has(c.peer)) return; conns.delete(c.peer); dropPeer(c.peer); broadcast({ t: 'left', peer: c.peer }); };
        c.on('close', gone); c.on('error', gone);
      });
      peer.on('error', err => {
        const t = err && err.type;
        if (t === 'unavailable-id') fail('id-taken');
        else if (t === 'peer-unavailable') fail('No party found with that Room ID.');
        else if (t === 'browser-incompatible') fail('This browser does not support peer-to-peer play.');
        else if (!settled) fail('Could not connect to the matchmaking server.');
        else if (t === 'network' || t === 'server-error' || t === 'socket-error') { /* signalling hiccup: live connections keep working */ }
      });
      peer.on('disconnected', () => { if (!closed) { try { peer.reconnect(); } catch (e) { } } });   // keeps the Room ID claimable for new joiners
    });
  }
};
