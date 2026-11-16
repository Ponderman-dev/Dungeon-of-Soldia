// PHONE SPEED (session 45, user: 'choppy on Android'): Phaser asks for its small 2D canvases (every Text, the texture
// makers) with willReadFrequently: false, so the browser keeps them on the graphics card. Our small-font sharpening
// (uiKit.js snapCanvas) reads the pixels back after EVERY text change, and on Android that read-back from the graphics
// card stalls the frame. Small canvases are now kept in normal memory instead (reads are free). The big game canvas
// is left alone. Must be imported before Phaser creates anything (first import in main.js).
const SCREEN_PIXELS = 390 * 844;
if (typeof HTMLCanvasElement !== 'undefined') {
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, options) {
    if (type === '2d' && this.width * this.height < SCREEN_PIXELS) options = { ...(options || {}), willReadFrequently: true };
    return getContext.call(this, type, options);
  };
}
