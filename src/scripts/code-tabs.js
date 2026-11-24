// Delegation also supports snippets inserted by page navigation.
function selectTab(tab, focus = false) {
  const group = tab.closest("[data-code-tabs]");
  for (const button of group.querySelectorAll("[data-code-tab]")) {
    const selected = button === tab;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  }
  for (const panel of group.querySelectorAll("[data-code-panel]"))
    panel.hidden = panel.id !== tab.getAttribute("aria-controls");
  if (focus) tab.focus();
}
document.addEventListener("click", (event) => {
  const tab =
    event.target instanceof Element && event.target.closest("[data-code-tab]");
  if (tab) selectTab(tab);
});
document.addEventListener("keydown", (event) => {
  const tab =
    event.target instanceof Element && event.target.closest("[data-code-tab]");
  if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
    return;
  const tabs = [
    ...tab.closest('[role="tablist"]').querySelectorAll("[data-code-tab]"),
  ];
  let index = tabs.indexOf(tab);
  if (event.key === "Home") index = 0;
  else if (event.key === "End") index = tabs.length - 1;
  else
    index =
      (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
      tabs.length;
  event.preventDefault();
  selectTab(tabs[index], true);
});
