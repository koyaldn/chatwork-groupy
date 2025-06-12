// デバッグログ
function debugLog(message) {
  console.log(`[Chatwork Groupy] ${message}`);
}

// アクティブなタブの取得
async function getActiveTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      debugLog('アクティブなタブが見つかりません');
      return null;
    }
    return tabs[0];
  } catch (error) {
    debugLog('タブの取得に失敗:', error);
    return null;
  }
}

// コンテンツスクリプトの注入
async function injectContentScript(tabId) {
  if (!tabId) {
    debugLog('無効なタブIDです');
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    debugLog(`タブ ${tabId} にコンテンツスクリプトを注入しました`);
  } catch (error) {
    debugLog(`タブ ${tabId} へのコンテンツスクリプト注入に失敗:`, error);
  }
}

// インストール時の処理
chrome.runtime.onInstalled.addListener(async () => {
  debugLog('拡張機能がインストールされました');
  await chrome.storage.sync.set({ rules: [] });
});

// タブ更新の監視
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('chatwork.com')) {
    debugLog(`Chatworkタブが更新されました: ${tabId}`);
    injectContentScript(tabId);
  }
});

// メッセージの処理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  debugLog('メッセージを受信:', message);

  if (message.type === 'GET_ACTIVE_TAB') {
    getActiveTab().then(tab => {
      if (tab) {
        sendResponse({ tabId: tab.id });
      } else {
        sendResponse({ error: 'アクティブなタブが見つかりません' });
      }
    });
    return true;
  }

  if (message.type === 'INJECT_CONTENT_SCRIPT' && sender.tab?.id) {
    injectContentScript(sender.tab.id).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ error: error.message });
    });
    return true;
  }

  sendResponse({ error: '不明なメッセージタイプ' });
});

// タブが閉じられたときの処理
chrome.tabs.onRemoved.addListener((tabId) => {
  debugLog('タブが閉じられました:', tabId);
});

// Service Workerのエラーハンドリング
self.addEventListener('error', (event) => {
  debugLog('Service Workerエラーが発生:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  debugLog('未処理のPromiseエラーが発生:', event.reason);
}); 