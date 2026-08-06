// Register a Trusted Types policy at the very beginning of page load to satisfy the strict "require-trusted-types-for 'script'" CSP directive.
if (typeof window !== 'undefined' && 'trustedTypes' in window && window.trustedTypes.createPolicy) {
  try {
    if (!window.trustedTypes.defaultPolicy) {
      window.trustedTypes.createPolicy('default', {
        createHTML: function(string) {
          return string;
        },
        createScript: function(string) {
          return string;
        },
        createScriptURL: function(string) {
          return string;
        }
      });
    }
  } catch (err) {
    console.warn('Early Trusted Types default policy failed:', err);
  }
}
