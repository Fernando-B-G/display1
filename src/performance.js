// src/performance.js
// Performance tier detection and optimization utilities

/**
 * Detects the performance tier of the current device
 * @returns {'low' | 'medium' | 'high'}
 */
export function detectPerformanceTier() {
    const cores = navigator.hardwareConcurrency || 2;
    const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    const memory = navigator.deviceMemory; // GB, if available

    // Low tier: mobile devices, low core count, or low memory
    if (mobile || cores <= 2) return 'low';
    if (memory && memory <= 4) return 'low';

    // Medium tier: moderate specs
    if (cores <= 4) return 'medium';
    if (memory && memory <= 8) return 'medium';

    // High tier: everything else
    return 'high';
}

/**
 * Get optimized settings based on performance tier
 * @param {string} tier - Performance tier ('low', 'medium', 'high')
 * @returns {object} Optimization settings
 */
export function getOptimizedSettings(tier = detectPerformanceTier()) {
    const settings = {
        low: {
            pixelRatio: 1.0,
            antialias: false,
            starfieldCount: 800,
            previewResolution: { width: 320, height: 180 },
            activeResolution: { width: 768, height: 432 },
            particleMultiplier: 0.5,
            mediapipeHands: 2,
            mediapipeResolution: { width: 480, height: 360 },
            powerPreference: 'low-power'
        },
        medium: {
            pixelRatio: 1.5,
            antialias: true,
            starfieldCount: 1200,
            previewResolution: { width: 480, height: 270 },
            activeResolution: { width: 960, height: 540 },
            particleMultiplier: 0.75,
            mediapipeHands: 2,
            mediapipeResolution: { width: 640, height: 480 },
            powerPreference: 'default'
        },
        high: {
            pixelRatio: 2.0,
            antialias: true,
            starfieldCount: 1600,
            previewResolution: { width: 480, height: 270 },
            activeResolution: { width: 1024, height: 576 },
            particleMultiplier: 1.0,
            mediapipeHands: 4,
            mediapipeResolution: { width: 640, height: 480 },
            powerPreference: 'high-performance'
        }
    };

    return settings[tier] || settings.medium;
}

/**
 * Apply pixel ratio cap to prevent excessive rendering on high-DPI displays
 * @param {number} devicePixelRatio - The device's pixel ratio
 * @param {number} maxRatio - Maximum allowed pixel ratio
 * @returns {number} Capped pixel ratio
 */
export function capPixelRatio(devicePixelRatio, maxRatio = 1.5) {
    return Math.min(devicePixelRatio, maxRatio);
}
