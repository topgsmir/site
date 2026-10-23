/** Temporary catalog of detailed product-comment avatar SVG options (1–10). */

export type AvatarOption = {
  id: number;
  label: string;
  description: string;
  /** Inline SVG markup (viewBox 0 0 32 32). Unique gradient ids per option. */
  svg: string;
};

export const AVATAR_OPTIONS: AvatarOption[] = [
  {
    id: 1,
    label: "Classic gold bust",
    description: "Gold disc, short navy hair, collar, soft smile — Digikala-rooted with depth.",
    svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="a1bg" cx="38%" cy="28%" r="78%"><stop offset="0%" stop-color="#FFD54A"/><stop offset="100%" stop-color="#F9BC01"/></radialGradient>
    <linearGradient id="a1skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1A2F42"/><stop offset="100%" stop-color="#011627"/></linearGradient>
  </defs>
  <circle cx="16" cy="16" r="16" fill="url(#a1bg)"/>
  <ellipse cx="16" cy="29.2" rx="11.2" ry="6.4" fill="#0A1E2E" opacity=".22"/>
  <path fill="#011627" d="M9.2 9.4c.4-3.2 3-5.2 6.8-5.2s6.4 2 6.8 5.2c.2 1.4-.2 2.6-1 3.4-.6-2.2-2.8-3.6-5.8-3.6s-5.2 1.4-5.8 3.6c-.8-.8-1.2-2-1-3.4Z"/>
  <circle cx="16" cy="13.2" r="5.4" fill="url(#a1skin)"/>
  <circle cx="13.6" cy="12.8" r=".55" fill="#F6F7F8" opacity=".9"/>
  <circle cx="18.4" cy="12.8" r=".55" fill="#F6F7F8" opacity=".9"/>
  <path d="M14.2 15.1c.6.7 1.5 1 1.8 1s1.2-.3 1.8-1" fill="none" stroke="#2EC4B6" stroke-width=".7" stroke-linecap="round"/>
  <path fill="#011627" d="M5.6 29.2c1.4-5.6 5.6-8.6 10.4-8.6s9 3 10.4 8.6A16 16 0 0 1 16 32a16 16 0 0 1-10.4-2.8Z"/>
  <path fill="#20A4F3" d="M8.2 28.6c1.2-3.6 4.2-5.4 7.8-5.4s6.6 1.8 7.8 5.4c-.8.6-1.8 1-2.6 1.2-.8-1.6-2.8-2.6-5.2-2.6s-4.4 1-5.2 2.6c-.8-.2-1.8-.6-2.6-1.2Z"/>
  <path fill="#F6F7F8" opacity=".35" d="M14.8 10.4c1-.8 2.4-.8 3.4 0 .2.2 0 .5-.3.4-1-.5-2-.5-2.8 0-.3.1-.5-.2-.3-.4Z"/>
</svg>`
  },
  {
    id: 2,
    label: "Soft wavy hair",
    description: "Rounded figure with wavy side hair, earrings, teal collar hint.",
    svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="a2bg" cx="40%" cy="30%" r="75%"><stop offset="0%" stop-color="#FFE082"/><stop offset="100%" stop-color="#F9BC01"/></radialGradient>
  </defs>
  <circle cx="16" cy="16" r="16" fill="url(#a2bg)"/>
  <path fill="#011627" d="M8.4 12.2c-.4-4 2.6-7.4 7.6-7.4s8 3.4 7.6 7.4c-.2 1.8-1.2 3.2-2.4 4 0-2.8-2.2-5-5.2-5s-5.2 2.2-5.2 5c-1.2-.8-2.2-2.2-2.4-4Z"/>
  <path fill="#0A2030" d="M7.6 14.8c.2 2.8 1.6 4.6 3.4 5.4-.2-1.6.2-3.4 1.4-4.6-2-.2-3.6-.6-4.8-.8Zm16.8 0c-1.2.2-2.8.6-4.8.8 1.2 1.2 1.6 3 1.4 4.6 1.8-.8 3.2-2.6 3.4-5.4Z"/>
  <circle cx="16" cy="13.4" r="5.1" fill="#011627"/>
  <circle cx="13.7" cy="13" r=".5" fill="#F6F7F8"/>
  <circle cx="18.3" cy="13" r=".5" fill="#F6F7F8"/>
  <path d="M14.4 15.2c.5.55 1.3.85 1.6.85s1.1-.3 1.6-.85" fill="none" stroke="#2EC4B6" stroke-width=".65" stroke-linecap="round"/>
  <circle cx="10.6" cy="15.6" r=".85" fill="#20A4F3"/>
  <circle cx="21.4" cy="15.6" r=".85" fill="#20A4F3"/>
  <circle cx="10.6" cy="15.6" r=".35" fill="#F6F7F8" opacity=".7"/>
  <circle cx="21.4" cy="15.6" r=".35" fill="#F6F7F8" opacity=".7"/>
  <path fill="#011627" d="M5.2 29.4c1.6-5.8 5.8-8.8 10.8-8.8s9.2 3 10.8 8.8A16 16 0 0 1 16 32a16 16 0 0 1-10.8-2.6Z"/>
  <path fill="#2EC4B6" d="M9 28.8c1-3.2 3.6-4.8 7-4.8s6 1.6 7 4.8c-1 .5-2.2.9-3.2 1.1C19.2 28.4 17.6 27.4 16 27.4s-3.2 1-3.8 2.5c-1-.2-2.2-.6-3.2-1.1Z"/>
</svg>`
  },
  {
    id: 3,
    label: "Line-art glasses",
    description: "Minimal strokes with round glasses, brows, and layered collar lines.",
    svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <circle cx="16" cy="16" r="15.4" fill="#F6F7F8" stroke="#011627" stroke-width="1.2"/>
  <circle cx="16" cy="16" r="13.6" fill="none" stroke="#20A4F3" stroke-width=".6" opacity=".45"/>
  <path fill="none" stroke="#011627" stroke-width="1.35" stroke-linecap="round" d="M10.2 9.8c1.4-2.4 3.4-3.4 5.8-3.4s4.4 1 5.8 3.4"/>
  <circle cx="16" cy="13.2" r="4.6" fill="none" stroke="#011627" stroke-width="1.35"/>
  <path fill="none" stroke="#011627" stroke-width="1.1" stroke-linecap="round" d="M12.2 11.4h2.2M17.6 11.4h2.2"/>
  <circle cx="13.5" cy="13.4" r="1.55" fill="none" stroke="#011627" stroke-width="1.05"/>
  <circle cx="18.5" cy="13.4" r="1.55" fill="none" stroke="#011627" stroke-width="1.05"/>
  <path fill="none" stroke="#011627" stroke-width=".9" d="M15.05 13.4h1.9"/>
  <circle cx="13.5" cy="13.4" r=".4" fill="#20A4F3"/>
  <circle cx="18.5" cy="13.4" r=".4" fill="#20A4F3"/>
  <path d="M14.6 15.6c.45.5 1.1.75 1.4.75s.95-.25 1.4-.75" fill="none" stroke="#2EC4B6" stroke-width=".7" stroke-linecap="round"/>
  <path fill="none" stroke="#011627" stroke-width="1.35" stroke-linecap="round" d="M7.8 26.8c1.5-4.8 4.8-7.2 8.2-7.2s6.7 2.4 8.2 7.2"/>
  <path fill="none" stroke="#20A4F3" stroke-width="1" stroke-linecap="round" d="M10.2 25.6c1.1-2.6 3.2-3.8 5.8-3.8s4.7 1.2 5.8 3.8"/>
  <path fill="none" stroke="#011627" stroke-width=".9" stroke-linecap="round" d="M16 19.6v2.2"/>
</svg>`
  },
  {
    id: 4,
    label: "Geometric teal builder",
    description: "Faceted hair planes, angular collar, teal disc with navy/blue accents.",
    svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="a4bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#5ED9CD"/><stop offset="100%" stop-color="#2EC4B6"/></linearGradient>
  </defs>
  <circle cx="16" cy="16" r="16" fill="url(#a4bg)"/>
  <path fill="#011627" d="M9 8.2 16 4.6 23 8.2 21.2 13.4h-10.4Z"/>
  <path fill="#0A2A38" d="M9 8.2 12.4 13.4h-1.6L9 8.2Zm14 0-1.8 5.2h-1.6L23 8.2Z"/>
  <circle cx="16" cy="13.6" r="4.7" fill="#011627"/>
  <rect x="13.1" y="12.4" width="1.2" height="1.2" rx=".2" fill="#F6F7F8"/>
  <rect x="17.7" y="12.4" width="1.2" height="1.2" rx=".2" fill="#F6F7F8"/>
  <path d="M14.4 15.2 16 16.2 17.6 15.2" fill="none" stroke="#2EC4B6" stroke-width=".7" stroke-linecap="round" stroke-linejoin="round"/>
  <path fill="#011627" d="M6.4 28.8 10.8 19.6h10.4l4.4 9.2A16 16 0 0 1 16 32a16 16 0 0 1-9.6-3.2Z"/>
  <path fill="#20A4F3" d="M11.2 27.8 13.4 21.2h5.2l2.2 6.6c-1.1.5-2.4.9-3.6 1.1v-3.2h-2.4v3.2c-1.2-.2-2.5-.6-3.6-1.1Z"/>
  <path fill="#F6F7F8" opacity=".28" d="M14.2 8.8h3.6l-.8 2.4h-2Z"/>
</svg>`
  },
  {
    id: 5,
    label: "Friendly beanie bust",
    description: "Gold field, soft beanie, rosy cheeks (teal blush), open smile.",
    svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="a5bg" cx="42%" cy="26%" r="78%"><stop offset="0%" stop-color="#FFD978"/><stop offset="100%" stop-color="#F9BC01"/></radialGradient>
  </defs>
  <circle cx="16" cy="16" r="16" fill="url(#a5bg)"/>
  <path fill="#20A4F3" d="M8.6 11.2c.6-4.2 3.6-6.8 7.4-6.8s6.8 2.6 7.4 6.8c-1.6-1.4-4.2-2.2-7.4-2.2s-5.8.8-7.4 2.2Z"/>
  <path fill="#011627" d="M9.4 11.6c.5-2.8 3-4.6 6.6-4.6s6.1 1.8 6.6 4.6c.2.9 0 1.7-.4 2.4-.8-1.8-3.2-3-6.2-3s-5.4 1.2-6.2 3c-.4-.7-.6-1.5-.4-2.4Z"/>
  <circle cx="16" cy="14" r="5.3" fill="#011627"/>
  <circle cx="12.8" cy="14.4" r="1.1" fill="#2EC4B6" opacity=".35"/>
  <circle cx="19.2" cy="14.4" r="1.1" fill="#2EC4B6" opacity=".35"/>
  <circle cx="13.7" cy="13.5" r=".55" fill="#F6F7F8"/>
  <circle cx="18.3" cy="13.5" r=".55" fill="#F6F7F8"/>
  <path d="M13.8 15.6c.8 1.1 2 1.6 2.2 1.6s1.4-.5 2.2-1.6" fill="none" stroke="#2EC4B6" stroke-width=".85" stroke-linecap="round"/>
  <path fill="#011627" d="M4.8 29.6c1.8-6.2 6.2-9.4 11.2-9.4s9.4 3.2 11.2 9.4A16 16 0 0 1 16 32a16 16 0 0 1-11.2-2.4Z"/>
  <path fill="#F6F7F8" d="M9.6 28.8c1.1-3.4 3.8-5.2 6.4-5.2s5.3 1.8 6.4 5.2c-1.2.6-2.6 1-4 1.2-.4-1.2-1.4-2-2.4-2s-2 .8-2.4 2c-1.4-.2-2.8-.6-4-1.2Z"/>
  <circle cx="22.6" cy="9.4" r="1.3" fill="#20A4F3"/>
  <circle cx="22.6" cy="9.4" r=".5" fill="#F6F7F8"/>
</svg>`
  },
  {
    id: 6,
    label: "Ringed professional",
    description: "Double brand rings, side-part hair, blue tie knot detail.",
    svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <circle cx="16" cy="16" r="16" fill="#F6F7F8"/>
  <circle cx="16" cy="16" r="14.4" fill="none" stroke="#20A4F3" stroke-width="1.5"/>
  <circle cx="16" cy="16" r="12.2" fill="none" stroke="#011627" stroke-width=".85" opacity=".4"/>
  <path fill="#011627" d="M10.4 10.2c.8-3.2 3.2-5 5.6-5 2.6 0 4.6 1.4 5.4 3.8-.8-.4-1.8-.6-2.8-.6-2.4 0-4.4 1.4-5.2 3.4-.4-.5-.8-1.1-1-1.6Z"/>
  <circle cx="16" cy="13.2" r="4.5" fill="#011627"/>
  <path fill="#0D2434" d="M11.6 11.2c1.2-1.6 2.8-2.4 4.4-2.4.6 0 1.2.1 1.8.3-1.4.2-2.6.8-3.4 1.8L11.6 11.2Z"/>
  <circle cx="14" cy="12.9" r=".45" fill="#F6F7F8"/>
  <circle cx="18" cy="12.9" r=".45" fill="#F6F7F8"/>
  <path d="M14.6 14.8c.4.45 1 .7 1.4.7s1-.25 1.4-.7" fill="none" stroke="#2EC4B6" stroke-width=".6" stroke-linecap="round"/>
  <path fill="#011627" d="M8.4 27.2c1-4.2 4-6.6 7.6-6.6s6.6 2.4 7.6 6.6A13.5 13.5 0 0 1 16 28.8a13.5 13.5 0 0 1-7.6-1.6Z"/>
  <path fill="#F6F7F8" d="M12.2 26.6c.7-2.2 2.2-3.4 3.8-3.4s3.1 1.2 3.8 3.4c-.8.3-1.8.5-2.6.6v-1.8h-2.4v1.8c-.8-.1-1.8-.3-2.6-.6Z"/>
  <path fill="#20A4F3" d="M15.2 23.4h1.6l.7 3.4h-3Z"/>
</svg>`
  },
  {
    id: 7,
    label: "Teal dual-tone curls",
    description: "Teal wash, curly hair volumes, layered navy/white torso shading.",
    svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="a7bg" cx="36%" cy="28%" r="80%"><stop offset="0%" stop-color="#7BE0D6"/><stop offset="100%" stop-color="#2EC4B6"/></radialGradient>
  </defs>
  <circle cx="16" cy="16" r="16" fill="url(#a7bg)"/>
  <circle cx="10.2" cy="11.2" r="3.2" fill="#011627"/>
  <circle cx="21.8" cy="11.2" r="3.2" fill="#011627"/>
  <circle cx="12.4" cy="8.2" r="2.6" fill="#011627"/>
  <circle cx="19.6" cy="8.2" r="2.6" fill="#011627"/>
  <circle cx="16" cy="7.4" r="2.8" fill="#011627"/>
  <circle cx="16" cy="13.4" r="5" fill="#011627"/>
  <circle cx="13.6" cy="13" r=".5" fill="#F6F7F8"/>
  <circle cx="18.4" cy="13" r=".5" fill="#F6F7F8"/>
  <path fill="#0A2A35" d="M13.2 12.2c.5-.35 1.1-.35 1.6 0M17.2 12.2c.5-.35 1.1-.35 1.6 0" opacity=".9"/>
  <path d="M14.3 15c.55.65 1.35.95 1.7.95s1.15-.3 1.7-.95" fill="none" stroke="#F6F7F8" stroke-width=".7" stroke-linecap="round"/>
  <path fill="#011627" d="M5.6 28.8c1.4-5.6 5.6-8.6 10.4-8.6s9 3 10.4 8.6A16 16 0 0 1 16 32a16 16 0 0 1-10.4-3.2Z"/>
  <path fill="#F6F7F8" opacity=".42" d="M7.4 29c1.2-4.2 4.6-6.6 8.6-6.6s7.4 2.4 8.6 6.6A16 16 0 0 1 16 32a16 16 0 0 1-8.6-3Z"/>
  <path fill="#20A4F3" d="M12.6 28.2c.7-1.8 2-2.8 3.4-2.8s2.7 1 3.4 2.8c-.9.4-2 .7-3.4.7s-2.5-.3-3.4-.7Z"/>
</svg>`
  },
  {
    id: 8,
    label: "Digikala gold detailed",
    description: "Warm gold, cropped bust, bangs, subtle brows and cheek light.",
    svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="a8bg" cx="40%" cy="25%" r="78%"><stop offset="0%" stop-color="#FFE28A"/><stop offset="55%" stop-color="#F9BC01"/><stop offset="100%" stop-color="#E5A800"/></radialGradient>
  </defs>
  <circle cx="16" cy="16" r="16" fill="url(#a8bg)"/>
  <path fill="#011627" d="M8.8 10.6c.6-3.8 3.4-6.2 7.2-6.2s6.6 2.4 7.2 6.2c.2 1.2-.2 2.3-.8 3.1-.7-2.4-3.2-4-6.4-4s-5.7 1.6-6.4 4c-.6-.8-1-1.9-.8-3.1Z"/>
  <path fill="#0B1F2E" d="M10.2 12.8c0-2.2 1.6-4.2 3.4-5.1-.4 1.4-.4 3-.1 4.4L10.2 12.8Zm11.6 0-3.1-.7c.3-1.4.3-3-.1-4.4 1.8.9 3.4 2.9 3.4 5.1Z"/>
  <circle cx="16" cy="13.6" r="5.5" fill="#011627"/>
  <path fill="#142838" d="M11.4 11.6c1.4-1.2 3-1.8 4.6-1.8s3.2.6 4.6 1.8c-1.2-.8-2.8-1.2-4.6-1.2s-3.4.4-4.6 1.2Z"/>
  <path fill="none" stroke="#F6F7F8" stroke-width=".55" stroke-linecap="round" opacity=".75" d="M12.6 12.4c.7-.4 1.5-.6 2-.5M17.4 11.9c.5-.1 1.3.1 2 .5"/>
  <circle cx="13.6" cy="13.3" r=".55" fill="#F6F7F8"/>
  <circle cx="18.4" cy="13.3" r=".55" fill="#F6F7F8"/>
  <circle cx="12.4" cy="14.6" r="1" fill="#2EC4B6" opacity=".28"/>
  <circle cx="19.6" cy="14.6" r="1" fill="#2EC4B6" opacity=".28"/>
  <path d="M14.2 15.4c.6.75 1.5 1.05 1.8 1.05s1.2-.3 1.8-1.05" fill="none" stroke="#2EC4B6" stroke-width=".7" stroke-linecap="round"/>
  <path fill="#011627" d="M4.4 30.6C6.2 23.4 10.8 19.8 16 19.8s9.8 3.6 11.6 10.8A16.2 16.2 0 0 1 16 32a16.2 16.2 0 0 1-11.6-1.4Z"/>
  <path fill="#1A3348" d="M8.8 29.6c1.2-3.8 4.2-5.8 7.2-5.8s6 2 7.2 5.8c-1.4.6-3.2 1-4.8 1.2-.5-1.4-1.6-2.3-2.4-2.3s-1.9.9-2.4 2.3c-1.6-.2-3.4-.6-4.8-1.2Z"/>
</svg>`
  },
  {
    id: 9,
    label: "Brand-blue explorer",
    description: "Blue disc, white figure, cap brim, backpack-strap clothing cue.",
    svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="a9bg" cx="35%" cy="28%" r="78%"><stop offset="0%" stop-color="#5BC4F7"/><stop offset="100%" stop-color="#20A4F3"/></radialGradient>
  </defs>
  <circle cx="16" cy="16" r="16" fill="url(#a9bg)"/>
  <path fill="#011627" d="M8.8 11c.8-3.6 3.6-5.6 7.2-5.6s6.4 2 7.2 5.6c-2-.8-4.4-1.2-7.2-1.2s-5.2.4-7.2 1.2Z"/>
  <ellipse cx="16" cy="9.2" rx="7.4" ry="2.1" fill="#F6F7F8"/>
  <path fill="#F6F7F8" d="M9.6 11.4c.6-2.6 3-4.2 6.4-4.2s5.8 1.6 6.4 4.2c.2.8 0 1.5-.4 2.1-.9-1.7-3.2-2.8-6-2.8s-5.1 1.1-6 2.8c-.4-.6-.6-1.3-.4-2.1Z"/>
  <circle cx="16" cy="13.6" r="4.9" fill="#F6F7F8"/>
  <circle cx="13.8" cy="13.2" r=".5" fill="#011627"/>
  <circle cx="18.2" cy="13.2" r=".5" fill="#011627"/>
  <path d="M14.4 15.2c.5.6 1.25.9 1.6.9s1.1-.3 1.6-.9" fill="none" stroke="#011627" stroke-width=".65" stroke-linecap="round"/>
  <path fill="#F6F7F8" d="M5.8 28.2c1.4-5.4 5.4-8.4 10.2-8.4s8.8 3 10.2 8.4A16 16 0 0 1 16 32a16 16 0 0 1-10.2-3.8Z"/>
  <path fill="#011627" opacity=".18" d="M8.2 28.6c1.1-3.8 4.2-5.8 7.8-5.8s6.7 2 7.8 5.8A16 16 0 0 1 16 32a16 16 0 0 1-7.8-3.4Z"/>
  <path fill="#2EC4B6" d="M11.2 24.2h2.2v5.6h-1.4c-.4-1.8-1-3.6-.8-5.6Zm7.4 0h2.2c.2 2-.4 3.8-.8 5.6h-1.4v-5.6Z"/>
  <path fill="#011627" d="M14.6 23.2h2.8l.6 2.8h-4Z"/>
</svg>`
  },
  {
    id: 10,
    label: "Gradient night glyph",
    description: "Navy→blue radial, star highlight, layered white person with hair tuft.",
    svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="a10bg" cx="32%" cy="26%" r="82%"><stop offset="0%" stop-color="#20A4F3"/><stop offset="55%" stop-color="#0A4F7A"/><stop offset="100%" stop-color="#011627"/></radialGradient>
  </defs>
  <circle cx="16" cy="16" r="16" fill="url(#a10bg)"/>
  <circle cx="23.6" cy="7.4" r="1.1" fill="#F9BC01" opacity=".9"/>
  <circle cx="8.4" cy="9.2" r=".55" fill="#F6F7F8" opacity=".55"/>
  <circle cx="25.2" cy="14.8" r=".4" fill="#F6F7F8" opacity=".4"/>
  <path fill="#F6F7F8" d="M10.2 10.6c.7-3.2 3.2-5 5.8-5s5.1 1.8 5.8 5c.2 1-.2 1.9-.8 2.6-.6-2-2.8-3.4-5-3.4s-4.4 1.4-5 3.4c-.6-.7-1-1.6-.8-2.6Z"/>
  <circle cx="16" cy="13.4" r="4.8" fill="#F6F7F8"/>
  <path fill="#DCE7EE" d="M12.2 11.8c1.1-.9 2.4-1.3 3.8-1.3s2.7.4 3.8 1.3c-.9-.55-2.2-.9-3.8-.9s-2.9.35-3.8.9Z"/>
  <circle cx="13.8" cy="13" r=".48" fill="#011627"/>
  <circle cx="18.2" cy="13" r=".48" fill="#011627"/>
  <path d="M14.4 15c.5.55 1.2.85 1.6.85s1.1-.3 1.6-.85" fill="none" stroke="#2EC4B6" stroke-width=".7" stroke-linecap="round"/>
  <path fill="#F6F7F8" d="M6.6 28c1.3-5.2 5.2-8 9.4-8s8.1 2.8 9.4 8A16 16 0 0 1 16 32a16 16 0 0 1-9.4-4Z"/>
  <path fill="#20A4F3" opacity=".55" d="M9.2 28.4c1-3.6 3.8-5.4 6.8-5.4s5.8 1.8 6.8 5.4c-1.2.6-2.8 1-4.2 1.2-.5-1.3-1.5-2.1-2.6-2.1s-2.1.8-2.6 2.1c-1.4-.2-3-.6-4.2-1.2Z"/>
  <path fill="#F9BC01" d="M15.4 21.2h1.2l.35 1.6h-1.9Z"/>
</svg>`
  }
];
