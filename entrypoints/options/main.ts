import {
  buildSiteRegex,
  getFromStorage,
  isValidObj,
  logExtensionError,
  saveToStorage,
  showAlert
} from '../shared/utils';

function logOptionsError(context: string, error: unknown) {
  logExtensionError(context, error);
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    updateViews();

    // --- Event Listeners ---

    // Sites
    const siteInput = document.getElementById('website_input') as HTMLInputElement;
    const siteBtn = document.getElementById('add_sites') as HTMLButtonElement;
    const siteClearBtn = document.getElementById('clear_sites') as HTMLButtonElement;

    siteBtn.addEventListener('click', () => addSite(siteInput));
    siteInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addSite(siteInput);
    });
    siteClearBtn.addEventListener('click', () => clearList('wordspotting_website_list', updateWebListDisplay));

    // Keywords
    const wordInput = document.getElementById('bl_word_input') as HTMLInputElement;
    const wordBtn = document.getElementById('add_bl_word') as HTMLButtonElement;
    const wordClearBtn = document.getElementById('clear_keywords') as HTMLButtonElement;

    wordBtn.addEventListener('click', () => addWord(wordInput));
    wordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addWord(wordInput);
    });
    wordClearBtn.addEventListener('click', () => clearList('wordspotting_word_list', updateBLWordListDisplay));

    // Switches
    (document.getElementById('notifications_switch') as HTMLInputElement).addEventListener('change', function () {
      const status = this.checked;
      saveToStorage({ wordspotting_notifications_on: status }).then(() => {
        showAlert(`Notifications turned ${status ? 'ON' : 'OFF'}`, 'Settings Saved', true);
      }).catch((error) => logOptionsError('Failed to update notifications switch', error));
    });

    (document.getElementById('extension_switch') as HTMLInputElement).addEventListener('change', function () {
      const status = this.checked;
      saveToStorage({ wordspotting_extension_on: status }).then(() => {
        showAlert(`Extension turned ${status ? 'ON' : 'OFF'}`, 'Settings Saved', true);
      }).catch((error) => logOptionsError('Failed to update extension switch', error));
    });

    // Highlight Switch
    const highlightSwitch = document.getElementById('highlight_switch') as HTMLInputElement;
    const colorRow = document.getElementById('highlight_color_row') as HTMLElement;
    highlightSwitch.addEventListener('change', function () {
      const status = this.checked;
      colorRow.style.display = status ? 'flex' : 'none';
      saveToStorage({ wordspotting_highlight_on: status }).then(() => {
        showAlert(`Highlighting turned ${status ? 'ON' : 'OFF'}`, 'Settings Saved', true);
      }).catch((error) => logOptionsError('Failed to update highlight switch', error));
    });

    // Highlight Color
    const colorInput = document.getElementById('highlight_color_input') as HTMLInputElement;
    colorInput.addEventListener('change', function () {
      const color = this.value;
      void saveToStorage({ wordspotting_highlight_color: color })
        .catch((error) => logOptionsError('Failed to update highlight color', error));
    });

    // Theme select
    const themeSelect = document.getElementById('theme_select') as HTMLSelectElement;
    themeSelect.addEventListener('change', () => {
      const value = themeSelect.value;
      applyTheme(value);
      void saveToStorage({ wordspotting_theme: value })
        .catch((error) => logOptionsError('Failed to update theme setting', error));
    });

    // Delegate click for removing items
    document.body.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (target?.classList.contains('chip')) {
        const type = target.dataset.type; // 'site' or 'word'
        const index = parseInt(target.dataset.index || '0', 10);
        removeIndex(type, index);
      }
    });
  });
}

// --- Logic ---

