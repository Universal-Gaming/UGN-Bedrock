import fs from "node:fs";
import path from "node:path";

/**
 * Applies UGN-specific branding to the pinned Minecraft Web Client source.
 * Uses exact-content guards to fail CI safely if upstream layout changes.
 * Keeps all actual game actions and upstream credits intact.
 */
const root = process.argv[2];
if (!root) throw new Error("Usage: node scripts/theme-client.mjs <upstream-directory>");
const componentFile = path.join(root, "src/react/MainMenu.tsx");
const stylesheetFile = path.join(root, "src/react/mainMenu.module.css");
const read = (file) => fs.readFileSync(file, "utf8");
const original = read(componentFile);

const oldHeader = [
  "      <div className={styles['game-title']}>",
  "        <div className={styles.minecraft}>",
  "          <div className={styles.edition} />",
  "          <span className={styles.splash}>{splashText}</span>",
  "        </div>",
  "      </div>"
].join("\n");

const newHeader = [
  "      <div className={styles['game-title']}>",
  "        <div className={styles.minecraft}>",
  "          <span>UGN</span>",
  "          <div className={styles.edition}>JAVA / MC BROWSER EDITION</div>",
  "          <span className={styles.splash}>{splashText}</span>",
  "        </div>",
  "      </div>"
].join("\n");
function replaceOnce(value, search, replacement, desc) {
  const count = value.split(search).length - 1;
  if (count !== 1) throw new Error("Incompatible upstream: expected one " + desc + ", found " + count);
  return value.replace(search, replacement);
}
let next = replaceOnce(original, oldHeader, newHeader, "menu title");
next = replaceOnce(next, "    <div className={styles.root}>", "    <div className={styles.root} onPointerMove={(event) => {\n      if (event.pointerType !== 'mouse') return\n      const el = event.currentTarget\n      el.style.setProperty('--ugn-pointer-x', ((event.clientX / Math.max(1, el.clientWidth) - .5) * 2).toFixed(3))\n      el.style.setProperty('--ugn-pointer-y', ((event.clientY / Math.max(1, el.clientHeight) - .5) * 2).toFixed(3))\n    }} onPointerLeave={(event) => {\n      event.currentTarget.style.setProperty('--ugn-pointer-x', '0')\n      event.currentTarget.style.setProperty('--ugn-pointer-y', '0')\n    }}>\n      <div className=\"ugn-menu-background\" aria-hidden=\"true\">\n        <div className=\"ugn-menu-stars ugn-menu-stars-near\" />\n        <div className=\"ugn-menu-stars ugn-menu-stars-far\" />\n        <div className=\"ugn-menu-nebula\" />\n        <div className=\"ugn-menu-planet-system\">\n          <div className=\"ugn-menu-planet\"><div className=\"ugn-menu-planet-texture\" /></div>\n          <div className=\"ugn-menu-ring ugn-menu-ring-back\" />\n          <div className=\"ugn-menu-ring ugn-menu-ring-front\" />\n          <div className=\"ugn-menu-moon\" />\n        </div>\n        <div className=\"ugn-menu-grid\" />\n        <div className=\"ugn-menu-vignette\" />\n      </div>", "animated UGN menu background");
next = replaceOnce(next, "        <div className={styles['menu-row']}>\n          <PauseLinkButtons />\n        </div>", "        <a className=\"ugn-menu-discord\" href=\"https://discord.universalgaming.us/\" target=\"_blank\" rel=\"noopener noreferrer\">\n          JOIN UGN DISCORD ↗\n        </a>\n        <div className={styles['menu-row']}>\n          <PauseLinkButtons />\n        </div>", "direct UGN Discord menu link");
next = replaceOnce(next, "\n          Connect to server\n", "\n          Multiplayer\n", "multiplayer button");
next = replaceOnce(next, "\n            Singleplayer\n", "\n            Singleplayer\n", "singleplayer button");
next = replaceOnce(next, "\n          Options\n", "\n          Settings\n", "settings button");
next = replaceOnce(next,
  "V2 Presented by Sandexzx {versionStatus}",
  "UGN Java MC Browser Edition {versionStatus}",
  "branding footer");
next = replaceOnce(next,
  "content: 'Connect to Java servers!'",
  "content: 'Join compatible Java servers through a configured relay'",
  "multiplayer tooltip");
next = replaceOnce(next,
  "content: 'Create worlds and play offline'",
  "content: 'Create a new world and play locally in your browser'",
  "singleplayer tooltip");
next = replaceOnce(next,
  "content: 'Explore maps to play from provider!'",
  "content: 'Explore or import your saved worlds'",
  "maps tooltip");

fs.writeFileSync(componentFile, next);

