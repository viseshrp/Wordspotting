import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const outDir = resolve(process.cwd(), 'store-assets');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();

try {
  const popupPage = await context.newPage();
  await popupPage.setViewportSize({ width: 420, height: 640 });
  await popupPage.goto(`file://${resolve(process.cwd(), 'entrypoints/popup/index.html')}`);
  await popupPage.evaluate(() => {
    const container = document.getElementById('keyword_container');
    if (container) {
      container.innerHTML = '';
      ['Example', 'Domain'].forEach((word) => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = word;
        container.appendChild(chip);
      });
    }
    const addSiteSection = document.getElementById('add_site_section');
    if (addSiteSection) {
      addSiteSection.setAttribute('style', 'display:none;');
    }
  });
  await popupPage.screenshot({ path: resolve(outDir, '01-popup-ui.png') });
  await popupPage.close();

  const optionsPage = await context.newPage();
  await optionsPage.setViewportSize({ width: 1280, height: 800 });
  await optionsPage.goto(`file://${resolve(process.cwd(), 'entrypoints/options/index.html')}`);
  await optionsPage.evaluate(() => {
    const keywordContainer = document.getElementById('bl_word_list_container');
    const websiteContainer = document.getElementById('website_list_container');
    if (keywordContainer) {
      keywordContainer.innerHTML = '<button class="chip">Example</button><button class="chip">Domain</button>';
    }
    if (websiteContainer) {
      websiteContainer.innerHTML = '<button class="chip">*example.com*</button>';
    }
    const highlightSwitch = document.getElementById('highlight_switch');
    if (highlightSwitch instanceof HTMLInputElement) {
      highlightSwitch.checked = true;
    }
    const highlightColorRow = document.getElementById('highlight_color_row');
    if (highlightColorRow) {
      highlightColorRow.setAttribute('style', 'display:flex;');
    }
  });
  await optionsPage.screenshot({ path: resolve(outDir, '02-options-page.png') });
  await optionsPage.close();

  const highlightPage = await context.newPage();
  await highlightPage.setViewportSize({ width: 1365, height: 768 });
  await highlightPage.goto('https://example.com');
  await highlightPage.evaluate(() => {
    const marker = document.createElement('style');
    marker.textContent = `
      .ws-highlight { background: #fff59d; color: #111; padding: 0 2px; border-radius: 3px; }
      .ws-badge { position: fixed; top: 12px; right: 12px; background: #1e8e3e; color: #fff; font: 600 12px/1.2 sans-serif; padding: 8px 10px; border-radius: 999px; z-index: 9999; }
    `;
    document.head.appendChild(marker);

    document.querySelectorAll('h1, p').forEach((node) => {
      node.innerHTML = node.innerHTML
        .replace('Example', '<span class="ws-highlight">Example</span>')
        .replace('domain', '<span class="ws-highlight">domain</span>');
    });

    const badge = document.createElement('div');
    badge.className = 'ws-badge';
    badge.textContent = 'Wordspotting: 2 matches';
    document.body.appendChild(badge);
  });
  await highlightPage.screenshot({ path: resolve(outDir, '03-highlighting-example.png') });
  await highlightPage.close();

  const notificationPage = await context.newPage();
  await notificationPage.setViewportSize({ width: 960, height: 540 });
  await notificationPage.setContent(`
    <html>
      <head>
        <style>
          body { margin: 0; font-family: 'Segoe UI', sans-serif; background: linear-gradient(135deg, #f0f4f8, #dde7f2); display: grid; place-items: center; height: 100vh; }
          .notification { width: 420px; border-radius: 12px; background: white; box-shadow: 0 12px 32px rgba(0,0,0,0.18); padding: 16px 18px; border-left: 6px solid #4caf50; }
          .title { font-size: 16px; font-weight: 700; margin: 0 0 8px 0; color: #1f2d3d; }
          .message { margin: 0; color: #425466; font-size: 14px; line-height: 1.4; }
          .meta { margin-top: 12px; color: #607385; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="notification">
          <p class="title">Wordspotting: Keyword found!</p>
          <p class="message">Detected keyword matches on Example Domain.</p>
          <p class="meta">Chrome Web Store listing preview image.</p>
        </div>
      </body>
    </html>
  `);
  await notificationPage.screenshot({ path: resolve(outDir, '04-notification-preview.png') });
  await notificationPage.close();
} finally {
  await context.close();
  await browser.close();
}