function addSite(input: HTMLInputElement) {
  const rawValue = input.value;
  if (!rawValue || !rawValue.trim()) {
    shakeInput(input);
    return;
  }

  // Split and Clean
  const list = rawValue.split(',').map((s) => s.trim()).filter((s) => s.length > 0);

  if (list.length === 0) {
    shakeInput(input);
    return;
  }

  const { valid, invalid } = partitionSitePatterns(list);

  if (invalid.length > 0) {
    showAlert(`Skipped invalid pattern(s): ${invalid.join(', ')}`, 'Validation', false);
  }

  if (valid.length === 0) {
    shakeInput(input);
    return;
  }

  getFromStorage<Record<string, unknown>>('wordspotting_website_list').then((items) => {
    const stored = Array.isArray(items.wordspotting_website_list) ? items.wordspotting_website_list as string[] : [];
    const merged = mergeUnique(stored, valid);
    return saveToStorage({ wordspotting_website_list: merged });
  }).then(() => {
    input.value = '';
    updateWebListDisplay();
    showAlert('Website(s) added.', 'Success', true);
  }).catch((error) => logOptionsError('Failed to add site patterns', error));
}

function addWord(input: HTMLInputElement) {
  const rawValue = input.value;
  if (!rawValue || !rawValue.trim()) {
    shakeInput(input);
    return;
  }

  // Split and Clean
  const list = rawValue.split(',').map((s) => s.trim()).filter((s) => s.length > 0);

  if (list.length === 0) {
    shakeInput(input);
    return;
  }

  const { valid, invalid } = partitionKeywordPatterns(list);

  if (invalid.length > 0) {
    showAlert(`Skipped invalid regex: ${invalid.join(', ')}`, 'Validation', false);
  }

  if (valid.length === 0) {
    shakeInput(input);
    return;
  }

  getFromStorage<Record<string, unknown>>('wordspotting_word_list').then((items) => {
    const stored = Array.isArray(items.wordspotting_word_list) ? items.wordspotting_word_list as string[] : [];
    const merged = mergeUnique(stored, valid);
    return saveToStorage({ wordspotting_word_list: merged });
  }).then(() => {
    input.value = '';
    updateBLWordListDisplay();
    showAlert('Keyword(s) added.', 'Success', true);
  }).catch((error) => logOptionsError('Failed to add keyword patterns', error));
}

function removeIndex(type: string | undefined, index: number) {
  const key = (type === 'site') ? 'wordspotting_website_list' : 'wordspotting_word_list';

  getFromStorage<Record<string, unknown>>(key).then((items) => {
    const stored = items[key] as string[] | undefined;
    if (isValidObj(stored)) {
      stored.splice(index, 1);
      return saveToStorage({ [key]: stored });
    }
    return undefined;
  }).then(() => {
    if (type === 'site') {
      updateWebListDisplay();
    } else {
      updateBLWordListDisplay();
    }
  }).catch((error) => logOptionsError('Failed to remove list item', error));
}

function clearList(key: string, updateFn: () => void) {
  if (confirm('Are you sure you want to clear this list?')) {
    saveToStorage({ [key]: [] }).then(() => {
      updateFn();
      showAlert('List cleared.', 'Success', true);
    }).catch((error) => logOptionsError('Failed to clear list', error));
  }
}

function updateViews() {
  updateWebListDisplay();
  updateNotifSwitchDisplay();
  updateExtSwitchDisplay();
  updateHighlightSettingsDisplay();
  updateBLWordListDisplay();
  updateThemeDisplay();
}

function updateWebListDisplay() {
  getFromStorage<Record<string, unknown>>('wordspotting_website_list').then((items) => {
    const stored = items.wordspotting_website_list as string[] | undefined;
    const container = document.getElementById('website_list_container') as HTMLElement;
    container.innerHTML = '';

    if (isValidObj(stored) && stored.length > 0) {
      stored.forEach((item, index) => {
        const chip = createChip(item, index, 'site');
        container.appendChild(chip);
      });
    } else {
      container.innerHTML = '<small>No sites added.</small>';
    }
  }).catch((error) => logOptionsError('Failed to load site list', error));
}

