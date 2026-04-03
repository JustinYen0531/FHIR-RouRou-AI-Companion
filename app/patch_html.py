import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

print(f'Original length: {len(html)}')

# ── STEP 1: Replace Chat screen header ──
old_header_start = '  <div class="screen" id="screen-chat">'
old_header_end_marker = '    <main class="chat-canvas" id="chat-messages">'

start_idx = html.find(old_header_start)
end_idx = html.find(old_header_end_marker)

if start_idx == -1 or end_idx == -1:
    print('ERROR: could not find chat header boundaries')
    print(f'  start_idx={start_idx}, end_idx={end_idx}')
else:
    new_header = (
        '  <div class="screen" id="screen-chat">\n'
        '    <header class="top-bar glass">\n'
        '      <div class="top-bar-left">\n'
        '        <div class="avatar-orb">\n'
        '          <span class="mat-icon fill">auto_awesome</span>\n'
        '        </div>\n'
        '        <div>\n'
        '          <h1 class="app-title">Rou Rou</h1>\n'
        '          <div class="status-row">\n'
        '            <span class="status-dot"></span>\n'
        '            <span class="status-label">\u966a\u4f34\u4e2d</span>\n'
        '            <span class="divider-v"></span>\n'
        '            <span class="mode-label" id="chat-mode-label">\u6a21\u5f0f\uff1a\u81ea\u7136\u804a\u5929</span>\n'
        '          </div>\n'
        '        </div>\n'
        '      </div>\n'
        '      <div style="display:flex;align-items:center;gap:8px">\n'
        '        <button id="memory-badge-wrap" class="memory-badge-btn" onclick="toggleMemoryDrawer()" style="display:none">\n'
        '          <span class="mat-icon fill" style="font-size:16px">psychology</span>\n'
        '          <span id="memory-badge-count">0</span> \u4ef6\u8a18\u61b6\n'
        '        </button>\n'
        "        <button class=\"icon-btn\" onclick=\"showScreen('screen-settings')\">\n"
        '          <span class="mat-icon">settings_heart</span>\n'
        '        </button>\n'
        '      </div>\n'
        '    </header>\n'
        '\n'
        '    <!-- Memory Drawer -->\n'
        '    <div id="memory-drawer" class="memory-drawer" style="display:none">\n'
        '      <div class="memory-drawer-header">\n'
        '        <div class="memory-drawer-title"><span class="mat-icon fill">psychology</span> Rou Rou \u8a18\u5f97\u7684\u4e8b</div>\n'
        '        <button class="icon-btn" onclick="toggleMemoryDrawer()"><span class="mat-icon">close</span></button>\n'
        '      </div>\n'
        '      <div id="memory-drawer-content" class="memory-drawer-content">\n'
        '        <div class="mem-empty"><span class="mat-icon">psychology</span><p>\u958b\u59cb\u804a\u5929\u5f8c\uff0cRou Rou \u6703\u6162\u6162\u8a18\u4f4f\u4f60\u7684\u4e8b \U0001f331</p></div>\n'
        '      </div>\n'
        '    </div>\n'
        '\n'
        '    <main class="chat-canvas" id="chat-messages">\n'
    )
    html = html[:start_idx] + new_header + html[end_idx + len(old_header_end_marker):]
    print(f'Step 1 done. Length now: {len(html)}')

# ── STEP 2: Add "認識你" tab button ──
manual_tab_marker = 'switchReportTab(\'manual\')'
if manual_tab_marker not in html:
    # try double-quote version
    manual_tab_marker = 'switchReportTab("manual")'

tab_idx = html.find(manual_tab_marker)
if tab_idx == -1:
    print('WARNING Step 2: manual tab button not found')
else:
    # Find the </div> closing the tabs container (after this tab button)
    tabs_container_close = html.find('</div>', tab_idx)
    new_tab_btn = (
        '\n          <button class="report-tab" onclick="switchReportTab(\'know\')">\n'
        '            <span class="mat-icon">psychology</span>\n'
        '            \u8a8d\u8b58\u4f60\n'
        '          </button>'
    )
    html = html[:tabs_container_close] + new_tab_btn + '\n        ' + html[tabs_container_close:]
    print('Step 2 done.')

# ── STEP 3: Add know-you tab content before </main> of report screen ──
know_tab_html = (
    '\n'
    '      <!-- TAB: KNOW YOU -->\n'
    '      <div id="report-tab-know" class="report-tab-content">\n'
    '        <section class="card-section" style="padding-bottom: 24px">\n'
    '          <div class="section-label">THERAPEUTIC MEMORY</div>\n'
    '          <h3 class="section-heading">Rou Rou \u8a8d\u8b58\u4f60</h3>\n'
    '          <p class="greeting-sub">\u9019\u662f Rou Rou \u5f9e\u5c0d\u8a71\u4e2d\u7d2f\u7a4d\u7684\u5fc3\u7406\u756b\u50cf\uff0c\u8d8a\u804a\u8d8a\u6e96\u78ba\u3002</p>\n'
    '          <div id="report-know-you-card" class="know-you-card">\n'
    '            <div class="know-you-empty">\n'
    '              <span class="mat-icon">psychology</span>\n'
    '              <p>\u9084\u6c92\u6709\u8db3\u5920\u7684\u5c0d\u8a71\u8cc7\u6599<br>\u958b\u59cb\u804a\u5929\u5f8c\uff0c\u9019\u88e1\u6703\u51fa\u73fe Rou Rou \u5c0d\u4f60\u7684\u8a8d\u8b58</p>\n'
    '            </div>\n'
    '          </div>\n'
    '        </section>\n'
    '      </div>\n'
)

# Find the </main> tag inside screen-report
report_screen_idx = html.find('id="screen-report"')
if report_screen_idx == -1:
    print('WARNING Step 3: screen-report not found')
else:
    main_close_idx = html.find('    </main>', report_screen_idx)
    if main_close_idx == -1:
        print('WARNING Step 3: </main> not found in report screen')
    else:
        html = html[:main_close_idx] + know_tab_html + html[main_close_idx:]
        print('Step 3 done.')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print(f'Final length: {len(html)}. File saved.')
