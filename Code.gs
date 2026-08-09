// ═══════════════════════════════════════════════════════════════════════════════
//  Almacén Mozzafiato — Google Apps Script Backend v2.2
//  Handles all write operations from the React frontend.
//
//  New in v2.1:
//   - Catálogo col J = codigoBarras, col K = precioRef
//   - Movimientos col K = precioUnit (optional price per unit)
//   - When an Entrada has precioUnit, updates precioRef in Catálogo
//   - New sheet '💰 Gastos' for expense records
//
//  CORS note: Apps Script Web Apps only support GET and POST.
//  The React app reads via Sheets API v4 (fast, no CORS issues) and
//  writes exclusively through these POST endpoints.
// ═══════════════════════════════════════════════════════════════════════════════

var SHEET = {
  catalogo:    '📦 Catálogo',
  movimientos: '📥 Movimientos',
  mermas:      '⚠️ Mermas',
  usuarios:    '👤 Usuarios',
  bitacora:    '📜 Bitácora',
  gastos:      '💰 Gastos',
  proveedores: '🏪 Proveedores',
  pedidos:     '🛒 Pedidos',
};

// ─── Health check ─────────────────────────────────────────────────────────────

function doGet(e) {
  return respond(true, null, { status: 'ok', message: 'Almacén API v2.3 OK' });
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

function doPost(e) {
  try {
    var data   = JSON.parse(e.postData.contents);
    var action = data.action || '';
    var ss     = SpreadsheetApp.getActiveSpreadsheet();

    switch (action) {
      case 'append':     return handleAppend(ss, data);
      case 'delete':     return handleDelete(ss, data);
      case 'update':     return handleUpdate(ss, data);
      case 'reconcile':  return handleReconcile(ss);
      case 'sendReport': return handleSendReport(ss, data);
      default:           return respond(false, 'Acción no reconocida: ' + action);
    }
  } catch (err) {
    return respond(false, err.toString());
  }
}

// ─── Append ───────────────────────────────────────────────────────────────────

function handleAppend(ss, data) {
  var sheet = ss.getSheetByName(data.sheet);
  if (!sheet) return respond(false, 'Pestaña no encontrada: ' + data.sheet);

  sheet.appendRow(data.values);

  // Side effect: update stock for movimientos
  if (data.sheet === SHEET.movimientos) {
    var tipo       = data.values[3];
    var producto   = data.values[5];
    var cantidad   = Number(data.values[6]) || 0;
    var precioUnit = data.values.length > 10 ? Number(data.values[10]) : 0;

    actualizarStock(ss, producto, tipo === 'Entrada' ? cantidad : -cantidad);

    // If this is an Entrada with a price, update precioRef in Catálogo (col K = index 10)
    if (tipo === 'Entrada' && precioUnit > 0) {
      actualizarPrecioRef(ss, producto, precioUnit);
    }
    // areaDestino is already stored in col L (index 11) via appendRow — no extra action needed
  }

  // Side effect: update stock for mermas
  if (data.sheet === SHEET.mermas) {
    var productoM = data.values[4];
    var cantidadM = Number(data.values[5]) || 0;
    actualizarStock(ss, productoM, -cantidadM);
  }

  return respond(true);
}

// ─── Delete ───────────────────────────────────────────────────────────────────

function handleDelete(ss, data) {
  var sheet = ss.getSheetByName(data.sheet);
  if (!sheet) return respond(false, 'Pestaña no encontrada: ' + data.sheet);
  if (!data.row || data.row < 2) return respond(false, 'Row inválido: ' + data.row);
  sheet.deleteRow(data.row);
  return respond(true);
}

// ─── Update (in-place range write) ───────────────────────────────────────────

function handleUpdate(ss, data) {
  var sheet = ss.getSheetByName(data.sheet);
  if (!sheet) return respond(false, 'Pestaña no encontrada: ' + data.sheet);
  if (!data.row || data.row < 2) return respond(false, 'Row inválido: ' + data.row);
  if (!data.values || !data.values.length) return respond(false, 'Sin valores');

  var numCols = data.values.length;
  sheet.getRange(data.row, 1, 1, numCols).setValues([data.values]);
  return respond(true);
}

// ─── Reconcile stock ──────────────────────────────────────────────────────────
// Recalculates stock for every product from scratch using all movements + mermas.
// Run when stock gets out of sync.

function handleReconcile(ss) {
  var catalogo   = ss.getSheetByName(SHEET.catalogo);
  var movSheet   = ss.getSheetByName(SHEET.movimientos);
  var mermaSheet = ss.getSheetByName(SHEET.mermas);

  if (!catalogo) return respond(false, 'No se encontró Catálogo');

  var catData = catalogo.getDataRange().getValues();
  var movData = movSheet  ? movSheet.getDataRange().getValues()  : [];
  var merData = mermaSheet ? mermaSheet.getDataRange().getValues() : [];

  // Build stock map from movements (skip header row)
  var stockMap = {};
  for (var i = 1; i < movData.length; i++) {
    var prod = String(movData[i][5]).trim().toLowerCase();
    var tipo = String(movData[i][3]).trim();
    var qty  = Number(movData[i][6]) || 0;
    if (!prod) continue;
    if (!stockMap[prod]) stockMap[prod] = 0;
    stockMap[prod] += (tipo === 'Entrada' ? qty : -qty);
  }

  // Subtract mermas
  for (var i = 1; i < merData.length; i++) {
    var prodM = String(merData[i][4]).trim().toLowerCase();
    var qtyM  = Number(merData[i][5]) || 0;
    if (!prodM) continue;
    if (!stockMap[prodM]) stockMap[prodM] = 0;
    stockMap[prodM] -= qtyM;
  }

  // Update catalog col F (index 5) = stockActual
  var updated = 0;
  for (var i = 1; i < catData.length; i++) {
    var prod = String(catData[i][2]).trim().toLowerCase();
    if (!prod) continue;
    var newStock = Math.max(0, stockMap[prod] || 0);
    catalogo.getRange(i + 1, 6).setValue(newStock);
    updated++;
  }

  return respond(true, null, { updated: updated });
}

// ─── Send Report (employee → boss via WhatsApp) ───────────────────────────────

/**
 * Called when an employee taps "Enviar reporte" or "📢 Urgente" in the app.
 * data.reportType: 'daily' | 'urgent'
 * data.empleado:   employee name
 * data.mensaje:    pre-formatted message body from the frontend
 */
function handleSendReport(ss, data) {
  if (!REPORT_CONFIG.ENABLED) {
    return respond(false, 'Reportes WhatsApp no están activados. Configura REPORT_APIKEY en Code.gs y pon ENABLED: true.');
  }
  if (!data.mensaje) return respond(false, 'Sin mensaje');

  var result = enviarReporteWhatsApp(data.mensaje);
  if (result) {
    // Log to bitácora
    var fecha = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
    var hora  = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
    var tipo  = data.reportType === 'urgent' ? 'alerta' : 'reporte';
    var bit   = ss.getSheetByName(SHEET.bitacora);
    if (bit) {
      bit.appendRow([fecha, hora, data.empleado || 'App', 'Reporte WhatsApp enviado', data.reportType || 'daily', tipo]);
    }
    return respond(true, null, { sent: true });
  } else {
    return respond(false, 'Error al enviar WhatsApp. Verifica REPORT_APIKEY.');
  }
}

/**
 * Sends a WhatsApp message to the boss via CallMeBot (report channel).
 * Returns true on success, false on error.
 */
function enviarReporteWhatsApp(mensaje) {
  if (!REPORT_CONFIG.REPORT_PHONE || !REPORT_CONFIG.REPORT_APIKEY) return false;
  try {
    var encoded = encodeURIComponent(mensaje);
    var url = 'https://api.callmebot.com/whatsapp.php'
      + '?phone='  + REPORT_CONFIG.REPORT_PHONE
      + '&text='   + encoded
      + '&apikey=' + REPORT_CONFIG.REPORT_APIKEY;
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var code = response.getResponseCode();
    Logger.log('CallMeBot report response: ' + code + ' — ' + response.getContentText().substring(0, 100));
    return code === 200;
  } catch (err) {
    Logger.log('enviarReporteWhatsApp error: ' + err);
    return false;
  }
}

// ─── Stock helper ─────────────────────────────────────────────────────────────

function actualizarStock(ss, producto, delta) {
  if (!producto || delta === 0) return;
  var catalogo = ss.getSheetByName(SHEET.catalogo);
  if (!catalogo) return;

  var data = catalogo.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][2]).trim().toLowerCase() === String(producto).trim().toLowerCase()) {
      var stockActual = Number(data[i][5]) || 0;
      var nuevoStock  = Math.max(0, stockActual + delta);
      catalogo.getRange(i + 1, 6).setValue(nuevoStock);
      break;
    }
  }
}