function updateBLWordListDisplay() {
  getFromStorage<Record<string, unknown>>('wordspotting_word_list').then((items) => {
    const stored = items.wordspotting_word_list as string[] | undefined;
    const container = document.getElementById('bl_word_list_container') as HTMLElement;
    container.innerHTML = '';

    if (isValidObj(stored) && stored.length > 0) {
      stored.forEach((item, index) => {
        const chip = createChip(item, index, 'word');
        container.appendChild(chip);
      });
    } else {
      container.innerHTML = '<small>No keywords added.</small>';
    }
  }).catch((error) => logOptionsError('Failed to load keyword list', error));
}

function createChip(text: string, index: number, type: string) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chip';
  chip.textContent = text;
  chip.dataset.index = String(index);
  chip.dataset.type = type;
  chip.title = 'Click to remove';
  chip.setAttribute('aria-label', `Remove ${text}`);
  return chip;
}

function updateNotifSwitchDisplay() {
  getFromStorage<Record<string, unknown>>('wordspotting_notifications_on').then((items) => {
    const status = items.wordspotting_notifications_on as boolean | undefined;
    (document.getElementById('notifications_switch') as HTMLInputElement).checked = (status !== false);
  }).catch((error) => logOptionsError('Failed to load notifications switch state', error));
}

function updateExtSwitchDisplay() {
  getFromStorage<Record<string, unknown>>('wordspotting_extension_on').then((items) => {
    const status = items.wordspotting_extension_on as boolean | undefined;
    (document.getElementById('extension_switch') as HTMLInputElement).checked = (status !== false);
  }).catch((error) => logOptionsError('Failed to load extension switch state', error));
}

function updateHighlightSettingsDisplay() {
  getFromStorage<Record<string, unknown>>([
    'wordspotting_highlight_on',
    'wordspotting_highlight_color'
  ]).then((items) => {
    const status = items.wordspotting_highlight_on === true;
    const color = (items.wordspotting_highlight_color as string) || '#FFFF00';

    (document.getElementById('highlight_switch') as HTMLInputElement).checked = status;
    (document.getElementById('highlight_color_input') as HTMLInputElement).value = color;
    (document.getElementById('highlight_color_row') as HTMLElement).style.display = status ? 'flex' : 'none';
  }).catch((error) => logOptionsError('Failed to load highlight settings', error));
}

function shakeInput(input: HTMLInputElement) {
  input.style.borderColor = 'var(--danger-color)';
  setTimeout(() => {
    input.style.borderColor = 'var(--border-color)';
  }, 500);
}

function updateThemeDisplay() {
  getFromStorage<Record<string, unknown>>('wordspotting_theme').then((items) => {
    const theme = (items.wordspotting_theme as string) || 'system';
    const select = document.getElementById('theme_select') as HTMLSelectElement;
    select.value = theme;
    applyTheme(theme);
  }).catch((error) => logOptionsError('Failed to load theme setting', error));
}

function applyTheme(value: string) {
  const root = document.documentElement;
  if (value === 'light') {
    root.setAttribute('data-theme', 'light');
  } else if (value === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.removeAttribute('data-theme');
  }
}

export function partitionKeywordPatterns(list: string[]) {
  const valid: string[] = [];
  const invalid: string[] = [];

  list.forEach((item) => {
    try {
      // Validate regex
      new RegExp(item);
      valid.push(item);
    } catch {
      invalid.push(item);
    }
  });

  return { valid, invalid };
}

export function partitionSitePatterns(list: string[], siteRegexBuilder: (pattern: string) => RegExp | null = buildSiteRegex) {
  const valid: string[] = [];
  const invalid: string[] = [];

  list.forEach((item) => {
    const regex = siteRegexBuilder(item);
    if (regex) {
      valid.push(item);
    } else {
      invalid.push(item);
    }
  });

  return { valid, invalid };
}

export function mergeUnique(existing: string[], additions: string[]) {
  return Array.from(new Set([...(existing || []), ...(additions || [])]));
}
