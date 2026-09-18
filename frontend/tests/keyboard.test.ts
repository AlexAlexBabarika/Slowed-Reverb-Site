import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { writable } from 'svelte/store';
import { handleShortcut } from '../src/lib/keyboard';
import * as player from '../src/lib/stores/player';
import { shortcutsEnabled } from '../src/lib/stores/preferences';
import { FakeAudioBuffer } from './fakes';

vi.mock('../src/lib/stores/player', () => ({
  buffer: writable<AudioBuffer | null>(null),
  loading: writable(false),
  currentTime: writable(20),
  duration: writable(100),
  next: vi.fn(), prev: vi.fn(), seekFraction: vi.fn(), stopPlayback: vi.fn(), toggle: vi.fn(), toggleLoop: vi.fn()
}));

const help = vi.fn();
const listener = (event: KeyboardEvent) => handleShortcut(event, help);

function press(key: string, options: KeyboardEventInit = {}, target: EventTarget = document.body) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
  target.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  vi.clearAllMocks();
  shortcutsEnabled.set(true);
  player.buffer.set(new FakeAudioBuffer(2, 100000, 1000) as unknown as AudioBuffer);
  player.loading.set(false);
  window.addEventListener('keydown', listener);
});

afterEach(() => {
  window.removeEventListener('keydown', listener);
  document.body.replaceChildren();
});

test('transport shortcuts delegate to existing player actions and suppress scrolling', () => {
  expect(press(' ').defaultPrevented).toBe(true);
  press('Escape');
  press('r');
  press('ArrowLeft');
  press('ArrowRight');
  press('ArrowLeft', { shiftKey: true });
  press('ArrowRight', { shiftKey: true });
  expect(player.toggle).toHaveBeenCalledOnce();
  expect(player.stopPlayback).toHaveBeenCalledOnce();
  expect(player.toggleLoop).toHaveBeenCalledOnce();
  expect(player.prev).toHaveBeenCalledOnce();
  expect(player.next).toHaveBeenCalledOnce();
  expect(player.seekFraction).toHaveBeenNthCalledWith(1, 0.15);
  expect(player.seekFraction).toHaveBeenNthCalledWith(2, 0.25);
});

test.each([
  '<input>', '<textarea></textarea>', '<select></select>', '<button><span>Play</span></button>',
  '<a href="#"><span>Link</span></a>', '<summary>Details</summary>',
  '<div contenteditable="true"><span>Text</span></div>', '<div role="slider"></div>',
  '<div role="button"></div>', '<div role="textbox"></div>'
])('preserves native input handling for %s', (markup) => {
  document.body.innerHTML = markup;
  const target = document.body.querySelector('span') ?? document.body.firstElementChild!;
  expect(press(' ', {}, target).defaultPrevented).toBe(false);
  press('ArrowRight', {}, target);
  press('?', {}, target);
  expect(player.toggle).not.toHaveBeenCalled();
  expect(player.seekFraction).not.toHaveBeenCalled();
  expect(help).not.toHaveBeenCalled();
});

test('does not hijack inputs inside a shadow root', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  const input = document.createElement('input');
  root.append(input);
  press(' ', { composed: true }, input);
  expect(player.toggle).not.toHaveBeenCalled();
});

test.each(['<dialog open></dialog>', '<div role="dialog" aria-modal="true"></div>'])(
  'dialogs suppress global shortcuts including Escape',
  (markup) => {
    document.body.innerHTML = markup;
    expect(press('Escape').defaultPrevented).toBe(false);
    press(' ');
    press('?');
    expect(player.stopPlayback).not.toHaveBeenCalled();
    expect(player.toggle).not.toHaveBeenCalled();
    expect(help).not.toHaveBeenCalled();
  }
);

test.each([
  { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }, { repeat: true }, { isComposing: true }
])('preserves modified, repeated, or composing key events %j', (options) => {
  expect(press(' ', options).defaultPrevented).toBe(false);
  press('r', options);
  expect(player.toggle).not.toHaveBeenCalled();
  expect(player.toggleLoop).not.toHaveBeenCalled();
});

test('ignores events already handled by another control', () => {
  const event = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
  event.preventDefault();
  handleShortcut(event, help);
  expect(player.toggle).not.toHaveBeenCalled();
});

test('help works without a track, and all shortcuts can be disabled', () => {
  player.buffer.set(null);
  expect(press(' ').defaultPrevented).toBe(false);
  expect(press('?', { shiftKey: true }).defaultPrevented).toBe(true);
  expect(help).toHaveBeenCalledOnce();
  shortcutsEnabled.set(false);
  expect(press('?').defaultPrevented).toBe(false);
  expect(help).toHaveBeenCalledOnce();
});

test('only Stop remains available while a track is loading', () => {
  player.loading.set(true);
  player.buffer.set(null);
  expect(press(' ').defaultPrevented).toBe(false);
  expect(press('ArrowRight').defaultPrevented).toBe(false);
  expect(press('Escape').defaultPrevented).toBe(true);
  expect(player.stopPlayback).toHaveBeenCalledOnce();
  expect(player.toggle).not.toHaveBeenCalled();
});
