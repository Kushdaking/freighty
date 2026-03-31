/**
 * eBOL PDF Generator
 * Generates a printable BOL PDF from BOL JSON data using expo-print.
 * Install: expo install expo-print expo-sharing
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export interface BOLVehicle {
  vin: string;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  color?: string | null;
  condition: string;
  is_operable: boolean;
  odometer?: string;
  damages?: { area: string; type: string; notes: string }[];
  vinMismatch?: string;
}

export interface BOLData {
  bolType: 'pickup' | 'delivery';
  trackingNumber: string;
  shipmentId: string;
  createdAt: string;

  origin: {
    address: string;
    city: string;
    state: string;
    zip?: string;
    contactName?: string;
    contactPhone?: string;
  };

  destination: {
    address: string;
    city: string;
    state: string;
    zip?: string;
    contactName?: string;
    contactPhone?: string;
  };

  carrier: {
    name: string;
    company?: string;
    mcNumber?: string;
    dotNumber?: string;
    phone?: string;
  };

  vehicles: BOLVehicle[];

  carrierSignature?: string | null; // base64 image
  customerSignature?: string | null; // base64 image
  customerName?: string;

  notes?: string;
  scheduledPickup?: string;
  estimatedDelivery?: string;
  transportType?: string;
  totalPrice?: number;
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function vehicleTitle(v: BOLVehicle) {
  const parts = [v.year, v.make, v.model].filter(Boolean).join(' ');
  return parts || 'Unknown Vehicle';
}

function generateHTML(data: BOLData): string {
  const isPickup = data.bolType === 'pickup';

  const vehicleRows = data.vehicles.map((v, idx) => {
    const damages = (v.damages ?? [])
      .map(d => `<li>${d.area} — ${d.type}${d.notes ? `: ${d.notes}` : ''}</li>`)
      .join('');

    return `
      <div class="vehicle-card">
        <div class="vehicle-header">
          <span class="vehicle-num">Vehicle ${idx + 1}</span>
          <span class="vehicle-title">${vehicleTitle(v)}</span>
          <span class="vehicle-status ${v.is_operable ? 'op' : 'inop'}">${v.is_operable ? 'OPERABLE' : 'INOPERABLE'}</span>
        </div>
        <div class="vehicle-body">
          <table class="detail-table">
            <tr>
              <td class="lbl">VIN</td>
              <td class="val mono">${v.vin}${v.vinMismatch ? `<span class="mismatch"> ⚠ Mismatch: ${v.vinMismatch}</span>` : ''}</td>
              <td class="lbl">Condition</td>
              <td class="val">${v.condition}</td>
            </tr>
            <tr>
              <td class="lbl">Year/Make/Model</td>
              <td class="val">${vehicleTitle(v)}</td>
              <td class="lbl">Color</td>
              <td class="val">${v.color || '—'}</td>
            </tr>
            <tr>
              <td class="lbl">Odometer</td>
              <td class="val">${v.odometer || '—'}</td>
              <td class="lbl">Operable</td>
              <td class="val">${v.is_operable ? 'Yes' : 'No'}</td>
            </tr>
          </table>
          ${damages ? `<div class="damages"><strong>Damage Notes:</strong><ul>${damages}</ul></div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  const sigBlock = (label: string, sig?: string | null, name?: string) => `
    <div class="sig-block">
      <div class="sig-label">${label}</div>
      ${sig
        ? `<img src="${sig}" class="sig-image" />`
        : `<div class="sig-empty">[ Signature Required ]</div>`
      }
      <div class="sig-line">${name || '_________________________'}</div>
      <div class="sig-name-label">Printed Name / Date</div>
    </div>
  `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bill of Lading — ${data.trackingNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 12px;
    color: #1a1a2e;
    background: #fff;
    padding: 20px 28px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid #1d3a8f;
    padding-bottom: 14px;
    margin-bottom: 18px;
  }
  .brand { display: flex; flex-direction: column; }
  .brand-name { font-size: 22px; font-weight: 900; color: #1d3a8f; letter-spacing: -0.5px; }
  .brand-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
  .doc-info { text-align: right; }
  .doc-type { font-size: 18px; font-weight: 800; color: #1d3a8f; }
  .doc-num { font-size: 13px; font-weight: 700; color: #374151; margin-top: 2px; }
  .doc-date { font-size: 11px; color: #64748b; margin-top: 2px; }
  .badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 700;
    background: ${isPickup ? '#dbeafe' : '#d1fae5'};
    color: ${isPickup ? '#1d4ed8' : '#065f46'};
    margin-top: 4px;
  }
  .section { margin-bottom: 16px; }
  .section-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #64748b;
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid #e2e8f0;
  }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .address-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px;
  }
  .address-box.highlight { border-color: ${isPickup ? '#bfdbfe' : '#a7f3d0'}; background: ${isPickup ? '#eff6ff' : '#ecfdf5'}; }
  .addr-type { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: ${isPickup ? '#2563eb' : '#059669'}; margin-bottom: 4px; }
  .addr-street { font-size: 13px; font-weight: 600; color: #1e293b; }
  .addr-city { font-size: 12px; color: #475569; margin-top: 2px; }
  .addr-contact { font-size: 11px; color: #64748b; margin-top: 4px; }
  .carrier-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px;
  }
  .detail-table { width: 100%; border-collapse: collapse; }
  .detail-table td { padding: 5px 6px; font-size: 11px; }
  .lbl { color: #64748b; font-weight: 600; width: 22%; }
  .val { color: #1e293b; font-weight: 500; }
  .mono { font-family: 'Courier New', monospace; font-size: 11px; letter-spacing: 0.5px; }
  .mismatch { color: #dc2626; font-size: 10px; font-weight: 700; }
  .vehicle-card {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    margin-bottom: 10px;
    overflow: hidden;
  }
  .vehicle-header {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #1e293b;
    padding: 8px 12px;
    color: #fff;
  }
  .vehicle-num { font-size: 10px; font-weight: 700; color: #94a3b8; }
  .vehicle-title { font-size: 13px; font-weight: 700; flex: 1; }
  .vehicle-status { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
  .vehicle-status.op { background: rgba(22,163,74,0.3); color: #86efac; }
  .vehicle-status.inop { background: rgba(220,38,38,0.3); color: #fca5a5; }
  .vehicle-body { padding: 10px 12px; }
  .damages { margin-top: 8px; font-size: 11px; }
  .damages ul { padding-left: 16px; margin-top: 4px; color: #dc2626; }
  .sig-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 2px solid #1d3a8f;
  }
  .sig-block { display: flex; flex-direction: column; gap: 6px; }
  .sig-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
  .sig-image { max-height: 70px; max-width: 200px; border: 1px solid #e2e8f0; border-radius: 4px; }
  .sig-empty { height: 60px; border: 1px dashed #cbd5e1; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 11px; }
  .sig-line { border-bottom: 1px solid #334155; padding-bottom: 2px; font-size: 12px; color: #1e293b; min-height: 24px; }
  .sig-name-label { font-size: 10px; color: #94a3b8; }
  .footer { margin-top: 16px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
  .terms { font-size: 9px; color: #cbd5e1; margin-top: 6px; line-height: 1.4; }
  .notes-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 10px; font-size: 11px; color: #92400e; }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div class="brand">
    <div class="brand-name">🚛 Freight Flow</div>
    <div class="brand-sub">Vehicle Transport Platform</div>
  </div>
  <div class="doc-info">
    <div class="doc-type">BILL OF LADING</div>
    <div class="doc-num">${data.trackingNumber}</div>
    <div class="doc-date">${formatDate(data.createdAt)}</div>
    <div class="badge">${isPickup ? '📦 PICKUP' : '🏁 DELIVERY'}</div>
  </div>
</div>

<!-- Route -->
<div class="section">
  <div class="section-title">Shipment Route</div>
  <div class="grid-2">
    <div class="address-box highlight">
      <div class="addr-type">📍 Origin (Pickup)</div>
      <div class="addr-street">${data.origin.address}</div>
      <div class="addr-city">${data.origin.city}, ${data.origin.state}${data.origin.zip ? ' ' + data.origin.zip : ''}</div>
      ${data.origin.contactName ? `<div class="addr-contact">Contact: ${data.origin.contactName}${data.origin.contactPhone ? ` · ${data.origin.contactPhone}` : ''}</div>` : ''}
      ${data.scheduledPickup ? `<div class="addr-contact">Scheduled: ${formatDate(data.scheduledPickup)}</div>` : ''}
    </div>
    <div class="address-box">
      <div class="addr-type">🏁 Destination (Delivery)</div>
      <div class="addr-street">${data.destination.address}</div>
      <div class="addr-city">${data.destination.city}, ${data.destination.state}${data.destination.zip ? ' ' + data.destination.zip : ''}</div>
      ${data.destination.contactName ? `<div class="addr-contact">Contact: ${data.destination.contactName}${data.destination.contactPhone ? ` · ${data.destination.contactPhone}` : ''}</div>` : ''}
      ${data.estimatedDelivery ? `<div class="addr-contact">Est. Delivery: ${formatDate(data.estimatedDelivery)}</div>` : ''}
    </div>
  </div>
</div>

<!-- Carrier -->
<div class="section">
  <div class="section-title">Carrier Information</div>
  <div class="carrier-box">
    <table class="detail-table">
      <tr>
        <td class="lbl">Driver</td>
        <td class="val">${data.carrier.name}</td>
        <td class="lbl">Company</td>
        <td class="val">${data.carrier.company || '—'}</td>
      </tr>
      <tr>
        <td class="lbl">MC Number</td>
        <td class="val">${data.carrier.mcNumber || '—'}</td>
        <td class="lbl">DOT Number</td>
        <td class="val">${data.carrier.dotNumber || '—'}</td>
      </tr>
      <tr>
        <td class="lbl">Phone</td>
        <td class="val">${data.carrier.phone || '—'}</td>
        <td class="lbl">Transport Type</td>
        <td class="val">${data.transportType || '—'}</td>
      </tr>
    </table>
  </div>
</div>

<!-- Vehicles -->
<div class="section">
  <div class="section-title">Vehicles (${data.vehicles.length})</div>
  ${vehicleRows}
</div>

${data.notes ? `
<div class="section">
  <div class="section-title">Notes</div>
  <div class="notes-box">${data.notes}</div>
</div>
` : ''}

<!-- Signatures -->
<div class="sig-row">
  ${sigBlock('Carrier Signature', data.carrierSignature)}
  ${sigBlock(isPickup ? 'Shipper Signature' : 'Consignee Signature', data.customerSignature, data.customerName)}
</div>

<div class="footer">
  <div>Freight Flow Vehicle Transport · ${data.trackingNumber} · Generated ${formatDate(new Date().toISOString())}</div>
  <div class="terms">
    By signing this Bill of Lading, the carrier acknowledges receipt of the described vehicles in the noted condition. 
    The shipper/consignee acknowledges release and accepts the condition documented herein. 
    This document serves as legal evidence of the vehicle's condition at the time of ${isPickup ? 'pickup' : 'delivery'}.
  </div>
</div>

</body>
</html>
  `;
}

/**
 * Generate and share a BOL PDF.
 * @param data BOL data object
 * @param options Optional: { open: true } to open PDF immediately, { save: true } to save to files
 */
export async function generateAndShareBOL(
  data: BOLData,
  options: { save?: boolean } = {}
): Promise<string> {
  const html = generateHTML(data);

  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  if (options.save || (await Sharing.isAvailableAsync())) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `BOL ${data.trackingNumber}`,
      UTI: 'com.adobe.pdf',
    });
  }

  return uri;
}

/**
 * Open the native print dialog for a BOL.
 */
export async function printBOL(data: BOLData): Promise<void> {
  const html = generateHTML(data);
  await Print.printAsync({ html });
}
