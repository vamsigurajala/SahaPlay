import { describe, test, expect, afterEach } from 'vitest';
import { getMenuFloorY } from './chatMenuPlacement';

// The long-press/"..." message menu used to always measure against
// window.innerHeight to decide whether to open above or below a row — which
// only happens to be correct when the chat fills the entire browser window
// (a phone in portrait). On a laptop/tablet, where the chat is a panel
// embedded well above the bottom of the window, that let the menu render
// past the panel's own bottom edge, hidden underneath the message composer.
// The fix measures against the composer's own top edge instead — these
// tests pin that against both ways the caller scopes the search: a direct
// element (GlobalChatWidget's wrapperRef) and a CSS selector resolved via
// `.closest()` (RoomChatPanel's '#room-chat-panel', which can have two
// instances mounted at once).
describe('getMenuFloorY', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function mockTop(el, top) {
    el.getBoundingClientRect = () => ({ top, left: 0, right: 0, bottom: top, width: 0, height: 0 });
  }

  test('measures against the composer inside a directly-passed scope element', () => {
    document.body.innerHTML = `
      <div id="wrapper">
        <div class="row">row</div>
        <textarea class="chat-msg-textarea"></textarea>
      </div>
    `;
    const wrapper = document.getElementById('wrapper');
    const composer = wrapper.querySelector('.chat-msg-textarea');
    mockTop(composer, 500);

    const row = wrapper.querySelector('.row');
    expect(getMenuFloorY(row, wrapper)).toBe(500);
  });

  test('resolves a CSS-selector scope via the row\'s closest() ancestor', () => {
    document.body.innerHTML = `
      <div id="room-chat-panel">
        <div class="row">row</div>
        <textarea class="chat-msg-textarea"></textarea>
      </div>
    `;
    const composer = document.querySelector('.chat-msg-textarea');
    mockTop(composer, 420);

    const row = document.querySelector('.row');
    expect(getMenuFloorY(row, '#room-chat-panel')).toBe(420);
  });

  // The bug this regresses: two chat panel instances can be mounted at
  // once (e.g. a desktop and a mobile-floating RoomChatPanel). Scoping must
  // resolve to the SAME panel instance the row lives in, never just the
  // first '.chat-msg-textarea' found anywhere in the document.
  test('scopes to the row\'s own panel instance, not another mounted panel\'s composer', () => {
    document.body.innerHTML = `
      <div id="room-chat-panel" class="panel-a">
        <div class="row">row A</div>
        <textarea class="chat-msg-textarea"></textarea>
      </div>
      <div id="room-chat-panel" class="panel-b">
        <div class="row">row B</div>
        <textarea class="chat-msg-textarea"></textarea>
      </div>
    `;
    const panelB = document.querySelector('.panel-b');
    mockTop(panelB.querySelector('.chat-msg-textarea'), 999);
    // panel-a's composer intentionally left at the jsdom default (0,0,0,0)
    // rect so a wrong (first-match-in-document) resolution would return 0,
    // not panelB's 999, making a scoping regression fail loudly.

    const rowB = panelB.querySelector('.row');
    expect(getMenuFloorY(rowB, '#room-chat-panel')).toBe(999);
  });

  test('falls back to window.innerHeight when no composer is found in scope', () => {
    document.body.innerHTML = `<div id="wrapper"><div class="row">row</div></div>`;
    const wrapper = document.getElementById('wrapper');
    const row = wrapper.querySelector('.row');
    expect(getMenuFloorY(row, wrapper)).toBe(window.innerHeight);
  });

  test('falls back to window.innerHeight when scope is null/undefined', () => {
    document.body.innerHTML = `<div class="row">row</div>`;
    const row = document.querySelector('.row');
    expect(getMenuFloorY(row, null)).toBe(window.innerHeight);
  });
});
