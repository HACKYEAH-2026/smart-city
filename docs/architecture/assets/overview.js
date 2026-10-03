/*
 * Overview page (docs/architecture/index.html): how the selected workspace package relates to the others, and the
 * filter of the single-source-of-truth table. Runs after docs.js (both deferred), so `window.Docs` is ready.
 */
(() => {
  /** Who imports whom (package.json dependencies and the imports in the code at the documented commit). */
  const DEPS = {
    app: ["shared", "sdk", "api"],
    api: ["shared", "sdk", "plugins"],
    shared: ["sdk"],
    sdk: [],
    plugins: ["sdk"],
    scripts: ["api"],
    video: ["app", "sdk"],
  };
  const LABELS = { imports: "imported", "imported-by": "imports it", both: "both ways" };

  const relation = (selected, id) => {
    if (id === selected) return "self";
    const imports = DEPS[selected]?.includes(id) ?? false;
    const importedBy = DEPS[id]?.includes(selected) ?? false;
    if (imports && importedBy) return "both";
    if (imports) return "imports";
    if (importedBy) return "imported-by";
    return "none";
  };

  const initRepoMap = () => {
    const group = document.querySelector("[data-repo]");
    if (!group) return;
    const diagram = group.querySelector(".diagram");
    const boxes = [...group.querySelectorAll(".repo-box")];
    window.Docs.on(group, (selected) => {
      diagram.classList.add("has-selection");
      for (const box of boxes) {
        const rel = relation(selected, box.dataset.show);
        box.dataset.rel = rel;
        box.querySelector(".rel").textContent = LABELS[rel] ?? "";
      }
    });
  };

  const initRulesFilter = () => {
    const input = document.getElementById("rules-filter");
    const rows = [...document.querySelectorAll(".rules tbody tr")];
    const count = document.querySelector("[data-rules-count]");
    if (!input || !rows.length) return;
    const apply = () => {
      const words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
      const matching = rows.filter((row) => words.every((word) => row.textContent.toLowerCase().includes(word)));
      for (const row of rows) row.hidden = !matching.includes(row);
      count.textContent = words.length ? `${matching.length} of ${rows.length}` : "";
    };
    input.addEventListener("input", apply);
    apply();
  };

  initRepoMap();
  initRulesFilter();
})();
