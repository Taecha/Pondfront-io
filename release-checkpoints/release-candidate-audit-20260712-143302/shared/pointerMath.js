(function initPointerMath(root, factory) {
  const value = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = value;
  else root.PondPointerMath = value;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPointerMath() {
  function positive(value, fallback = 1) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function canvasPoint(clientX, clientY, metrics = {}) {
    const rect = metrics.rect || { left: 0, top: 0, width: 1, height: 1 };
    const dpr = positive(metrics.dpr, 1);
    const logicalWidth = positive(metrics.backingWidth, rect.width * dpr) / dpr;
    const logicalHeight = positive(metrics.backingHeight, rect.height * dpr) / dpr;
    return {
      x: (Number(clientX) - Number(rect.left || 0)) * (logicalWidth / positive(rect.width, logicalWidth)),
      y: (Number(clientY) - Number(rect.top || 0)) * (logicalHeight / positive(rect.height, logicalHeight)),
      width: logicalWidth,
      height: logicalHeight,
    };
  }

  function screenPointToWorld(clientX, clientY, metrics = {}, camera = {}) {
    const point = canvasPoint(clientX, clientY, metrics);
    const zoom = positive(camera.zoom, 1);
    return {
      x: (point.x - point.width / 2) / zoom + Number(camera.x || 0),
      y: (point.y - point.height / 2) / zoom + Number(camera.y || 0),
      canvasX: point.x,
      canvasY: point.y,
    };
  }

  function worldPointToClient(worldX, worldY, metrics = {}, camera = {}) {
    const rect = metrics.rect || { left: 0, top: 0, width: 1, height: 1 };
    const dpr = positive(metrics.dpr, 1);
    const logicalWidth = positive(metrics.backingWidth, rect.width * dpr) / dpr;
    const logicalHeight = positive(metrics.backingHeight, rect.height * dpr) / dpr;
    const zoom = positive(camera.zoom, 1);
    const canvasX = (Number(worldX) - Number(camera.x || 0)) * zoom + logicalWidth / 2;
    const canvasY = (Number(worldY) - Number(camera.y || 0)) * zoom + logicalHeight / 2;
    return {
      x: Number(rect.left || 0) + canvasX * (positive(rect.width, logicalWidth) / logicalWidth),
      y: Number(rect.top || 0) + canvasY * (positive(rect.height, logicalHeight) / logicalHeight),
    };
  }

  function tileCoordinates(worldX, worldY, tileSize) {
    const size = positive(tileSize, 1);
    return { x: Math.floor(Number(worldX) / size), y: Math.floor(Number(worldY) / size) };
  }

  function pointInSquareTile(worldX, worldY, tile, tileSize, tolerance = 0) {
    if (!tile) return false;
    const size = positive(tileSize, 1);
    const pad = Math.max(0, Number(tolerance) || 0);
    const left = tile.x * size - pad;
    const top = tile.y * size - pad;
    return Number(worldX) >= left && Number(worldX) < left + size + pad * 2 && Number(worldY) >= top && Number(worldY) < top + size + pad * 2;
  }

  return Object.freeze({ canvasPoint, screenPointToWorld, worldPointToClient, tileCoordinates, pointInSquareTile });
});
