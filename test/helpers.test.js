import test from 'node:test';
import assert from 'node:assert/strict';
import {
  slotsFromSTR,
  speedFactorFromEmpty,
  fmtSpeed,
  slowdownLabel,
  contiguousEmpty,
  placeMulti,
  tryPlaceMulti,
  removeMulti,
  moveMulti
} from '../js/helpers.js';

global.alert = () => {};

test('slotsFromSTR returns correct slot counts', () => {
  assert.equal(slotsFromSTR(18), 19);
  assert.equal(slotsFromSTR(16), 18);
  assert.equal(slotsFromSTR(13), 17);
  assert.equal(slotsFromSTR(10), 16);
  assert.equal(slotsFromSTR(6), 15);
  assert.equal(slotsFromSTR(4), 14);
  assert.equal(slotsFromSTR(3), 13);
});

test('speedFactorFromEmpty returns correct speed modifier', () => {
  assert.equal(speedFactorFromEmpty(1), 0.25);
  assert.equal(speedFactorFromEmpty(3), 0.50);
  assert.equal(speedFactorFromEmpty(5), 0.75);
  assert.equal(speedFactorFromEmpty(6), 1.00);
});

test('fmtSpeed formats feet and squares', () => {
  assert.equal(fmtSpeed(30), "30' (10')");
});

test('slowdownLabel describes encumbrance', () => {
  assert.equal(slowdownLabel(1, 10), 'Severely Slowed — 9/10 used');
  assert.equal(slowdownLabel(3, 10), 'Heavily Slowed — 7/10 used');
  assert.equal(slowdownLabel(5, 10), 'Slowed — 5/10 used');
  assert.equal(slowdownLabel(6, 10), 'Unburdened — 4/10 used');
});

test('contiguousEmpty detects available space', () => {
  const arr = [null, null, {filled: true}, null];
  assert.ok(contiguousEmpty(arr, 0, 2));
  assert.ok(!contiguousEmpty(arr, 1, 2));
});

test('placeMulti inserts multi-slot items', () => {
  const slots = Array(5).fill(null);
  placeMulti(slots, 1, 'Item', 2);
  assert.deepEqual(slots[1], { name: 'Item', slots: 2, head: true });
  assert.deepEqual(slots[2], { link: 1 });
});

test('tryPlaceMulti respects available space', () => {
  const slots = Array(5).fill(null);
  assert.equal(tryPlaceMulti(0, 0, 'Item', 2, slots, 'equipped'), true);
  assert.equal(slots[0].name, 'Item');
  assert.equal(tryPlaceMulti(0, 0, 'Another', 2, slots, 'equipped'), false);
});

test('removeMulti clears multi-slot items', () => {
  const slots = Array(5).fill(null);
  placeMulti(slots, 1, 'Item', 2);
  removeMulti(0, 1, slots, 'equipped');
  assert.deepEqual(slots, [null, null, null, null, null]);
});

test('moveMulti moves items between arrays', () => {
  const from = Array(5).fill(null);
  const to = Array(5).fill(null);
  placeMulti(from, 0, 'Item', 2);
  moveMulti(0, 0, 1, 1, 2, from, to, 'equipped', 'backpack');
  assert.deepEqual(from.slice(0, 2), [null, null]);
  assert.deepEqual(to[1], { name: 'Item', slots: 2, head: true });
  assert.deepEqual(to[2], { link: 1 });
});
