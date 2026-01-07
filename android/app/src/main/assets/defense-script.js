(function() {
  var adJails = [];
  
  function isAllowedUrl(u) {
    if (!u) return false;
    var url = u.toLowerCase();
    // Allow embed providers
    if (url.includes('vidsrc')) return true;
    if (url.includes('vidlink')) return true;
    if (url.includes('2embed')) return true;
    if (url.includes('autoembed')) return true;
    if (url.includes('vidcloud')) return true;
    if (url.includes('vidplay')) return true;
    if (url.includes('filemoon')) return true;
    if (url.includes('streamwish')) return true;
    if (url.includes('doodstream')) return true;
    if (url.includes('upstream')) return true;
    if (url.includes('mixdrop')) return true;
    if (url.includes('mp4upload')) return true;
    if (url.includes('streamsb')) return true;
    if (url.includes('streamtape')) return true;
    if (url.includes('fembed')) return true;
    if (url.includes('evoload')) return true;
    if (url.includes('godrive')) return true;
    if (url.includes('mostream')) return true;
    // Allow anchors
    if (url.includes('#')) return true;
    return false;
  }
  
  function jailAd(u) {
    var c = document.createElement('div');
    c.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;visibility:hidden;pointer-events:none;z-index:-9999;';
    var i = document.createElement('iframe');
    i.style.cssText = 'width:1px;height:1px;border:none;';
    i.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    i.src = u;
    c.appendChild(i);
    document.body.appendChild(c);
    setTimeout(function() { if (c.parentNode) c.parentNode.removeChild(c); }, 600);
  }
  
  function neutralizeOverlays() {
    var os = document.querySelectorAll('div');
    os.forEach(function(el) {
      var s = window.getComputedStyle(el);
      var f = s.position === 'fixed' || s.position === 'absolute';
      var l = el.offsetWidth >= window.innerWidth * 0.7 && el.offsetHeight >= window.innerHeight * 0.7;
      var t = s.backgroundColor === 'transparent' || s.backgroundColor === 'rgba(0, 0, 0, 0)' || s.opacity < 0.1;
      var z = parseInt(s.zIndex) > 100;
      if (f && (l || z) && t) { el.style.display = 'none'; el.style.pointerEvents = 'none'; }
    });
  }
  
  // CRITICAL: Block navigation attempts to escape iframe
  window.open = function(u) { if (!isAllowedUrl(u)) { jailAd(u); return null; } };
  window.location.assign = function(u) { if (!isAllowedUrl(u)) { jailAd(u); } };
  window.location.replace = function(u) { if (!isAllowedUrl(u)) { jailAd(u); } };
  
  // CRITICAL: Block parent window navigation
  // Ads try to break out of iframe by using window.parent.location
  try {
    if (window.parent && window.parent !== window) {
      // We're in an iframe - protect parent from being navigated
      var originalParent = window.parent;
      Object.defineProperty(window, 'parent', {
        get: function() {
          // Return self instead of actual parent
          // This prevents ads from escaping to parent window
          return window;
        },
        set: function() {
          // Silently ignore attempts to set parent
        },
        configurable: false
      });
      console.log('[DEFENSE] ? Parent window navigation blocked');
    }
  } catch (e) {
    console.warn('[DEFENSE] Could not block parent access:', e);
  }
  
  // Block top window access (another escape vector)
  try {
    if (window.top && window.top !== window) {
      var originalTop = window.top;
      Object.defineProperty(window, 'top', {
        get: function() {
          return window;
        },
        set: function() {},
        configurable: false
      });
      console.log('[DEFENSE] ? Top window navigation blocked');
    }
  } catch (e) {
    console.warn('[DEFENSE] Could not block top access:', e);
  }
  
  // Intercept link clicks
  document.addEventListener('click', function(e) {
    var l = e.target.closest('a');
    if (l && l.href && !isAllowedUrl(l.href)) {
      jailAd(l.href); e.preventDefault(); e.stopPropagation();
    }
  }, true);
  
  neutralizeOverlays();
  setInterval(neutralizeOverlays, 1000);
  var obs = new MutationObserver(function() { setTimeout(neutralizeOverlays, 100); });
  obs.observe(document.body, { childList: true, subtree: true });
})();
