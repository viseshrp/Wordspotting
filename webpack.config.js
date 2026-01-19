const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';

    return {
        entry: {
            background: './src/js/background.js',
            content: './src/js/content.js',
            popup: './src/js/popup.js',
            options: './src/js/options.js',
            'scan-worker': './src/js/scan-worker.js',
        },
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'js/[name].js',
            clean: true,
        },
        module: {
            rules: [
                {
                    test: /\.js$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                    },
                },
                {
                    test: /\.css$/,
                    use: [MiniCssExtractPlugin.loader, 'css-loader'],
                },
            ],
        },
        plugins: [
            new MiniCssExtractPlugin({
                filename: 'css/[name].css',
            }),
            new CopyPlugin({
                patterns: [
                    {
                        from: 'manifest.json',
                        to: 'manifest.json',
                        transform: transformManifest,
                    },
                    { from: 'src/assets', to: 'assets' },
                ],
            }),
            new HtmlWebpackPlugin({
                template: './src/pages/popup.html',
                filename: 'pages/popup.html',
                chunks: ['popup'],
                inject: 'body',
            }),
            new HtmlWebpackPlugin({
                template: './src/pages/options.html',
                filename: 'pages/options.html',
                chunks: ['options'],
                inject: 'body',
            }),
        ],
        devtool: isProduction ? false : 'cheap-module-source-map',
        experiments: {
            topLevelAwait: true,
        },
    };
};

function transformManifest(content) {
    const manifest = JSON.parse(content.toString());

    // Update background script
    if (manifest.background && manifest.background.service_worker) {
        manifest.background.service_worker = 'js/background.js';
    }

    // Update action popup
    if (manifest.action && manifest.action.default_popup) {
        manifest.action.default_popup = 'pages/popup.html';
    }

    // Update options page
    if (manifest.options_ui && manifest.options_ui.page) {
        manifest.options_ui.page = 'pages/options.html';
    }

    // Update icons
    const updateIcons = (icons) => {
        if (!icons) return;
        for (const size in icons) {
            icons[size] = icons[size].replace('src/assets', 'assets');
        }
    };
    updateIcons(manifest.icons);
    if (manifest.action) {
        updateIcons(manifest.action.default_icon);
    }

    // Update web accessible resources
    if (manifest.web_accessible_resources) {
        manifest.web_accessible_resources = manifest.web_accessible_resources.map((resource) => {
            if (resource.resources) {
                resource.resources = resource.resources.map((r) => {
                    if (r.includes('scan-worker.js')) return 'js/scan-worker.js';
                    // core/scanner.js is likely bundled, but if referenced directly:
                    if (r.includes('scanner.js')) return 'js/scanner.js'; // This might be wrong if webpack doesn't output it.
                    // Given we are bundling, scanner.js logic is inside content/background/worker.
                    // But if the code still tries to fetch it (like in the blob fallback), it will fail unless we also copy it or output it.
                    // The plan is to remove blob fallback. So we can probably remove it from WAR or point to a dummy.
                    // Let's assume we clean up WAR in the manifest.json file itself or here.
                    // For now, let's just remap assets.
                    if (r.startsWith('src/assets')) return r.replace('src/assets', 'assets');
                    return r;
                });
            }
            return resource;
        });
    }

    return JSON.stringify(manifest, null, 2);
}
