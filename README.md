# Dental Pro — website

A 3D, scroll-driven site for Dental PRO Dental Clinic (Dr. Alyssa Marie V. Mamaril).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production files → dist/
npm run preview    # serve dist/ locally
```

`dist/` is a plain static site. Deploy it anywhere: drag the folder onto [Netlify Drop](https://app.netlify.com/drop), or use Vercel, Cloudflare Pages or any web host.

## Before going live

| What | Where |
|---|---|
| **Booking form → Messenger.** Submitting copies the visitor's details and opens your Page's Messenger chat (Page ID `100549332021492`), so requests land in your Meta Business Suite inbox. To use a different Page, change `MESSENGER_PAGE_ID`. | `src/main.js` (top) |
| Add phone number, clinic hours and Facebook/Messenger link. These weren't publicly available. | `index.html` → `.visit__locations` |
| Double-check both addresses. They came from public clinic directory listings. | `index.html` → Visit section + JSON-LD in `<head>` |
| Review Dr. Alyssa's bio wording. | `index.html` → `#doctor` |
| Put your real domain in front of the share image URL, e.g. `https://dentalpro.ph/assets/img/og.jpg`. | `index.html` → `og:image` |

## How it's built

- **3D hero**: `src/scene.js` (Three.js). A porcelain/pearl molar with iridescent clearcoat, a glowing edge with a travelling shine, floating gold dust and a studio-lit environment. Scroll keyframes live in `computeKeys()` in `src/main.js`.
- **Motion**: GSAP + ScrollTrigger, Lenis smooth scroll. Respects "reduce motion" settings.
- **Design**: "Aqua Couture": Manrope + Fraunces italic; teal-blue background (#90D8DA, sampled from the aqua silk video) with deep teal, white and gold. Colours and type live as tokens at the top of `src/style.css`.
- **Sections**: loader → hero (aqua silk video + 3D tooth) → why → *Inside the smile* (pinned 3D story on deep teal, driven by `setStory()` in `src/scene.js`) → treatments selector (copy in `TREATMENTS` in `src/main.js`) → before/after cases → Dr. Alyssa → your visit → FAQ → booking → footer.
- **Logo**: traced to vector from your logo file, in `src/svg/`.

## Assets

- Your photos and silk videos (from the *Chesca* folder), optimised to WebP/MP4 in `public/assets/`.
- Treatment showcase images (`public/assets/img/tx-*.webp`) and the share-image smile are free photos from Unsplash, under the [Unsplash License](https://unsplash.com/license) (free for commercial use, no credit required):
  - Whitening: https://unsplash.com/photos/glPVwPr1FKo
  - Braces: https://unsplash.com/photos/YKqYvUYzw0w
  - Deep cleaning: https://unsplash.com/photos/8BkF0sTC6Uo
  - Restorations: https://unsplash.com/photos/SU6EGDd-ySQ
  - Dentures & bridges: https://unsplash.com/photos/LOgBp87WzIk
  - Share image (`og.jpg`): https://unsplash.com/photos/KzmhiJJ041M
- Generated with Higgsfield: the 3D molar (`public/assets/model/tooth.glb`, original in `source-assets/`) and the portrait background cut-out. The earlier pearl/silk treatment artwork is kept in `source-assets/generated/`.