// ─── Price reference helper (col K = index 10) ───────────────────────────────

function actualizarPrecioRef(ss, producto, precio) {
  if (!producto || !precio || precio <= 0) return;
  var catalogo = ss.getSheetByName(SHEET.catalogo);
  if (!catalogo) return;

  var data = catalogo.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][2]).trim().toLowerCase() === String(producto).trim().toLowerCase()) {
      // Col K = column 11 (1-based)
      catalogo.getRange(i + 1, 11).setValue(precio);
      break;
    }
  }
}

// ─── Response helper ──────────────────────────────────────────────────────────

function respond(success, error, extra) {
  var obj = { success: success };
  if (error) obj.error = error;
  if (extra) {
    for (var k in extra) obj[k] = extra[k];
  }
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SHEET SETUP HELPER
//  Run once to add headers to new columns and create Gastos sheet.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run this function ONCE after deploying v2.1 to:
 *  - Add column headers for J (codigoBarras) and K (precioRef) in Catálogo
 *  - Add column header for K (precioUnit) in Movimientos
 *  - Create '💰 Gastos' sheet with headers if it doesn't exist
 */
function setupV21() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Catálogo — add headers J1 and K1
  var cat = ss.getSheetByName(SHEET.catalogo);
  if (cat) {
    if (!cat.getRange('J1').getValue()) cat.getRange('J1').setValue('codigoBarras');
    if (!cat.getRange('K1').getValue()) cat.getRange('K1').setValue('precioRef');
  }

  // 2. Movimientos — add header K1
  var mov = ss.getSheetByName(SHEET.movimientos);
  if (mov) {
    if (!mov.getRange('K1').getValue()) mov.getRange('K1').setValue('precioUnit');
  }

  // 3. Gastos sheet
  var gastos = ss.getSheetByName(SHEET.gastos);
  if (!gastos) {
    gastos = ss.insertSheet(SHEET.gastos);
    gastos.getRange('A1:J1').setValues([[
      'id', 'fecha', 'hora', 'producto', 'categoria',
      'cantidad', 'precioUnit', 'total', 'proveedor', 'responsable'
    ]]);
    // Freeze header row
    gastos.setFrozenRows(1);
    // Bold header
    gastos.getRange('A1:J1').setFontWeight('bold');
    Logger.log('Hoja Gastos creada');
  } else {
    Logger.log('Hoja Gastos ya existe');
  }

  Logger.log('setupV21 completado OK');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  V2.2 SETUP — Run ONCE after deploying v2.2
//  Adds 'area' column to Catálogo and 'areaDestino' column to Movimientos.
//  Fills all existing products with 'General' as default area.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run this function ONCE after deploying v2.2 to:
 *  - Add column header for L (area) in Catálogo
 *  - Fill existing products with 'General' (default area)
 *  - Add column header for L (areaDestino) in Movimientos
 */
function setupV22() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Catálogo — add header L1 and default 'General' for existing rows
  var cat = ss.getSheetByName(SHEET.catalogo);
  if (cat) {
    var l1 = cat.getRange('L1').getValue();
    if (!l1) {
      cat.getRange('L1').setValue('area');
      cat.getRange('L1').setFontWeight('bold');
    }

    // Fill existing rows with 'General' where column L is empty
    var lastRow = cat.getLastRow();
    if (lastRow > 1) {
      for (var i = 2; i <= lastRow; i++) {
        var existing = cat.getRange(i, 12).getValue(); // col L = column 12
        var producto  = cat.getRange(i, 3).getValue();  // col C = producto name
        if (producto && !existing) {
          cat.getRange(i, 12).setValue('General');
        }
      }
    }
    Logger.log('Catálogo: columna L (area) configurada');
  }

  // 2. Movimientos — add header L1
  var mov = ss.getSheetByName(SHEET.movimientos);
  if (mov) {
    if (!mov.getRange('L1').getValue()) {
      mov.getRange('L1').setValue('areaDestino');
      mov.getRange('L1').setFontWeight('bold');
    }
    Logger.log('Movimientos: columna L (areaDestino) configurada');
  }

  Logger.log('setupV22 completado OK — todos los productos existentes quedan como General');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  V2.3 SETUP — Run ONCE after deploying v2.3
//  Adds 'prioridad' column (M) to Catálogo. Default = 3 for existing products.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run this function ONCE after deploying v2.3 to:
 *  - Add column header M1 = 'prioridad' in Catálogo
 *  - Fill existing products with 3 (medium priority) where column M is empty
 */
function setupV23() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var cat = ss.getSheetByName(SHEET.catalogo);
  if (!cat) { Logger.log('ERROR: No se encontró Catálogo'); return; }

  // Add header M1
  if (!cat.getRange('M1').getValue()) {
    cat.getRange('M1').setValue('prioridad');
    cat.getRange('M1').setFontWeight('bold');
    Logger.log('Header M1 (prioridad) creado');
  }

  // Fill existing rows with default priority 3
  var lastRow = cat.getLastRow();
  var filled  = 0;
  for (var i = 2; i <= lastRow; i++) {
    var producto  = cat.getRange(i, 3).getValue();
    var existing  = cat.getRange(i, 13).getValue(); // col M = column 13
    if (producto && (existing === '' || existing === null || existing === undefined)) {
      cat.getRange(i, 13).setValue(3);
      filled++;
    }
  }

  Logger.log('setupV23 completado OK — ' + filled + ' productos con prioridad 3 por defecto');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  V2.4 SETUP — Run ONCE after deploying v2.4
//  Creates '🏪 Proveedores' and '🛒 Pedidos' sheets.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run this function ONCE after deploying v2.4 to:
 *  - Create '🏪 Proveedores' sheet with headers
 *  - Create '🛒 Pedidos' sheet with headers
 */
function setupV24() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Proveedores sheet
  var provSheet = ss.getSheetByName('🏪 Proveedores');
  if (!provSheet) {
    provSheet = ss.insertSheet('🏪 Proveedores');
    provSheet.getRange('A1:E1').setValues([[
      'id', 'nombre', 'telefono', 'contacto', 'notas'
    ]]);
    provSheet.setFrozenRows(1);
    provSheet.getRange('A1:E1').setFontWeight('bold');
    provSheet.setColumnWidth(1, 80);
    provSheet.setColumnWidth(2, 180);
    provSheet.setColumnWidth(3, 150);
    provSheet.setColumnWidth(4, 150);
    provSheet.setColumnWidth(5, 200);
    Logger.log('Hoja Proveedores creada');
  } else {
    Logger.log('Hoja Proveedores ya existe');
  }

  // 2. Pedidos sheet
  var pedSheet = ss.getSheetByName('🛒 Pedidos');
  if (!pedSheet) {
    pedSheet = ss.insertSheet('🛒 Pedidos');
    pedSheet.getRange('A1:J1').setValues([[
      'id', 'fecha', 'proveedor', 'producto', 'cantidad',
      'unidad', 'precioRef', 'estado', 'fechaRecibido', 'responsable'
    ]]);
    pedSheet.setFrozenRows(1);
    pedSheet.getRange('A1:J1').setFontWeight('bold');
    pedSheet.setColumnWidth(1, 80);
    pedSheet.setColumnWidth(2, 100);
    pedSheet.setColumnWidth(3, 160);
    pedSheet.setColumnWidth(4, 200);
    pedSheet.setColumnWidth(8, 120);
    Logger.log('Hoja Pedidos creada');
  } else {
    Logger.log('Hoja Pedidos ya existe');
  }

  Logger.log('setupV24 completado OK');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  NOTIFICATION TRIGGERS
//  Set these up in Apps Script > Triggers as time-based functions.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Daily stock alert — run via time-based trigger (e.g. every day at 8am).
 * Sends an email summary + WhatsApp message (via CallMeBot) when stock is low.
 *
 * Setup:
 *   1. Set ADMIN_EMAIL below.
 *   2. For WhatsApp, register at callmebot.com and set CALLMEBOT_PHONE + CALLMEBOT_APIKEY.
 *   3. In Apps Script → Triggers → Add Trigger:
 *      Function: checkStockBajo | Event: Time-driven | Day timer | 8am–9am
 */
var CONFIG = {
  ADMIN_EMAIL:       'admin@mozzafiato.com',  // ← change this
  CALLMEBOT_PHONE:   '',                       // ← e.g. '+521234567890' (stock alerts)
  CALLMEBOT_APIKEY:  '',                       // ← from callmebot.com  (stock alerts)
  SEND_WHATSAPP:     false,                    // ← set true when ready
  SEND_EMAIL:        true,
};

// ─── Report WhatsApp config (employee → boss) ─────────────────────────────────
// This is a SEPARATE CallMeBot registration for receiving employee reports.
// Register your personal number at https://www.callmebot.com/blog/free-api-whatsapp-messages/
// then fill in REPORT_PHONE and REPORT_APIKEY below.

var REPORT_CONFIG = {
  REPORT_PHONE:    '+529832079693',  // ← your WhatsApp number with country code
  REPORT_APIKEY:   '',               // ← API key from callmebot.com for this number
  ENABLED:         false,            // ← set true once you have the API key
};

function checkStockBajo() {
  var ss       = SpreadsheetApp.getActiveSpreadsheet();
  var catalogo = ss.getSheetByName(SHEET.catalogo);
  if (!catalogo) return;

  var data    = catalogo.getDataRange().getValues();
  var bajitos = [];

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][6] || 'SI').trim().toUpperCase() === 'NO') continue;
    var producto  = data[i][2];
    var minimo    = Number(data[i][4]) || 0;
    var actual    = Number(data[i][5]) || 0;
    var precioRef = Number(data[i][10]) || 0;
    if (!producto || minimo === 0) continue;
    if (actual < minimo) {
      var faltante = minimo - actual;
      bajitos.push({
        producto:  producto,
        categoria: data[i][1],
        proveedor: data[i][7],
        actual:    actual,
        minimo:    minimo,
        faltante:  faltante,
        unidad:    data[i][3],
        est:       precioRef > 0 ? faltante * precioRef : 0,
      });
    }
  }

  if (!bajitos.length) return;

  var fechaStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
  var msg = '🛒 STOCK BAJO - ' + fechaStr + '\nAlmacén Mozzafiato\n━━━━━━━━━━━━━━━━━\n\n';

  // Total presupuesto
  var totalEst = bajitos.reduce(function(s, p) { return s + p.est; }, 0);

  // Group by proveedor
  var byProv = {};
  bajitos.forEach(function(p) {
    if (!byProv[p.proveedor]) byProv[p.proveedor] = [];
    byProv[p.proveedor].push(p);
  });

  Object.keys(byProv).sort().forEach(function(prov) {
    var provEst = byProv[prov].reduce(function(s, p) { return s + p.est; }, 0);
    msg += '🏪 ' + prov.toUpperCase() + (provEst > 0 ? ' (est. $' + provEst.toFixed(2) + ')' : '') + '\n';
    byProv[prov].forEach(function(p) {
      var estStr = p.est > 0 ? ' ≈ $' + p.est.toFixed(2) : '';
      msg += '  ▫ ' + p.producto + ' — Comprar: ' + p.faltante + ' ' + p.unidad +
             estStr + ' (Stock: ' + p.actual + '/' + p.minimo + ')\n';
    });
    msg += '\n';
  });

  if (totalEst > 0) msg += '💰 Presupuesto estimado: $' + totalEst.toFixed(2) + '\n';
  msg += 'Total: ' + bajitos.length + ' productos';

  // Send Email
  if (CONFIG.SEND_EMAIL && CONFIG.ADMIN_EMAIL) {
    try {
      MailApp.sendEmail({
        to:      CONFIG.ADMIN_EMAIL,
        subject: '🛒 Stock Bajo — Almacén Mozzafiato (' + bajitos.length + ' productos)',
        body:    msg,
      });
    } catch (err) {
      Logger.log('Email error: ' + err);
    }
  }

  // Send WhatsApp via CallMeBot
  if (CONFIG.SEND_WHATSAPP && CONFIG.CALLMEBOT_PHONE && CONFIG.CALLMEBOT_APIKEY) {
    try {
      var encoded = encodeURIComponent(msg);
      var url = 'https://api.callmebot.com/whatsapp.php?phone=' + CONFIG.CALLMEBOT_PHONE +
                '&text=' + encoded + '&apikey=' + CONFIG.CALLMEBOT_APIKEY;
      UrlFetchApp.fetch(url);
    } catch (err) {
      Logger.log('WhatsApp error: ' + err);
    }
  }

  Logger.log('Stock alert sent for ' + bajitos.length + ' products.');
}
