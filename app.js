/* 单轮读片实验（纯前端）。轮次由页面里的 window.QUIZ_ROUND 决定：
     1 = 无 AI 辅助，用 order1
     2 = 显示 RetiFlex Top-5，用 order2（与第一轮几乎完全错开）
   本文件是「经典脚本」而非 ES module —— file:// 下 module 会被 CORS 拦掉。 */
(function () {
"use strict";

var D = window.QUIZ_DATA, CLASSES = D.classes, ITEMS = D.items, N = ITEMS.length;
var ROUND = window.QUIZ_ROUND;
var ORDER = ROUND === 2 ? D.order2 : D.order1;
var $ = function (s) { return document.querySelector(s); };
var user = null, CUR = 0, tShown = 0, LANG = "zh";

/* ---------------- i18n ---------------- */
function T(k) { return (window.I18N[LANG] || {})[k] || k; }
var UNK_IDX = 103;                     // 0-102 是 103 个具体类别, 103 = Unknown
function clsName(i) { return i === UNK_IDX ? T("unknownDx") : CLASSES[i]; }

function applyLang() {
  document.documentElement.lang = LANG === "zh" ? "zh" : "en";
  var extra = { roundSub: ROUND === 2 ? T("r2Sub") : T("r1Sub") };
  var get = function (k) { return k in extra ? extra[k] : T(k); };

  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    el.textContent = get(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
    el.innerHTML = get(el.dataset.i18nHtml);
  });
  document.querySelectorAll("[data-ph]").forEach(function (el) {
    el.placeholder = T(el.dataset.ph);
  });
  $("#lang").textContent = T("langBtn");
  var ou = $("#opt-unk");                    // 选项已建出来的话, 切语言也要跟着变
  if (ou) ou.innerHTML = '<span class="oi">' + UNK_IDX + '.</span> ' + T("unknownDx");
  $("#rlabel").textContent = (LANG === "zh" ? "第 " + ROUND + " 轮" : "Round " + ROUND)
    + (ROUND === 2 ? (LANG === "zh" ? "（含 AI 参考）" : " (with AI)") : "");
  if (user) refreshDynamic();
}

function setLang(l) {
  LANG = l;
  try { localStorage.setItem("reader:lang", l); } catch (e) {}
  applyLang();
}
$("#lang").onclick = function () { setLang(LANG === "zh" ? "en" : "zh"); };
try { LANG = localStorage.getItem("reader:lang") || "zh"; } catch (e) {}

/* 切语言时把当前页上随数据变化的文字重刷一遍 */
function refreshDynamic() {
  $("#who").textContent = (user.full_name || user.username) + " · " + user.institution;
  var ansMap = loadState().answers || {};
  var n = Object.keys(ansMap).length;
  if (n === 0) $("#prog").textContent = T("notStarted");
  else if (n >= N) $("#prog").textContent = T("finished") + " " + n + "/" + N;
  else {
    var nextPos = ORDER.findIndex(function (i) { return ansMap[ITEMS[i].uid] === undefined; });
    $("#prog").textContent = T("inProgress") + " " + n + "/" + N +
      "　" + T("resumeAt").replace("%d", nextPos + 1);
  }
  $("#btn-start").textContent = n === 0 ? T("start") : T("resume");
  if (!storageOK) $("#prog").textContent = T("noStorage");
  if (!$("#page-quiz").classList.contains("hidden")) render();
  if (!$("#page-result").classList.contains("hidden")) showResult();
}

/* ---------------- 本机存储 ---------------- */
function keyOf() { return "reader:" + user.username.toLowerCase() + ":r" + ROUND; }
function loadState() {
  try { return JSON.parse(localStorage.getItem(keyOf()) || "{}"); } catch (e) { return {}; }
}
function saveState(o) {
  try { localStorage.setItem(keyOf(), JSON.stringify(o)); return true; } catch (e) { return false; }
}
var storageOK = (function () {
  try { localStorage.setItem("__t", "1"); localStorage.removeItem("__t"); return true; }
  catch (e) { return false; }
})();

function showPage(id) {
  ["login", "home", "quiz", "result"].forEach(function (p) {
    $("#page-" + p).classList.toggle("hidden", p !== id);
  });
}

/* ---------------- 登记 ---------------- */
$("#form-login").onsubmit = function (e) {
  e.preventDefault();
  var o = {}; new FormData(e.target).forEach(function (v, k) { o[k] = String(v).trim(); });
  o.username = o.username.replace(/\s+/g, "");   // 用户名去掉所有空格, 减少两轮对不上的概率
  if (!o.username || !o.full_name || !o.institution || !o.title || !o.years) {
    $("#login-msg").className = "msg err"; $("#login-msg").textContent = T("required"); return;
  }
  user = o;
  try { localStorage.setItem("reader:identity", JSON.stringify(o)); } catch (err) {}
  enterHome();
};

function enterHome() { refreshDynamic(); showPage("home"); }

$("#btn-start").onclick = function () {
  buildOptions();
  var ans = loadState().answers || {};
  var first = ORDER.findIndex(function (i) { return ans[ITEMS[i].uid] === undefined; });
  CUR = first < 0 ? 0 : first;
  $("#tot").textContent = N;
  showPage("quiz"); render();
};
$("#btn-back").onclick = enterHome;
$("#res-back").onclick = enterHome;
$("#btn-result").onclick = function () { showResult(); };
$("#res-export").onclick = function () { $("#btn-export").click(); };
$("#btn-switch").onclick = function () {
  user = null;
  try { localStorage.removeItem("reader:identity"); } catch (e) {}
  $("#form-login").reset(); $("#login-msg").textContent = ""; showPage("login");
};

/* ---------------- 选项 ---------------- */
var optsBuilt = false;
function buildOptions() {
  if (optsBuilt) return;
  var frag = document.createDocumentFragment();
  CLASSES.forEach(function (name, i) {
    var el = document.createElement("button");
    el.className = "opt"; el.dataset.idx = i;
    el.innerHTML = '<span class="oi">' + i + '.</span> ' + name;   // 病名保持英文原名
    el.onclick = function () { pick(i); };
    frag.appendChild(el);
  });
  // 最后追加第 104 个选项：103. Unknown。医生看不出就选它, 好过在 103 个里瞎猜 ——
  // 分析时能把"不确定"和"确信但答错"区分开。样式与其余选项一致。
  var unk = document.createElement("button");
  unk.className = "opt"; unk.dataset.idx = String(UNK_IDX); unk.id = "opt-unk";
  unk.innerHTML = '<span class="oi">' + UNK_IDX + '.</span> ' + T("unknownDx");
  unk.onclick = function () { pick(UNK_IDX); };
  frag.appendChild(unk);
  $("#opts").appendChild(frag); optsBuilt = true;
}

/* ---------------- 渲染 ---------------- */
function render() {
  var it = ITEMS[ORDER[CUR]], ans = (loadState().answers || {})[it.uid];
  $("#photo").src = "images/" + it.file;
  $("#photo").onclick = function () {
    $("#lbimg").src = "images/" + it.file; $("#lb").classList.remove("hidden");
  };
  $("#pos").textContent = CUR + 1;
  $("#barfill").style.width = ((CUR + 1) / N * 100) + "%";

  if (ROUND === 2) {
    $("#ai-list").innerHTML = it.top5.map(function (c, k) {
      return "<li>Top" + (k + 1) + ": " + CLASSES[c] + "</li>";
    }).join("");
    $("#ai").classList.remove("hidden");
  }

  document.querySelectorAll(".opt").forEach(function (o) {
    o.classList.toggle("sel", +o.dataset.idx === ans);
  });
  $("#picked").textContent = ans !== undefined
    ? T("picked") + "：" + clsName(ans) : T("notPicked");
  $("#prev").disabled = CUR === 0;
  $("#next").textContent = CUR === N - 1 ? T("finish") : T("next");
  tShown = Date.now();
  window.scrollTo({ top: 0 });
}

function pick(idx) {
  var it = ITEMS[ORDER[CUR]], st = loadState();
  st.answers = st.answers || {}; st.meta = st.meta || {};
  st.answers[it.uid] = idx;
  st.meta[it.uid] = { position: CUR, ms: Date.now() - tShown, at: new Date().toISOString() };
  if (!saveState(st)) alert(T("saveFail"));
  document.querySelectorAll(".opt").forEach(function (o) {
    o.classList.toggle("sel", +o.dataset.idx === idx);
  });
  $("#picked").textContent = T("picked") + "：" + clsName(idx);
  // 刻意不提示对错 —— 避免边做边获得反馈

  var n = Object.keys(st.answers).length;
  if (CFG.SUBMIT_URL && n % (CFG.AUTOSAVE_EVERY || 20) === 0 && n < N) {
    setSyncBadge("ing", T("syncing"));
    submit(true, function (ok) { setSyncBadge(ok ? "ok" : "err", T(ok ? "syncOk" : "syncErr")); });
  }
}

$("#prev").onclick = function () { if (CUR > 0) { CUR--; render(); } };
$("#next").onclick = function () {
  var it = ITEMS[ORDER[CUR]];
  if ((loadState().answers || {})[it.uid] === undefined) { alert(T("pickFirst")); return; }
  if (CUR < N - 1) { CUR++; render(); return; }
  var done = Object.keys(loadState().answers || {}).length;
  if (done < N) alert(T("leftUnanswered").replace("%d", N - done));
  else showResult();
};
$("#lb").onclick = function () { $("#lb").classList.add("hidden"); };

/* ---------------- 结果页 ----------------
   只给汇总、不给逐题对错：否则医生会记住答案，第二轮就失效了。 */
function fmtDur(ms) {
  var s = Math.round(ms / 1000);
  if (s < 60) return s + " " + T("sec");
  var m = Math.floor(s / 60);
  if (m < 60) return m + " " + T("min") + " " + (s % 60) + " " + T("sec");
  return Math.floor(m / 60) + " " + T("hour") + " " + (m % 60) + " " + T("min");
}

function showResult() {
  var st = loadState(), ans = st.answers || {}, meta = st.meta || {};
  var uids = Object.keys(ans);
  if (!uids.length) { alert(T("noRecord")); return; }
  var nc = 0, nu = 0, times = [];
  uids.forEach(function (u) {
    var it = ITEMS.filter(function (x) { return String(x.uid) === u; })[0];
    if (ans[u] === UNK_IDX) nu++;
    if (ans[u] === it.truth) nc++;
    var ms = (meta[u] || {}).ms;
    if (ms > 0 && ms < 30 * 60 * 1000) times.push(ms);      // 掐掉挂机的异常值
  });
  times.sort(function (a, b) { return a - b; });
  var sum = times.reduce(function (a, b) { return a + b; }, 0);
  var med = times.length ? times[Math.floor(times.length / 2)] : 0;

  var head = LANG === "zh" ? "第 " + ROUND + " 轮 · " : "Round " + ROUND + " · ";
  $("#res-title").textContent = head + (uids.length >= N ? T("resDone") : T("resDoing"));
  $("#res-user").textContent = user.username;
  $("#res-inst").textContent = user.institution;
  $("#res-name").textContent = user.full_name || "—";
  $("#res-title2").textContent = user.title || "—";
  $("#res-years").textContent = user.years ? user.years + (LANG === "zh" ? " 年" : " yr") : "—";
  $("#res-round").textContent = ROUND === 1
    ? (LANG === "zh" ? "第 1 轮（无 AI 辅助）" : "Round 1 (unaided)")
    : (LANG === "zh" ? "第 2 轮（含 AI 参考）" : "Round 2 (with AI)");
  $("#res-when").textContent = new Date().toLocaleString(LANG === "zh" ? "zh-CN" : "en-GB",
                                                         { hour12: false });
  $("#res-n").textContent = uids.length + " / " + N;
  $("#res-c").textContent = nc;
  $("#res-acc").textContent = (nc / uids.length * 100).toFixed(1) + "%";
  $("#res-unk").textContent = nu;
  $("#res-total").textContent = fmtDur(sum);
  $("#res-mean").textContent = times.length ? (sum / times.length / 1000).toFixed(1) + " " + T("sec") : "—";
  $("#res-med").textContent = times.length ? (med / 1000).toFixed(1) + " " + T("sec") : "—";

  // 校验码：由作答内容算出，用来核对截图与后补的 JSON 是不是同一份
  $("#res-code").textContent = verifyCode();
  showPage("result");

  if (CFG.SUBMIT_URL) {
    $("#res-sync").className = "ressync ing"; $("#res-sync").textContent = T("syncing");
    submit(uids.length < N, function (ok, m) {
      $("#res-sync").className = "ressync " + (ok ? "ok" : "err");
      $("#res-sync").textContent = ok ? T("syncOk") : T("syncErr") + " (" + m + ")";
    });
  } else {
    $("#res-sync").className = "ressync"; $("#res-sync").textContent = "";
  }
}

/* ---------------- 上传到收集端点 ----------------
   GitHub Pages 是纯静态的，记录靠外部端点（Google Apps Script）。
   用 text/plain 发 JSON —— 这样是「简单请求」，不触发 CORS 预检，
   Apps Script 的 Web App 才收得到。 */
function buildPayload(partial) {
  var st = loadState(), ans = st.answers || {}, meta = st.meta || {};
  var uids = Object.keys(ans);
  if (!uids.length) return null;
  var recs = uids.map(function (u) {
    var it = ITEMS.filter(function (x) { return String(x.uid) === u; })[0], m = meta[u] || {};
    return { uid: +u, position: m.position, ms_spent: m.ms, answered_at: m.at,
             choice_idx: ans[u], choice_name: clsName(ans[u]),
             truth_idx: it.truth, truth_name: CLASSES[it.truth],
             correct: ans[u] === it.truth ? 1 : 0,
             ai_top1: CLASSES[it.top5[0]],
             ai_top5: it.top5.map(function (c) { return CLASSES[c]; }) };
  }).sort(function (a, b) { return (a.position | 0) - (b.position | 0); });
  var nc = recs.filter(function (x) { return x.correct; }).length;
  var times = recs.map(function (r) { return r.ms_spent; })
                  .filter(function (m) { return m > 0 && m < 1800000; });
  return { username: user.username, full_name: user.full_name,
           institution: user.institution, title: user.title,
           years_in_practice: Number(user.years),
           round: ROUND, partial: !!partial,
           client_time: new Date().toISOString(),
           n_items: N, n_answered: recs.length, n_correct: nc,
           n_unknown: recs.filter(function (r) { return r.choice_idx === UNK_IDX; }).length,
           accuracy: +(nc / recs.length).toFixed(4),
           total_ms: times.reduce(function (a, b) { return a + b; }, 0),
           verify_code: verifyCode(), records: recs };
}

function verifyCode() {
  var ans = (loadState().answers || {});
  var seed = user.username.toLowerCase() + "|" + ROUND + "|" +
             Object.keys(ans).sort().map(function (u) { return u + ":" + ans[u]; }).join(",");
  var h = 2166136261;
  for (var i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  var hex = (h >>> 0).toString(16).toUpperCase();
  while (hex.length < 8) hex = "0" + hex;
  return hex.slice(0, 4) + "-" + hex.slice(4);
}

var CFG = window.QUIZ_CONFIG || {};
function submit(partial, cb) {
  var url = (CFG.SUBMIT_URL || "").trim();
  var body = buildPayload(partial);
  if (!url || !body) { if (cb) cb(false, "no-endpoint"); return; }
  fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
               body: JSON.stringify(body) })
    .then(function (r) { return r.text(); })
    .then(function (t) {
      var ok = t.indexOf("OK") >= 0;
      try { localStorage.setItem(keyOf() + ":sent", ok ? new Date().toISOString() : ""); } catch (e) {}
      if (cb) cb(ok, t);
    })
    .catch(function (e) { if (cb) cb(false, String(e)); });
}

