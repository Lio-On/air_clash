# Mobile Controls Implementation Guide

This document outlines the best practices and technical implementation details for adding mobile controls to *Air Clash*. It is designed to be given to an AI coding assistant (like Claude Code) to implement the feature.

## 1. UX & Design Best Practices

For a high-paced flight combat game, the controls must be responsive, intuitive, and unobtrusive.

### Layout
**"Twin-Stick" configuration (Standard for mobile flight/shooters):**
*   **Left Thumb (Flight Control):** Virtual Joystick.
    *   **Control:** Controls Pitch (Up/Down) and Roll (Left/Right).
    *   **Type:** *Dynamic* or *Semi-Dynamic*. The joystick appears where the thumb touches in the bottom-left zone, preventing "missed" inputs.
    *   **Feedback:** Visual ring follows the finger; returns to center on release.
*   **Right Thumb (Action):** Fire Button.
    *   **Control:** Fires machine guns.
    *   **Type:** Large, fixed circular button in the bottom-right corner.
    *   **Feedback:** Visual depression/glow on press.

### Visual Style
*   **Transparency:** Controls should be 30-50% opaque to minimize blocking the view.
*   **Feedback:** Increase opacity or brightness when active to confirm input.
*   **Safety Zones:** Ensure buttons are not too close to the edge to avoid accidental system swipe gestures (Home/Back).

## 2. Technical Implementation Plan

### Recommended Library: `nipple.js`
It is the industry standard for web virtual joysticks—lightweight (`~6kb`), dependency-free, and handles multi-touch perfectly.

### Step-by-Step Instructions for Claude Code

#### Phase 1: Setup
1.  **Install Library**: Run `npm install nipplejs`.
2.  **HTML Structure**:
    *   Create a container div `#mobile-controls` overlaying the game canvas (`z-index: 10`).
    *   Divide it into two zones: `#joystick-zone` (Left 50% width) and `#button-zone` (Right 50% width).
    *   Add a `#fire-button` div inside the button zone.

#### Phase 2: CSS Styling
*   **Container**: `position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;` (allows seeing through, but children need events).
*   **Zones**: `pointer-events: auto; touch-action: none;` (PREVENTS browser scrolling/zooming).
*   **Fire Button**: Large (e.g., 80px), circular, translucent white/red border. positioned bottom-right with margin.

#### Phase 3: JavaScript Logic (`MobileInputManager.ts`)
*   **Joystick Logic**:
    *   Initialize `nipplejs` in `#joystick-zone` with `mode: 'static'` or `'semi'`.
    *   Listen to `'move'` event:
        *   Map `data.vector.x` -> Game Input `Left/Right` (Roll).
        *   Map `data.vector.y` -> Game Input `Up/Down` (Pitch).
        *   *Note: Apply a small "deadzone" (e.g., 0.1) to prevent drift.*
    *   Listen to `'end'` event: Reset inputs to false.
*   **Fire Button Logic**:
    *   Listen to `touchstart` -> Set Game Input `Shoot = true`.
    *   Listen to `touchend` -> Set Game Input `Shoot = false`.
*   **Device Detection**:
    *   Check `('ontouchstart' in window)` to conditionally show the mobile UI.

#### Phase 4: Integration
*   Modify `InputManager` to merge keyboard state AND mobile state.
    *   `finalInput = keyboardInput OR mobileInput`.

## 3. Non-Code Adjustments for "Nice Experience"

To ensure the game feels like a native app on mobile:

### 1. Landscape Orientation Lock
*   **Issue**: The game is unplayable in Portrait mode.
*   **Solution**: Since browsers can't force rotation, display a strict "Please Rotate Your Device" overlay if `window.innerHeight > window.innerWidth`.

### 2. Fullscreen Experience (PWA)
*   **Recommendation**: Encourage users to "Add to Home Screen".
*   **Why**: This removes the Safari/Chrome URL bar and navigation buttons, giving 100% screen real estate to the game.
*   **Meta Tag**: Ensure `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">` is present to prevent accidental zooming.

### 3. Disable Select/Copy
*   Add CSS `user-select: none; -webkit-user-select: none;` to the entire body to prevent accidental text selection highlighting during frantic tapping.
