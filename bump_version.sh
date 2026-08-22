#!/bin/bash
# 给 js/css 加内容哈希版本号，改动后医生浏览器自动拿最新的，不用手动强刷。
# 每次改完前端代码跑一次：  ./bump_version.sh
cd "$(dirname "$0")"
python3 - <<'PY'
import hashlib, re, glob
from pathlib import Path
assets = ["app.js", "app.css", "i18n.js", "data.js", "config.js"]
vers = {a: hashlib.md5(Path(a).read_bytes()).hexdigest()[:8] for a in assets}
for html in glob.glob("index.html") + glob.glob("round2-*.html"):
    s = Path(html).read_text(encoding="utf-8")
    for a, v in vers.items():
        # 匹配 "app.js" 或 "app.js?v=abc123"，统一换成带新哈希的
        s = re.sub(r'(["\'])' + re.escape(a) + r'(?:\?v=[0-9a-f]+)?(["\'])',
                   r'\g<1>' + a + '?v=' + v + r'\g<2>', s)
    Path(html).write_text(s, encoding="utf-8")
for a, v in vers.items():
    print(f"  {a:<12} v={v}")
print("版本号已更新")
PY
