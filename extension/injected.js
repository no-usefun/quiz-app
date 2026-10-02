// Injected script in webpage execution context
(function () {
  window.__DYNOQUIZZ_EXTENSION_ACTIVE__ = true;
  window.__DYNOQUIZZ_EXTENSION_VERSION__ = "1.0.0";

  // Dispatch custom event for immediate React Hook detection
  window.dispatchEvent(
    new CustomEvent("dynoquizz-extension-ready", {
      detail: {
        version: "1.0.0",
        active: true,
      },
    }),
  );

  console.log(
    "%c[DynoQuizz AI Proctor Shield]%c Extension injected & ready.",
    "background: #165dfb; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;",
    "color: #10b981; font-weight: bold;",
  );
})();
