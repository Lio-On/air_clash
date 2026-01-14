# Air Clash BETA Deployment Plan

To publish the game for public testing without cost, we need a "Hybrid Deployment":
1.  **Frontend (Client)**: Hosted on a fast, global CDN.
2.  **Backend (Server)**: Hosted on a cloud platform that supports persistent Node.js processes and WebSockets.

## Recommendation: Vercel + Render

I recommend this combination as the best "Free Forever" stack for 2025 development.

### 1. The Client: **Vercel**
*   **Why:** It is the industry standard for frontend hosting. It integrates perfectly with GitHub and Vite.
*   **Cost:** Free (Hobby Tier).
*   **Performance:** Excellent. It serves your assets (images, JS) from a global edge network, ensuring the game loads fast for everyone.
*   **Features:** Automatic SSL (https), auto-deploy on Git push.

### 2. The Server: **Render.com**
*   **Why:** Hosting a game server is harder than a website because it needs **WebSockets** (persistent connections). Most free hosts (like Vercel serverless functions) *cannot* do this. Render supports persistent Node.js services natively.
*   **Cost:** Free (Individual Tier).
*   **Performance:** Good enough for a beta test.
*   **Caveat:** On the free tier, the server will "spin down" (sleep) after 15 minutes of inactivity. When the first player joins after a break, it may take ~30-50 seconds to wake up. This is standard for free hosting.

---

## Deployment Workflow

Here is the step-by-step plan we would follow:

### Phase 1: Preparation (GitHub)
Since you have a GitHub account, we will verify the code is pushed and organized. simple:
- Ensure the `client` and `server` folders are in your repository.

### Phase 2: Deploy Server (Render)
1.  Create a "Web Service" on Render linked to your GitHub repo.
2.  **Root Directory:** `server` (This tells Render to look in the server folder).
3.  **Build Command:** `npm install && npm run build`
4.  **Start Command:** `npm run start`
5.  **Environment Variables:** Add `PORT=3000`.
6.  *Result:* Render gives us a URL like `wss://air-clash-server.onrender.com`.

### Phase 3: Update Client Config
1.  We update `client/.env.production` to point to the new Render URL.
    - `VITE_SERVER_URL=wss://air-clash-server.onrender.com`
2.  Push this change to GitHub.

### Phase 4: Deploy Client (Vercel)
1.  Import the GitHub repo into Vercel.
2.  **Root Directory:** `client` (This tells Vercel to look in the client folder).
3.  **Framework Preset:** Vite (Vercel detects this automaticlaly).
4.  **Deploy.**
5.  *Result:* Vercel gives us a URL like `https://air-clash.vercel.app`.

---

## Summary of Experience
- **You:** Push code to GitHub -> Both Client and Server update automatically.
- **Your Friends:** Open a link on their phone/PC -> Play instantly.

**Shall we proceed with this execution plan?**
If yes, the first step is to ensure your GitHub repository is up to date.
