// popup.js (機能追加版)
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('add-rule-form');
  const groupNameInput = document.getElementById('group-name-input');
  const keywordInput = document.getElementById('keyword-input');
  const rulesList = document.getElementById('rules-list');
  const submitButton = form.querySelector('.add-button');
  const backgroundColorInput = document.getElementById('background-color-input');

  // ルールを描画する関数
  async function renderRules() {
    const { rules = [] } = await chrome.storage.sync.get('rules');
    rulesList.innerHTML = ''; 

    if (rules.length === 0) {
      rulesList.innerHTML = '<li>ルールはまだありません。</li>';
      return;
    }

    rules.forEach(rule => {
      const li = document.createElement('li');
      li.className = 'rule-item';
      // 複数キーワードをカンマ区切りの文字列に戻して表示
      const keywordsText = Array.isArray(rule.keywords) ? rule.keywords.join(', ') : rule.keywords;
      const bgColor = rule.backgroundColor || '#f6f8fa';
      li.innerHTML = `
        <div class="rule-details">
          <div class="group-name">${rule.groupName}</div>
          <div class="keyword">キーワード: ${keywordsText}</div>
          <div class="color-sample" style="margin-top:4px;">
            <span style="display:inline-block;width:18px;height:18px;border-radius:4px;background:${bgColor};border:1px solid #ccc;vertical-align:middle;"></span>
          </div>
        </div>
        <div class="rule-actions">
          <button class="action-button edit-button" data-rule-id="${rule.id}" title="編集">
            <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
          <button class="action-button delete-button" data-rule-id="${rule.id}" title="削除">
            <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      `;
      rulesList.appendChild(li);
    });
  }

  // フォームをリセットする関数
  function resetForm() {
    form.reset();
    delete form.dataset.editingId;
    submitButton.textContent = 'ルールを追加';
    submitButton.classList.remove('update-mode');
    backgroundColorInput.value = '#f6f8fa';
  }

  // 追加または更新の処理
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const groupName = groupNameInput.value.trim();
    const keywordsRaw = keywordInput.value.trim();
    const editingId = form.dataset.editingId ? Number(form.dataset.editingId) : null;
    const backgroundColor = backgroundColorInput.value || '#f6f8fa';

    if (groupName && keywordsRaw) {
      // カンマで分割し、各キーワードの空白を除去し、空のものをフィルタリング
      const keywords = keywordsRaw.split(',').map(kw => kw.trim()).filter(Boolean);

      let { rules = [] } = await chrome.storage.sync.get('rules');

      if (editingId) { // 更新モード
        rules = rules.map(rule => 
          rule.id === editingId ? { ...rule, groupName, keywords, backgroundColor } : rule
        );
      } else { // 追加モード
        rules.push({ id: Date.now(), groupName, keywords, backgroundColor });
      }

      await chrome.storage.sync.set({ rules });
      resetForm();
      renderRules();
    }
  });

  // 編集と削除の処理（イベントデリゲーション）
  rulesList.addEventListener('click', async (e) => {
    const button = e.target.closest('.action-button');
    if (!button) return;

    const ruleId = Number(button.dataset.ruleId);
    let { rules = [] } = await chrome.storage.sync.get('rules');

    if (button.classList.contains('delete-button')) {
      rules = rules.filter(rule => rule.id !== ruleId);
      await chrome.storage.sync.set({ rules });
      renderRules();
    } else if (button.classList.contains('edit-button')) {
      const ruleToEdit = rules.find(rule => rule.id === ruleId);
      if (ruleToEdit) {
        groupNameInput.value = ruleToEdit.groupName;
        keywordInput.value = Array.isArray(ruleToEdit.keywords) ? ruleToEdit.keywords.join(', ') : '';
        backgroundColorInput.value = ruleToEdit.backgroundColor || '#f6f8fa';
        form.dataset.editingId = ruleId;
        submitButton.textContent = 'ルールを更新';
        submitButton.classList.add('update-mode');
        groupNameInput.focus();
      }
    }
  });

  // 初期表示
  renderRules();

  // ▼▼▼ 並び順ドラッグ＆ドロップ（Sortable.js） ▼▼▼
  new Sortable(rulesList, {
    animation: 150,
    onEnd: async function (evt) {
      // 並び替え後のrules配列を更新
      let { rules = [] } = await chrome.storage.sync.get('rules');
      if (evt.oldIndex === undefined || evt.newIndex === undefined || evt.oldIndex === evt.newIndex) return;
      // 配列の順序を入れ替え
      const moved = rules.splice(evt.oldIndex, 1)[0];
      rules.splice(evt.newIndex, 0, moved);
      await chrome.storage.sync.set({ rules });
      renderRules();
      // content.jsに並び順更新を通知
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'RULES_ORDER_UPDATED' });
        }
      });
    }
  });
});