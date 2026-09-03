import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph, nearestNode, shortestPath, routeThrough } from '../tools/osmgraph.mjs';

// A(0,0) — B(0,0.001) — C(0,0.002); B → D(0.001,0.001) một chiều; E là đường vòng dài A–E–C.
const elements = [
  { type: 'node', id: 1, lat: 0, lon: 0 },
  { type: 'node', id: 2, lat: 0, lon: 0.001 },
  { type: 'node', id: 3, lat: 0, lon: 0.002 },
  { type: 'node', id: 4, lat: 0.001, lon: 0.001 },
  { type: 'node', id: 5, lat: -0.003, lon: 0.001 },
  { type: 'way', id: 10, nodes: [1, 2], tags: { highway: 'trunk', ref: 'QL.1', lanes: '2' } },
  { type: 'way', id: 11, nodes: [3, 2], tags: { highway: 'trunk', ref: 'QL.1', surface: 'asphalt' } }, // liệt kê ngược chiều đi
  { type: 'way', id: 12, nodes: [2, 4], tags: { highway: 'primary', oneway: 'yes' } },
  { type: 'way', id: 13, nodes: [1, 5, 3], tags: { highway: 'unclassified' } },
];

test('buildGraph joins split ways and honours oneway', () => {
  const g = buildGraph(elements);
  assert.equal(g.nodes.size, 5);
  assert.deepEqual(shortestPath(g, 1, 3), [1, 2, 3]);      // ngắn hơn đường vòng qua E, đi qua way liệt kê ngược
  assert.deepEqual(shortestPath(g, 1, 4), [1, 2, 4]);
  assert.equal(shortestPath(g, 4, 1), null);               // không đi ngược chiều way một chiều
});

test('nearestNode snaps a coordinate to the closest graph node', () => {
  const g = buildGraph(elements);
  assert.equal(nearestNode(g, 0.0001, 0.00095), 2);
});

test('routeThrough chains waypoints and carries way tags per point', () => {
  const g = buildGraph(elements);
  const r = routeThrough(g, [{ lat: 0, lon: 0 }, { lat: 0, lon: 0.002 }, { lat: 0.001, lon: 0.001 }]);
  assert.deepEqual(r.nodeIds, [1, 2, 3, 2, 4]);
  assert.ok(Math.abs(r.lengthM - (111.2 * 3 + 111.2)) < 2, `length ${r.lengthM}`);
  assert.equal(r.points[0].tags.lanes, '2');
  assert.equal(r.points[2].tags.surface, 'asphalt');
  assert.equal(r.points[4].tags.oneway, 'yes');
});

test('routeThrough falls back to the next-nearest nodes when the nearest one is isolated', () => {
  // Node 9 nằm trên một way cụt riêng, rất gần waypoint đầu; đường thật phải đi từ node 1.
  const els = [...elements, { type: 'node', id: 9, lat: 0.00001, lon: 0 }, { type: 'node', id: 8, lat: 0.00002, lon: 0 }, { type: 'way', id: 20, nodes: [9, 8], tags: { highway: 'service' } }];
  const g = buildGraph(els);
  assert.equal(nearestNode(g, 0.000008, 0), 9);
  const r = routeThrough(g, [{ lat: 0.000008, lon: 0 }, { lat: 0, lon: 0.002 }]);
  assert.deepEqual(r.nodeIds, [1, 2, 3]);
});

test('ignoreOneway (closed circuit) lets the path use a oneway way backwards', () => {
  const g = buildGraph(elements, { ignoreOneway: true });
  assert.deepEqual(shortestPath(g, 4, 1), [4, 2, 1]);
});
