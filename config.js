/* ============================================================
   配置文件 —— 部署前只需要改这一处
   ============================================================

   SUBMIT_URL: Google Apps Script 部署后拿到的 Web App 网址
               （形如 https://script.google.com/macros/s/AKfyc.../exec）
               留空则不上传，医生只能靠截图 / 导出 JSON 交回。

   照 部署说明.md 第 2 节做一遍，把网址粘到下面引号里即可。
   ============================================================ */
window.QUIZ_CONFIG = {
  SUBMIT_URL: "https://script.google.com/macros/s/AKfycbzLLVfukgfmOYSgeCe6bl5HpR6aplKT3LwEyeW8jQfAWYWt9ZUE0zd990-Y7zPQhdkl/exec",

  // 每答多少题自动上传一次快照（防止医生中途关掉页面丢数据）
  AUTOSAVE_EVERY: 20
};