const css = read(stylesheetFile);
const theme = String.raw`

/* UGN Java MC Browser Edition — customized from the MIT upstream client.
 * Pixel-sharp cosmic presentation. Does not replace gameplay HUD or menus.
 */
.root {
    --top-offset: 24px;
    position: fixed;
    inset: 0;
    overflow: hidden;
    background:
        radial-gradient(circle at 78% 33%, rgba(118, 91, 214, .34) 0%, transparent 22%),
        radial-gradient(ellipse at 25% 78%, rgba(19, 145, 179, .16), transparent 50%),
        linear-gradient(125deg, #050916 0%, #101b3b 58%, #090b20 100%);
    isolation: isolate;
}
.root::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: .60;
    background-image:
        radial-gradient(1px 1px at 25px 41px, white 99%, transparent),
        radial-gradient(1px 1px at 154px 167px, #b2ceff 99%, transparent),
        radial-gradient(2px 2px at 242px 83px, #a5b4ff 99%, transparent),
        radial-gradient(1px 1px at 87px 252px, #b1ffdf 99%, transparent);
    background-size: 320px 310px;
    animation: ugn-star-drift 70s linear infinite;
}
.root::after {
    content: '';
    position: absolute;
    width: min(62vmin, 420px);
    height: min(62vmin, 420px);
    border-radius: 50%;
    top: 19%;
    right: -8%;
    pointer-events: none;
    opacity: .68;
    background:
        repeating-linear-gradient(155deg, transparent 0 17px, rgba(179, 160, 255, .15) 20px 35px, transparent 42px 70px),
        radial-gradient(circle at 28% 24%, #8d88e0, #353e95 49%, #08132d 87%);
    box-shadow: inset -34px -19px 65px #050819, 0 0 72px #8e76ff45;
    animation: ugn-planet-drift 19s ease-in-out infinite alternate;
}
.game-title {
    top: clamp(28px, 8vh, 72px);
    z-index: 3;
}
.game-title .minecraft {
    width: 320px;
    height: 110px;
    background: none;
    text-align: center;
    position: relative;
}
.game-title .minecraft > span:first-child {
    position: relative;
    display: block;
    font-family: Minecraft, mojangles, monospace;
    font-size: 54px;
    line-height: 1.15;
    font-weight: 900;
    letter-spacing: .12em;
    color: #efefff;
    text-shadow: 4px 4px 0 #483b7f, 0 0 32px #7c74c9a6;
}
.game-title .minecraft > span:first-child::first-letter { color: #a18bff; }
.game-title .edition {
    position: absolute;
    top: 58px;
    left: 0;
    width: 100%;
    height: auto;
    background: none;
    color: #82eafa;
    font-family: mojangles, monospace;
    font-size: 12px;
    letter-spacing: .1em;
    font-weight: 900;
    text-align: center;
    line-height: 1.7;
    text-shadow: 2px 2px 0 #07122a;
}
.splash {
    top: 89px;
    left: 50%;
    width: max-content;
    max-width: 300px;
    text-align: center;
    color: #a2ffbe;
    font-size: 8px;
    text-shadow: 1px 1px #092523;
    transform: translate(-50%, -50%) rotate(-2deg);
    animation: ugn-tag-pulse 2.5s ease-in-out infinite alternate;
}
.menu {
    z-index: 4;
    top: clamp(172px, 38%, 310px);
    width: 240px;
    padding: 15px 15px 17px;
    background: linear-gradient(145deg, rgba(15, 25, 53, .91), rgba(20, 20, 52, .94));
    border: 1px solid rgba(151, 172, 255, .48);
    box-shadow: 0 9px 0 rgba(4, 9, 26, .55), 0 22px 75px rgba(0, 0, 0, .44), inset 0 1px rgba(205, 229, 255, .18);
    border-radius: 5px;
    gap: 7px;
}
.menu button {
    border-radius: 3px;
    outline-offset: 2px;
    transition: filter .2s, transform .2s;
}
.menu > button:first-child,
.menu > :first-child button {
    color: #f1fff6;
}
.menu button:focus-visible { outline: 2px solid #78ffb6; }
.menu button:hover:not(:disabled) { filter: brightness(1.2); transform: translateY(-1px); }
.menu button::before,
.menu button::after {
    background-image: linear-gradient(180deg, #35477e, #202c55) !important;
    background-color: #25335f !important;
    border-top: 1px solid #91a6df !important;
    border-bottom: 2px solid #0c1531 !important;
    border-radius: 2px !important;
}
.menu > :first-child button::before,
.menu > :first-child button::after {
    background-image: linear-gradient(180deg, #328c77, #226054) !important;
    border-top-color: #77f6b7 !important;
}
.bottom-info {
    z-index: 4;
    padding: 0 11px 8px;
    color: #c6d6f2;
    background: linear-gradient(0deg, rgba(5, 9, 24, .65), transparent);
}
.product-info { color: #a2bedf; }
.product-description { color: #b7cceb; }
@keyframes ugn-star-drift {
    from { transform: translateY(0); }
    to { transform: translateY(-60px); }
}
@keyframes ugn-planet-drift {
    from { transform: translateY(-9px) rotate(-4deg); }
    to { transform: translateY(13px) rotate(6deg); }
}
@keyframes ugn-tag-pulse {
    from { opacity: .70; transform: translate(-50%, -50%) rotate(-3deg) scale(1); }
    to { opacity: 1; transform: translate(-50%, -50%) rotate(-3deg) scale(1.08); }
}
@media (max-height: 480px) {
    .root { --top-offset: 5px; }
    .game-title { top: 9px; }
    .game-title .minecraft { transform: scale(.62); transform-origin: center top; }
    .menu { top: 110px; }
    .root::after { right: -20%; }
}
@media (max-width: 550px) {
    .game-title .minecraft { transform: scale(.84); transform-origin: center top; }
    .menu { top: clamp(145px, 33%, 270px); }
    .root::after { right: -34%; opacity: .36; }
}
@media (prefers-reduced-motion: reduce) {
    .root::before, .root::after, .splash { animation: none !important; }
    .menu button { transition: none !important; }
}
`;
fs.writeFileSync(stylesheetFile, css + theme + "\n.root::before,.root::after { display: none !important; }\n");
const globalFile = path.join(root, "src/styles.css");
const backgroundCss = fs.readFileSync(new URL("./ugn-menu-background.css", import.meta.url), "utf8");
fs.appendFileSync(globalFile, "\n" + backgroundCss + "\n");
console.log("UGN menu themed: animated background, UGN Discord and original actions preserved.");
