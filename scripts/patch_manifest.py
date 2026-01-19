import json
import sys
import os

def main():
    if len(sys.argv) < 2:
        print("Usage: patch_manifest.py <manifest_path>")
        sys.exit(1)

    manifest_path = sys.argv[1]

    with open(manifest_path, 'r') as f:
        data = json.load(f)

    # Add Action (Popup)
    data['action'] = {
        "default_title": "Wordspotting",
        "default_popup": "assets/popup/popup.html",
    }

    # Add Options UI
    data['options_ui'] = {
        "page": "assets/options/options.html",
        "open_in_tab": True
    }

    with open(manifest_path, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"Patched manifest at {manifest_path}")

if __name__ == "__main__":
    main()
