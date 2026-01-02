function getParam(name) {
  const params = new URLSearchParams(location.search);
  return params.get(name) || "";
}

document.addEventListener("DOMContentLoaded", () => {
  const reason = getParam("reason") || "content";
  const keyword = getParam("keyword") || "";
  const url = getParam("url") || "";

  const reasonEl = document.getElementById("reason");
  const keywordEl = document.getElementById("keyword");
  const urlEl = document.getElementById("url");
  const backBtn = document.getElementById("backBtn");

  if (reasonEl) reasonEl.textContent = reason;
  if (keywordEl) keywordEl.textContent = keyword || "-";

  if (urlEl) {
    urlEl.textContent = url || "-";
    if (url) urlEl.href = url;
  }

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      history.back();
    });
  }
});
