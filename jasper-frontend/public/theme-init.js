// Runs before React loads to set the dark/light theme class on <html>
// so there's no flash of the wrong theme on page load.
try {
  var t = localStorage.getItem("jasper-theme");
  if (t ? t === "dark" : true) {
    document.documentElement.classList.add("dark");
  }
} catch (e) {}
