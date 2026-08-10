'use strict';
(() => {
  // The interaction renderer owns the single chart viewport and vertical scale.
  // Fibonacci contributes its price levels through CryptoFibScaleLevels only.
  // Never replace drawMain here: doing so would desynchronise candles from FIB
  // during wheel zoom and history drag.
  window.CryptoChartUnifiedScale = true;
})();
