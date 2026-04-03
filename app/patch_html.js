const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');
console.log('Original length:', html.length);

// ── STEP 1: Replace Chat screen header ──
const chatScreenStart = html.indexOf('  <div class="screen" id="screen-chat">');
const mainMarker = '    <main class="chat-canvas" id="chat-messages">';
const mainStart = html.indexOf(mainMarker);

if (chatScreenStart === -1 || mainStart === -1) {
  console.log('ERROR Step 1: markers not found', chatScreenStart, mainStart);
  process.exit(1);
}

const newHeader = [
  '  <div class="screen" id="screen-chat">',
  '    <header class="top-bar glass">',
  '      <div class="top-bar-left">',
  '        <div class="avatar-orb">',
  '          <span class="mat-icon fill">auto_awesome</span>',
  '        </div>',
  '        <div>',
  '          <h1 class="app-title">Rou Rou</h1>',
  '          <div class="status-row">',
  '            <span class="status-dot"></span>',
  '            <span class="status-label">\u966a\u4f34\u4e2d</span>',
  '            <span class="divider-v"></span>',
  '            <span class="mode-label" id="chat-mode-label">\u6a21\u5f0f\uff1a\u81ea\u7136\u804a\u5929</span>',
  '          </div>',
  '        </div>',
  '      </div>',
  '      <div style="display:flex;align-items:center;gap:8px">',
  '        <button id="memory-badge-wrap" class="memory-badge-btn" onclick="toggleMemoryDrawer()" style="display:none">',
  '          <span class="mat-icon fill" style="font-size:16px">psychology</span>',
  '          <span id="memory-badge-count">0</span> \u4ef6\u8a18\u61b6',
  '        </button>',
  "        <button class=\"icon-btn\" onclick=\"showScreen('screen-settings')\">",
  '          <span class="mat-icon">settings_heart</span>',
  '        </button>',
  '      </div>',
  '    </header>',
  '',
  '    <!-- Memory Drawer -->',
  '    <div id="memory-drawer" class="memory-drawer" style="display:none">',
  '      <div class="memory-drawer-header">',
  '        <div class="memory-drawer-title"><span class="mat-icon fill">psychology</span> Rou Rou \u8a18\u5f97\u7684\u4e8b</div>',
  '        <button class="icon-btn" onclick="toggleMemoryDrawer()"><span class="mat-icon">close</span></button>',
  '      </div>',
  '      <div id="memory-drawer-content" class="memory-drawer-content">',
  '        <div class="mem-empty"><span class="mat-icon">psychology</span><p>\u958b\u59cb\u804a\u5929\u5f8c\uff0cRou Rou \u6703\u6162\u6162\u8a18\u4f4f\u4f60\u7684\u4e8b \uD83C\uDF31</p></div>',
  '      </div>',
  '    </div>',
  '',
  '    <main class="chat-canvas" id="chat-messages">',
  ''
].join('\n');

html = html.slice(0, chatScreenStart) + newHeader + html.slice(mainStart + mainMarker.length);
console.log('Step 1 done. Length:', html.length);

// ── STEP 2: Add 認識你 tab button ──
// Find the closing </div> of report-tabs
const tabsStart = html.indexOf('class="report-tabs glass"');
if (tabsStart === -1) {
  console.log('WARNING Step 2: report-tabs not found');
} else {
  // Find the </div> that closes the tabs container
  // Strategy: find 'manual' tab button, then find closing </div>
  const manualBtnIdx = html.indexOf("switchReportTab('manual')", tabsStart);
  if (manualBtnIdx === -1) {
    console.log('WARNING Step 2: manual tab not found');
  } else {
    // Find end of the button </button> and then the next </div>
    const btnClose = html.indexOf('</button>', manualBtnIdx) + '</button>'.length;
    const divClose = html.indexOf('</div>', btnClose);
    
    const newTabBtn = [
      '',
          '          <button class="report-tab" onclick="switchReportTab(\'know\')">',
          '            <span class="mat-icon">psychology</span>',
          '            \u8a8d\u8b58\u4f60',
          '          </button>'
    ].join('\n');
    
    html = html.slice(0, divClose) + newTabBtn + '\n        ' + html.slice(divClose);
    console.log('Step 2 done.');
  }
}

// ── STEP 3: Add know-you tab content ──
const knowTabHtml = [
  '',
  '      <!-- TAB: KNOW YOU -->',
  '      <div id="report-tab-know" class="report-tab-content">',
  '        <section class="card-section" style="padding-bottom: 24px">',
  '          <div class="section-label">THERAPEUTIC MEMORY</div>',
  '          <h3 class="section-heading">Rou Rou \u8a8d\u8b58\u4f60</h3>',
  '          <p class="greeting-sub">\u9019\u662f Rou Rou \u5f9e\u5c0d\u8a71\u4e2d\u7d2f\u7a4d\u7684\u5fc3\u7406\u756b\u50cf\uff0c\u8d8a\u804a\u8d8a\u6e96\u78ba\u3002</p>',
  '          <div id="report-know-you-card" class="know-you-card">',
  '            <div class="know-you-empty">',
  '              <span class="mat-icon">psychology</span>',
  '              <p>\u9084\u6c92\u6709\u8db3\u5920\u7684\u5c0d\u8a71\u8cc7\u6599<br>\u958b\u59cb\u804a\u5929\u5f8c\uff0c\u9019\u88e1\u6703\u51fa\u73fe Rou Rou \u5c0d\u4f60\u7684\u8a8d\u8b58</p>',
  '            </div>',
  '          </div>',
  '        </section>',
  '      </div>',
  ''
].join('\n');

const reportScreenIdx = html.indexOf('id="screen-report"');
if (reportScreenIdx === -1) {
  console.log('WARNING Step 3: screen-report not found');
} else {
  const mainCloseMarker = '    </main>';
  const mainCloseIdx = html.indexOf(mainCloseMarker, reportScreenIdx);
  if (mainCloseIdx === -1) {
    console.log('WARNING Step 3: </main> not found');
  } else {
    html = html.slice(0, mainCloseIdx) + knowTabHtml + html.slice(mainCloseIdx);
    console.log('Step 3 done.');
  }
}

fs.writeFileSync('index.html', html, 'utf8');
console.log('Final length:', html.length, 'File saved.');
