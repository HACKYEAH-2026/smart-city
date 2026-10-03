/*
 * Shared behaviour of the architecture docs (docs/architecture/*.html): theme toggle, table of contents, groups
 * (tabs and explorers), steppers, annotated code and a small syntax highlighter. No dependencies. Without
 * JavaScript every step, note and pane is simply shown expanded.
 *
 * Page scripts use `window.Docs`: `Docs.initStepper(el)` after (re)building a stepper, `Docs.highlight(el)` after
 * inserting code, `Docs.on(group, fn)` to react to a selection in a `data-group`.
 */
(() => {
  const root = document.documentElement;
  root.classList.add("js");

  // ───────────────────────────── theme ─────────────────────────────

  const THEME_KEY = "twoje-miejsce-docs-theme";

  const readTheme = () => {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch {
      return null;
    }
  };

  const saveTheme = (theme) => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Storage may be blocked (private window, file:// policies): the toggle still works for this page view.
    }
  };

  const storedTheme = readTheme();
  if (storedTheme === "dark" || storedTheme === "light") root.dataset.theme = storedTheme;

  const effectiveTheme = () =>
    root.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

  const initThemeToggle = () => {
    for (const button of document.querySelectorAll("[data-theme-toggle]")) {
      button.addEventListener("click", () => {
        const next = effectiveTheme() === "dark" ? "light" : "dark";
        root.dataset.theme = next;
        saveTheme(next);
      });
    }
  };

  // ───────────────────────────── syntax highlighting ─────────────────────────────

  const STRING = String.raw`"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'`;
  const LANGS = {
    ts: [
      ["comment", String.raw`\/\/[^\n]*|\/\*[\s\S]*?\*\/`],
      ["string", `${STRING}|\`(?:[^\`\\\\]|\\\\.)*\``],
      [
        "keyword",
        String.raw`\b(?:const|let|function|return|async|await|yield|if|else|for|of|in|new|throw|try|catch|finally|import|export|default|from|type|interface|extends|class|private|readonly|typeof|keyof|as|null|undefined|true|false|this|void|while|break|continue)\b`,
      ],
      ["number", String.raw`\b\d[\d_]*(?:\.\d+)?\b`],
      ["type", String.raw`\b[A-Z][A-Za-z0-9]*\b`],
      ["prop", String.raw`(?<=\.)[a-zA-Z_$][\w$]*(?=\()`],
    ],
    sql: [
      ["comment", String.raw`--[^\n]*`],
      ["string", STRING],
      ["prop", String.raw`\$[a-zA-Z_][\w]*`],
      [
        "keyword",
        String.raw`\b(?:SELECT|FROM|WHERE|AND|OR|IN|ORDER|BY|ASC|DESC|LIMIT|START|DEFINE|TABLE|FIELD|INDEX|IF|NOT|EXISTS|ON|TYPE|SCHEMAFULL|SCHEMALESS|REFERENCE|DELETE|CASCADE|UNSET|REJECT|FIELDS|UNIQUE|UPSERT|SET|CREATE|CONTENT|RETURN|AFTER|BEFORE|UPDATE|BEGIN|COMMIT|TRANSACTION|LET|INSERT|INTO|IGNORE|GROUP|ALL|NONE|FETCH|VALUE|REMOVE|OVERWRITE|ELSE|DEFAULT|FLEXIBLE|LIVE|KILL|MERGE|AS|IS)\b`,
      ],
      ["type", String.raw`\b(?:string|int|float|bool|datetime|record|option|any|object|array|geometry|point)\b`],
      ["number", String.raw`\b\d+(?:\.\d+)?\b`],
    ],
    json: [
      ["prop", String.raw`"(?:[^"\\\n]|\\.)*"(?=\s*:)`],
      ["string", STRING],
      ["keyword", String.raw`\b(?:true|false|null)\b`],
      ["number", String.raw`-?\b\d+(?:\.\d+)?\b`],
    ],
    http: [
      ["keyword", String.raw`\b(?:GET|POST|PUT|PATCH|DELETE)\b`],
      ["number", String.raw`\b[1-5]\d\d\b`],
      ["string", STRING],
      ["comment", String.raw`#[^\n]*|\/\/[^\n]*`],
    ],
    sh: [
      ["comment", String.raw`#[^\n]*`],
      ["string", STRING],
      ["keyword", String.raw`\b(?:bun|bunx|just|cd|nix|git)\b`],
    ],
  };

  const compiled = Object.fromEntries(
    Object.entries(LANGS).map(([lang, rules]) => [
      lang,
      new RegExp(rules.map(([name, source]) => `(?<${name}>${source})`).join("|"), "g"),
    ]),
  );

  /** Tokens of one text node as a fragment, or null when nothing in it is highlighted. */
  const tokenize = (text, pattern) => {
    const matches = [...text.matchAll(pattern)].filter((m) => m[0].length > 0);
    if (!matches.length) return null;
    const fragment = document.createDocumentFragment();
    const end = matches.reduce((at, match) => {
      if (match.index > at) fragment.append(text.slice(at, match.index));
      const kind = Object.entries(match.groups).find(([, value]) => value !== undefined)?.[0];
      const span = document.createElement("span");
      span.className = `tok-${kind}`;
      span.textContent = match[0];
      fragment.append(span);
      return match.index + match[0].length;
    }, 0);
    if (end < text.length) fragment.append(text.slice(end));
    return fragment;
  };

  const textNodes = (el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  };

  /** Highlights every `code[data-lang]` inside `scope` (once per element). */
  const highlight = (scope = document) => {
    for (const code of scope.querySelectorAll("code[data-lang]:not([data-highlighted])")) {
      const pattern = compiled[code.dataset.lang];
      code.dataset.highlighted = "";
      if (!pattern) continue;
      for (const node of textNodes(code)) {
        if (node.parentElement?.className.startsWith("tok-")) continue;
        const fragment = tokenize(node.data, pattern);
        if (fragment) node.replaceWith(fragment);
      }
    }
  };

  // ───────────────────────────── table of contents ─────────────────────────────

  const initToc = () => {
    const toc = document.querySelector("[data-toc]");
    const sections = [...document.querySelectorAll("main > section[id]")];
    if (!toc || !sections.length) return;
    const heading = document.createElement("p");
    heading.textContent = "On this page";
    const list = document.createElement("ol");
    const links = sections.map((section) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = `#${section.id}`;
      link.textContent = section.dataset.toc ?? section.querySelector("h2")?.textContent ?? section.id;
      item.append(link);
      list.append(item);
      return link;
    });
    toc.append(heading, list);

    const visible = new Set();
    const mark = () => {
      const current = sections.find((s) => visible.has(s)) ?? null;
      links.forEach((link, i) => {
        link.classList.toggle("is-current", sections[i] === current);
      });
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        mark();
      },
      { rootMargin: "-80px 0px -55% 0px" },
    );
    for (const section of sections) observer.observe(section);
  };

  // ───────────────────────────── groups (tabs, explorers) ─────────────────────────────

  const listeners = new WeakMap();
  const own = (group, selector) =>
    [...group.querySelectorAll(selector)].filter((el) => el.closest("[data-group]") === group);

  const select = (group, id) => {
    for (const trigger of own(group, "[data-show]")) {
      const on = trigger.dataset.show === id;
      if (trigger.getAttribute("role") === "tab") {
        trigger.setAttribute("aria-selected", String(on));
        trigger.tabIndex = on ? 0 : -1;
      } else trigger.setAttribute("aria-pressed", String(on));
    }
    for (const pane of own(group, "[data-pane]")) pane.hidden = pane.dataset.pane !== id;
    for (const fn of listeners.get(group) ?? []) fn(id);
  };

  const initGroup = (group) => {
    const triggers = own(group, "[data-show]");
    if (!triggers.length) return;
    const initial =
      triggers.find((t) => t.getAttribute("aria-selected") === "true" || t.getAttribute("aria-pressed") === "true") ??
      triggers[0];
    for (const trigger of triggers) {
      trigger.addEventListener("click", () => select(group, trigger.dataset.show));
      if (trigger.getAttribute("role") !== "tab") continue;
      trigger.addEventListener("keydown", (event) => {
        const tabs = triggers.filter((t) => t.getAttribute("role") === "tab");
        const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
        if (!step) return;
        const next = tabs[(tabs.indexOf(trigger) + step + tabs.length) % tabs.length];
        next.focus();
        select(group, next.dataset.show);
      });
    }
    select(group, initial.dataset.show);
  };

  /** Calls `fn(id)` whenever the selection in `group` changes (and once now, with the current selection). */
  const on = (group, fn) => {
    listeners.set(group, [...(listeners.get(group) ?? []), fn]);
    const current = own(group, "[data-show]").find(
      (t) => t.getAttribute("aria-selected") === "true" || t.getAttribute("aria-pressed") === "true",
    );
    if (current) fn(current.dataset.show);
  };

  // ───────────────────────────── steppers ─────────────────────────────

  const steppers = new WeakMap();

  const controls = (el) => {
    const existing = el.querySelector(".stepper-controls");
    if (existing) return existing;
    const box = document.createElement("div");
    box.className = "stepper-controls";
    box.innerHTML = `<button class="btn" type="button" data-prev aria-label="Previous step">← Back</button>
      <span class="stepper-count" aria-live="polite"></span>
      <button class="btn primary" type="button" data-next aria-label="Next step">Next →</button>`;
    const head = el.querySelector(".stepper-head");
    if (head) head.append(box);
    else el.prepend(box);
    return box;
  };

  /** (Re)initialises a stepper: one current step, its `data-hl` nodes lit, the others dimmed. */
  const initStepper = (el) => {
    const steps = [...el.querySelectorAll(".stepper-steps > li")];
    const box = controls(el);
    const count = box.querySelector(".stepper-count");
    const prev = box.querySelector("[data-prev]");
    const next = box.querySelector("[data-next]");
    const nodes = [...el.querySelectorAll("[data-node]")];

    const go = (index) => {
      const at = Math.max(0, Math.min(steps.length - 1, index));
      steps.forEach((step, i) => {
        step.classList.toggle("is-current", i === at);
        step.classList.toggle("is-past", i < at);
        step.querySelector(".step-title")?.setAttribute("aria-expanded", String(i === at));
      });
      const lit = new Set((steps[at]?.dataset.hl ?? "").split(/\s+/).filter(Boolean));
      for (const node of nodes) node.classList.toggle("is-lit", lit.has(node.dataset.node));
      el.classList.toggle("has-highlight", lit.size > 0);
      count.textContent = steps.length ? `${at + 1} / ${steps.length}` : "";
      prev.disabled = at === 0;
      next.disabled = at === steps.length - 1;
      steppers.get(el).index = at;
      el.dispatchEvent(new CustomEvent("docs:step", { detail: { index: at, step: steps[at] } }));
    };

    const known = steppers.get(el);
    steppers.set(el, { index: 0, go });
    steps.forEach((step, i) => {
      step.querySelector(".step-title")?.addEventListener("click", () => go(i));
    });
    if (!known) {
      prev.addEventListener("click", () => steppers.get(el).go(steppers.get(el).index - 1));
      next.addEventListener("click", () => steppers.get(el).go(steppers.get(el).index + 1));
      el.addEventListener("keydown", (event) => {
        if (event.target.closest("input, select, textarea")) return;
        const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        steppers.get(el).go(steppers.get(el).index + step);
      });
    }
    go(0);
    return steppers.get(el);
  };

  // ───────────────────────────── annotated code ─────────────────────────────

  const initAnnotated = (el) => {
    const marks = [...el.querySelectorAll(".ann[data-note]")];
    const order = [...new Set(marks.map((m) => m.dataset.note))];
    const bodies = new Map([...el.querySelectorAll("[data-note-body]")].map((b) => [b.dataset.noteBody, b]));
    const notes = el.querySelector(".notes");

    for (const mark of marks) {
      mark.dataset.n = String(order.indexOf(mark.dataset.note) + 1);
      mark.tabIndex = 0;
      mark.setAttribute("role", "button");
      mark.setAttribute("aria-label", `Note ${mark.dataset.n}`);
    }
    for (const [id, body] of bodies) {
      const title = body.querySelector("h4");
      const n = document.createElement("span");
      n.className = "note-n";
      n.textContent = String(order.indexOf(id) + 1);
      title?.prepend(n);
    }

    const nav = document.createElement("div");
    nav.className = "note-nav";
    nav.innerHTML = `<button class="btn" type="button" data-prev>← Previous</button>
      <span class="kbd-hint">Click a number in the code</span>
      <button class="btn" type="button" data-next>Next →</button>`;
    notes?.append(nav);

    const state = { index: 0 };
    const show = (index) => {
      state.index = (index + order.length) % order.length;
      const id = order[state.index];
      for (const mark of marks) mark.classList.toggle("is-current", mark.dataset.note === id);
      for (const [key, body] of bodies) body.classList.toggle("is-current", key === id);
    };
    for (const mark of marks) {
      const pick = () => show(order.indexOf(mark.dataset.note));
      mark.addEventListener("click", pick);
      mark.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          pick();
        }
      });
    }
    nav.querySelector("[data-prev]").addEventListener("click", () => show(state.index - 1));
    nav.querySelector("[data-next]").addEventListener("click", () => show(state.index + 1));
    show(0);
  };

  // ───────────────────────────── start ─────────────────────────────

  window.Docs = { highlight, initStepper, on, select };

  const start = () => {
    initThemeToggle();
    initToc();
    for (const el of document.querySelectorAll("[data-annotated]")) initAnnotated(el);
    highlight();
    for (const group of document.querySelectorAll("[data-group]")) initGroup(group);
    for (const el of document.querySelectorAll("[data-stepper]")) initStepper(el);
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
