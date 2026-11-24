# Family Events

A shared family calendar with RSVPs and task lists. It's a website that works like an app:
open the link on any phone, tablet or computer, and add it to your home screen.

- **Calendar**: month view, tap a day to see what's on.
- **Upcoming**: everything coming up, with a reminder of which events still need your reply.
- **RSVPs**: Going / Maybe / Can't go on every event, with an optional note ("bringing dessert"), plus who hasn't replied yet.
- **Repeating events**: every week, every 2 weeks, every month or every year, with an optional end date. People RSVP to each date separately.
- **Reminders**: "Add to my calendar" puts an event (and all its repeats) on your phone's calendar with alerts the day before and 2 hours before. A "Coming up" box on the calendar shows what's on today and tomorrow, and your tasks due soon.
- **Tasks**: to-dos on their own or for an event. Assign them to someone, add a due date, tick them off. Choose who can see each one (everyone, just you, or people you pick) and share a task by message.
- **Chores**: a weekly roster. Pick who takes turns on each chore and it moves to the next person every Monday. Tick chores off, and see who's on what for the next 4 weeks.
- **Add to calendar**: Apple, Google and Outlook buttons on every event, plus "Add all to my calendar" on the Upcoming tab.
- **Family**: the admin adds family members by email. Only people on the list can see anything.

## Try it right now (demo mode)

With `config.js` left empty, the app runs in **demo mode** with sample data saved only in your browser.
Open `index.html` through any web server, or just publish it with GitHub Pages (below) and open the link.

## Going live: one-time setup (about 20 minutes)

### 1. Create the free database (Supabase)

1. Go to <https://supabase.com> and click **Start your project**. Sign in with your GitHub account.
2. Click **New project**. Name it `family-events`, make up a database password (save it somewhere safe),
   and pick the region **Sydney** (closest to New Zealand). Click **Create new project** and wait a minute or two.
3. In the left menu open **SQL Editor**, click **New query**, paste in everything from
   [`supabase/schema.sql`](supabase/schema.sql), and click **Run**. You should see "Success".
4. Open **Project Settings → API**. Copy the **Project URL** and the **anon public** key.
5. Open **Authentication → URL Configuration**. Set **Site URL** to your app's address
   (for example `https://YOUR-USERNAME.github.io/family-events/`) and add the same address under **Redirect URLs**.

### 2. Add your details to the app

Edit `config.js` on GitHub (open the file, click the pencil ✏️ icon), paste the Project URL and anon key between
the quotes, change `familyName` if you like, then click **Commit changes**.

The anon key is designed to be public. The database rules in `schema.sql` make sure only family members can read or change anything.

### 3. Turn on the website (GitHub Pages)

1. In your repository on GitHub, open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to *Deploy from a branch*, choose the `main` branch and the `/ (root)` folder, and click **Save**.
3. After a minute, the page shows your link: `https://YOUR-USERNAME.github.io/family-events/`.

### 4. Sign in and invite the family

1. Open your link and sign in with your email. **The first person to sign in becomes the admin**, so do this before sharing the link.
2. Go to the **Family** tab and add each family member's name and email.
3. Send them the link. They sign in with the email you added. No passwords needed.

## Good to know

- Supabase's free plan sends a limited number of sign-in emails per hour. That's plenty for a family. If someone
  doesn't get the email, check their spam folder and wait a few minutes before trying again.
- Free Supabase projects pause after a week with no activity. If that happens, open supabase.com and click **Restore**.
- Sign-ins last a long time, so most people only sign in once per device.

## Files

| File | What it does |
| --- | --- |
| `index.html` | The page itself |
| `styles.css` | Colours and layout (light and dark mode) |
| `app.js` | Everything the app does |
| `config.js` | Your family name and Supabase details |
| `supabase/schema.sql` | Database tables and privacy rules |
| `manifest.webmanifest`, `icon.svg` | Home-screen app name and icon |
