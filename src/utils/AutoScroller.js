/**
 * SmartAutoScroller - v4 (The "Zero-Tolerance" Edition)
 * A professional, layout-neutral autoscroll solution.
 */
export class SmartAutoScroller {
    constructor(container, options = {}) {
        if (!container) return;
        this.container = container;
        this.options = {
            pinStrategy: options.pinStrategy || 'top',
            topMargin: options.topMargin || 20,
            bottomMargin: options.bottomMargin || 80,
            smoothDuration: options.smoothDuration || 700,
            triggerCooldown: options.triggerCooldown || 2000,
            ...options
        };

        this.status = {
            isScrolling: false,
            lastTriggerTime: 0,
            rafId: null,
            targetY: -1
        };

        this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    /**
     * Stable measurement relative to container content
     */
    getOffsetTop(el) {
        if (!el || !this.container) return 0;
        let offset = 0;
        let curr = el;
        // Traverse up to the container, summing offsets
        while (curr && curr !== this.container) {
            offset += curr.offsetTop;
            curr = curr.offsetParent;
            // Safety break if we jump out of the container subtree
            if (!curr) break;
        }
        return offset;
    }

    scrollTo(targetY) {
        if (!this.container) return;

        targetY = Math.max(0, targetY);
        // Round to avoid subpixel flickering
        targetY = Math.round(targetY);

        // Don't scroll if we are already there
        if (Math.abs(this.container.scrollTop - targetY) < 5) return;

        if (this.prefersReducedMotion) {
            this.container.scrollTop = targetY;
            return;
        }

        const startY = this.container.scrollTop;
        const distance = targetY - startY;
        const startTime = performance.now();

        this.status.targetY = targetY;
        this.status.isScrolling = true;
        this.status.lastTriggerTime = performance.now(); // Reset cooldown after any movement

        const animate = (currentTime) => {
            if (!this.status.rafId) return;

            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / this.options.smoothDuration, 1);

            // Quintic easing for maximum smoothness
            const easeOutQuint = 1 - Math.pow(1 - progress, 5);

            this.container.scrollTop = startY + (distance * easeOutQuint);

            if (progress < 1) {
                this.status.rafId = requestAnimationFrame(animate);
            } else {
                this.status.isScrolling = false;
                this.status.rafId = null;
                this.status.targetY = -1;
            }
        };

        if (this.status.rafId) cancelAnimationFrame(this.status.rafId);
        this.status.rafId = requestAnimationFrame(animate);
    }

    /**
     * Explicitly jump to/focus an element (e.g. when clicking on map)
     */
    focusElement(el, immediate = false) {
        if (!el) return;
        const target = this.getOffsetTop(el) - this.options.topMargin;
        if (immediate) {
            this.container.scrollTop = target;
        } else {
            this.scrollTo(target);
        }
    }

    syncHighlight(wordEl) {
        if (!wordEl || !this.container || this.status.isScrolling) return;

        const now = performance.now();
        if (now - this.status.lastTriggerTime < this.options.triggerCooldown) return;

        // Use requestAnimationFrame for the measurement to ensure layout is ready
        requestAnimationFrame(() => {
            if (!wordEl.isConnected || this.status.isScrolling) return;

            const containerH = this.container.clientHeight;
            const scrollTop = this.container.scrollTop;

            const wordTop = this.getOffsetTop(wordEl);
            const wordBottom = wordTop + wordEl.offsetHeight;

            // Page Flip Trigger: Word nears bottom edge
            const triggerZone = scrollTop + containerH - this.options.bottomMargin;

            // ONLY scroll if the word is actually pushing past the bottom margin
            if (wordBottom > triggerZone) {
                // Calculation: Move word to the top
                const target = wordTop - this.options.topMargin;

                // Threshold: If the jump is too small (< 2 lines approx), wait.
                // This prevents nervous micro-jumps.
                if (target - scrollTop > 40) {
                    this.status.lastTriggerTime = performance.now();
                    this.scrollTo(target);
                }
            }
        });
    }

    destroy() {
        if (this.status.rafId) cancelAnimationFrame(this.status.rafId);
        this.status.rafId = null;
        this.container = null;
    }
}
