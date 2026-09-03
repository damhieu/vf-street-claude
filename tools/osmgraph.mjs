// Đồ thị node từ phản hồi Overpass; Dijkstra theo chiều dài; tôn trọng oneway. Thuần, dùng cho tool và test.
const DEG = Math.PI / 180, R = 6371000;

export function haversine(a, b) {
  const dLat = (b.lat - a.lat) * DEG, dLon = (b.lon - a.lon) * DEG;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function buildGraph(elements, { ignoreOneway = false } = {}) {
  const nodes = new Map(), ways = new Map(), adj = new Map(), connected = new Set();
  const addEdge = (a, b, d, wayId) => { if (!adj.has(a)) adj.set(a, []); adj.get(a).push({ to: b, d, wayId }); connected.add(a); connected.add(b); };
  for (const e of elements) if (e.type === 'node') nodes.set(e.id, { lat: e.lat, lon: e.lon });
  for (const e of elements) {
    if (e.type !== 'way' || !e.nodes) continue;
    const tags = e.tags || {};
    ways.set(e.id, tags);
    const ow = tags.oneway;
    const fwd = ignoreOneway || ow !== '-1', back = ignoreOneway || !['yes', '1', 'true', '-1'].includes(ow);
    for (let i = 0; i + 1 < e.nodes.length; i++) {
      const a = e.nodes[i], b = e.nodes[i + 1];
      if (!nodes.has(a) || !nodes.has(b)) continue;
      const d = haversine(nodes.get(a), nodes.get(b));
      if (fwd) addEdge(a, b, d, e.id);
      if (back) addEdge(b, a, d, e.id);
    }
  }
  return { nodes, ways, adj, connected };
}

/** k node có cạnh gần toạ độ nhất, gần trước. */
export function nearestNodes(g, lat, lon, k = 1, maxDist = Infinity) {
  const all = [];
  for (const id of g.connected) { const d = haversine(g.nodes.get(id), { lat, lon }); if (d <= maxDist) all.push({ id, d }); }
  all.sort((a, b) => a.d - b.d);
  return all.slice(0, k).map(x => x.id);
}
export const nearestNode = (g, lat, lon) => nearestNodes(g, lat, lon, 1)[0] ?? null;

class Heap {
  constructor() { this.a = []; }
  push(k, v) { const a = this.a; a.push([k, v]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; }
}

/** Dijkstra: mảng node id từ from tới to, hoặc null. Kèm way dùng để tới mỗi node qua `via`. */
export function shortestPath(g, from, to, withWays = false) {
  const dist = new Map([[from, 0]]), prev = new Map(), via = new Map(), heap = new Heap();
  heap.push(0, from);
  while (heap.size) {
    const [d, u] = heap.pop();
    if (d > (dist.get(u) ?? Infinity)) continue;
    if (u === to) break;
    for (const e of g.adj.get(u) || []) {
      const nd = d + e.d;
      if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); prev.set(e.to, u); via.set(e.to, e.wayId); heap.push(nd, e.to); }
    }
  }
  if (!dist.has(to)) return null;
  const path = [to];
  while (path[path.length - 1] !== from) path.push(prev.get(path[path.length - 1]));
  path.reverse();
  return withWays ? { path, via, lengthM: dist.get(to) } : path;
}

/** Nối các waypoint (lat/lon) bằng đường ngắn nhất; trả về node, điểm kèm tag way, chiều dài. */
export function routeThrough(g, waypoints) {
  const nodeIds = [], wayOf = [];
  let lengthM = 0;
  for (let i = 0; i + 1 < waypoints.length; i++) {
    // node gần nhất có thể thuộc cụm đường cụt → thử lần lượt các node gần nhất
    const SNAP_M = 120;
    const as = i === 0 || !nodeIds.length ? nearestNodes(g, waypoints[i].lat, waypoints[i].lon, 12, SNAP_M) : [nodeIds[nodeIds.length - 1]];
    const bs = nearestNodes(g, waypoints[i + 1].lat, waypoints[i + 1].lon, 12, SNAP_M);
    if (!as.length || !bs.length) throw new Error(`Waypoint ${!as.length ? i : i + 1} cách đường quá ${SNAP_M} m`);
    let r = null, a = as[0], b = bs[0];
    outer: for (const ca of as) for (const cb of bs) { if (ca === cb) continue; const cand = shortestPath(g, ca, cb, true); if (cand) { r = cand; a = ca; b = cb; break outer; } }
    if (!r) throw new Error(`Không tìm được đường từ waypoint ${i} tới ${i + 1} (node ${a} → ${b})`);
    lengthM += r.lengthM;
    r.path.forEach((id, k) => {
      if (k === 0 && nodeIds.length) return; // trùng node nối
      nodeIds.push(id);
      wayOf.push(k === 0 ? r.via.get(r.path[1]) : r.via.get(id));
    });
  }
  const points = nodeIds.map((id, k) => ({ ...g.nodes.get(id), id, wayId: wayOf[k], tags: g.ways.get(wayOf[k]) || {} }));
  return { nodeIds, points, lengthM };
}
