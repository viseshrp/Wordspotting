import {
  buildPatternsForTab,
  getFromStorage,
  isUrlAllowed,
  saveToStorage,
  showAlert
} from '../shared/utils';

document.addEventListener('DOMContentLoaded', () => {
  // UI References
  const keywordContainer = document.getElementById('keyword_container') as HTMLElement | null;
  const addSiteBtn = document.getElementById('add_current_site') as HTMLButtonElement | null;
  const addSiteSection = document.getElementById('add_site_section') as HTMLElement | null;
  const siteScopeSelect = document.getElementById('site_scope_select') as HTMLSelectElement | null;
  const refreshOnAddToggle = document.getElementById('refresh_on_add') as HTMLInputElement | null;
  const scopeOptions = [
    { value: 'root', label: 'Root domain' },
    { value: 'subdomain', label: 'This subdomain' },
    { value: 'path', label: 'URL path' },
    { value: 'full', label: 'Full URL (exact match)' }
  ];
  const refreshPrefKey = 'wordspotting_refresh_on_add';

  // Theme
  getFromStorage<Record<string, unknown>>('wordspotting_theme').then((items) => {
    const theme = (items.wordspotting_theme as string) || 'system';
    applyTheme(theme);
  });
  getFromStorage<Record<string, unknown>>(refreshPrefKey).then((items) => {
    if (refreshOnAddToggle) {
      refreshOnAddToggle.checked = (items[refreshPrefKey] as boolean | undefined) !== false;
    }
  });

  // Connect to Content Script
  browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    const currTab = tabs[0];
    if (currTab) {
      checkActivation(currTab).then((activation) => {
        if (!activation.allowed) {
          setAddSiteVisibility(true);
          renderEmpty('This site is not in your allowed list.');
          return;
        }
        setAddSiteVisibility(false);

        if (!activation.hasPermission) {
          setAddSiteVisibility(true);
          renderEmpty('Permission not granted for this site.');
          return;
        }

        if (typeof currTab.id !== 'number') return;
        browser.tabs.sendMessage(
          currTab.id,
          { from: 'popup', subject: 'word_list_request' }
        ).then((response) => {
          if (response) {
            renderKeywords(response.word_list as string[] | undefined);

            // Set badge text (sync with what we see)
            const count = response.word_list ? response.word_list.length : 0;
            void browser.action.setBadgeText({
              text: count > 0 ? count.toString() : '0',
              tabId: currTab.id
            });
          }
        }).catch(() => {
          // Content script might not be injected yet
          renderEmpty('Not active on this page.');
        });
      });
      if (currTab.url) updateSitePreview(currTab.url);
    }
  });

  if (addSiteBtn) {
    addSiteBtn.addEventListener('click', () => {
      browser.tabs.query({ active: true, currentWindow: true }).then(async (tabs) => {
        const tab = tabs[0];
        if (!tab || !tab.url || typeof tab.id !== 'number') return;

        const scope = getSelectedScope();
        const pattern = buildPatternForTab(tab.url, scope);

        try {
          const items = await getFromStorage<Record<string, unknown>>('wordspotting_website_list');
          const existing = Array.isArray(items.wordspotting_website_list)
            ? (items.wordspotting_website_list as string[])
            : [];
          const merged = mergeUnique(existing, [pattern]);
          await saveToStorage({ wordspotting_website_list: merged });
          showAlert(`Added "${pattern}" to allowlist`, 'Saved', true);
          setAddSiteVisibility(false);
          window.close();
          if (refreshOnAddToggle?.checked) {
            await browser.tabs.reload(tab.id);
          }
        } catch (e) {
          console.error('Failed to add site to allowlist', e);
          showAlert('Could not save site.', 'Error', false);
        }
      });
    });
  }

  if (refreshOnAddToggle) {
    refreshOnAddToggle.addEventListener('change', () => {
      saveToStorage({ [refreshPrefKey]: refreshOnAddToggle.checked })
        .catch((e) => console.error('Failed to save refresh setting', e));
    });
  }

  if (siteScopeSelect) {
    siteScopeSelect.addEventListener('change', () => {
      browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        const tab = tabs[0];
        if (tab?.url) {
          updateSitePreview(tab.url);
        }
      });
    });
  }

  // Options Button
  const optionsButton = document.getElementById('options_btn');
  optionsButton?.addEventListener('click', () => {
    if (browser.runtime.openOptionsPage) {
      void browser.runtime.openOptionsPage();
    } else {
      window.open(browser.runtime.getURL('options.html'));
    }
  });

  function renderKeywords(list?: string[]) {
    if (!keywordContainer) return;
    keywordContainer.innerHTML = '';

    if (!list || list.length === 0) {
      renderEmpty('No keywords found.');
      return;
    }

    // Unique keywords
    const uniqueList = [...new Set(list)];

    uniqueList.forEach((word) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = word;
      keywordContainer.appendChild(chip);
    });
  }

  function renderEmpty(msg: string) {
    if (!keywordContainer) return;
    keywordContainer.innerHTML = `<div class="empty-state">${msg}</div>`;
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

  async function checkActivation(tab: chrome.tabs.Tab) {
    try {
      const items = await getFromStorage<Record<string, unknown>>('wordspotting_website_list');
      const allowedSites = (items.wordspotting_website_list as string[]) || [];
      const allowed = tab.url ? isUrlAllowed(tab.url, allowedSites) : false;
      if (tab.url) updateSitePreview(tab.url);
      return { allowed, hasPermission: true };
    } catch (e) {
      console.error('Activation check failed:', e);
      return { allowed: false, hasPermission: false };
    }
  }

  function getSelectedScope() {
    return siteScopeSelect?.value || 'root';
  }

  function buildPatternForTab(urlString: string, scope: string) {
    const patterns = buildPatternsForTab(urlString);
    const pattern = (patterns as Record<string, string>)[scope];
    if (!pattern) {
      throw new Error('Invalid URL');
    }
    return pattern;
  }

  function updateSitePreview(urlString: string) {
    try {
      updateScopeOptions(urlString);
    } catch (e) {
      console.warn('Failed to update scope options', e);
    }
  }

  function updateScopeOptions(urlString: string) {
    if (!siteScopeSelect) return;
    const selectedValue = siteScopeSelect.value || 'root';
    const uniquePatterns = new Set<string>();
    const optionsToRender: Array<{ value: string; text: string }> = [];
    const patterns = buildPatternsForTab(urlString) as Record<string, string>;

    scopeOptions.forEach((scopeOption) => {
      const pattern = patterns[scopeOption.value] || '';
      if (!pattern || uniquePatterns.has(pattern)) {
        return;
      }
      uniquePatterns.add(pattern);
      optionsToRender.push({
        value: scopeOption.value,
        text: `${scopeOption.label} (${pattern})`
      });
    });

    siteScopeSelect.innerHTML = '';
    optionsToRender.forEach((optionData) => {
      const option = document.createElement('option');
      option.value = optionData.value;
      option.textContent = optionData.text;
      siteScopeSelect.appendChild(option);
    });

    const hasSelected = optionsToRender.some((option) => option.value === selectedValue);
    if (hasSelected) {
      siteScopeSelect.value = selectedValue;
      return;
    }
    const rootOption = optionsToRender.find((option) => option.value === 'root');
    siteScopeSelect.value = rootOption ? rootOption.value : (optionsToRender[0]?.value || 'root');
  }

  function mergeUnique(existing: string[], additions: string[]) {
    return Array.from(new Set([...(existing || []), ...(additions || [])]));
  }

  function setAddSiteVisibility(isVisible: boolean) {
    if (!addSiteSection) return;
    addSiteSection.style.display = isVisible ? '' : 'none';
  }
});
