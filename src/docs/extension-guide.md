# Building and Loading the ReelView Browser Extension

This guide provides instructions for building the ReelView application as a browser extension to enable powerful, native pop-up blocking.

## 1. The Critical Limitation: Chrome on Android

Before you begin, it is essential to understand a fundamental limitation of Chrome on Android: **you cannot install custom extensions (packed or unpacked) on the standard version of Chrome for Android.** This is a security and design policy set by Google.

- **No "Developer Mode":** Unlike its desktop counterpart, Chrome on Android does not have a "Load unpacked" or "Install from .zip" feature.
- **Chrome Web Store is the Only Way:** The only way an extension can run on Chrome for Android is if it is officially published and approved on the Chrome Web Store, and even then, Google only makes a very small, curated list of extensions available for mobile.

**Therefore, for testing your extension on an Android device, you MUST use a browser that supports sideloading.** The recommended browser for this is **Kiwi Browser**. This guide provides instructions for that process.

## 2. Prerequisites

*   Node.js and npm must be installed.
*   A Chromium-based browser for desktop (e.g., Google Chrome, Microsoft Edge, Brave).
*   For mobile testing, **Kiwi Browser** for Android is required.

## 3. Step-by-Step Instructions

### Step 3.1: Install Dependencies

A helper library for the build script needs to be installed. Run the following command in your terminal:

```bash
npm install
```

This will install `fs-extra`, which is listed in your `package.json` devDependencies.

### Step 3.2: Build the Extension

Run the build script from your project's root directory:

```bash
npm run build:extension
```

This command will:
1.  Create a production-ready, static export of the Next.js application in the `out/` directory.
2.  Create a new `dist/` directory.
3.  Copy the static web app (`out/`), the `manifest.json`, the `background.js`, and the `icon.png` into the `dist/` directory, making it a complete, loadable browser extension.

### Step 3.3: Load the Extension in a Desktop Browser

1.  Open your desktop Chromium-based browser (e.g., Google Chrome).
2.  Navigate to the extensions management page. You can usually find this at `chrome://extensions`.
3.  Enable **"Developer mode"**. This is typically a toggle switch in the top-right corner of the page.
4.  Click the **"Load unpacked"** button.
5.  In the file dialog that appears, navigate to your project folder and select the **`dist`** directory that was created by the build script.
6.  The "ReelView Extension" should now appear in your list of extensions, and it will be active.

### Step 3.4: Load the Extension on Android (Using Kiwi Browser)

1.  Install **Kiwi Browser** from the Google Play Store.
2.  Use the "Build & Download Extension" button on the app's homepage to get the `extension-build.zip` file, or transfer the file to your Android device manually.
3.  In Kiwi Browser, go to the address bar and navigate to `chrome://extensions`.
4.  Enable Developer mode (usually a toggle in the top-right).
5.  Select the option **"+ (from .zip / .crx / .user.js)"**.
6.  Using your device's file manager, select the `extension-build.zip` file.
7.  The extension should now be installed and active in Kiwi Browser.

### Step 3.5: Using the Extension

After loading the extension, an icon for ReelView will appear in your browser's toolbar. Clicking this icon will open the ReelView application in a popup window. The pop-up blocking is now handled automatically and silently by the extension's background script.