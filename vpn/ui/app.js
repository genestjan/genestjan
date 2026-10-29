// Monggols VPN screen, shared by the Windows app (inside WebView2) and the
// iPhone home-screen app. Each platform supplies a small "host" that does
// the real work; the screen only shows state and forwards taps.

(function () {
  "use strict";

  var SERVER = "https://vpn.genestjanramirez.com";
  var SERVER_IP = "145.241.229.12";

  var TEXT = {
    off: "DI PA KONEKTADO",
    on: "KONEKTADO NA",
    busy: "KADIYOT…",
    offBody: "Dili pa ka safe, Dong. Time na magpa-VPN!",
    onBody: "Safe na ka, Dong. Naa ka sa London karon.",
    connect: "KONEKTAHON",
    disconnect: "PUTLON",
    needSetup: "I-setup una kining device.",
    soon: "Moabot ra ni sunod. Karon, ang VPN na mismo ang nag-protect nimo.",
    resetConfirm: "Tangtangon ang setup? Kinahanglan nimo ug bag-ong invite link aron maka-connect pag-usab."
  };

  var $ = function (id) { return document.getElementById(id); };
  var state = { up: false, busy: false, hasSetup: false };

  // ---------- screen ----------

  function showPage(index) {
    var pages = ["pageHome", "pageServer", "pageProtect", "pageSettings"];
    pages.forEach(function (id, i) { $(id).hidden = i !== index; });
    document.querySelectorAll("nav button").forEach(function (b, i) {
      b.classList.toggle("active", i === index);
    });
    window.scrollTo(0, 0);
  }

  function render() {
    var color = state.up ? "var(--green)" : "var(--red)";
    $("powerRing").src = state.up ? "assets/power_green.png" : "assets/power_red.png";
    $("connectLabel").textContent = state.busy ? TEXT.busy : state.up ? TEXT.disconnect : TEXT.connect;
    $("statusTitle").textContent = state.busy ? TEXT.busy : state.up ? TEXT.on : TEXT.off;
    $("statusBody").textContent = state.up ? TEXT.onBody : TEXT.offBody;
    $("protectStatus").textContent = state.up ? TEXT.on : TEXT.off;
    [$("statusIcon"), $("statusTitle"), $("protectStatus")].forEach(function (el) { el.style.color = color; });
    $("connectButton").disabled = state.busy;
    $("setupPanel").hidden = state.hasSetup;
    $("readyPanel").hidden = !state.hasSetup;
  }

  var toastTimer;
  function toast(message) {
    var el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 3500);
  }

  function update(next) {
    Object.keys(next).forEach(function (k) { state[k] = next[k]; });
    render();
  }

  function toggle() {
    if (state.busy) return;
    if (!state.hasSetup) { toast(TEXT.needSetup); showPage(3); return; }
    host.setConnected(!state.up);
  }

  function inviteUrl(input) {
    var text = (input || "").trim();
    var m = text.match(/https?:\/\/\S+\/cnf\/[A-Za-z0-9_-]+/);
    if (m) return m[0];
    return text ? SERVER + "/cnf/" + text : "";
  }

  // ---------- Windows host (WebView2) ----------
  // The C# side answers with {type:"state", up, busy, hasSetup} and
  // {type:"toast", text}, and keeps sending state while things change.

  function windowsHost() {
    var view = window.chrome.webview;
    function send(msg) { view.postMessage(msg); }
    view.addEventListener("message", function (e) {
      var msg = e.data;
      if (msg.type === "state") {
        update({ up: msg.up, busy: msg.busy, hasSetup: msg.hasSetup });
        if (msg.goHome) showPage(0);
      } else if (msg.type === "toast") {
        toast(msg.text);
      }
    });
    return {
      start: function () { send({ type: "hello" }); },
      setConnected: function (on) { send({ type: on ? "connect" : "disconnect" }); },
      setUpFromLink: function (url) { send({ type: "setupLink", url: url }); },
      setUpFromFile: function () { send({ type: "setupFile" }); },
      reset: function () { send({ type: "reset" }); }
    };
  }

  // ---------- iPhone host (home-screen web app) ----------
  // iPhones only let App Store apps run a VPN, so the free WireGuard app does
  // the connecting. Two Shortcuts ("Monggols ON" / "Monggols OFF", each one
  // action: WireGuard > Set Tunnel Status) let the big button switch it.
  // Connected or not is read from the public IP: the server's IP means on.

  function iphoneHost() {
    var KEY = "monggols-ready";
    function ready() { try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; } }
    function setReady(on) { try { on ? localStorage.setItem(KEY, "1") : localStorage.removeItem(KEY); } catch (e) {} }

    function check() {
      return fetch("https://api.ipify.org?format=json", { cache: "no-store" })
        .then(function (r) { return r.json(); })
        .then(function (j) { update({ up: j.ip === SERVER_IP, busy: false, hasSetup: ready() }); })
        .catch(function () { update({ busy: false, hasSetup: ready() }); });
    }

    $("setupHelp").textContent = "1) I-install ang libre nga WireGuard app gikan sa App Store. 2) I-paste ang invite link ug pindota ang I-SETUP. 3) Sa file nga mo-gawas, pindota ang Share, dayon WireGuard.";
    $("readyBody").textContent = "Para sa usa ka pindot nga KONEKTAHON, buhata kini kausa sa Shortcuts app:";
    var steps = document.createElement("ol");
    steps.innerHTML =
      "<li>Ablihi ang <b>Shortcuts</b>, pindota ang <b>+</b>.</li>" +
      "<li>Add Action, pangitaa ang <b>WireGuard</b>, pili-a ang <b>Set Tunnel Status</b>.</li>" +
      "<li>Tunnel: imong Monggols tunnel. Status: <b>On</b>.</li>" +
      "<li>Nganli ug <b>Monggols ON</b> (eksakto).</li>" +
      "<li>Usba pag-usab: Status <b>Off</b>, nganli ug <b>Monggols OFF</b>.</li>";
    $("readyPanel").insertBefore(steps, $("resetLink"));

    $("fileLink").hidden = true;
    document.addEventListener("visibilitychange", function () { if (!document.hidden) check(); });
    setInterval(check, 15000);

    return {
      start: check,
      setConnected: function (on) {
        update({ busy: true });
        window.location.href = "shortcuts://run-shortcut?name=" + encodeURIComponent(on ? "Monggols ON" : "Monggols OFF");
        setTimeout(check, 4000);
      },
      setUpFromLink: function (url) {
        setReady(true);
        update({ hasSetup: true });
        window.location.href = url;   // Safari downloads the .conf; Share > WireGuard imports it
      },
      setUpFromFile: function () {},
      reset: function () { setReady(false); update({ hasSetup: false }); }
    };
  }

  // ---------- wiring ----------

  var host = window.chrome && window.chrome.webview ? windowsHost() : iphoneHost();

  document.querySelectorAll("nav button").forEach(function (b) {
    b.addEventListener("click", function () { showPage(Number(b.dataset.page)); });
  });
  $("menuButton").addEventListener("click", function () { showPage(3); });
  $("destinationCard").addEventListener("click", function () { showPage(1); });
  $("connectButton").addEventListener("click", toggle);
  $("bannerButton").addEventListener("click", function () { if (!state.up) toggle(); });
  $("manyakSwitch").addEventListener("change", function (e) { if (e.target.checked) toast(TEXT.soon); });
  $("setupButton").addEventListener("click", function () {
    var url = inviteUrl($("inviteField").value);
    if (url) host.setUpFromLink(url);
  });
  $("fileLink").addEventListener("click", function () { host.setUpFromFile(); });
  $("resetLink").addEventListener("click", function () { if (confirm(TEXT.resetConfirm)) host.reset(); });

  render();
  showPage(0);
  host.start();
})();
