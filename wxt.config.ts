import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'wxt';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as {
  version: string;
};
const MANIFEST_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxTXma4csNnYitWbhLXF3YvLIIs+I0ILdscV2sz4FP8MMIJFaeC7Jkx4jpPhqfV5HqQhpinrYxtopjFSsc280YdNbNwG2DK8MVVzjrn5Rf5SE9vlFg7qPJ24PGyef72ptZCitt9owS/4xx7SQHspxmLT74Mbx29ecb5opRJhRn++Cl/E8UZDS4H47RJIU3NzroUpfpWwZxWkZmscp4dGWUfqwMGftMHiztnPytk6ccPp14vg0Gj+HnXaSYsx/gvwnRUqMbH8FcxS4u6lpg36367ZajKps4dosRhsod0VC0XFlDskPm9eImYuGPrtMNASpKrS2fbEU5zs69limEhqgIwIDAQAB';

export default defineConfig({
  manifest: {
    key: MANIFEST_KEY,
    name: 'Wordspotting',
    description: 'Get notified when a word is found in a web page.',
    version: pkg.version,
    permissions: ['notifications', 'storage', 'scripting', 'offscreen'],
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
        resources: ['assets/*.png', 'css/*.css'],
        matches: ['http://*/*', 'https://*/*']
      }
    ]
  }
});
