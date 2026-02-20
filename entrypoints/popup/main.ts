import {
  buildPatternsForTab,
  type ExtensionErrorOperation,
  getFromStorage,
  logExtensionError,
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
    { value: 'section', label: 'Path section' },
    { value: 'path', label: 'URL path' },
  ];
  const refreshPrefKey = 'wordspotting_refresh_on_add';
  const handleAsyncError = (context: string, operation?: ExtensionErrorOperation) => (error: unknown) => {
    logExtensionError(context, error, operation ? { operation } : undefined);
  };

  // Theme
  getFromStorage<Record<string, unknown>>('wordspotting_theme').then((items) => {
    const theme = (items.wordspotting_theme as string) || 'system';
    applyTheme(theme);
  }).catch(handleAsyncError('Failed to load popup theme'));
  getFromStorage<Record<string, unknown>>(refreshPrefKey).then((items) => {
    if (refreshOnAddToggle) {
      refreshOnAddToggle.checked = (items[refreshPrefKey] as boolean | undefined) !== false;
    }
  }).catch(handleAsyncError('Failed to load refresh preference'));

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
            }).catch(handleAsyncError('Failed to sync popup badge count', 'badge_update'));
          }
        }).catch((error) => {
          logExtensionError('Unable to fetch popup word list', error, { operation: 'tab_message' });
          // Content script might not be injected yet
          renderEmpty('Not active on this page.');
        });
      }).catch((error) => {
        logExtensionError('Failed to check popup activation', error);
        renderEmpty('Could not read this tab.');
      });
      if (currTab.url) updateSitePreview(currTab.url);
    }
  }).catch(handleAsyncError('Failed to query active tab for popup', 'tab_query'));

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
            await browser.tabs.reload(tab.id).catch((error) => {
              logExtensionError('Failed to reload tab after adding allowlist site', error, { operation: 'tab_reload' });
            });
          }
        } catch (e) {
          logExtensionError('Failed to add site to allowlist', e);
          showAlert('Could not save site.', 'Error', false);
        }
      }).catch(handleAsyncError('Failed to query active tab while adding site', 'tab_query'));
    });
  }

  if (refreshOnAddToggle) {
    refreshOnAddToggle.addEventListener('change', () => {
      saveToStorage({ [refreshPrefKey]: refreshOnAddToggle.checked })
        .catch((error) => logExtensionError('Failed to save refresh setting', error));
    });
  }

  if (siteScopeSelect) {
    siteScopeSelect.addEventListener('change', () => {
      browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        const tab = tabs[0];
        if (tab?.url) {
          updateSitePreview(tab.url);
        }
      }).catch(handleAsyncError('Failed to refresh popup scope options', 'tab_query'));
    });
  }

  // Options Button
  const optionsButton = document.getElementById('options_btn');
  optionsButton?.addEventListener('click', () => {
    if (browser.runtime.openOptionsPage) {
      void browser.runtime.openOptionsPage().catch(handleAsyncError('Failed to open options page'));
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
    const keywordList = document.createElement('ul');
    keywordList.className = 'list';

    uniqueList.forEach((word) => {
      const item = document.createElement('li');
      item.className = 'item';

      const itemMain = document.createElement('div');
      itemMain.className = 'item-main';

      const itemTitle = document.createElement('div');
      itemTitle.className = 'item-title';
      itemTitle.textContent = word;

      itemMain.appendChild(itemTitle);
      item.appendChild(itemMain);
      keywordList.appendChild(item);
    });

    keywordContainer.appendChild(keywordList);
  }

  function renderEmpty(msg: string) {
    if (!keywordContainer) return;
    keywordContainer.innerHTML = '';
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.textContent = msg;
    keywordContainer.appendChild(emptyState);
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
      logExtensionError('Activation check failed', e);
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
      logExtensionError('Failed to update scope options', e);
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
