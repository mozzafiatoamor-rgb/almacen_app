// ═══════════════════════════════════════════════════════════════════════════════
//  Almacén Mozzafiato — Google Apps Script Backend v2.1
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
};

// ─── Health check ─────────────────────────────────────────────────────────────

function doGet(e) {
  return respond(true, null, { status: 'ok', message: 'Almacén API v2.1 OK' });
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

function doPost(e) {
  try {
    var data   = JSON.parse(e.postData.contents);
    var action = data.action || '';
    var ss     = SpreadsheetApp.getActiveSpreadsheet();

    switch (action) {
      case 'append':    return handleAppend(ss, data);
      case 'delete':    return handleDelete(ss, data);
      case 'update':    return handleUpdate(ss, data);
      case 'reconcile': return handleReconcile(ss);
      default:          return respond(false, 'Acción no reconocida: ' + action);
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
    var tipo      = data.values[3];
    var producto  = data.values[5];
    var cantidad  = Number(data.values[6]) || 0;
    var precioUnit = data.values.length > 10 ? Number(data.values[10]) : 0;

    actualizarStock(ss, producto, tipo === 'Entrada' ? cantidad : -cantidad);

    // If this is an Entrada with a price, update precioRef in Catálogo (col K = index 10)
    if (tipo === 'Entrada' && precioUnit > 0) {
      actualizarPrecioRef(ss, producto, precioUnit);
    }
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
  CALLMEBOT_PHONE:   '',                       // ← e.g. '+521234567890'
  CALLMEBOT_APIKEY:  '',                       // ← from callmebot.com
  SEND_WHATSAPP:     false,                    // ← set true when ready
  SEND_EMAIL:        true,
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
