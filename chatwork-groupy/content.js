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

    // 既存グループの開閉状態を保存
    const groupOpenState = new Map();
    roomList.querySelectorAll('.chatwork-groupy-group').forEach(group => {
      const header = group.querySelector('.chatwork-groupy-header');
      const groupName = header && header.querySelector('span') ? header.querySelector('span').textContent : '';
      if (group.classList.contains('open')) {
        groupOpenState.set(groupName, true);
      }
    });

    roomList.querySelectorAll('.chatwork-groupy-group').forEach(group => {
      // グループ内のli[role=tab]をroomList内のグループdivの直前に戻す
      const content = group.querySelector('.chatwork-groupy-content');
      if (content) {
        Array.from(content.children).forEach(child => {
          if (child.matches && child.matches('li[role="tab"]')) {
            roomList.insertBefore(child, group);
          }
        });
      }
      group.remove();
    });

    if (rules.length > 0) {
      const allRooms = Array.from(roomList.querySelectorAll(SELECTORS.ROOM_ITEM));
      const groupDivs = [];
      for (const rule of rules) {
        const matchingRooms = allRooms.filter(room => {
          const roomName = room.getAttribute('aria-label');
          if (!roomName) return false;
          return Array.isArray(rule.keywords) && rule.keywords.some(kw => roomName.includes(kw));
        });
        if (matchingRooms.length > 0) {
          let totalUnread = 0;
          let hasTo = false;
          matchingRooms.forEach(room => {
            const unreadLi = room.querySelector("li[data-testid='unread-badge-with-mention']");
            if (unreadLi) {
              const unreadSpan = unreadLi.querySelector('span');
              const unread = unreadSpan ? parseInt(unreadSpan.textContent, 10) || 0 : 0;
              totalUnread += unread;
              hasTo = true;
            }
          });
          const bgColor = rule.backgroundColor || '#f6f8fa';
          const txtColor = rule.textColor || '#24292e';
          const groupContainer = document.createElement('div');
          groupContainer.className = 'chatwork-groupy-group';
          // 開閉状態を復元
          if (groupOpenState.get(rule.groupName)) {
            groupContainer.classList.add('open');
          }
          groupContainer.innerHTML = `
            <div class="chatwork-groupy-header" style="background-color: ${bgColor}; color: ${txtColor};">
              <span>${rule.groupName}</span>
              <span class="chatwork-groupy-count">
                <span title="未読数" class="cwgy-badge cwgy-unread"><span class="cwgy-label">未読</span> ${totalUnread}</span>
                ${hasTo ? '<span title="Toあり" class="cwgy-badge cwgy-to"><span class="cwgy-label">To</span></span>' : ''}
              </span>
            </div>
            <div class="chatwork-groupy-content"></div>
          `;
          const contentDiv = groupContainer.querySelector('.chatwork-groupy-content');
          matchingRooms.forEach(room => contentDiv.appendChild(room));
          groupDivs.push(groupContainer);
          const header = groupContainer.querySelector('.chatwork-groupy-header');
          header.addEventListener('click', () => {
              groupContainer.classList.toggle('open');
          });
        }
      }
      // すべてのグループdivをroomList内の最初のグループdivまたはli[role=tab]の直前に順にinsertBefore
      let insertBeforeTarget = roomList.firstChild;
      for (const groupDiv of groupDivs) {
        // insertBeforeの安全な実行
        if (insertBeforeTarget && insertBeforeTarget.parentNode === roomList) {
          roomList.insertBefore(groupDiv, insertBeforeTarget);
        } else {
          roomList.appendChild(groupDiv);
        }
        insertBeforeTarget = groupDiv.nextSibling;
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

// ▼▼▼ 並び順更新メッセージを受けて再グループ化 ▼▼▼
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'RULES_ORDER_UPDATED') {
    debugLog('RULES_ORDER_UPDATEDメッセージを受信。グループ再構築します。');
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