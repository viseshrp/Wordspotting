const path = require("node:path");
const CopyPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

/**
 * A helper function to dynamically modify the manifest.json file during the build process.
 * This is crucial for updating file paths to match the structure of the 'dist' directory.
 * @param {Buffer} content The original content of manifest.json as a Buffer.
 * @returns {string} The modified manifest content as a JSON string.
 */
function transformManifest(content) {
    const manifest = JSON.parse(content.toString());

    // Update paths for scripts and UI pages to point to their new locations in the dist folder.
    manifest.background.service_worker = "js/background.js";
    manifest.action.default_popup = "pages/popup.html";
    manifest.options_ui.page = "pages/options.html";

    // Update icon paths, removing the 'src/' prefix.
    if (manifest.icons) {
        for (const key of Object.keys(manifest.icons)) {
            manifest.icons[key] = manifest.icons[key].replace("src/", "");
        }
    }
    if (manifest.action?.default_icon) {
        for (const key of Object.keys(manifest.action.default_icon)) {
            manifest.action.default_icon[key] = manifest.action.default_icon[key].replace(
                "src/",
                ""
            );
        }
    }

    // Update web_accessible_resources to ensure the content script and its worker can be loaded by the browser.
    // Bundled resources like CSS or dependent JS modules are no longer needed here.
    if (manifest.web_accessible_resources) {
        manifest.web_accessible_resources = [
            {
                resources: [
                    "assets/*.png",
                    "js/scan-worker.js",
                    "js/content.js" // content script needs to be accessible for programmatic injection.
                ],
                matches: ["<all_urls>"]
            }
        ];
    }

    return JSON.stringify(manifest, null, 2);
}

module.exports = {
    // Defines the entry points of the application. Webpack starts bundling from these files.
    // Each key represents a chunk name, and the value is the path to the entry file.
    entry: {
        background: "./src/js/background.js",
        content: "./src/js/content.js",
        popup: "./src/js/popup.js",
        options: "./src/js/options.js",
        "scan-worker": "./src/js/scan-worker.js"
    },

    // Configures how the bundled files are output.
    output: {
        // The target directory for all output files. `path.resolve` creates an absolute path.
        path: path.resolve(__dirname, "dist"),
        // The filename pattern for entry chunks. `[name]` is replaced by the chunk name (e.g., 'popup').
        filename: "js/[name].js",
        // Cleans the output directory before each build to ensure a fresh build.
        clean: true
    },

    // Defines how different types of modules are treated.
    module: {
        rules: [
            {
                // This rule applies to all files ending in .js.
                test: /\.js$/,
                // Excludes the node_modules directory from transpilation to speed up the build.
                exclude: /node_modules/,
                // Uses the Babel loader to transpile JavaScript files.
                use: {
                    loader: "babel-loader",
                    options: {
                        // Uses the @babel/preset-env preset to transpile modern JavaScript to a compatible version.
                        presets: ["@babel/preset-env"]
                    }
                }
            },
            {
                // This rule applies to all files ending in .css.
                test: /\.css$/,
                // A chain of loaders processed in reverse order:
                // 1. 'css-loader': Resolves @import and url() in CSS.
                // 2. 'MiniCssExtractPlugin.loader': Extracts CSS into separate files instead of bundling it with JS.
                use: [MiniCssExtractPlugin.loader, "css-loader"]
            }
        ]
    },

    // Configures plugins used in the build process.
    plugins: [
        // Copies individual files or entire directories to the build directory.
        new CopyPlugin({
            patterns: [
                {
                    // Copies the assets folder from 'src' to 'dist'.
                    from: "src/assets",
                    to: "assets"
                },
                {
                    // Copies manifest.json to the root of 'dist'.
                    from: "manifest.json",
                    to: "manifest.json",
                    // Applies the transformManifest function to update file paths within the manifest.
                    transform: transformManifest
                }
            ]
        }),
        // Generates an HTML file for the popup, injecting the bundled scripts and styles.
        new HtmlWebpackPlugin({
            // The source HTML file.
            template: "./src/pages/popup.html",
            // The output filename in the 'dist' directory.
            filename: "pages/popup.html",
            // Specifies which chunk(s) to include in this HTML file.
            chunks: ["popup"],
            // Injects all assets at the bottom of the body.
            inject: "body"
        }),
        // Generates an HTML file for the options page.
        new HtmlWebpackPlugin({
            template: "./src/pages/options.html",
            filename: "pages/options.html",
            chunks: ["options"],
            inject: "body"
        }),
        // Extracts CSS into separate files. It creates a CSS file per JS file which contains CSS.
        new MiniCssExtractPlugin({
            // The filename pattern for extracted CSS files.
            filename: "css/[name].css"
        })
    ],

    // Configuration for webpack's performance hints.
    performance: {
        // Disables warnings about asset size, which can be noisy for extensions.
        hints: false
    },

    // Controls if and how source maps are generated.
    // 'cheap-module-source-map' offers a good balance of speed and detail for debugging.
    devtool: "cheap-module-source-map"
};
