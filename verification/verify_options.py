from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Determine the absolute path to options.html (prefer WXT build output)
        cwd = os.getcwd()
        output_root = os.path.join(cwd, ".output")
        options_path = os.path.join(cwd, "entrypoints", "options", "index.html")
        if os.path.isdir(output_root):
            entries = [d for d in os.listdir(output_root) if os.path.isdir(os.path.join(output_root, d))]
            chrome_entry = next((d for d in entries if "chrome" in d), entries[0] if entries else None)
            if chrome_entry:
                options_path = os.path.join(output_root, chrome_entry, "options.html")

        url = f"file://{options_path}"

        print(f"Navigating to {url}")
        page.goto(url)

        # Wait for the page to render (DOMContent is sufficient as our logic is simple)
        page.wait_for_load_state("domcontentloaded")

        # Take a screenshot of the initial state
        screenshot_path = "verification/options_ui.png"
        page.screenshot(path=screenshot_path, full_page=True)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    run()
