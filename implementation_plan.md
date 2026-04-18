# Supabase Migration Plan

Migrating from local SQLite to Supabase (PostgreSQL) is a major architectural upgrade. To ensure nothing breaks, we will execute this in a strict, phased approach. 

## Phase 1: Supabase Project Setup (Your Action Required)
Before I can write the code, you need to create the cloud environment.
1. Go to [database.supabase.com](https://supabase.com) and sign up/log in.
2. Click **"New Project"**. Give it a name (e.g., "WatchTogether") and a strong database password.
3. Once the project provisions (takes ~2 mins), go to **Project Settings -> API**.
4. You will need to provide me with two specific keys:
    *   **Project URL** (e.g., `https://xyz.supabase.co`)
    *   **Service Role Key** (The secret key, required because our Node.js backend needs admin privileges to bypass RLS and act as the core database manager).

## Phase 2: Schema Migration
I will write a script to recreate all your SQLite tables inside Supabase's Postgres database. 
The tables we will recreate are:
*   `users` (Profiles, settings, passwords)
*   `messages` (Chat history)
*   `room_names` (Room metadata, hosts, permissions)
*   `follows` & `blocks` (Social graph)
*   `room_bans` (Moderation)

## Phase 3: Backend Refactoring (`server.js`)
This is the heaviest phase. The current backend is ~3000 lines of code heavily reliant on local `sqlite3` callbacks. 
*   **[NEW]** Install `@supabase/supabase-js` in your `backend` folder.
*   **[MODIFY]** Replace the `sqlite3` database connection block with the Supabase client initialization.
*   **[MODIFY]** Rewrite all `db.run()`, `db.get()`, and `db.all()` callbacks into modern `await supabase.from(...).select(...)` promise chains. 
*   *Note on Authentication:* To prevent massive frontend rewrites, we will **keep your existing custom JWT/bcrypt authentication system** for now! We will just route the user lookups to Supabase Postgres instead of SQLite. This keeps the migration isolated and predictable. 

## Phase 4: Testing & Verification
We will start the servers and test:
1. Registering a new user (Ensure it posts to Supabase).
2. Joining a room (Ensure room data saves to Supabase).
3. Sending a message (Ensure history fetches from Supabase).

## Open Questions for You

1. **Keep Existing Data?** Do you want me to write a migration script to upload all the data currently sitting in your `database.sqlite` over to Supabase, or are you comfortable starting with a fresh, empty database? 
2. **Postgres Setup:** Can you confirm once you have created the Supabase project and have the **URL** and **Service Role Key** ready to paste?
