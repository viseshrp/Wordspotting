import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'wxt';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as {
  version: string;
};

export default defineConfig({
  manifest: {
    name: 'Wordspotting',
    description: 'Get notified when a word is found in a web page.',
    version: pkg.version,
    permissions: ['notifications', 'storage', 'scripting'],
    host_permissions: ['<all_urls>'],
    action: {
      default_icon: {
        '16': 'assets/ws16.png',
        '24': 'assets/ws24.png',
        '32': 'assets/ws32.png',
        '48': 'assets/ws48.png',
        '128': 'assets/ws128.png'
      },
      default_title: 'Wordspotting',
      default_popup: 'popup.html'
    },
    options_ui: {
      page: 'options.html'
    },
    icons: {
      '16': 'assets/ws16.png',
      '24': 'assets/ws24.png',
      '32': 'assets/ws32.png',
      '48': 'assets/ws48.png',
      '128': 'assets/ws128.png'
    },
    web_accessible_resources: [
      {
        resources: ['assets/*.png', 'css/*.css', 'scan-worker.js'],
        matches: ['http://*/*', 'https://*/*']
      }
    ]
  }
});
