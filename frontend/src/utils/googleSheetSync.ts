/**
 * Hỗ trợ đồng bộ dữ liệu đơn hàng quét được lên Google Sheets
 * Target Sheet: https://docs.google.com/spreadsheets/d/1oEZWAOdYu4x2s5sCJUlxIJrRu3femE9a2wsN0UcG3rQ/edit?gid=863388700
 */

export const APPS_SCRIPT_TEMPLATE = `function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Tìm tab có gid 863388700 hoặc tab hiện tại
    var sheets = ss.getSheets();
    var sheet = sheets.find(function(s) { return s.getSheetId() == 863388700; }) || ss.getActiveSheet();
    
    // Nếu trước đó có cột F "Tổng đơn trong ngày" hoặc lỗi #ERROR!, tự động xóa bỏ cột đó
    if (sheet.getLastColumn() >= 6) {
      var headerVal = sheet.getRange(1, 6).getValue();
      if (headerVal && (headerVal.toString().indexOf("Tổng đơn") !== -1 || headerVal.toString().indexOf("#ERROR") !== -1)) {
        sheet.deleteColumn(6);
      }
    }
    
    // Tạo dòng tiêu đề chuẩn 5 cột nếu trang tính còn trống
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["STT", "Mã vận đơn", "Mã đơn hàng", "Thời gian quét", "Ngày quét"]);
      sheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#e0e7ff").setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
    }
    
    var lastRow = sheet.getLastRow();
    
    // Lấy danh sách các mã đã có trên Sheet để LỌC TRÙNG TUYỆT ĐỐI
    var existingCodes = {};
    if (lastRow >= 2) {
      var existingData = sheet.getRange(2, 2, lastRow - 1, 2).getValues();
      for (var r = 0; r < existingData.length; r++) {
        var exTrack = existingData[r][0] ? existingData[r][0].toString().trim().toUpperCase().replace(/[\s-]/g, '') : '';
        var exOrder = existingData[r][1] ? existingData[r][1].toString().trim().toUpperCase().replace(/[\s-]/g, '') : '';
        if (exTrack) existingCodes[exTrack] = true;
        if (exOrder) existingCodes[exOrder] = true;
      }
    }
    
    var orders = data.orders || [];
    var rows = [];
    var currentStt = lastRow >= 2 ? lastRow - 1 : 0;
    var now = new Date();
    var defaultDate = Utilities.formatDate(now, "Asia/Ho_Chi_Minh", "dd/MM/yyyy");
    var defaultTime = Utilities.formatDate(now, "Asia/Ho_Chi_Minh", "HH:mm:ss");

    for (var i = 0; i < orders.length; i++) {
      var item = orders[i];
      var normTrack = item.trackingCode ? item.trackingCode.toString().trim().toUpperCase().replace(/[\s-]/g, '') : '';
      var normOrder = item.orderCode ? item.orderCode.toString().trim().toUpperCase().replace(/[\s-]/g, '') : '';

      // TỰ ĐỘNG BỎ QUA NẾU MÃ VẬN ĐƠN HOẶC MÃ ĐƠN HÀNG ĐÃ TỒN TẠI TRÊN SHEET
      if ((normTrack && existingCodes[normTrack]) || (normOrder && existingCodes[normOrder])) {
        continue;
      }

      currentStt++;
      if (normTrack) existingCodes[normTrack] = true;
      if (normOrder) existingCodes[normOrder] = true;

      var timeVal = item.scannedTime || defaultTime;
      var dateVal = item.scannedDate || defaultDate;

      rows.push([
        currentStt,
        item.trackingCode || '',
        item.orderCode || '',
        timeVal,
        dateVal
      ]);
    }

    if (rows.length > 0) {
      sheet.getRange(lastRow + 1, 1, rows.length, 5).setValues(rows);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      added: rows.length,
      skipped: orders.length - rows.length,
      total: currentStt
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}`;

export interface SyncOrderItem {
  trackingCode?: string;
  orderCode?: string;
  scannedAt?: string;
  scannedTime?: string;
  scannedDate?: string;
  [key: string]: any;
}

/**
 * Gửi danh sách đơn hàng lên Google Sheet qua Apps Script Web App
 */
export async function pushOrdersToGoogleSheet(
  orders: SyncOrderItem[],
  webhookUrl: string,
): Promise<{ success: boolean }> {
  if (!webhookUrl) {
    throw new Error('Chưa cấu hình Webhook URL của Google Sheet.');
  }

  const payload = {
    orders: orders.map((o) => ({
      trackingCode: o.trackingCode || '',
      orderCode: o.orderCode || '',
      scannedAt: o.scannedAt || new Date().toLocaleString('vi-VN'),
      scannedTime:
        o.scannedTime ||
        new Date().toLocaleTimeString('vi-VN', { hour12: false }),
      scannedDate: o.scannedDate || new Date().toLocaleDateString('vi-VN'),
    })),
  };

  await fetch(webhookUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  return { success: true };
}

/**
 * Sao chép danh sách đơn hàng sang định dạng bảng để dán trực tiếp vào Google Sheet
 */
export function copyOrdersToClipboard(orders: SyncOrderItem[]): boolean {
  if (!orders || orders.length === 0) return false;

  const now = new Date();
  const defaultDate = now.toLocaleDateString('vi-VN');
  const defaultTime = now.toLocaleTimeString('vi-VN', { hour12: false });

  // Tiêu đề bảng - Chỉ giữ 5 cột sạch đẹp theo yêu cầu
  const rows = [
    ['STT', 'Mã vận đơn', 'Mã đơn hàng', 'Thời gian quét', 'Ngày quét'].join('\t'),
  ];

  orders.forEach((o, index) => {
    let timeStr = o.scannedTime || defaultTime;
    let dateStr = o.scannedDate || defaultDate;

    if (!o.scannedTime && o.scannedAt) {
      const parts = o.scannedAt.replace(',', '').split(' ');
      if (parts.length >= 2) {
        timeStr = parts[0];
        dateStr = parts[1];
      }
    }

    rows.push(
      [
        index + 1,
        o.trackingCode || '',
        o.orderCode || '',
        timeStr,
        dateStr,
      ].join('\t'),
    );
  });

  const textToCopy = rows.join('\n');
  navigator.clipboard.writeText(textToCopy);
  return true;
}
