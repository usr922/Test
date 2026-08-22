/**
 * 眼底读片实验 —— 结果收集端点
 *
 * 把这段代码整个粘进 Google Apps Script，部署成 Web App，
 * 再把拿到的网址填进 config.js 的 SUBMIT_URL。
 *
 * 数据会写进两张工作表：
 *   汇总  —— 每位医生每轮一行（用户名/姓名/单位/职称/正确率/用时/校验码）
 *   明细  —— 每题一行（选了什么/正确答案/对错/耗时/该题 AI Top-1、Top-5）
 *
 * 同一人同一轮重复提交（中途自动上传 + 最后提交）会覆盖旧行，不会堆重复。
 */

var SUMMARY = '汇总';
var DETAIL  = '明细';

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var key = (d.username || '').toLowerCase() + '|' + d.round;

    // ---------- 汇总 ----------
    var sh = sheet_(ss, SUMMARY, ['提交时间','用户名','姓名','单位','职称','轮次',
                                  '已答','总题数','正确','正确率','净用时(分)','校验码','状态','key']);
    var row = [new Date(), d.username, d.full_name, d.institution, d.title, d.round,
               d.n_answered, d.n_items, d.n_correct,
               d.accuracy, Math.round((d.total_ms || 0) / 60000 * 10) / 10,
               d.verify_code, d.partial ? '进行中' : '已完成', key];
    upsert_(sh, 14, key, row);          // 第 14 列是 key

    // ---------- 明细 ----------
    var dt = sheet_(ss, DETAIL, ['提交时间','用户名','单位','轮次','位置','题目uid',
                                 '医生选择','正确答案','对错','耗时(秒)',
                                 'AI_Top1','AI_Top5','key']);
    deleteByKey_(dt, 13, key);          // 先清掉这人这轮的旧明细
    var rows = (d.records || []).map(function (r) {
      return [new Date(), d.username, d.institution, d.round, r.position, r.uid,
              r.choice_name, r.truth_name, r.correct,
              Math.round((r.ms_spent || 0) / 100) / 10,
              r.ai_top1, (r.ai_top5 || []).join(' | '), key];
    });
    if (rows.length) dt.getRange(dt.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);

    return out_('OK ' + d.n_answered + '/' + d.n_items);
  } catch (err) {
    return out_('ERR ' + err);
  }
}

function doGet() { return out_('OK reader-study endpoint alive'); }

// ---------- 工具 ----------
function sheet_(ss, name, header) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(header);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, header.length).setFontWeight('bold');
  }
  return sh;
}

function upsert_(sh, keyCol, key, row) {
  var last = sh.getLastRow();
  if (last > 1) {
    var keys = sh.getRange(2, keyCol, last - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (keys[i][0] === key) {
        sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
        return;
      }
    }
  }
  sh.appendRow(row);
}

function deleteByKey_(sh, keyCol, key) {
  var last = sh.getLastRow();
  if (last < 2) return;
  var keys = sh.getRange(2, keyCol, last - 1, 1).getValues();
  for (var i = keys.length - 1; i >= 0; i--) {      // 倒着删，行号才不会错位
    if (keys[i][0] === key) sh.deleteRow(i + 2);
  }
}

function out_(msg) {
  return ContentService.createTextOutput(msg).setMimeType(ContentService.MimeType.TEXT);
}
