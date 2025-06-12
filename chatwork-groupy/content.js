// content.js (機能追加版)

console.log('%c[Chatwork Groupy] Version 3.0 Loaded!', 'color: green; font-weight: bold; font-size: 16px;');

const SELECTORS = {
  ROOM_LIST: '#RoomList',
  ROOM_ITEM: 'li[role="tab"]',
};

function debugLog(message, ...args) {
  console.log(`[Chatwork Groupy] ${message}`, ...args);
}

async function getRules() {
  const { rules = [] } = await chrome.storage.sync.get('rules');
  return rules;
}

const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(groupChats, 500);
});
let debounceTimer;

async function groupChats() {
  observer.disconnect();
  
  try {
    const rules = await getRules();
    const roomList = document.querySelector(SELECTORS.ROOM_LIST);
    if (!roomList) return;

    roomList.querySelectorAll('.chatwork-groupy-group').forEach(group => {
      const content = group.querySelector('.chatwork-groupy-content');
      if (content) {
        while (content.firstChild) {
          roomList.appendChild(content.firstChild);
        }
      }
      group.remove();
    });

    if (rules.length > 0) {
      for (const rule of rules) {
        const matchingRooms = Array.from(roomList.querySelectorAll(SELECTORS.ROOM_ITEM)).filter(room => {
          const roomName = room.getAttribute('aria-label');
          if (!roomName) return false;
          
          // ▼▼▼ 複数キーワードに対応するための修正 ▼▼▼
          // rule.keywordsが配列であることを確認し、その中のいずれかのキーワードが含まれるかチェック
          return Array.isArray(rule.keywords) && rule.keywords.some(kw => roomName.includes(kw));
        });

        if (matchingRooms.length > 0) {
          const groupContainer = document.createElement('div');
          groupContainer.className = 'chatwork-groupy-group';
          groupContainer.innerHTML = `
            <div class="chatwork-groupy-header">
              <span>${rule.groupName}</span>
              <span class="chatwork-groupy-count">${matchingRooms.length}</span>
            </div>
            <div class="chatwork-groupy-content"></div>
          `;
          const contentDiv = groupContainer.querySelector('.chatwork-groupy-content');
          matchingRooms.forEach(room => contentDiv.appendChild(room));
          roomList.prepend(groupContainer);

          // ヘッダーをクリックして開閉
          const header = groupContainer.querySelector('.chatwork-groupy-header');
          header.addEventListener('click', () => {
              groupContainer.classList.toggle('open');
          });
        }
      }
    }
  } catch (error) {
    debugLog('チャットのグループ化に失敗:', error);
  } finally {
    const roomList = document.querySelector(SELECTORS.ROOM_LIST);
    if (roomList) {
      observer.observe(roomList, { childList: true, subtree: true });
    }
  }
}

// ルール変更を検知して即時反映
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.rules) {
    debugLog('ルールの変更を検知しました。即時反映します。');
    groupChats();
  }
});

function initialize() {
  const roomList = document.querySelector(SELECTORS.ROOM_LIST);
  if (roomList) {
    groupChats();
  } else {
    setTimeout(initialize, 500);
  }
}

initialize();