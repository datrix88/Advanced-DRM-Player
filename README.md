# DRM Player Avanzado

An advanced private Chrome extension designed for playing M3U playlists with robust support for DRM, EPG, and direct provider integrations.

## 🙏 Agradecimientos

Gracias especiales a **FRANHACKER** y **NACHO** por su ayuda, ideas y apoyo continuo durante el desarrollo de este proyecto. ¡Este reproductor no sería lo mismo sin vosotros!

---

## 🙌 Special Thanks

A special thank you to **FRANHACKER** and **NACHO** for their help, ideas, and continuous support throughout the development of this project. This player wouldn't be the same without you!

---

## ✨ Key Features

*   **Advanced M3U/M3U8 Player**: Plays standard M3U playlists from a URL or a local file.
*   **DRM Support**: Handles Widevine and ClearKey protected content using KodiProp-style tags (`#KODIPROP`).
*   **Floating Player Windows**: Open multiple channels simultaneously in draggable and resizable windows.
*   **Taskbar Management**: Easily switch between active player windows with a dedicated taskbar at the bottom of the screen.
*   **EPG Support**: Load external XMLTV guides to display program information. Also integrates with Movistar+ VOD as an EPG source.
*   **Direct Provider Integration**: Load channel lists directly from providers like **OrangeTV**, **Movistar+**, **DAZN**, **Atresplayer**, and **BarTV**.
*   **Xtream Codes & XCodec Support**: Connect to Xtream Codes servers and process streams from XCodec panels.
*   **Powerful M3U Editor**: A full-featured editor to manage your playlist. Includes drag-and-drop for reordering groups/channels, multi-editing, and detailed property modification.
*   **Customizable UI**: Personalize your experience with different color themes, fonts, and channel card layouts.
*   **Search & Filtering**: Quickly find channels by name, group, favorites, or viewing history.

## 🚀 Getting Started

1.  **Load a Playlist**: Use the URL input, the local file selector, or one of the provider buttons in the header.
2.  **Find a Channel**: Browse the channel grid or use the sidebar/search bar to filter the content.
3.  **Play**: Click on a channel card to open it in a new, floating player window.

## 🛠️ Installation (for Private Use)

As this is a private extension, it must be loaded manually into Chrome.

1.  Download or clone the project source code to your local machine.
2.  Open Google Chrome and navigate to `chrome://extensions`.
3.  Enable **"Developer mode"** using the toggle in the top-right corner.
4.  Click on the **"Load unpacked"** button.
5.  Select the directory that contains the extension's `manifest.json` file.

The extension icon should now appear in your Chrome toolbar.

## ⚙️ Configuration

The extension is highly configurable. Access the settings panel by clicking the **gear icon (⚙️)** in the header. Here you can:
*   Set up credentials for providers (OrangeTV, BarTV, etc.).
*   Manage DAZN and Movistar+ tokens.
*   Customize player behavior (buffering, latency).
*   Change the UI theme, fonts, and card display options.
*   Configure network settings like User-Agent and retry parameters.
*   Manage saved data, including importing/exporting your settings.