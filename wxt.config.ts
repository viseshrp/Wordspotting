import { defineConfig } from 'wxt';

const manifestVersion = process.env.RELEASE_VERSION ?? process.env.npm_package_version ?? '1.0.1';
const MANIFEST_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxTXma4csNnYitWbhLXF3YvLIIs+I0ILdscV2sz4FP8MMIJFaeC7Jkx4jpPhqfV5HqQhpinrYxtopjFSsc280YdNbNwG2DK8MVVzjrn5Rf5SE9vlFg7qPJ24PGyef72ptZCitt9owS/4xx7SQHspxmLT74Mbx29ecb5opRJhRn++Cl/E8UZDS4H47RJIU3NzroUpfpWwZxWkZmscp4dGWUfqwMGftMHiztnPytk6ccPp14vg0Gj+HnXaSYsx/gvwnRUqMbH8FcxS4u6lpg36367ZajKps4dosRhsod0VC0XFlDskPm9eImYuGPrtMNASpKrS2fbEU5zs69limEhqgIwIDAQAB';

export default defineConfig({
  entrypointsDir: 'entrypoints',
  outDirTemplate: '{{browser}}-mv{{manifestVersion}}{{modeSuffix}}',
  vite: () => ({
    build: {
      sourcemap: false
    }
  }),
  manifest: {
    key: MANIFEST_KEY,
    version: manifestVersion,
    name: 'Wordspotting',
    description: 'Get notified when a word is found in a web page.',
    homepage_url: 'https://github.com/viseshrp/Wordspotting',
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