function setSyncBadge(state, msg) {
  var el = $("#sync"); if (!el) return;
  el.className = "sync " + state;
  el.textContent = msg;
}

/* ---------------- 导出（备份用） ---------------- */
$("#btn-export").onclick = function () {
  var st = loadState(), ans = st.answers || {}, meta = st.meta || {};
  var uids = Object.keys(ans);
  if (!uids.length) { alert(T("noRecord")); return; }
  var recs = uids.map(function (u) {
    var it = ITEMS.filter(function (x) { return String(x.uid) === u; })[0], m = meta[u] || {};
    return { uid: +u, position: m.position, ms_spent: m.ms, answered_at: m.at,
             choice_idx: ans[u], choice_name: clsName(ans[u]),
             truth_idx: it.truth, truth_name: CLASSES[it.truth],
             correct: ans[u] === it.truth ? 1 : 0,
             ai_top1: CLASSES[it.top5[0]],
             ai_top5: it.top5.map(function (c) { return CLASSES[c]; }) };
  }).sort(function (a, b) { return (a.position | 0) - (b.position | 0); });
  var nc = recs.filter(function (x) { return x.correct; }).length;
  var out = { username: user.username, institution: user.institution,
              full_name: user.full_name || "", title: user.title || "",
              years_in_practice: Number(user.years) || null,
              round: ROUND, exported_at: new Date().toISOString(),
              n_items: N, n_answered: recs.length, n_correct: nc,
              accuracy: +(nc / recs.length).toFixed(4), records: recs };
  var a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }));
  a.download = "reader_r" + ROUND + "_" + user.username + "_" +
               new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
};

/* ---------------- 启动 ---------------- */
applyLang();
try {
  // 记住身份：医生隔天/换轮次回来直接进首页，不必重填 —— 也避免打错用户名导致进度对不上
  var saved = localStorage.getItem("reader:identity");
  if (saved) { user = JSON.parse(saved); enterHome(); }
  else showPage("login");
} catch (e) { showPage("login"); }

})();
