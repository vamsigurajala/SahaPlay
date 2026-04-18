# WatchTogether - Comprehensive Application Specification Prompt

If you are an AI developer or a software engineer tasked with building the **WatchTogether** platform from scratch, strictly adhere to the following highly detailed product requirements document (PRD), architectural, and aesthetic instructions.

## 1. Application Overview
**WatchTogether** is a real-time web application where users can create synchronized media watch parties (YouTube, Twitch, Video files) with their friends along with integrated chat, WebRTC voice/camera capabilities, and a global social networking layer.

---

## 2. Technology Stack
**Frontend:**
*   **Core:** React (initialized via Vite), vanilla CSS (or CSS-in-JS without generic frameworks like Tailwind).
*   **Routing:** `react-router-dom`
*   **Icons & Assets:** `lucide-react`, `react-icons`, `@emoji-mart/react`
*   **Real-time:** `socket.io-client` for signaling and chat, WebRTC for camera/screen sharing.
*   **State / UI:** Context/props for state, `react-hot-toast` for notifications.

**Backend:**
*   **Core:** Node.js with `express`.
*   **Database:** `sqlite3` locally (tables for users, rooms, follows, blocks, messages, reports).
*   **Auth:** `jsonwebtoken` (JWT), `bcrypt` for hashing.
*   **Uploads:** `multer` for local avatar storage.
*   **Real-time:** `socket.io` server.

---

## 3. Core Features & Logic Guidelines

### A. Authentication & Security
*   **Auth Flow:** Email/Password via JWT and Google OAuth fallback. Implement Signup, Login, and Password Reset (simulated Nodemailer link).
*   **Email Verification:** Users must verify their email with a token before successfully logging in.

### B. User Profiles & Social Graph
*   **Profile Editing:** Users can change their Display Name, Bio, update Passwords, and upload a circular Avatar image with an integrated Cropper UI.
*   **Follow System (Instagram-style):**
    *   **States:** Pending, Accepted, Not Following.
    *   **Logic:** When User A follows User B, it creates a "Pending" request for B. User B gets a real-time notification to "Allow" or keep them as a "Follower". B can click "Follow Back".
    *   **UI Check:** Display follower/following lists in a neat, centered modal with tabs.
*   **Blocking:** Users can block others. A blocked user cannot view the blocker's profile or send messages. Existing follow relationships in both directions are instantly severed. Chat messages from a blocked user reflect an anonymized empty state.

### C. Direct Messaging & Global Chat (`GlobalChatWidget`)
*   **The Widget:** A slide-out, glassy dark-mode side panel (350px width) accessible globally from Home, Profile, and Settings.
*   **Mutual Follow Restraint (CRITICAL):** A user *cannot* initiate a Direct Message (DM) to someone unless they **mutually follow** each other (A follows B & B follows A). The "Message" button on profiles must be locked (grayed out + 🔒 icon) otherwise.
*   **Features:**
    *   Real-time unread badges mirroring database reads.
    *   Optimistic updates for sending messages.
    *   Reply to specific messages.
    *   Emoji Reactions (`@emoji-mart`) — single reaction restricted per user.
    *   Options dropdown to Clear Chat History (for self or both users).

### D. Rooms & Media Synchronization
*   **Room Creation:**
    *   Categories: Movies, Anime, Music, Gaming, Sports, Other.
    *   Visibility: Public (Listable on Home/Rooms page) or Private (Join by Room ID).
*   **Sync Logic (Zero-Latency Goal):**
    *   Only the **Host** controls playback by default (Play, Pause, Seek).
    *   Socket events broadcast the play state & exact timestamp to all specific room occupants.
    *   Late-joiners automatically receive a payload of the current `currentTime` and `isPlaying` state.
*   **Room Chat:** Fully functional text chat within the room component.
*   **Pinning:** Users can "Pin" rooms so they permanently appear on their Home dashboard.

### E. WebRTC Camera & Screenshare
*   **Mesh Architecture:** Peer-to-Peer streaming managed by Socket signaling.
*   **Cameras:** Display a maximum grid of 5 distinct cameras with pagination (prev/next controls) for larger rooms.
*   **Screenshare:** The host can hijack a large screenshare frame.
*   **Deduplication:** Ensure WebRTC logic does not duplicate `stream.id` loops, which causes mirror-hall effects on the UI.

---

## 4. Design & Aesthetics Guidelines
*Wait, aesthetics are VERY IMPORTANT. DO NOT deliver a basic MVP.*

1.  **Vibe:** Premium, modern "Glassmorphism" combined with sleek Dark Mode (`#111` to `#1a1a2e` backgrounds).
2.  **Typography:** Use modern web fonts (e.g., *Outfit*, *Inter*).
3.  **Color Palette:** Limit harsh primary colors. Use smooth gradients (e.g., `linear-gradient(135deg, #6366f1, #a855f7)`) for primary call-to-action buttons (Launch Room, Follow, Send).
4.  **Micro-animations:** 
    *   Cards should float `translateY(-4px)` with increased box shadows on hover.
    *   Inputs should have smooth border-color transitions (`rgba(99,102,241,0.5)`).
    *   Reaction icons should scale-up on hover (`transform: scale(1.3)`).
5.  **Layout Patterns:** Rounded corners (`12px` to `24px`), distinct borders `1px solid rgba(255,255,255,0.05)`, and frosted background blur where applicable.

---

## 5. Development Instructions (Prompt Injection Guidelines)

When writing code for this application:
1.  **Do not use generic placeholders.** Fill logic flows naturally.
2.  **Avoid Tailwind.** Rely strictly on inline-styles or standard CSS for rapid, granular control.
3.  **Encapsulate State:** Extract massive components into hooks if they exceed 500 lines, however prioritize getting one unified feature working perfectly first.
4.  **Graceful Errors:** Implement `react-hot-toast` across all async calls instead of generic browser alerts.
5.  **Refs & Imperative Methods:** Be highly cautious using `useImperativeHandle` for global components (like `GlobalChatWidget`); assure you explicitly map original DOM functions like `.contains` to a `containerRef` to prevent outside click detectors from crashing the main DOM.

Build to wow. Ensure every feature is tightly coupled to the backend Node APIs mapped in the database tables.
